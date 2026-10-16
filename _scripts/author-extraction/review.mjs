import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { prepareArticle } from "./core.mjs?contract=1.3";
import { verifyConsolidationInputs } from "./consolidator.mjs?contract=1.3";

const MAX_BYTES = 8 * 1024 * 1024;
const RECORDS_DIRECTORY = "docs/author-extraction-results/v1.3";
const REVIEW_SCHEMA_PATH = "_scripts/author-extraction/author-review.schema.json";
const RAW_SCHEMA_PATH = "_scripts/author-extraction/patterns.v0.6.schema.json";
const SOURCE_FILES = [
  { dimension: "decisional", path: "docs/author-pattern-results/v1.3/decisional.json", sha256: "a070df8a4229fc3cb075d248f7da308f3388e7e448052f938a6d473b753b9d08" },
  { dimension: "epistemic", path: "docs/author-pattern-results/v1.3/epistemic.json", sha256: "57544ad260e6418087922e883e5d7173516bd8ea7e74fb73519bb4915f90b8de" },
  { dimension: "rhetorical", path: "docs/author-pattern-results/v1.3/rhetorical.json", sha256: "c8b5cf945df6e43f477300df025c536f9168e65cf8eaa076d656fb2f8775dda0" },
  { dimension: "semantic", path: "docs/author-pattern-results/v1.3/semantic.json", sha256: "8fd77c9b3b248ab0ada18d49bc2e407c3dc360c18c8f9c4a6e8b906cffbcc4cd" },
];
const DIMENSIONS = SOURCE_FILES.map(({ dimension }) => dimension);
const REPORT_DIMENSIONS = ["rhetorical", "epistemic", "semantic", "decisional"];
const FROZEN_CORPUS_HASH = "bc061167c298415d96547a6709c21aa6889a48814793726d55b670f4c46502f5";
const FROZEN_RAW_SCHEMA_HASH = "1cc2d9fd3c779f51c294719cd28e85f3570ffe65e274e8dc6fea1f1f39eef834";
const FROZEN_REVIEW_SCHEMA_HASH = "e7f861b8b7ea5f1f85328cb918db139c24be4e17aae5dcb5e6ccc8fbd917212b";

function errorWith(code, message, details = []) {
  const error = new Error(String(message).slice(0, 240));
  error.code = code;
  error.details = details.filter((detail) => typeof detail === "string").slice(0, 5);
  return error;
}

function fail(code, message, details) {
  throw errorWith(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function parseStrictJson(text, code, message) {
  let index = 0;
  const whitespace = () => {
    while (text[index] === " " || text[index] === "\t" || text[index] === "\n" || text[index] === "\r") index += 1;
  };
  const string = () => {
    const start = index++;
    while (index < text.length) {
      const char = text[index++];
      if (char === '"') return JSON.parse(text.slice(start, index));
      if (char === "\\") {
        if (index >= text.length) throw new Error("invalid");
        const escape = text[index++];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index, index + 4))) throw new Error("invalid");
          index += 4;
        } else if (!'"\\/bfnrt'.includes(escape)) throw new Error("invalid");
      } else if (char.charCodeAt(0) < 0x20) throw new Error("invalid");
    }
    throw new Error("invalid");
  };
  const value = (depth = 0) => {
    if (depth > 128) throw new Error("invalid");
    whitespace();
    if (text[index] === '"') return string();
    if (text[index] === "{") {
      index += 1;
      whitespace();
      const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (true) {
        whitespace();
        if (text[index] !== '"') throw new Error("invalid");
        const key = string();
        if (keys.has(key)) throw new Error("invalid");
        keys.add(key);
        whitespace();
        if (text[index++] !== ":") throw new Error("invalid");
        value(depth + 1);
        whitespace();
        const separator = text[index++];
        if (separator === "}") return;
        if (separator !== ",") throw new Error("invalid");
      }
    }
    if (text[index] === "[") {
      index += 1;
      whitespace();
      if (text[index] === "]") { index += 1; return; }
      while (true) {
        value(depth + 1);
        whitespace();
        const separator = text[index++];
        if (separator === "]") return;
        if (separator !== ",") throw new Error("invalid");
      }
    }
    const primitive = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(index));
    if (!primitive) throw new Error("invalid");
    index += primitive[0].length;
  };
  try {
    value();
    whitespace();
    if (index !== text.length) throw new Error("invalid");
    return JSON.parse(text);
  } catch {
    fail(code, message);
  }
}

async function trustedRoot(repoRoot) {
  if (typeof repoRoot !== "string" || !repoRoot) fail("BINDING_INVALID", "The workspace root is unavailable.");
  try {
    const resolved = await realpath(repoRoot);
    const info = await lstat(resolved);
    if (!info.isDirectory()) throw new Error("invalid");
    return { path: resolved, device: info.dev };
  } catch {
    fail("BINDING_INVALID", "The workspace root is unavailable.");
  }
}

async function readRootFile(root, relativePath) {
  let current = root.path;
  const parts = relativePath.split("/");
  try {
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const info = await lstat(current);
      if (info.isSymbolicLink() || info.dev !== root.device || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) throw new Error("unsafe");
    }
    const resolved = await realpath(current);
    if (!resolved.startsWith(`${root.path}${path.sep}`)) throw new Error("unsafe");
    const handle = await open(resolved, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.dev !== root.device || info.size > MAX_BYTES) throw new Error("unsafe");
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  } catch {
    fail("IMMUTABLE_INVALID", "A required frozen review input is unavailable or unsafe.");
  }
}

function decodeUtf8(bytes, code, message) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, message);
  }
}

function compileSchema(bytes) {
  try {
    const schema = JSON.parse(decodeUtf8(bytes, "SCHEMA_INVALID", "The local review schema is invalid."));
    const inspectRefs = (value) => {
      if (Array.isArray(value)) {
        value.forEach(inspectRefs);
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (key === "$ref" && (typeof item !== "string" || !item.startsWith("#/"))) throw new Error("remote reference");
        if (key === "$dynamicRef") throw new Error("dynamic reference");
        inspectRefs(item);
      }
    };
    if (schema.$id !== "urn:gabrielebaldassarre:author-pattern-review:1") throw new Error("unexpected schema");
    inspectRefs(schema);
    const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false, strict: false });
    ajv.addSchema(schema);
    const validators = {};
    for (const name of Object.keys(schema.$defs ?? {})) {
      validators[name] = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
      if (!validators[name]) throw new Error("invalid");
    }
    return { schema, validators };
  } catch (error) {
    if (error?.code === "SCHEMA_INVALID") throw error;
    fail("SCHEMA_INVALID", "The local review schema is invalid.");
  }
}

function validateSchema(validator, value, code, message) {
  if (validator?.(value)) return;
  const details = (validator?.errors ?? [])
    .map((entry) => entry.instancePath || "")
    .filter((pointer, index, all) => all.indexOf(pointer) === index)
    .slice(0, 5);
  fail(code, message, details);
}

function observationIndex(records) {
  return records.flatMap((record) => record.observations.map((observation) => ({
    dimension: observation.dimension,
    observation_id: observation.id,
    source_article_id: record.source.article_id,
    observation,
  })));
}

async function passageContextIndex(repoRoot, records) {
  const citedByArticle = new Map(records.map((record) => [record.source.article_id, new Set(record.observations.flatMap((observation) => observation.evidence.map((evidence) => evidence.passage_id)))]));
  const contexts = [];
  for (const record of records) {
    const prepared = await prepareArticle(repoRoot, record.source.article_id);
    if (prepared.source.file_hash !== record.source.file_hash || prepared.source.corpus_hash !== record.source.corpus_hash) {
      fail("IMMUTABLE_INVALID", "A source passage context no longer matches its verified record.");
    }
    const cited = citedByArticle.get(record.source.article_id);
    for (const passage of prepared.passages) {
      if (!cited.has(passage.passage_id)) continue;
      contexts.push({ article_id: record.source.article_id, ...passage });
    }
    if (prepared.passages.filter((passage) => cited.has(passage.passage_id)).length !== cited.size) {
      fail("IMMUTABLE_INVALID", "A cited source passage is unavailable.");
    }
  }
  return contexts;
}

function candidateSnapshots(acceptedDimensions) {
  return acceptedDimensions.flatMap((accepted) => accepted.groups.map((candidate) => ({
    dimension: accepted.dimension,
    source_pattern_id: candidate.id,
    candidate,
  })));
}

function initialReviews(candidates) {
  return candidates.map(({ dimension, source_pattern_id }) => dimension === "semantic" ? {
    dimension, source_pattern_id, decision: null, correctness: null, applicability: null, notes: null, revision: null, merge_key: null,
  } : {
    dimension, source_pattern_id, decision: null, correctness: null, applicability: null, notes: null, revision: null,
    author_relevance: null, generative_utility: null, overuse_risk: null,
  });
}

function unclusteredCoverage(acceptedDimensions) {
  return acceptedDimensions.map((accepted) => ({
    dimension: accepted.dimension,
    observations: accepted.unclustered_observations.map(({ observation_id, reason }) => ({ observation_id, reason })),
  }));
}

async function loadReviewInputs(repoRoot) {
  const root = await trustedRoot(repoRoot);
  const [reviewSchemaBytes, rawSchemaBytes, ...rawSourceBytes] = await Promise.all([
    readRootFile(root, REVIEW_SCHEMA_PATH),
    readRootFile(root, RAW_SCHEMA_PATH),
    ...SOURCE_FILES.map(({ path: sourcePath }) => readRootFile(root, sourcePath)),
  ]);
  const reviewSchemaHash = sha256(reviewSchemaBytes);
  if (reviewSchemaHash !== FROZEN_REVIEW_SCHEMA_HASH) fail("IMMUTABLE_INVALID", "The frozen review schema has changed.");
  if (sha256(rawSchemaBytes) !== FROZEN_RAW_SCHEMA_HASH) fail("IMMUTABLE_INVALID", "The frozen raw pattern schema has changed.");
  const { validators } = compileSchema(reviewSchemaBytes);
  const sources = SOURCE_FILES.map((source, index) => {
    const bytes = rawSourceBytes[index];
    if (sha256(bytes) !== source.sha256) fail("IMMUTABLE_INVALID", "A frozen raw pattern source has changed.");
    const raw = parseStrictJson(decodeUtf8(bytes, "IMMUTABLE_INVALID", "A frozen raw pattern source is invalid."), "IMMUTABLE_INVALID", "A frozen raw pattern source is invalid.");
    return { ...source, bytes, raw };
  });
  const accepted = await verifyConsolidationInputs(
    repoRoot,
    FROZEN_CORPUS_HASH,
    sources.map(({ bytes }) => decodeUtf8(bytes, "IMMUTABLE_INVALID", "A frozen raw pattern source is invalid.")),
    RECORDS_DIRECTORY,
  );
  const byDimension = new Map(accepted.accepted_dimensions.map((dimension) => [dimension.dimension, dimension]));
  if (sources.some(({ dimension, raw }) => canonicalJson(byDimension.get(dimension)) !== canonicalJson(raw))) {
    fail("IMMUTABLE_INVALID", "A frozen raw pattern source does not match its verified accepted dimension.");
  }
  if (accepted.corpus_hash !== FROZEN_CORPUS_HASH) fail("BINDING_INVALID", "The verified author corpus does not match the frozen review contract.");
  const methods = accepted.accepted_dimensions.map((dimension) => canonicalJson(dimension.method));
  if (methods.some((method) => method !== methods[0])) fail("BINDING_INVALID", "The frozen dimensions do not share one source method.");
  const method = accepted.accepted_dimensions[0].method;
  const source_files = sources.map(({ dimension, path: sourcePath, sha256: sourceHash, raw }) => ({
    dimension, path: sourcePath, sha256: sourceHash, schema_version: raw.schema_version, input_hash: raw.input_hash,
  }));
  const bindingWithoutHash = {
    corpus_hash: accepted.corpus_hash,
    source_files,
    method,
    review_contract_version: "author-review/1",
    raw_schema_sha256: sha256(rawSchemaBytes),
    review_schema_sha256: reviewSchemaHash,
  };
  const binding = { ...bindingWithoutHash, review_source_hash: sha256(Buffer.from(canonicalJson(bindingWithoutHash), "utf8")) };
  validateSchema(validators.Binding, binding, "BINDING_INVALID", "The frozen review binding is invalid.");
  const candidates = candidateSnapshots(DIMENSIONS.map((dimension) => byDimension.get(dimension)));
  const records = accepted.verified_records;
  const sheet = {
    schema_version: "author-pattern-review/1",
    binding,
    candidates,
    observation_index: observationIndex(records),
    passage_context_index: await passageContextIndex(repoRoot, records),
    unclustered_coverage: unclusteredCoverage(DIMENSIONS.map((dimension) => byDimension.get(dimension))),
    reviews: initialReviews(candidates),
    semantic_merges: [],
  };
  validateSchema(validators.PendingSheet, sheet, "SCHEMA_INVALID", "The generated pending review sheet is invalid.");
  const sheetJson = `${JSON.stringify(sheet, null, 2)}\n`;
  if (Buffer.byteLength(sheetJson, "utf8") > MAX_BYTES) fail("SCHEMA_INVALID", "The generated review sheet exceeds the size limit.");
  return { root, validators, reviewSchemaBytes, rawSchemaBytes, accepted, sources, sheet, sheetJson };
}

function validationReport(inputs) {
  const counts = new Map(REPORT_DIMENSIONS.map((dimension) => [dimension, { dimension, groups: 0, observations: 0, evidence: 0, unclustered_observations: 0 }]));
  const records = inputs.accepted.verified_records;
  for (const record of records) {
    for (const observation of record.observations) {
      const count = counts.get(observation.dimension);
      count.observations += 1;
      count.evidence += observation.evidence.length;
    }
  }
  for (const { dimension, raw } of inputs.sources) {
    counts.get(dimension).groups = raw.groups.length;
    counts.get(dimension).unclustered_observations = raw.unclustered_observations.length;
  }
  const per_dimension = REPORT_DIMENSIONS.map((dimension) => counts.get(dimension));
  const report = {
    schema_version: "author-pattern-validation/1",
    binding: inputs.sheet.binding,
    per_dimension,
    total_groups: per_dimension.reduce((total, item) => total + item.groups, 0),
    total_observations: per_dimension.reduce((total, item) => total + item.observations, 0),
    total_evidence: per_dimension.reduce((total, item) => total + item.evidence, 0),
  };
  validateSchema(inputs.validators.ValidationReport, report, "SCHEMA_INVALID", "The source validation report is invalid.");
  return report;
}

export async function validateAuthorPatterns(repoRoot) {
  try {
    return validationReport(await loadReviewInputs(repoRoot));
  } catch (error) {
    if (typeof error?.code === "string" && Array.isArray(error.details)) throw error;
    fail("IMMUTABLE_INVALID", "The frozen author pattern inputs could not be verified.");
  }
}

export async function prepareAuthorReview(repoRoot) {
  try {
    const inputs = await loadReviewInputs(repoRoot);
    validationReport(inputs);
    return inputs.sheetJson;
  } catch (error) {
    if (typeof error?.code === "string" && Array.isArray(error.details)) throw error;
    fail("IMMUTABLE_INVALID", "The frozen author pattern inputs could not be prepared for review.");
  }
}

function compareImmutableParts(completed, pending) {
  for (const key of ["schema_version", "binding", "candidates", "observation_index", "passage_context_index", "unclustered_coverage"]) {
    if (canonicalJson(completed[key]) !== canonicalJson(pending[key])) {
      fail("IMMUTABLE_INVALID", "A source-bound review field has changed.", [`/${key}`]);
    }
  }
}

function countSupport(support) {
  const perArticle = new Map();
  for (const entry of support) perArticle.set(entry.article_id, (perArticle.get(entry.article_id) ?? 0) + 1);
  const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return {
    support: [...support].sort((left, right) => lexical(left.observation_id, right.observation_id)),
    observation_count: support.length,
    article_count: perArticle.size,
    local_incidence: [...perArticle].sort(([left], [right]) => lexical(left, right)).map(([article_id, observation_count]) => ({ article_id, observation_count })),
  };
}

function finalValue(review, revision, key, candidate) {
  if (review.decision === "revise" && revision[key] !== null && revision[key] !== undefined) return revision[key];
  return candidate[key];
}

function requireEffectiveRevision(review, candidate) {
  const revision = review.revision;
  const keys = review.dimension === "rhetorical" ? ["label", "description", "abstraction_kind", "pattern_scope"]
    : review.dimension === "semantic" ? ["label", "description", "abstraction_kind", "semantic_kind"]
      : ["label", "description", "abstraction_kind", "classification"];
  if (keys.every((key) => revision[key] === null || revision[key] === undefined || revision[key] === candidate[key])) {
    fail("DECISION_INVALID", "A revise decision must make at least one effective candidate change.");
  }
}

function reviewedAuthorEntry(snapshot, review) {
  const candidate = snapshot.candidate;
  if (!["accept", "revise"].includes(review.decision)) return null;
  if (review.decision === "revise") requireEffectiveRevision(review, candidate);
  const typeKey = snapshot.dimension === "rhetorical" ? "pattern_scope" : "classification";
  const type = finalValue(review, review.revision, typeKey, candidate);
  if (snapshot.dimension === "decisional" && type === "thematic") fail("DECISION_INVALID", "A thematic decisional candidate cannot be approved.");
  const aggregate = countSupport(candidate.support);
  return {
    dimension: snapshot.dimension,
    source_pattern_id: snapshot.source_pattern_id,
    label: finalValue(review, review.revision, "label", candidate),
    description: finalValue(review, review.revision, "description", candidate),
    abstraction_kind: finalValue(review, review.revision, "abstraction_kind", candidate),
    type,
    applicability: review.applicability,
    author_relevance: review.author_relevance,
    generative_utility: review.generative_utility,
    overuse_risk: review.overuse_risk,
    ...aggregate,
  };
}

function mergeSemanticEntries(sheet) {
  const candidates = new Map(sheet.candidates.filter(({ dimension }) => dimension === "semantic").map((item) => [item.source_pattern_id, item]));
  const reviews = new Map(sheet.reviews.filter(({ dimension }) => dimension === "semantic").map((item) => [item.source_pattern_id, item]));
  const mergeSpecs = new Map(sheet.semantic_merges.map((spec) => [spec.merge_key, spec]));
  if (mergeSpecs.size !== sheet.semantic_merges.length) fail("MERGE_INVALID", "Semantic merge keys must be unique.");
  const used = new Set();
  for (const [mergeKey, spec] of mergeSpecs) {
    const participants = [...spec.source_pattern_ids].sort();
    if (new Set(participants).size !== participants.length || participants.length < 2 ||
      participants.some((id) => !candidates.has(id) || reviews.get(id)?.decision !== "merge" || reviews.get(id)?.merge_key !== mergeKey)) {
      fail("MERGE_INVALID", "A semantic merge must name consenting original source groups.");
    }
    for (const id of participants) {
      if (used.has(id)) fail("MERGE_INVALID", "Semantic merge participants cannot overlap.");
      used.add(id);
    }
    if (sheet.reviews.some((review) => review.dimension === "semantic" && review.decision === "merge" && review.merge_key === mergeKey && !participants.includes(review.source_pattern_id))) {
      fail("MERGE_INVALID", "Every semantic merge decision must appear in its merge specification.");
    }
  }
  for (const review of sheet.reviews.filter((item) => item.dimension === "semantic")) {
    if (review.decision === "merge" && !mergeSpecs.has(review.merge_key)) fail("MERGE_INVALID", "A semantic merge decision has no matching specification.");
  }

  const mergedByKey = new Map();
  for (const spec of sheet.semantic_merges) {
    const participants = spec.source_pattern_ids.map((id) => candidates.get(id));
    const support = participants.flatMap(({ candidate }) => candidate.support);
    if (new Set(support.map(({ observation_id }) => observation_id)).size !== support.length) {
      fail("MERGE_INVALID", "Semantic merge support must contain whole disjoint source groups.");
    }
    const aggregate = countSupport(support);
    mergedByKey.set(spec.merge_key, {
      decision: "merge",
      source_pattern_ids: [...spec.source_pattern_ids].sort(),
      role: spec.semantic_kind === "concept" ? "corpus_concept" : "corpus_relation",
      semantic_kind: spec.semantic_kind,
      label: spec.label,
      description: spec.description,
      abstraction_kind: spec.abstraction_kind,
      applicability: spec.applicability,
      ...aggregate,
    });
  }

  const entries = [];
  const emitted = new Set();
  for (const snapshot of sheet.candidates.filter(({ dimension }) => dimension === "semantic")) {
    const review = reviews.get(snapshot.source_pattern_id);
    if (review.decision === "merge") {
      if (!emitted.has(review.merge_key)) {
        entries.push(mergedByKey.get(review.merge_key));
        emitted.add(review.merge_key);
      }
      continue;
    }
    if (review.decision !== "retain" && review.decision !== "revise") continue;
    if (review.decision === "revise") requireEffectiveRevision(review, snapshot.candidate);
    const candidate = snapshot.candidate;
    const semantic_kind = finalValue(review, review.revision, "semantic_kind", candidate);
    entries.push({
      decision: review.decision,
      source_pattern_ids: [snapshot.source_pattern_id],
      role: semantic_kind === "concept" ? "corpus_concept" : "corpus_relation",
      semantic_kind,
      label: finalValue(review, review.revision, "label", candidate),
      description: finalValue(review, review.revision, "description", candidate),
      abstraction_kind: finalValue(review, review.revision, "abstraction_kind", candidate),
      applicability: review.applicability,
      ...countSupport(candidate.support),
    });
  }
  if (sheet.reviews.some((review) => review.dimension === "semantic" && review.decision === "merge" && !used.has(review.source_pattern_id))) {
    fail("MERGE_INVALID", "Every semantic merge participant must be represented exactly once.");
  }
  return entries;
}

function buildTransformation(sheet, completedReviewHash) {
  const byId = new Map(sheet.candidates.map((item) => [`${item.dimension}\0${item.source_pattern_id}`, item]));
  const audit = sheet.reviews.map((review) => {
    const candidate = byId.get(`${review.dimension}\0${review.source_pattern_id}`);
    if (!candidate) fail("IMMUTABLE_INVALID", "A review row does not match a source candidate.");
    return { dimension: review.dimension, source_pattern_id: review.source_pattern_id, candidate, review };
  });
  const provenance = {
    binding: sheet.binding,
    review_source_hash: sheet.binding.review_source_hash,
    completed_review_hash: completedReviewHash,
  };
  const semanticAudit = audit.filter(({ dimension }) => dimension === "semantic");
  const authorPatterns = {
    schema_version: "reviewed-author-patterns/1",
    provenance,
    observation_index: sheet.observation_index,
    passage_context_index: sheet.passage_context_index,
    audit,
    reviewed_entries: sheet.reviews.flatMap((review) => {
      if (review.dimension === "semantic") return [];
      const snapshot = byId.get(`${review.dimension}\0${review.source_pattern_id}`);
      const entry = reviewedAuthorEntry(snapshot, review);
      return entry ? [entry] : [];
    }),
  };
  const semanticModel = {
    schema_version: "reviewed-semantic-model/1",
    provenance,
    observation_index: sheet.observation_index,
    passage_context_index: sheet.passage_context_index,
    audit: semanticAudit,
    semantic_merges: sheet.semantic_merges,
    reviewed_entries: mergeSemanticEntries(sheet),
  };
  return { authorPatterns, semanticModel };
}

export async function applyAuthorReview(repoRoot, completedReviewJson) {
  try {
    if (typeof completedReviewJson !== "string" || Buffer.byteLength(completedReviewJson, "utf8") > MAX_BYTES) {
      fail("REVIEW_JSON_INVALID", "The completed review document is invalid or exceeds the size limit.");
    }
    const completed = parseStrictJson(completedReviewJson, "REVIEW_JSON_INVALID", "The completed review document is not strict JSON.");
    if (!completed || typeof completed !== "object" || Array.isArray(completed)) fail("REVIEW_JSON_INVALID", "The completed review must be a JSON object.");
    const inputs = await loadReviewInputs(repoRoot);
    if (canonicalJson(completed.binding) !== canonicalJson(inputs.sheet.binding)) fail("BINDING_INVALID", "The completed review is bound to different frozen sources.", ["/binding"]);
    compareImmutableParts(completed, inputs.sheet);
    if (!Array.isArray(completed.reviews) || completed.reviews.length !== inputs.sheet.reviews.length || completed.reviews.some((review) => !review || typeof review !== "object" || review.decision === null || review.decision === undefined)) {
      fail("REVIEW_INCOMPLETE", "Every source candidate must have a completed decision.");
    }
    validateSchema(inputs.validators.CompletedSheet, completed, "SCHEMA_INVALID", "The completed review does not match the review contract.");
    const expectedReviews = new Set(inputs.sheet.reviews.map((review) => `${review.dimension}\0${review.source_pattern_id}`));
    const seenReviews = new Set();
    for (const review of completed.reviews) {
      const key = `${review.dimension}\0${review.source_pattern_id}`;
      if (!expectedReviews.has(key) || seenReviews.has(key)) fail("REVIEW_INCOMPLETE", "Every source candidate must have exactly one completed decision.");
      seenReviews.add(key);
    }
    if (seenReviews.size !== expectedReviews.size) fail("REVIEW_INCOMPLETE", "Every source candidate must have exactly one completed decision.");
    const completedReviewHash = sha256(Buffer.from(canonicalJson(completed), "utf8"));
    const { authorPatterns, semanticModel } = buildTransformation(completed, completedReviewHash);
    const reviewed_author_patterns_json = canonicalJson(authorPatterns);
    const reviewed_semantic_model_json = canonicalJson(semanticModel);
    if (Buffer.byteLength(reviewed_author_patterns_json, "utf8") > MAX_BYTES || Buffer.byteLength(reviewed_semantic_model_json, "utf8") > MAX_BYTES) {
      fail("SCHEMA_INVALID", "A reviewed output exceeds the size limit.");
    }
    const transformation = {
      schema_version: "author-review-transformation/1",
      review_source_hash: completed.binding.review_source_hash,
      completed_review_hash: completedReviewHash,
      reviewed_author_patterns_json,
      reviewed_author_patterns_sha256: sha256(Buffer.from(reviewed_author_patterns_json, "utf8")),
      reviewed_semantic_model_json,
      reviewed_semantic_model_sha256: sha256(Buffer.from(reviewed_semantic_model_json, "utf8")),
    };
    validateSchema(inputs.validators.ReviewedAuthorPatterns, authorPatterns, "SCHEMA_INVALID", "The reviewed author-pattern output is invalid.");
    validateSchema(inputs.validators.ReviewedSemanticModel, semanticModel, "SCHEMA_INVALID", "The reviewed semantic output is invalid.");
    validateSchema(inputs.validators.ReviewTransformation, transformation, "SCHEMA_INVALID", "The review transformation output is invalid.");
    if (Buffer.byteLength(canonicalJson(transformation), "utf8") > MAX_BYTES) fail("SCHEMA_INVALID", "The review transformation exceeds the size limit.");
    return transformation;
  } catch (error) {
    if (typeof error?.code === "string" && Array.isArray(error.details)) throw error;
    fail("DECISION_INVALID", "The completed review could not be applied.");
  }
}
