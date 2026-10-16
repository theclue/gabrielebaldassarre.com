import Ajv2020 from "ajv/dist/2020.js";
import extractionSchema from "./extraction.v1.2.schema.json" with { type: "json" };

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
  "EVIDENCE_INVALID",
  "FINAL_SCHEMA_INVALID",
  "RECORD_JSON_INVALID",
  "RECORD_SCHEMA_INVALID",
  "RECORD_DERIVED_INVALID",
  "WORKFLOW_RECEIPT_INVALID",
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
const validatePreparedRecord = ajv.compile({
  ...localSchema,
  $ref: "#/$defs/Prepared",
});
const validateFinalRecord = ajv.compile({
  ...localSchema,
  $ref: "#/$defs/FinalRecord",
});
const validateAcceptanceEnvelope = ajv.compile({
  ...localSchema,
  $ref: "#/$defs/AcceptanceEnvelope",
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
    context.sessionId.trim().length === 0 ||
    context.sessionId.length > 256
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
    !validatePreparedRecord(prepared) ||
    prepared.source.article_id !== articleId ||
    !/^[a-f0-9]{64}$/.test(prepared.input_hash)
  ) {
    throw failure("INTERNAL_ERROR", "The extraction core returned an invalid prepared record.");
  }
  safelySerialize(prepared, 4 * 1024 * 1024, "The prepared record exceeds its size limit.");
}

function validCoreJson(canonicalJson, { sessionId, articleId, inputHash, prepared }) {
  if (typeof canonicalJson !== "string") {
    throw failure("INTERNAL_ERROR", "The extraction core returned an invalid accepted record.");
  }
  if (Buffer.byteLength(canonicalJson, "utf8") > 1024 * 1024) {
    throw failure("LIMIT_EXCEEDED", "The acceptance envelope exceeds its size limit.");
  }
  let record;
  try {
    record = JSON.parse(canonicalJson);
  } catch {
    throw failure("RECORD_JSON_INVALID", "The extraction core returned invalid record JSON.");
  }
  if (!validateFinalRecord(record)) {
    throw failure("RECORD_SCHEMA_INVALID", "The extraction core returned a record that does not match the v1.2 schema.");
  }
  const expectedReceipt = {
    workflow_version: "host-session-whole-article/1",
    mode: "whole_article",
    session_id: sessionId,
    article_id: articleId,
    input_hash: inputHash,
    prepare_returned: true,
  };
  const receipt = record.processing.receipt;
  if (
    !receipt ||
    receipt.workflow_version !== expectedReceipt.workflow_version ||
    receipt.mode !== expectedReceipt.mode ||
    receipt.session_id !== expectedReceipt.session_id ||
    receipt.article_id !== expectedReceipt.article_id ||
    receipt.input_hash !== expectedReceipt.input_hash ||
    receipt.prepare_returned !== expectedReceipt.prepare_returned ||
    record.source.article_id !== articleId ||
    record.processing.mode !== "whole_article" ||
    record.processing.status !== "complete" ||
    record.processing.article_processed !== true ||
    record.processing.passages_available !== prepared.passages.length
  ) {
    throw failure("WORKFLOW_RECEIPT_INVALID", "The accepted record does not match the host-tracked whole-article session.");
  }
  const citedPassages = new Set(
    record.observations.flatMap((observation) => observation.evidence.map((evidence) => evidence.passage_id)),
  ).size;
  if (record.processing.passages_cited !== citedPassages) {
    throw failure("RECORD_DERIVED_INVALID", "The accepted record has inconsistent cited-passage counts.");
  }
  const envelope = { status: "accepted", canonical_json: canonicalJson };
  const serialized = safelySerialize(
    envelope,
    1024 * 1024,
    "The acceptance envelope exceeds its size limit.",
  );
  if (!validateAcceptanceEnvelope(envelope)) {
    throw failure("INTERNAL_ERROR", "The extraction core returned an invalid acceptance envelope.");
  }
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

        const prepared = await coreCall(() => coreApi.prepareArticle(repoRoot, input.article_id));
        active(state);
        validPrepared(prepared, input.article_id);
        if (state.inputHash !== null && state.inputHash !== prepared.input_hash) {
          throw failure("INPUT_CHANGED", "The prepared source changed during this extraction session.");
        }
        state.articleId ??= input.article_id;
        state.inputHash ??= prepared.input_hash;
        state.prepared = prepared;
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

        const workflowReceipt = {
          workflow_version: "host-session-whole-article/1",
          mode: "whole_article",
          session_id: sessionId,
          article_id: state.articleId,
          input_hash: state.inputHash,
          prepare_returned: true,
        };
        const canonicalJson = await coreCall(() =>
          coreApi.acceptCandidate(
            repoRoot,
            state.articleId,
            state.inputHash,
            input.candidate_json,
            { workflowReceipt },
          ),
        );
        active(state);
        const envelope = validCoreJson(canonicalJson, {
          sessionId,
          articleId: state.articleId,
          inputHash: state.inputHash,
          prepared: state.prepared,
        });
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
