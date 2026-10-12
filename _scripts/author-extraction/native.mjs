import Ajv2020 from "ajv/dist/2020.js";
import extractionSchema from "./extraction.schema.json" with { type: "json" };

const CORE_ERROR_CODES = new Set([
  "CORE_INVALID_ARGUMENT",
  "UNKNOWN_ARTICLE",
  "CORPUS_INVALID",
  "SOURCE_BOUNDARY",
  "SOURCE_INVALID",
  "LIMIT_EXCEEDED",
  "INPUT_CHANGED",
  "CANDIDATE_JSON_INVALID",
  "CANDIDATE_SCHEMA_INVALID",
  "NO_OBSERVATIONS",
  "COVERAGE_INVALID",
  "EVIDENCE_INVALID",
  "FINAL_SCHEMA_INVALID",
  "INTERNAL_ERROR",
]);
const NATIVE_ERROR_CODES = new Set([
  "AGENT_DENIED",
  "PROTOCOL_INVALID",
  "ATTEMPT_LIMIT",
  "CANCELLED",
]);
const ARTICLE_IDS = new Set(extractionSchema.$defs.PrepareInput.properties.article_id.enum);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const localSchema = {
  $schema: extractionSchema.$schema,
  $defs: extractionSchema.$defs,
};
const validatePrepareInput = ajv.compile({
  ...localSchema,
  $ref: "#/$defs/PrepareInput",
});
const validateSubmitInput = ajv.compile({
  ...localSchema,
  $ref: "#/$defs/SubmitInput",
});
function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  error.details = [];
  return error;
}

function protocol(message = "The extraction session protocol is invalid.") {
  return failure("PROTOCOL_INVALID", message);
}

function checkContext(context) {
  if (!context || context.agent !== "author-extractor") {
    throw failure("AGENT_DENIED", "Only the author-extractor agent may use extraction tools.");
  }
  if (
    typeof context.sessionId !== "string" ||
    context.sessionId.length === 0
  ) {
    throw protocol("A valid host session ID is required.");
  }
  const signal = context.signal;
  if (
    signal !== undefined &&
    (!signal ||
      typeof signal.aborted !== "boolean" ||
      typeof signal.addEventListener !== "function" ||
      typeof signal.removeEventListener !== "function")
  ) {
    throw protocol("The host cancellation signal is invalid.");
  }
  return { sessionId: context.sessionId, signal };
}

function safelySerialize(value, limit, message) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw failure("INTERNAL_ERROR", "The extraction core returned an unserializable value.");
  }
  if (typeof serialized !== "string") {
    throw failure("INTERNAL_ERROR", "The extraction core returned an invalid value.");
  }
  if (Buffer.byteLength(serialized, "utf8") > limit) {
    throw failure("LIMIT_EXCEEDED", message);
  }
  return serialized;
}

function validateCoreError(error) {
  const code = error && Object.hasOwn(error, "code") ? error.code : undefined;
  const message = error && Object.hasOwn(error, "message") ? error.message : undefined;
  const details = error && Object.hasOwn(error, "details") ? error.details : undefined;
  if (
    !(error instanceof Error) ||
    !CORE_ERROR_CODES.has(code) ||
    typeof message !== "string" ||
    message.length > 240 ||
    !Array.isArray(details) ||
    details.length > 5 ||
    details.some((pointer) => typeof pointer !== "string" || !/^(?:|\/(?:[^~]|~[01])*)$/.test(pointer))
  ) {
    return failure("INTERNAL_ERROR", "The extraction core failed with an invalid error.");
  }
  const safe = new Error(message);
  safe.code = code;
  safe.details = [...details];
  return safe;
}

function coreCall(operation) {
  return Promise.resolve()
    .then(operation)
    .catch((error) => {
      throw validateCoreError(error);
    });
}

function enqueue(state, operation) {
  const result = state.queue.then(operation);
  state.queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function active(state) {
  if (state.status === "aborted") {
    clearSignals(state);
    throw failure("CANCELLED", "The extraction session was cancelled.");
  }
  if (state.status === "sealed") {
    clearSignals(state);
    throw protocol("The extraction session has already been accepted.");
  }
}

function clearSignals(state) {
  for (const [signal, listener] of state.signals) signal.removeEventListener("abort", listener);
  state.signals.clear();
}

function cancelState(state) {
  state.status = "aborted";
  clearSignals(state);
}

function stateFor(states, sessionId) {
  let state = states.get(sessionId);
  if (!state) {
    state = {
      articleId: null,
      inputHash: null,
      attempts: 0,
      status: "active",
      queue: Promise.resolve(),
      signals: new Map(),
    };
    states.set(sessionId, state);
  }
  return state;
}

function bindSignal(state, signal) {
  if (!signal) return;
  if (signal.aborted) {
    cancelState(state);
    throw failure("CANCELLED", "The extraction session was cancelled.");
  }
  if (state.signals.has(signal)) return;
  const listener = () => cancelState(state);
  state.signals.set(signal, listener);
  signal.addEventListener(
    "abort",
    listener,
    { once: true },
  );
}

function validPrepared(prepared, articleId) {
  if (
    !prepared || typeof prepared !== "object" || Array.isArray(prepared) ||
    !prepared.source || typeof prepared.source !== "object" || Array.isArray(prepared.source) ||
    prepared.source.article_id !== articleId ||
    !/^[a-f0-9]{64}$/.test(prepared.input_hash)
  ) {
    throw failure("INTERNAL_ERROR", "The extraction core returned an invalid prepared record.");
  }
  safelySerialize(prepared, 4 * 1024 * 1024, "The prepared record exceeds its size limit.");
}

function validCoreJson(canonicalJson) {
  if (typeof canonicalJson !== "string") {
    throw failure("INTERNAL_ERROR", "The extraction core returned an invalid accepted record.");
  }
  const envelope = { status: "accepted", canonical_json: canonicalJson };
  const serialized = safelySerialize(
    envelope,
    1024 * 1024,
    "The acceptance envelope exceeds its size limit.",
  );
  return envelope;
}

export function createExtractionAdapter(coreApi, repoRoot) {
  if (
    !coreApi ||
    typeof coreApi.prepareArticle !== "function" ||
    typeof coreApi.acceptCandidate !== "function" ||
    typeof repoRoot !== "string" ||
    repoRoot.length === 0
  ) {
    throw new TypeError("A core API and trusted repository root are required.");
  }

  const states = new Map();

  return {
    async prepare(input, context) {
      const { sessionId, signal } = checkContext(context);
      const state = stateFor(states, sessionId);
      active(state);
      bindSignal(state, signal);
      active(state);

      return enqueue(state, async () => {
        active(state);
        if (!validatePrepareInput(input) || !ARTICLE_IDS.has(input.article_id)) {
          throw protocol("The prepare input does not match the extraction contract.");
        }
        if (state.articleId !== null && state.articleId !== input.article_id) {
          throw protocol("An extraction session may prepare only one article.");
        }
        if (state.articleId === null) state.articleId = input.article_id;

        const prepared = await coreCall(() => coreApi.prepareArticle(repoRoot, input.article_id));
        active(state);
        validPrepared(prepared, input.article_id);
        if (state.inputHash !== null && state.inputHash !== prepared.input_hash) {
          throw failure("INPUT_CHANGED", "The prepared source changed during this extraction session.");
        }
        state.inputHash ??= prepared.input_hash;
        return prepared;
      });
    },

    async submit(input, context) {
      const { sessionId, signal } = checkContext(context);
      const state = stateFor(states, sessionId);
      active(state);
      bindSignal(state, signal);
      active(state);
      if (state.attempts >= 2) {
        throw failure("ATTEMPT_LIMIT", "This extraction session has used both submit attempts.");
      }
      state.attempts += 1;

      return enqueue(state, async () => {
        active(state);
        if (!validateSubmitInput(input) || !ARTICLE_IDS.has(input.article_id)) {
          throw protocol("The submit input does not match the extraction contract.");
        }
        if (state.articleId === null || state.inputHash === null) {
          throw protocol("Prepare the article before submitting a candidate.");
        }
        if (input.article_id !== state.articleId || input.input_hash !== state.inputHash) {
          throw protocol("The submitted article and input hash must match the prepared record.");
        }

        const canonicalJson = await coreCall(() =>
          coreApi.acceptCandidate(
            repoRoot,
            state.articleId,
            state.inputHash,
            input.candidate_json,
          ),
        );
        active(state);
        const envelope = validCoreJson(canonicalJson);
        state.status = "sealed";
        clearSignals(state);
        return envelope;
      });
    },

    abort(sessionId) {
      if (typeof sessionId !== "string" || sessionId.length === 0) return;
      const state = stateFor(states, sessionId);
      cancelState(state);
    },
  };
}

export async function loadPluginSDK() {
  return import("@opencode/plugin");
}

export const prepareInputSchema = extractionSchema.$defs.PrepareInput;
export const submitInputSchema = extractionSchema.$defs.SubmitInput;
