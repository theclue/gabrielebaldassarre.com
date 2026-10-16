import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";

const HEX = /^[a-f0-9]{64}$/;
const AUTHOR_ID = /^(?:APC::R|[ED]PC:[AET])[0-9]{4}$/;
const SEMANTIC_ID = /^SPC::[CR][0-9]{4}$/;
const LIMIT = 256 * 1024;
const CANDIDATE_LIMIT = 128 * 1024;
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value !== null && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const sha = (text) => createHash("sha256").update(text).digest("hex");

export const modelPrepareInputSchema = {
  type: "object", properties: { include_semantic_context: { type: "boolean" } }, required: [], additionalProperties: false,
};
export const modelSubmitInputSchema = {
  type: "object", additionalProperties: false,
  required: ["source_review_hash", "input_hash", "candidate_json"],
  properties: {
    source_review_hash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    input_hash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    candidate_json: { type: "string", minLength: 1, maxLength: CANDIDATE_LIMIT },
  },
};
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validatePrepare = ajv.compile(modelPrepareInputSchema);
const validateSubmit = ajv.compile(modelSubmitInputSchema);

function failure(code, message, details = []) { return Object.assign(new Error(message), { code, details }); }
function plain(value) { return value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function checkInput(validate, input) {
  if (!plain(input) || Reflect.ownKeys(input).some((key) => typeof key !== "string") || !validate(input)) throw failure("INPUT_INVALID", "The model tool input does not match its closed schema.");
}
function serialized(value) {
  let text;
  try { text = JSON.stringify(value); } catch { throw failure("INTERNAL_ERROR", "The model core returned unserializable data."); }
  if (typeof text !== "string" || Buffer.byteLength(text) > LIMIT) throw failure("LIMIT_EXCEEDED", "The complete model-tool result exceeds its size bound.");
  return text;
}
function checkPrepared(result, includeSemanticContext) {
  serialized(result);
  if (!plain(result) || result.schema_version !== "author-model-preparation/1" || result.status !== "ready" ||
      Object.keys(result).sort().join() !== ["schema_version", "status", "source_review_hash", "input_hash", "include_semantic_context", "method", "author_patterns", "semantic_context_sources", "candidate_schema"].sort().join() ||
      !HEX.test(result.source_review_hash ?? "") || !HEX.test(result.input_hash ?? "") || result.include_semantic_context !== includeSemanticContext ||
      !Array.isArray(result.author_patterns) || !result.author_patterns.length || result.author_patterns.length > 240 ||
      !Array.isArray(result.semantic_context_sources) || result.semantic_context_sources.length > 240 ||
      (!includeSemanticContext && result.semantic_context_sources.length) || result.candidate_schema?.$ref !== "#/$defs/Composition" ||
      result.candidate_schema?.$id !== "urn:gabrielebaldassarre:author-model:1" || !plain(result.method) ||
      Object.keys(result.method).sort().join() !== ["compiler_sha256", "schema_sha256", "instructions_sha256", "preparation_sha256", "reviewed_author_patterns_sha256", "reviewed_semantic_model_sha256"].sort().join() ||
      Object.entries(result.method).some(([key, value]) => key === "reviewed_semantic_model_sha256" && !includeSemanticContext ? value !== null : typeof value !== "string" || !HEX.test(value))) {
    throw failure("INTERNAL_ERROR", "The model core returned an invalid preparation.");
  }
  const { input_hash, ...body } = result;
  if (sha(JSON.stringify(canonical(body))) !== input_hash) throw failure("INTERNAL_ERROR", "The prepared model input hash is inconsistent.");
  const ids = new Set();
  for (const item of result.author_patterns) {
    if (!plain(item) || !AUTHOR_ID.test(item.source_pattern_id ?? "") || ids.has(item.source_pattern_id) ||
        !["rhetorical", "epistemic", "decisional"].includes(item.dimension) ||
        ["label", "description", "applicability"].some((key) => typeof item[key] !== "string" || !item[key].trim()) ||
        !(item.review_notes === null || typeof item.review_notes === "string") ||
        !["low", "medium", "high"].includes(item.overuse_risk) || !["high", "contextual", "none"].includes(item.author_relevance) ||
        !["usable", "descriptive_only", "none"].includes(item.generative_utility) ||
        !Number.isInteger(item.article_count) || item.article_count < 1 || item.article_count > 20 ||
        !Number.isInteger(item.observation_count) || item.observation_count < 1 || item.observation_count > 240) {
      throw failure("INTERNAL_ERROR", "The prepared author pattern projection is invalid.");
    }
    ids.add(item.source_pattern_id);
  }
  if (result.semantic_context_sources.some((item) => !plain(item) || !Array.isArray(item.source_pattern_ids) || !item.source_pattern_ids.length ||
      !["concept", "relation"].includes(item.semantic_kind) || ["label", "description", "applicability"].some((key) => typeof item[key] !== "string" || !item[key].trim()) ||
      !Array.isArray(item.review_notes) || item.review_notes.length !== item.source_pattern_ids.length || item.review_notes.some((note) => !plain(note) ||
        !item.source_pattern_ids.includes(note.source_pattern_id) || !(note.notes === null || typeof note.notes === "string")))) {
    throw failure("INTERNAL_ERROR", "The prepared semantic projection is invalid.");
  }
  const semanticIds = result.semantic_context_sources.flatMap((item) => item.source_pattern_ids ?? []);
  if (semanticIds.some((id) => !SEMANTIC_ID.test(id)) || new Set(semanticIds).size !== semanticIds.length) {
    throw failure("INTERNAL_ERROR", "The prepared semantic source identities are invalid.");
  }
}
function checkCandidateResult(result, prepared) {
  serialized(result);
  const prefix = `docs/author-pattern-results/v1.3/author-model-candidates/${prepared.input_hash}/${result?.author_model_sha256}`;
  if (!plain(result) || result.schema_version !== "author-model-candidate/1" || result.status !== "compiled_candidate" ||
      Object.keys(result).sort().join() !== ["schema_version", "status", "source_review_hash", "input_hash", "include_semantic_context", "candidate_dir", "composition_path", "author_model_path", "preparation_path", "composition_sha256", "author_model_sha256", "counts"].sort().join() ||
      result.source_review_hash !== prepared.source_review_hash || result.input_hash !== prepared.input_hash ||
      result.include_semantic_context !== prepared.include_semantic_context || !HEX.test(result.author_model_sha256 ?? "") ||
      !HEX.test(result.composition_sha256 ?? "") || result.candidate_dir !== prefix ||
      result.author_model_path !== `${prefix}/author-model.json` || result.composition_path !== `${prefix}/composition.json` ||
      result.preparation_path !== `${prefix}/preparation.json` || !plain(result.counts) ||
      Object.keys(result.counts).sort().join() !== ["source_patterns", "principles", "contextual_profiles", "devices", "guardrails", "semantic_context"].sort().join() ||
      Object.values(result.counts).some((count) => !Number.isInteger(count) || count < 0 || count > 240) ||
      result.counts.source_patterns !== prepared.author_patterns.length || result.counts.principles < 1 ||
      result.counts.principles >= prepared.author_patterns.length || result.counts.contextual_profiles < 1 || result.counts.guardrails < 1 ||
      (!prepared.include_semantic_context && result.counts.semantic_context !== 0)) {
    throw failure("INTERNAL_ERROR", "The model core returned an invalid candidate receipt.");
  }
}
const SAFE = {
  INPUT_INVALID: "The model input is invalid.", SOURCE_INVALID: "A fixed model source is unavailable or unsafe.",
  MODEL_SOURCE_MISMATCH: "Released model sources do not match the completed review.",
  MODEL_INPUT_CHANGED: "Prepared model inputs changed; this session cannot continue.",
  MODEL_BINDING_INVALID: "The composition refers to a different completed review.",
  MODEL_SCHEMA_INVALID: "The model schema is invalid.", COMPOSITION_INVALID: "The composition does not match its closed contract.",
  MODEL_NOT_COMPACT: "Compose fewer principles than approved source patterns.",
  MODEL_LINEAGE_INVALID: "A component cites a missing, discarded or wrong-dimension source.",
  MODEL_COVERAGE_INVALID: "Each approved author source needs exactly one primary principle.",
  MODEL_REFERENCE_INVALID: "A component identifier or reference is inconsistent.", MODEL_SIZE_INVALID: "The compiled model exceeds its size bound.",
  MODEL_OPTIONS_INVALID: "The model options are invalid.", LIMIT_EXCEEDED: "The complete model result exceeds its size bound.",
  CANDIDATE_PATH_INVALID: "The candidate destination is unsafe.", CANDIDATE_COLLISION: "Existing candidate bytes differ; nothing was overwritten.",
  IMMUTABLE_INVALID: "Frozen review sources no longer match.", BINDING_INVALID: "The review binding is invalid.",
  DECISION_INVALID: "The completed review cannot be verified.", MERGE_INVALID: "Reviewed semantic merges cannot be verified.",
  REVIEW_INCOMPLETE: "Complete human review is required before model compilation.", REVIEW_JSON_INVALID: "The review JSON is invalid.",
  SCHEMA_INVALID: "The review source contract is invalid.", CANCELLED: "The model compilation was cancelled.",
};
function safeError(error) {
  const safePointer = /^(?:|\/(?:principles|contextual_profiles|devices|guardrails|semantic_context)(?:\/[0-9]+)?(?:\/(?:id|label|directive|when|instruction|source_pattern_ids|principle_ids|device_ids|guardrail_ids|rules|context|applicability|optional|usage)(?:\/[0-9]+)?)*)$/;
  const details = (Array.isArray(error?.details) ? error.details : []).filter((pointer) => typeof pointer === "string" && pointer.length <= 200 && safePointer.test(pointer)).slice(0, 5).map((pointer) => ({ pointer }));
  return error && Object.hasOwn(SAFE, error.code) ? failure(error.code, SAFE[error.code], details)
    : failure("INTERNAL_ERROR", "The model operation failed safely.");
}

export function createModelAdapter(core, repoRoot) {
  if (!core || typeof core.prepareAuthorModelCandidate !== "function" || typeof core.submitAuthorModelCandidate !== "function" || typeof repoRoot !== "string" || !repoRoot) {
    throw new TypeError("A model-agent core API and trusted repository root are required.");
  }
  let disposed = false;
  const states = new Map();
  const stateFor = (id) => {
    if (!states.has(id)) states.set(id, { prepared: null, attempts: 0, status: "active", queue: Promise.resolve(), controller: new AbortController(), signals: new Map() });
    return states.get(id);
  };
  const cancel = (state) => {
    state.status = "aborted"; state.controller.abort();
    for (const [signal, listener] of state.signals) signal.removeEventListener("abort", listener);
    state.signals.clear();
  };
  const active = (state) => {
    if (disposed || state.status === "aborted") throw failure("CANCELLED", "The model session is no longer active.");
    if (state.status !== "active") throw failure("PROTOCOL_INVALID", "This model session is sealed or blocked.");
  };
  const contextState = (context) => {
    if (disposed) throw failure("CANCELLED", "The model adapter is no longer active.");
    if (context?.agent !== "author-model-compiler") throw failure("AGENT_DENIED", "Only author-model-compiler may use these tools.");
    if (typeof context.sessionId !== "string" || !context.sessionId.trim() || context.sessionId.length > 256) throw failure("PROTOCOL_INVALID", "A trusted host session is required.");
    const state = stateFor(context.sessionId);
    if (context.signal !== undefined) {
      const signal = context.signal;
      if (typeof signal?.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function") throw failure("PROTOCOL_INVALID", "Invalid host cancellation signal.");
      if (signal.aborted) cancel(state);
      else if (!state.signals.has(signal)) {
        const listener = () => cancel(state); state.signals.set(signal, listener); signal.addEventListener("abort", listener, { once: true });
      }
    }
    active(state); return state;
  };
  const enqueue = (state, operation) => {
    const next = state.queue.then(operation); state.queue = next.then(() => undefined, () => undefined); return next;
  };
  const callCore = async (state, operation) => {
    active(state);
    try { const result = await operation(); active(state); return result; }
    catch (error) {
      active(state);
      if (error?.code === "MODEL_INPUT_CHANGED") state.status = "blocked";
      throw safeError(error);
    }
  };
  return {
    prepare(input, context) {
      const state = contextState(context); checkInput(validatePrepare, input);
      return enqueue(state, async () => {
        active(state); const include = input.include_semantic_context ?? true;
        if (state.prepared) {
          if (state.prepared.include_semantic_context !== include) throw failure("PROTOCOL_INVALID", "The semantic option is already bound for this session.");
          return structuredClone(state.prepared);
        }
        const result = await callCore(state, () => core.prepareAuthorModelCandidate(repoRoot, include));
        checkPrepared(result, include); state.prepared = structuredClone(result); return result;
      });
    },
    submit(input, context) {
      const state = contextState(context);
      return enqueue(state, async () => {
        active(state);
        if (!state.prepared) throw failure("PROTOCOL_INVALID", "Prepare the model inputs before submitting.");
        if (state.attempts >= 2) throw failure("ATTEMPT_LIMIT", "This model session permits at most two received submissions.");
        state.attempts += 1; checkInput(validateSubmit, input);
        if (Buffer.byteLength(input.candidate_json) > CANDIDATE_LIMIT) throw failure("LIMIT_EXCEEDED", "The composition exceeds its byte bound.");
        if (input.source_review_hash !== state.prepared.source_review_hash || input.input_hash !== state.prepared.input_hash) throw failure("PROTOCOL_INVALID", "Submit the exact hashes from this session's preparation.");
        const result = await callCore(state, () => core.submitAuthorModelCandidate(repoRoot, input.source_review_hash, input.input_hash, input.candidate_json,
          { includeSemanticContext: state.prepared.include_semantic_context, signal: state.controller.signal }));
        checkCandidateResult(result, state.prepared); state.status = "sealed";
        for (const [signal, listener] of state.signals) signal.removeEventListener("abort", listener);
        state.signals.clear(); return result;
      });
    },
    abort(sessionId) { cancel(stateFor(sessionId)); },
    dispose() { disposed = true; for (const state of states.values()) cancel(state); },
  };
}

export function modelToolResult(value) {
  const result = { content: [{ type: "text", text: serialized(value) }], metadata: { truncated: false } };
  if (Buffer.byteLength(JSON.stringify(result)) > 2 * LIMIT) throw failure("LIMIT_EXCEEDED", "The model tool wrapper exceeds its size bound.");
  return result;
}
