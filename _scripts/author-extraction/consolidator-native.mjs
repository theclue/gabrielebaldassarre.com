import Ajv2020 from "ajv/dist/2020.js";
import patternSchema from "./patterns.schema.json" with { type: "json" };
import rhetoricalPatternSchema from "./patterns.v0.2.schema.json" with { type: "json" };
import semanticPatternSchema from "./patterns.v0.3.schema.json" with { type: "json" };
import decisionalPatternSchema from "./patterns.v0.4.schema.json" with { type: "json" };
import epistemicPatternSchema from "./patterns.v0.5.schema.json" with { type: "json" };
import currentPatternSchema from "./patterns.v0.6.schema.json" with { type: "json" };
import { assignRhetoricalGroupIds } from "./rhetorical.mjs";
import { assignSemanticGroupIds } from "./semantic.mjs";
import { assignDecisionalGroupIds } from "./decisional.mjs";
import { assignEpistemicGroupIds } from "./epistemic.mjs";

const CORE_ERROR_CODES = new Set([
  "CORE_INVALID_ARGUMENT",
  "DATASET_INVALID",
  "PROCESSING_INCOMPLETE",
  "PARTITION_INVALID",
  "DIMENSION_INVALID",
  "INPUT_CHANGED",
  "SUPPORT_INVALID",
  "PARTITION_INVALID",
  "CANDIDATE_JSON_INVALID",
  "CANDIDATE_SCHEMA_INVALID",
  "RECORD_DERIVED_INVALID",
  "LIMIT_EXCEEDED",
  "INTERNAL_ERROR",
]);
const NATIVE_ERROR_CODES = new Set([
  "AGENT_DENIED",
  "PROTOCOL_INVALID",
  "ATTEMPT_LIMIT",
  "CANCELLED",
]);
const DIMENSIONS = new Set(patternSchema.$defs.Dimension.enum);
const RECORD_DIRECTORIES = new Set([
  "docs/author-extraction-results/v1.1",
  "docs/author-extraction-results/v1.2",
  "docs/author-extraction-results/v1.3",
]);
const DEFAULT_RECORD_DIRECTORY = "docs/author-extraction-results/v1.1";
const CANDIDATE_LIMIT = 256 * 1024;
const RESULT_LIMIT = 4 * 1024 * 1024;

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(patternSchema);
ajv.addSchema(rhetoricalPatternSchema);
ajv.addSchema(semanticPatternSchema);
ajv.addSchema(decisionalPatternSchema);
ajv.addSchema(epistemicPatternSchema);
ajv.addSchema(currentPatternSchema);
const localSchema = { $schema: patternSchema.$schema, $defs: patternSchema.$defs };
const validatePrepareInput = ajv.compile({ ...localSchema, $ref: "#/$defs/PrepareInput" });
const validateSubmitInput = ajv.compile({ ...localSchema, $ref: "#/$defs/SubmitInput" });
const validatePrepareResult = ajv.compile({ oneOf: [
  { $ref: `${patternSchema.$id}#/$defs/PrepareResult` },
  { $ref: `${rhetoricalPatternSchema.$id}#/$defs/PreparedDimension` },
  { $ref: `${semanticPatternSchema.$id}#/$defs/PreparedDimension` },
  { $ref: `${decisionalPatternSchema.$id}#/$defs/PreparedDimension` },
  { $ref: `${epistemicPatternSchema.$id}#/$defs/PreparedDimension` },
  { $ref: `${currentPatternSchema.$id}#/$defs/BlockedPreparation` },
  { $ref: `${currentPatternSchema.$id}#/$defs/PreparedDimension` },
] });
const validateAcceptedDimensionSchema = ajv.compile({ oneOf: [
  { $ref: `${patternSchema.$id}#/$defs/AcceptedDimension` },
  { $ref: `${rhetoricalPatternSchema.$id}#/$defs/AcceptedDimension` },
  { $ref: `${semanticPatternSchema.$id}#/$defs/AcceptedDimension` },
  { $ref: `${decisionalPatternSchema.$id}#/$defs/AcceptedDimension` },
  { $ref: `${epistemicPatternSchema.$id}#/$defs/AcceptedDimension` },
  { $ref: `${currentPatternSchema.$id}#/$defs/AcceptedDimension` },
] });
const validateAcceptanceEnvelope = ajv.compile({ ...localSchema, $ref: "#/$defs/AcceptanceEnvelope" });
const validateNonsemanticCandidate = ajv.compile({ ...localSchema, $ref: "#/$defs/CandidateNonsemantic" });
const validateSemanticCandidate = ajv.compile({ ...localSchema, $ref: "#/$defs/CandidateSemantic" });
const validateRhetoricalCandidate = ajv.getSchema(`${epistemicPatternSchema.$id}#/$defs/CandidateRhetorical`);
const currentCandidateValidators = {
  rhetorical: ajv.getSchema(`${currentPatternSchema.$id}#/$defs/CandidateRhetorical`),
  semantic: ajv.getSchema(`${currentPatternSchema.$id}#/$defs/CandidateSemantic`),
  epistemic: ajv.getSchema(`${currentPatternSchema.$id}#/$defs/CandidateNonsemantic`),
  decisional: ajv.getSchema(`${currentPatternSchema.$id}#/$defs/CandidateNonsemantic`),
};

function candidateValidator(dimension, prepared) {
  if (prepared.schema_version === "author-pattern-preparation/0.6") return currentCandidateValidators[dimension];
  return dimension === "semantic" ? validateSemanticCandidate
    : dimension === "rhetorical" && ["author-pattern-preparation/0.2", "author-pattern-preparation/0.3", "author-pattern-preparation/0.4", "author-pattern-preparation/0.5"].includes(prepared.schema_version) ? validateRhetoricalCandidate
      : validateNonsemanticCandidate;
}

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  error.details = [];
  return error;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function compareLexically(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function protocol(message = "The consolidation session protocol is invalid.") {
  return failure("PROTOCOL_INVALID", message);
}

function checkContext(context) {
  if (!context || context.agent !== "author-pattern-consolidator") {
    throw failure("AGENT_DENIED", "Only the author-pattern-consolidator agent may use consolidation tools.");
  }
  if (typeof context.sessionId !== "string" || context.sessionId.trim().length === 0 || context.sessionId.length > 256) {
    throw protocol("A valid host session ID is required.");
  }
  const signal = context.signal;
  if (signal !== undefined && (!signal || typeof signal.aborted !== "boolean" ||
    typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
    throw protocol("The host cancellation signal is invalid.");
  }
  return { sessionId: context.sessionId, signal };
}

function safeSerialize(value, limit, message) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw failure("INTERNAL_ERROR", "The consolidation core returned an unserializable value.");
  }
  if (typeof serialized !== "string") throw failure("INTERNAL_ERROR", "The consolidation core returned an invalid value.");
  if (Buffer.byteLength(serialized, "utf8") > limit) throw failure("LIMIT_EXCEEDED", message);
  return serialized;
}

function validateCoreError(error) {
  const code = error && Object.hasOwn(error, "code") ? error.code : undefined;
  const message = error && Object.hasOwn(error, "message") ? error.message : undefined;
  const details = error && Object.hasOwn(error, "details") ? error.details : undefined;
  if (!(error instanceof Error) || !CORE_ERROR_CODES.has(code) || typeof message !== "string" || message.length > 240 ||
    !Array.isArray(details) || details.length > 5 ||
    details.some((pointer) => typeof pointer !== "string" || !/^(?:|\/(?:[^~]|~[01])*)$/.test(pointer))) {
    return failure("INTERNAL_ERROR", "The consolidation core failed with an invalid error.");
  }
  const safe = new Error(message);
  safe.code = code;
  safe.details = [...details];
  return safe;
}

function coreCall(operation) {
  return Promise.resolve().then(operation).catch((error) => { throw validateCoreError(error); });
}

function enqueue(state, operation) {
  const result = state.queue.then(operation);
  state.queue = result.then(() => undefined, () => undefined);
  return result;
}

function clearSignals(state) {
  for (const [signal, listener] of state.signals) signal.removeEventListener("abort", listener);
  state.signals.clear();
}

function cancelState(state) {
  state.status = "aborted";
  clearSignals(state);
}

function active(state) {
  if (state.status === "aborted") {
    clearSignals(state);
    throw failure("CANCELLED", "The consolidation session was cancelled.");
  }
  if (state.status === "blocked") throw protocol("This consolidation session is blocked and cannot submit a candidate.");
  if (state.status === "sealed") throw protocol("The consolidation session has already been accepted.");
}

function stateFor(states, sessionId) {
  let state = states.get(sessionId);
  if (!state) {
    state = {
      dimension: null,
      corpusHash: null,
      inputHash: null,
      prepared: null,
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
    throw failure("CANCELLED", "The consolidation session was cancelled.");
  }
  if (state.signals.has(signal)) return;
  const listener = () => cancelState(state);
  state.signals.set(signal, listener);
  signal.addEventListener("abort", listener, { once: true });
}

function assertPrepared(result, dimension) {
  if (!validatePrepareResult(result)) {
    throw failure("RECORD_SCHEMA_INVALID", "The consolidation core returned an invalid preparation result.");
  }
  if (result.status === "blocked") return;
  if (result.dimension !== dimension || new Set(result.observations.map((item) => item.observation_id)).size !== result.observations.length ||
    result.observations.some((item) => item.dimension !== dimension)) {
    throw failure("RECORD_DERIVED_INVALID", "Prepared observations do not match the requested dimension.");
  }
}

function validateCandidateAgainstPrepared(candidate, dimension, prepared) {
  const validate = candidateValidator(dimension, prepared);
  if (!validate(candidate)) throw failure("CANDIDATE_SCHEMA_INVALID", "The submitted groups do not match the dimension candidate schema.");
  const projected = new Map(prepared.observations.map((item) => [item.observation_id, item]));
  if (projected.size !== prepared.observations.length) throw failure("RECORD_DERIVED_INVALID", "Prepared observation IDs are not unique.");
  const assigned = new Set();
  const supportFor = (observationId) => {
    const observation = projected.get(observationId);
    if (!observation || observation.dimension !== dimension || assigned.has(observationId)) {
      throw failure("PARTITION_INVALID", "Candidate support does not partition the prepared observations.");
    }
    assigned.add(observationId);
    return { observation_id: observationId, article_id: observation.article_id };
  };
  let expectedGroups = candidate.groups.map((group) => {
    const support = group.member_observation_ids.map(supportFor)
      .sort((left, right) => compareLexically(left.observation_id, right.observation_id));
    return {
      ...Object.fromEntries(Object.entries(group).filter(([key]) => key !== "member_observation_ids")),
      support,
      observation_count: support.length,
      article_count: new Set(support.map((entry) => entry.article_id)).size,
    };
  }).sort((left, right) => compareLexically(JSON.stringify(canonicalize(left)), JSON.stringify(canonicalize(right))));
  if (dimension === "rhetorical" && ["author-pattern-preparation/0.2", "author-pattern-preparation/0.3", "author-pattern-preparation/0.4", "author-pattern-preparation/0.5", "author-pattern-preparation/0.6"].includes(prepared.schema_version)) {
    expectedGroups = assignRhetoricalGroupIds(expectedGroups, prepared.schema_version);
  }
  if (dimension === "semantic" && ["author-pattern-preparation/0.3", "author-pattern-preparation/0.4", "author-pattern-preparation/0.5", "author-pattern-preparation/0.6"].includes(prepared.schema_version)) {
    expectedGroups = assignSemanticGroupIds(expectedGroups, prepared.schema_version);
  }
  if (dimension === "decisional" && ["author-pattern-preparation/0.4", "author-pattern-preparation/0.5", "author-pattern-preparation/0.6"].includes(prepared.schema_version)) {
    expectedGroups = assignDecisionalGroupIds(expectedGroups);
  }
  if (dimension === "epistemic" && ["author-pattern-preparation/0.5", "author-pattern-preparation/0.6"].includes(prepared.schema_version)) {
    expectedGroups = assignEpistemicGroupIds(expectedGroups);
  }
  const expectedUnclustered = candidate.unclustered_observations.map((item) => ({
    observation_id: item.observation_id,
    article_id: supportFor(item.observation_id).article_id,
    reason: item.reason,
  })).sort((left, right) => compareLexically(left.observation_id, right.observation_id));
  if (assigned.size !== projected.size) throw failure("PARTITION_INVALID", "Candidate support must account for every prepared observation.");
  return { expectedGroups, expectedUnclustered, projected };
}

function validateAcceptedDimension(canonicalJson, { dimension, corpusHash, inputHash, prepared, candidate }) {
  if (typeof canonicalJson !== "string") throw failure("INTERNAL_ERROR", "The consolidation core returned an invalid accepted dimension.");
  if (Buffer.byteLength(canonicalJson, "utf8") > RESULT_LIMIT) throw failure("LIMIT_EXCEEDED", "The accepted dimension exceeds its size limit.");
  let accepted;
  try {
    accepted = JSON.parse(canonicalJson);
  } catch {
    throw failure("RECORD_JSON_INVALID", "The consolidation core returned invalid dimension JSON.");
  }
  if (JSON.stringify(canonicalize(accepted)) !== canonicalJson) {
    throw failure("RECORD_JSON_INVALID", "The accepted dimension is not canonical JSON.");
  }
  if (!validateAcceptedDimensionSchema(accepted)) throw failure("RECORD_SCHEMA_INVALID", "The accepted dimension does not match its schema.");
  const expected = validateCandidateAgainstPrepared(candidate, dimension, prepared);
  const expectedVersion = prepared.schema_version.replace("author-pattern-preparation/", "author-pattern-dimension/");
  if (accepted.schema_version !== expectedVersion || accepted.dimension !== dimension || accepted.corpus_hash !== corpusHash || accepted.input_hash !== inputHash ||
    !sameJson(accepted.method, prepared.method) ||
    accepted.groups.length !== expected.expectedGroups.length ||
    accepted.unclustered_observations.length !== expected.expectedUnclustered.length) {
    throw failure("RECORD_DERIVED_INVALID", "Accepted counts, method, or session bindings do not match preparation.");
  }
  const consumed = new Set();
  for (let index = 0; index < accepted.groups.length; index += 1) {
    const expectedGroup = expected.expectedGroups[index];
    const group = accepted.groups[index];
    if (!sameJson(group, expectedGroup)) throw failure("RECORD_DERIVED_INVALID", "Accepted groups do not match the submitted candidate and derived support.");
    if (group.support.length < 2) throw failure("SUPPORT_INVALID", "Accepted groups require at least two supporting observations.");
    for (const support of group.support) {
      if (consumed.has(support.observation_id)) throw failure("SUPPORT_INVALID", "Accepted support contains a duplicate observation.");
      consumed.add(support.observation_id);
    }
  }
  for (let index = 0; index < accepted.unclustered_observations.length; index += 1) {
    const actual = accepted.unclustered_observations[index];
    const expectedItem = expected.expectedUnclustered[index];
    if (!sameJson(actual, expectedItem) || consumed.has(actual.observation_id)) {
      throw failure("SUPPORT_INVALID", "Accepted unclustered support does not match the candidate.");
    }
    consumed.add(actual.observation_id);
  }
  if (consumed.size !== expected.projected.size) throw failure("SUPPORT_INVALID", "Accepted groups do not account for all prepared observations.");
  const envelope = { status: "accepted", canonical_json: canonicalJson };
  safeSerialize(envelope, RESULT_LIMIT, "The accepted envelope exceeds its size limit.");
  if (!validateAcceptanceEnvelope(envelope)) throw failure("INTERNAL_ERROR", "The consolidation core returned an invalid acceptance envelope.");
  return envelope;
}

function approvedConfig(hostConfig) {
  if (hostConfig === undefined) return DEFAULT_RECORD_DIRECTORY;
  if (!hostConfig || typeof hostConfig !== "object" || Array.isArray(hostConfig) ||
    Object.keys(hostConfig).length !== 1 || !Object.hasOwn(hostConfig, "recordsDirectory") ||
    !RECORD_DIRECTORIES.has(hostConfig.recordsDirectory)) {
    throw new TypeError("Only an approved extraction-result directory may be configured.");
  }
  return hostConfig.recordsDirectory;
}

export function createConsolidationAdapter(coreApi, repoRoot, hostConfig) {
  if (!coreApi || typeof coreApi.prepareConsolidation !== "function" ||
    typeof coreApi.acceptDimensionCandidate !== "function" || typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new TypeError("A consolidation core API and trusted repository root are required.");
  }
  const recordsDirectory = approvedConfig(hostConfig);
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
        if (!validatePrepareInput(input) || !DIMENSIONS.has(input.dimension)) {
          throw protocol("The prepare input does not match the consolidation contract.");
        }
        if (state.dimension !== null && state.dimension !== input.dimension) {
          throw protocol("A consolidation session may prepare only one dimension.");
        }
        const prepared = await coreCall(() => coreApi.prepareConsolidation(repoRoot, input.dimension, recordsDirectory));
        active(state);
        assertPrepared(prepared, input.dimension);
        safeSerialize(prepared, RESULT_LIMIT, "The prepared dimension exceeds its size limit.");
        if (state.corpusHash !== null && prepared.corpus_hash !== state.corpusHash) {
          throw failure("INPUT_CHANGED", "The corpus changed during this consolidation session.");
        }
        if (prepared.status === "blocked") {
          state.dimension = input.dimension;
          state.corpusHash = prepared.corpus_hash;
          state.status = "blocked";
          return prepared;
        }
        if (state.inputHash !== null && prepared.input_hash !== state.inputHash) {
          throw failure("INPUT_CHANGED", "The prepared consolidation input changed during this session.");
        }
        state.dimension ??= input.dimension;
        state.corpusHash ??= prepared.corpus_hash;
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
      if (state.attempts >= 1) throw failure("ATTEMPT_LIMIT", "This consolidation session has used its one submit attempt.");
      state.attempts += 1;
      return enqueue(state, async () => {
        active(state);
        if (input && typeof input === "object" && typeof input.candidate_json === "string" &&
          Buffer.byteLength(input.candidate_json, "utf8") > CANDIDATE_LIMIT) {
          throw failure("LIMIT_EXCEEDED", "The consolidation candidate exceeds its size limit.");
        }
        if (!validateSubmitInput(input) || !DIMENSIONS.has(input.dimension)) {
          throw protocol("The submit input does not match the consolidation contract.");
        }
        if (!state.prepared || state.status !== "active") throw protocol("Prepare a ready dimension before submitting a candidate.");
        if (input.dimension !== state.dimension || input.corpus_hash !== state.corpusHash || input.input_hash !== state.inputHash) {
          throw protocol("The submitted dimension and hashes must match the prepared result.");
        }
        if (state.prepared.observations.length === 0) throw protocol("Empty dimensions must be accepted offline without an LLM submission.");
        let candidate;
        try {
          candidate = JSON.parse(input.candidate_json);
        } catch {
          throw failure("CANDIDATE_JSON_INVALID", "The consolidation candidate is not valid JSON.");
        }
        const validateCandidate = candidateValidator(input.dimension, state.prepared);
        if (!validateCandidate(candidate)) throw failure("CANDIDATE_SCHEMA_INVALID", "The consolidation candidate does not match the dimension schema.");
        validateCandidateAgainstPrepared(candidate, input.dimension, state.prepared);
        const canonicalJson = await coreCall(() => coreApi.acceptDimensionCandidate(
          repoRoot,
          state.dimension,
          state.corpusHash,
          state.inputHash,
          input.candidate_json,
          recordsDirectory,
        ));
        active(state);
        const envelope = validateAcceptedDimension(canonicalJson, {
          dimension: state.dimension,
          corpusHash: state.corpusHash,
          inputHash: state.inputHash,
          prepared: state.prepared,
          candidate,
        });
        state.status = "sealed";
        clearSignals(state);
        return envelope;
      });
    },

    abort(sessionId) {
      if (typeof sessionId !== "string" || sessionId.length === 0) return;
      cancelState(stateFor(states, sessionId));
    },
  };
}

export async function loadPluginSDK() {
  return import("@opencode/plugin");
}

export const prepareInputSchema = {
  ...patternSchema.$defs.PrepareInput,
  properties: { dimension: patternSchema.$defs.Dimension },
};
export const submitInputSchema = {
  ...patternSchema.$defs.SubmitInput,
  properties: {
    dimension: patternSchema.$defs.Dimension,
    corpus_hash: patternSchema.$defs.Hash,
    input_hash: patternSchema.$defs.Hash,
    candidate_json: patternSchema.$defs.SubmitInput.properties.candidate_json,
  },
};
