import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { verifyExtractionRecord } from "./core.mjs";
import { assignRhetoricalGroupIds } from "./rhetorical.mjs";
import { assignSemanticGroupIds } from "./semantic.mjs";
import { assignDecisionalGroupIds } from "./decisional.mjs";
import { assignEpistemicGroupIds } from "./epistemic.mjs";

const ARTICLE_IDS = Array.from({ length: 12 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`);
const DIMENSIONS = ["rhetorical", "epistemic", "semantic", "decisional"];
const RECORD_DIRECTORIES = new Set([
  "docs/author-extraction-results/v1.1",
  "docs/author-extraction-results/v1.2",
]);
const SCHEMA_PATH = "_scripts/author-extraction/patterns.schema.json";
const RHETORICAL_SCHEMA_PATH = "_scripts/author-extraction/patterns.v0.2.schema.json";
const SEMANTIC_SCHEMA_PATH = "_scripts/author-extraction/patterns.v0.3.schema.json";
const DECISIONAL_SCHEMA_PATH = "_scripts/author-extraction/patterns.v0.4.schema.json";
const CURRENT_SCHEMA_PATH = "_scripts/author-extraction/patterns.v0.5.schema.json";
const INSTRUCTIONS_PATH = ".opencode/agents/author-pattern-consolidator.md";
const LEGACY_INSTRUCTIONS_PATH = "_scripts/author-extraction/author-pattern-consolidator.v0.1.md";
const RETAINED_INSTRUCTIONS_PATH = "_scripts/author-extraction/author-pattern-consolidator.v0.2.md";
const SEMANTIC_INSTRUCTIONS_PATH = "_scripts/author-extraction/author-pattern-consolidator.v0.3.md";
const DECISIONAL_INSTRUCTIONS_PATH = "_scripts/author-extraction/author-pattern-consolidator.v0.4.md";
const DATASET_LIMIT = 1024 * 1024;
const CANDIDATE_LIMIT = 256 * 1024;
const OUTPUT_LIMIT = 4 * 1024 * 1024;
const VERSION = Object.freeze({
  consolidation_version: "consolidate/5",
  projection_version: "observation-projection/1",
  instructions_version: "author-pattern-consolidator/0.5",
});
const CONTRACTS = Object.freeze({
  "0.1": { schemaPaths: [SCHEMA_PATH], instructionsPath: LEGACY_INSTRUCTIONS_PATH, consolidation_version: "consolidate/1", instructions_version: "author-pattern-consolidator/0.1" },
  "0.2": { schemaPaths: [SCHEMA_PATH, RHETORICAL_SCHEMA_PATH], instructionsPath: RETAINED_INSTRUCTIONS_PATH, consolidation_version: "consolidate/2", instructions_version: "author-pattern-consolidator/0.2" },
  "0.3": { schemaPaths: [SCHEMA_PATH, RHETORICAL_SCHEMA_PATH, SEMANTIC_SCHEMA_PATH], instructionsPath: SEMANTIC_INSTRUCTIONS_PATH, consolidation_version: "consolidate/3", instructions_version: "author-pattern-consolidator/0.3" },
  "0.4": { schemaPaths: [SCHEMA_PATH, RHETORICAL_SCHEMA_PATH, SEMANTIC_SCHEMA_PATH, DECISIONAL_SCHEMA_PATH], instructionsPath: DECISIONAL_INSTRUCTIONS_PATH, consolidation_version: "consolidate/4", instructions_version: "author-pattern-consolidator/0.4" },
  "0.5": { schemaPaths: [SCHEMA_PATH, RHETORICAL_SCHEMA_PATH, SEMANTIC_SCHEMA_PATH, DECISIONAL_SCHEMA_PATH, CURRENT_SCHEMA_PATH], instructionsPath: INSTRUCTIONS_PATH, ...VERSION },
});

function errorWith(code, message, details = []) {
  const error = new Error(String(message).slice(0, 240));
  error.code = code;
  error.details = details.filter((detail) => typeof detail === "string").slice(0, 5);
  return error;
}

function isOwnError(error) {
  return error instanceof Error && typeof error.code === "string" && Array.isArray(error.details);
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

function compareLexically(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateSchema(validator, value, code, message) {
  if (validator(value)) return;
  const details = (validator.errors ?? [])
    .map((entry) => entry.instancePath || "")
    .filter((pointer, index, all) => all.indexOf(pointer) === index)
    .slice(0, 5);
  fail(code, message, details);
}

function parseStrictJson(text, code, message) {
  let index = 0;
  const whitespace = () => {
    while (text[index] === " " || text[index] === "\t" || text[index] === "\n" || text[index] === "\r") index += 1;
  };
  const string = () => {
    const start = index;
    index += 1;
    while (index < text.length) {
      const char = text[index++];
      if (char === '"') return JSON.parse(text.slice(start, index));
      if (char === "\\") {
        if (index >= text.length) throw new Error("Invalid JSON.");
        const escape = text[index++];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index, index + 4))) throw new Error("Invalid JSON.");
          index += 4;
        } else if (!'"\\/bfnrt'.includes(escape)) throw new Error("Invalid JSON.");
      } else if (char.charCodeAt(0) < 0x20) throw new Error("Invalid JSON.");
    }
    throw new Error("Invalid JSON.");
  };
  const value = (depth = 0) => {
    if (depth > 128) throw new Error("Invalid JSON.");
    whitespace();
    if (text[index] === '"') return string();
    if (text[index] === "{") {
      index += 1;
      whitespace();
      const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (true) {
        whitespace();
        if (text[index] !== '"') throw new Error("Invalid JSON.");
        const key = string();
        if (keys.has(key)) throw new Error("Invalid JSON.");
        keys.add(key);
        whitespace();
        if (text[index++] !== ":") throw new Error("Invalid JSON.");
        value(depth + 1);
        whitespace();
        const separator = text[index++];
        if (separator === "}") return;
        if (separator !== ",") throw new Error("Invalid JSON.");
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
        if (separator !== ",") throw new Error("Invalid JSON.");
      }
    }
    const primitive = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(index));
    if (!primitive) throw new Error("Invalid JSON.");
    index += primitive[0].length;
  };
  try {
    value();
    whitespace();
    if (index !== text.length) throw new Error("Invalid JSON.");
    return JSON.parse(text);
  } catch {
    fail(code, message);
  }
}

async function trustedRoot(repoRoot) {
  if (typeof repoRoot !== "string" || repoRoot.length === 0) fail("CORE_INVALID_ARGUMENT", "A workspace root is required.");
  try {
    const resolved = await realpath(repoRoot);
    const info = await lstat(resolved);
    if (!info.isDirectory()) fail("CORE_INVALID_ARGUMENT", "The workspace root is invalid.");
    return { path: resolved, device: info.dev };
  } catch (error) {
    if (isOwnError(error)) throw error;
    fail("CORE_INVALID_ARGUMENT", "The workspace root is unavailable.");
  }
}

async function readRootFile(root, relativePath, maximumBytes = Number.MAX_SAFE_INTEGER) {
  const parts = relativePath.split("/");
  let current = root.path;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const info = await lstat(current);
    if (info.isSymbolicLink() || info.dev !== root.device || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) {
      throw new Error("Unsafe workspace path.");
    }
  }
  const absolute = await realpath(current);
  if (!absolute.startsWith(`${root.path}${path.sep}`)) throw new Error("Workspace path escapes the root.");
  const handle = await open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.dev !== root.device) throw new Error("Unexpected workspace file type.");
    if (info.size > maximumBytes) throw new Error("Workspace file exceeds its size limit.");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function readContract(root, version = "0.5") {
  const selected = CONTRACTS[version];
  if (!selected) fail("INTERNAL_ERROR", "The requested local consolidation contract is unsupported.");
  let schemaBytes;
  let instructionsBytes;
  try {
    [schemaBytes, instructionsBytes] = await Promise.all([
      Promise.all(selected.schemaPaths.map((schemaPath) => readRootFile(root, schemaPath, OUTPUT_LIMIT))),
      readRootFile(root, selected.instructionsPath, OUTPUT_LIMIT),
    ]);
  } catch {
    fail("INTERNAL_ERROR", "The local consolidation contract is unavailable.");
  }
  let schema;
  try {
    const schemas = schemaBytes.map((bytes) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    schema = schemas.at(-1);
    const ajv = new Ajv2020({ allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false, strict: false });
    for (const localSchema of schemas) ajv.addSchema(localSchema);
    const validators = {};
    for (const name of Object.keys(schema.$defs ?? {})) {
      validators[name] = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
      if (!validators[name]) throw new Error("Uncompiled schema definition.");
    }
    if (!validators.CandidateNonsemantic || !validators.CandidateSemantic || !validators.AcceptedDimension || !validators.FinalBundle) {
      throw new Error("Required schema definitions are missing.");
    }
    return {
      validators,
      method: {
        consolidation_version: selected.consolidation_version,
        projection_version: "observation-projection/1",
        instructions_version: selected.instructions_version,
        schema_hash: version === "0.1" ? sha256(schemaBytes[0]) : sha256(Buffer.from(canonicalJson(version === "0.2" ? {
          base_schema_hash: sha256(schemaBytes[0]), extension_schema_hash: sha256(schemaBytes[1]),
        } : {
          base_schema_hash: sha256(schemaBytes[0]), rhetorical_schema_hash: sha256(schemaBytes[1]), semantic_schema_hash: sha256(schemaBytes[2]),
          ...(["0.4", "0.5"].includes(version) ? { decisional_schema_hash: sha256(schemaBytes[3]) } : {}),
          ...(version === "0.5" ? { epistemic_schema_hash: sha256(schemaBytes[4]) } : {}),
        }), "utf8")),
        instructions_hash: sha256(instructionsBytes),
      },
    };
  } catch {
    fail("INTERNAL_ERROR", "The local consolidation schema is invalid.");
  }
}

function normalizeRecordsDirectory(recordsDirectory) {
  const selected = recordsDirectory ?? "docs/author-extraction-results/v1.1";
  if (typeof selected !== "string" || !RECORD_DIRECTORIES.has(selected)) {
    fail("DATASET_INVALID", "The author record directory is not an approved dataset.");
  }
  return selected;
}

async function datasetEntries(root, recordsDirectory) {
  const parts = recordsDirectory.split("/");
  let current = root.path;
  try {
    for (const part of parts) {
      current = path.join(current, part);
      const info = await lstat(current);
      if (info.isSymbolicLink() || info.dev !== root.device || !info.isDirectory()) throw new Error("Unsafe dataset directory.");
    }
    const entries = await readdir(current, { withFileTypes: true });
    const names = new Set(entries.map((entry) => entry.name));
    for (const name of names) {
      if (/\.json$/i.test(name) && !ARTICLE_IDS.some((id) => name === `${id}.json`)) throw new Error("Unexpected dataset record.");
      if (!/\.json$/i.test(name) && !/\.md$/i.test(name)) throw new Error("Unexpected dataset entry.");
      if (/\.md$/i.test(name) && !entries.find((entry) => entry.name === name)?.isFile()) throw new Error("Unexpected dataset entry.");
    }
    if (ARTICLE_IDS.some((id) => !names.has(`${id}.json`))) throw new Error("Incomplete dataset.");
  } catch {
    fail("DATASET_INVALID", "The author record dataset is incomplete or unsafe.");
  }
}

async function loadDataset(root, recordsDirectory) {
  const directory = normalizeRecordsDirectory(recordsDirectory);
  await datasetEntries(root, directory);
  const verified = [];
  for (const articleId of ARTICLE_IDS) {
    let raw;
    try {
      raw = await readRootFile(root, `${directory}/${articleId}.json`, DATASET_LIMIT);
    } catch {
      fail("DATASET_INVALID", "An approved author record is unavailable or exceeds the size limit.");
    }
    let json;
    try {
      json = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      fail("DATASET_INVALID", "An author record is not valid UTF-8.");
    }
    let result;
    try {
      result = await verifyExtractionRecord(root.path, json);
    } catch {
      fail("DATASET_INVALID", "An author record failed source and evidence verification.");
    }
    if (result.record.source.article_id !== articleId) {
      fail("DATASET_INVALID", "An author record does not match its allowlisted dataset filename.");
    }
    verified.push(result);
  }
  const corpusHash = sha256(Buffer.from(canonicalJson(verified
    .map(({ record, record_fingerprint }) => ({ article_id: record.source.article_id, record_fingerprint }))
    .sort((left, right) => compareLexically(left.article_id, right.article_id))), "utf8"));
  return { verified, corpusHash };
}

function projectObservations(verified, dimension) {
  return verified.flatMap(({ record }) => record.observations
    .filter((observation) => observation.dimension === dimension)
    .map((observation) => ({
      observation_id: observation.id,
      article_id: record.source.article_id,
      dimension: observation.dimension,
      label: observation.label,
      description: observation.description,
      inference_kind: observation.inference_kind,
      evidence_refs: observation.evidence.map(({ passage_id, quote }) => ({ passage_id, quote })),
    })))
    .sort((left, right) => compareLexically(left.observation_id, right.observation_id));
}

function currentInputHash(corpusHash, dimension, observations, method) {
  return sha256(Buffer.from(canonicalJson({ corpus_hash: corpusHash, dimension, observations, method }), "utf8"));
}

async function prepareCurrent(repoRoot, dimension, recordsDirectory) {
  if (!DIMENSIONS.includes(dimension)) fail("DIMENSION_INVALID", "The consolidation dimension is invalid.");
  const root = await trustedRoot(repoRoot);
  const contract = await readContract(root);
  const { verified, corpusHash } = await loadDataset(root, recordsDirectory);
  const ineligible = verified.filter((entry) => !entry.processing_eligible);
  if (ineligible.length) {
    return {
      status: "blocked",
      schema_version: "author-pattern-preparation/0.1",
      corpus_hash: corpusHash,
      diagnostics: ineligible.map(({ record, processing_reason }) => ({
        code: processing_reason === "PROCESSING_NOT_TRACKED" ? "PROCESSING_NOT_TRACKED" : "PROCESSING_INCOMPLETE",
        article_id: record.source.article_id,
      })),
    };
  }
  const observations = projectObservations(verified, dimension);
  const prepared = {
    status: "ready",
    schema_version: "author-pattern-preparation/0.5",
    corpus_hash: corpusHash,
    input_hash: currentInputHash(corpusHash, dimension, observations, contract.method),
    method: contract.method,
    dimension,
    observations,
  };
  validateSchema(contract.validators.PreparedDimension, prepared, "INTERNAL_ERROR", "Prepared consolidation data failed local validation.");
  if (Buffer.byteLength(canonicalJson(prepared), "utf8") > OUTPUT_LIMIT) fail("LIMIT_EXCEEDED", "Prepared consolidation data exceeds the response limit.");
  return JSON.parse(canonicalJson(prepared));
}

function requireEligible(verified) {
  if (verified.some((entry) => !entry.processing_eligible)) {
    fail("PROCESSING_INCOMPLETE", "Every author record must have complete tracked processing before consolidation.");
  }
}

function validatePartition(candidate, observations, dimension) {
  const index = new Map(observations.map((observation) => [observation.observation_id, observation]));
  const assigned = new Set();
  const addMember = (id, pointer) => {
    const observation = index.get(id);
    if (!observation || observation.dimension !== dimension || assigned.has(id)) {
      fail("PARTITION_INVALID", "Candidate groups must form an exhaustive disjoint partition of this dimension.", [pointer]);
    }
    assigned.add(id);
    return observation;
  };
  for (let groupIndex = 0; groupIndex < candidate.groups.length; groupIndex += 1) {
    const group = candidate.groups[groupIndex];
    for (let memberIndex = 0; memberIndex < group.member_observation_ids.length; memberIndex += 1) {
      addMember(group.member_observation_ids[memberIndex], `/groups/${groupIndex}/member_observation_ids/${memberIndex}`);
    }
  }
  for (let indexOfUnclustered = 0; indexOfUnclustered < candidate.unclustered_observations.length; indexOfUnclustered += 1) {
    addMember(candidate.unclustered_observations[indexOfUnclustered].observation_id, `/unclustered_observations/${indexOfUnclustered}/observation_id`);
  }
  if (assigned.size !== index.size) fail("PARTITION_INVALID", "Every projected observation must be assigned exactly once.");
}

function normalizedGroup(group, observations, dimension) {
  const support = group.member_observation_ids
    .map((observationId) => ({ observation_id: observationId, article_id: observations.get(observationId).article_id }))
    .sort((left, right) => compareLexically(left.observation_id, right.observation_id));
  const accepted = {
    ...(dimension === "semantic" ? { semantic_kind: group.semantic_kind }
      : dimension === "rhetorical" ? { pattern_scope: group.pattern_scope, author_relevance: group.author_relevance }
        : { classification: group.classification }),
    label: group.label,
    description: group.description,
    abstraction_kind: group.abstraction_kind,
    rationale: group.rationale,
    variation_notes: [...group.variation_notes],
    support,
    observation_count: support.length,
    article_count: new Set(support.map((entry) => entry.article_id)).size,
  };
  return accepted;
}

function groupSort(left, right) {
  return compareLexically(canonicalJson(left), canonicalJson(right));
}

function verifyAcceptedPartition(accepted, observations, dimension) {
  if (dimension === "rhetorical" && ["author-pattern-dimension/0.2", "author-pattern-dimension/0.3", "author-pattern-dimension/0.4", "author-pattern-dimension/0.5"].includes(accepted.schema_version)) {
    const expected = assignRhetoricalGroupIds(accepted.groups.map(({ id, ...group }) => group));
    if (canonicalJson(expected) !== canonicalJson(accepted.groups)) {
      fail("RECORD_DERIVED_INVALID", "Rhetorical IDs and ordering must be derived from group membership.", ["/groups"]);
    }
  }
  if (dimension === "semantic" && ["author-pattern-dimension/0.3", "author-pattern-dimension/0.4", "author-pattern-dimension/0.5"].includes(accepted.schema_version)) {
    const expected = assignSemanticGroupIds(accepted.groups.map(({ id, ...group }) => group));
    if (canonicalJson(expected) !== canonicalJson(accepted.groups)) {
      fail("RECORD_DERIVED_INVALID", "Semantic IDs, kind codes, and ordering must be derived from group membership.", ["/groups"]);
    }
  }
  const observationIndex = new Map(observations.map((observation) => [observation.observation_id, observation]));
  if (dimension === "decisional" && ["author-pattern-dimension/0.4", "author-pattern-dimension/0.5"].includes(accepted.schema_version)) {
    const expected = assignDecisionalGroupIds(accepted.groups.map(({ id, ...group }) => group));
    if (canonicalJson(expected) !== canonicalJson(accepted.groups)) {
      fail("RECORD_DERIVED_INVALID", "Decisional IDs and subtype counters must be derived from classification and membership.", ["/groups"]);
    }
  }
  const assigned = new Set();
  if (dimension === "epistemic" && accepted.schema_version === "author-pattern-dimension/0.5") {
    const expected = assignEpistemicGroupIds(accepted.groups.map(({ id, ...group }) => group));
    if (canonicalJson(expected) !== canonicalJson(accepted.groups)) {
      fail("RECORD_DERIVED_INVALID", "Epistemic IDs and subtype counters must be derived from classification and membership.", ["/groups"]);
    }
  }
  const supportEntries = [];
  for (let groupIndex = 0; groupIndex < accepted.groups.length; groupIndex += 1) {
    const group = accepted.groups[groupIndex];
    const hasSemanticKind = Object.hasOwn(group, "semantic_kind");
    if (hasSemanticKind !== (dimension === "semantic")) {
      fail("DIMENSION_INVALID", "Accepted groups must use the schema for their selected dimension.", [`/groups/${groupIndex}`]);
    }
    const unique = new Set();
    for (let supportIndex = 0; supportIndex < group.support.length; supportIndex += 1) {
      const entry = group.support[supportIndex];
      const observation = observationIndex.get(entry.observation_id);
      if (!observation || observation.article_id !== entry.article_id || observation.dimension !== dimension) {
        fail("SUPPORT_INVALID", "Accepted support must match a verified observation and article.", [`/groups/${groupIndex}/support/${supportIndex}`]);
      }
      if (unique.has(entry.observation_id) || assigned.has(entry.observation_id)) {
        fail("PARTITION_INVALID", "Accepted support must partition observations without duplicates.", [`/groups/${groupIndex}/support/${supportIndex}`]);
      }
      unique.add(entry.observation_id);
      assigned.add(entry.observation_id);
      supportEntries.push(entry);
    }
    const expectedArticleCount = new Set(group.support.map((entry) => entry.article_id)).size;
    if (group.observation_count !== group.support.length || group.article_count !== expectedArticleCount) {
      fail("RECORD_DERIVED_INVALID", "Accepted observation and article counts must be derived from verified support.", [`/groups/${groupIndex}`]);
    }
  }
  for (let index = 0; index < accepted.unclustered_observations.length; index += 1) {
    const entry = accepted.unclustered_observations[index];
    const observation = observationIndex.get(entry.observation_id);
    if (!observation || observation.article_id !== entry.article_id || observation.dimension !== dimension) {
      fail("SUPPORT_INVALID", "Accepted unclustered support must match a verified observation and article.", [`/unclustered_observations/${index}`]);
    }
    if (assigned.has(entry.observation_id)) fail("PARTITION_INVALID", "Accepted support must partition observations without duplicates.", [`/unclustered_observations/${index}`]);
    assigned.add(entry.observation_id);
  }
  if (assigned.size !== observationIndex.size) fail("PARTITION_INVALID", "Accepted data must account for every verified observation.");
  return supportEntries;
}

function dimensionCode(dimension) {
  return { rhetorical: "R", epistemic: "E", decisional: "D", semantic: "S" }[dimension];
}

function finalGroupFrom(group, dimension, classification, support, id) {
  const articleCount = new Set(support.map((entry) => entry.article_id)).size;
  return {
    id,
    dimension,
    ...(classification === "semantic" ? { semantic_kind: group.semantic_kind }
      : classification === "rhetorical" ? { pattern_scope: group.pattern_scope, author_relevance: group.author_relevance }
        : { classification: group.classification }),
    label: group.label,
    description: group.description,
    abstraction_kind: group.abstraction_kind,
    rationale: group.rationale,
    variation_notes: group.variation_notes,
    support,
    observation_count: support.length,
    article_count: articleCount,
    promotion_status: articleCount >= 3 ? "recurrent_candidate" : "cross_article_candidate",
    review_status: "unreviewed",
  };
}

function makeFinalBundle(corpusHash, method, acceptedByDimension) {
  const authorPatterns = {
    schema_version: "author-pattern-candidates/0.5",
    corpus_hash: corpusHash,
    method,
    patterns: [],
    editorial_format: [],
    thematic: [],
    rhetorical_groups: [],
    unclustered_observations: [],
    diagnostics: [],
  };
  const semanticRecurrences = {
    schema_version: "semantic-recurrence-candidates/0.5",
    corpus_hash: corpusHash,
    method,
    concepts: [],
    relations: [],
    unclustered_observations: [],
    diagnostics: [],
  };
  const pending = [];
  for (const dimension of DIMENSIONS) {
    const accepted = acceptedByDimension.get(dimension);
    for (const group of accepted.groups) {
      const support = group.support.slice().sort((left, right) => compareLexically(left.observation_id, right.observation_id));
      const articleCount = new Set(support.map((entry) => entry.article_id)).size;
      if (articleCount < 2) {
        for (const entry of support) {
          const target = dimension === "semantic" ? semanticRecurrences.unclustered_observations : authorPatterns.unclustered_observations;
          target.push({ ...entry, dimension, reason: "LOCAL_ONLY" });
        }
        continue;
      }
      const isSemantic = dimension === "semantic";
      const classification = isSemantic ? "semantic" : dimension === "rhetorical" && Object.hasOwn(group, "id") ? "rhetorical" : group.classification;
      const prefix = isSemantic ? Object.hasOwn(group, "id") ? "SPC" : "SRC"
        : dimension === "decisional" && Object.hasOwn(group, "id") ? "DPC"
          : dimension === "epistemic" && Object.hasOwn(group, "id") ? "EPC"
          : classification === "rhetorical" || classification === "author_candidate" ? "APC" : classification === "editorial_format" ? "EFC" : "THC";
      const groupKey = { ...group, support };
      pending.push({ dimension, classification, group, support, prefix, sortKey: canonicalJson(groupKey) });
    }
    for (const entry of accepted.unclustered_observations) {
      if (dimension === "semantic") semanticRecurrences.unclustered_observations.push({
        observation_id: entry.observation_id,
        article_id: entry.article_id,
        dimension,
        reason: entry.reason,
      });
      else authorPatterns.unclustered_observations.push({
        observation_id: entry.observation_id,
        article_id: entry.article_id,
        dimension,
        reason: entry.reason,
      });
    }
  }
  pending.sort((left, right) => compareLexically(left.prefix, right.prefix) || compareLexically(dimensionCode(left.dimension), dimensionCode(right.dimension)) || compareLexically(left.sortKey, right.sortKey));
  const counters = new Map();
  for (const item of pending) {
    const key = `${item.prefix}:${dimensionCode(item.dimension)}`;
    const sequence = (counters.get(key) ?? 0) + 1;
    counters.set(key, sequence);
    const id = item.classification === "rhetorical" || ["SPC", "DPC", "EPC"].includes(item.prefix) ? item.group.id : `${item.prefix}::${dimensionCode(item.dimension)}${String(sequence).padStart(4, "0")}`;
    const finalGroup = finalGroupFrom(item.group, item.dimension, item.classification, item.support, id);
    if (item.classification === "rhetorical") authorPatterns.rhetorical_groups.push(finalGroup);
    else if (item.classification === "author_candidate") authorPatterns.patterns.push(finalGroup);
    else if (item.classification === "editorial_format") authorPatterns.editorial_format.push(finalGroup);
    else if (item.classification === "thematic") authorPatterns.thematic.push(finalGroup);
    else if (item.group.semantic_kind === "concept") semanticRecurrences.concepts.push(finalGroup);
    else semanticRecurrences.relations.push(finalGroup);
  }
  authorPatterns.unclustered_observations.sort((left, right) => compareLexically(left.dimension, right.dimension) || compareLexically(left.observation_id, right.observation_id));
  semanticRecurrences.unclustered_observations.sort((left, right) => compareLexically(left.observation_id, right.observation_id));
  for (const list of [authorPatterns.patterns, authorPatterns.editorial_format, authorPatterns.thematic, authorPatterns.rhetorical_groups, semanticRecurrences.concepts, semanticRecurrences.relations]) {
    list.sort((left, right) => compareLexically(left.id, right.id));
  }
  return {
    author_patterns: authorPatterns, semantic_recurrences: semanticRecurrences,
    dimension_methods: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, acceptedByDimension.get(dimension).method])),
  };
}

async function runApi(callback, genericMessage) {
  try {
    return await callback();
  } catch (error) {
    if (isOwnError(error)) throw error;
    throw errorWith("INTERNAL_ERROR", genericMessage);
  }
}

export async function prepareConsolidation(repoRoot, dimension, recordsDirectory) {
  return runApi(() => prepareCurrent(repoRoot, dimension, recordsDirectory), "Consolidation preparation failed.");
}

export async function acceptDimensionCandidate(repoRoot, dimension, corpusHash, inputHash, candidateJson, recordsDirectory) {
  return runApi(async () => {
    if (!DIMENSIONS.includes(dimension)) fail("DIMENSION_INVALID", "The consolidation dimension is invalid.");
    if (typeof corpusHash !== "string" || !/^[a-f0-9]{64}$/.test(corpusHash) || typeof inputHash !== "string" || !/^[a-f0-9]{64}$/.test(inputHash) || typeof candidateJson !== "string") {
      fail("CORE_INVALID_ARGUMENT", "The consolidation candidate arguments are invalid.");
    }
    if (Buffer.byteLength(candidateJson, "utf8") > CANDIDATE_LIMIT) fail("LIMIT_EXCEEDED", "The consolidation candidate exceeds the size limit.");
    const candidate = parseStrictJson(candidateJson, "CANDIDATE_JSON_INVALID", "The candidate is not valid strict JSON.");
    const root = await trustedRoot(repoRoot);
    const contract = await readContract(root);
    const { verified, corpusHash: currentCorpusHash } = await loadDataset(root, recordsDirectory);
    requireEligible(verified);
    const observations = projectObservations(verified, dimension);
    const expectedInputHash = currentInputHash(currentCorpusHash, dimension, observations, contract.method);
    if (corpusHash !== currentCorpusHash || inputHash !== expectedInputHash) fail("INPUT_CHANGED", "The author records or consolidation method have changed.");
    const validator = dimension === "semantic" ? contract.validators.CandidateSemantic
      : dimension === "rhetorical" ? contract.validators.CandidateRhetorical : contract.validators.CandidateNonsemantic;
    validateSchema(validator, candidate, "CANDIDATE_SCHEMA_INVALID", "The candidate does not match the consolidation contract.");
    validatePartition(candidate, observations, dimension);
    const observationIndex = new Map(observations.map((observation) => [observation.observation_id, observation]));
    let groups = candidate.groups
      .map((group) => normalizedGroup(group, observationIndex, dimension))
      .sort(groupSort);
    if (dimension === "rhetorical") groups = assignRhetoricalGroupIds(groups);
    if (dimension === "semantic") groups = assignSemanticGroupIds(groups);
    if (dimension === "decisional") groups = assignDecisionalGroupIds(groups);
    if (dimension === "epistemic") groups = assignEpistemicGroupIds(groups);
    const unclusteredObservations = candidate.unclustered_observations
      .map((entry) => ({
        observation_id: entry.observation_id,
        article_id: observationIndex.get(entry.observation_id).article_id,
        reason: entry.reason,
      }))
      .sort((left, right) => compareLexically(left.observation_id, right.observation_id));
    const accepted = {
      schema_version: "author-pattern-dimension/0.5",
      dimension,
      corpus_hash: currentCorpusHash,
      input_hash: expectedInputHash,
      method: contract.method,
      groups,
      unclustered_observations: unclusteredObservations,
    };
    validateSchema(contract.validators.AcceptedDimension, accepted, "INTERNAL_ERROR", "Accepted dimension data failed local validation.");
    const canonical = canonicalJson(accepted);
    if (Buffer.byteLength(canonical, "utf8") > OUTPUT_LIMIT) fail("LIMIT_EXCEEDED", "Accepted dimension data exceeds the response limit.");
    return canonical;
  }, "Consolidation candidate acceptance failed.");
}

export async function finalizeConsolidation(repoRoot, corpusHash, acceptedDimensionJsons, recordsDirectory) {
  return runApi(async () => {
    if (typeof corpusHash !== "string" || !/^[a-f0-9]{64}$/.test(corpusHash) || !Array.isArray(acceptedDimensionJsons)) {
      fail("CORE_INVALID_ARGUMENT", "Finalization arguments are invalid.");
    }
    if (acceptedDimensionJsons.length !== DIMENSIONS.length) fail("DIMENSION_INVALID", "Exactly one accepted dimension is required for each dimension.");
    const root = await trustedRoot(repoRoot);
    const contract = await readContract(root);
    const { verified, corpusHash: currentCorpusHash } = await loadDataset(root, recordsDirectory);
    requireEligible(verified);
    if (corpusHash !== currentCorpusHash) fail("INPUT_CHANGED", "The author records have changed since consolidation preparation.");
    const acceptedByDimension = new Map();
    const contractsByVersion = new Map([["0.5", contract]]);
    for (const acceptedJson of acceptedDimensionJsons) {
      if (typeof acceptedJson !== "string" || Buffer.byteLength(acceptedJson, "utf8") > OUTPUT_LIMIT) fail("LIMIT_EXCEEDED", "Accepted dimension data exceeds the size limit.");
      const accepted = parseStrictJson(acceptedJson, "DIMENSION_INVALID", "Accepted dimension JSON is invalid.");
      const version = accepted && typeof accepted === "object" && !Array.isArray(accepted)
        ? { "author-pattern-dimension/0.1": "0.1", "author-pattern-dimension/0.2": "0.2", "author-pattern-dimension/0.3": "0.3", "author-pattern-dimension/0.4": "0.4", "author-pattern-dimension/0.5": "0.5" }[accepted.schema_version] : undefined;
      if (!version) fail("DIMENSION_INVALID", "Accepted dimension data uses an unsupported contract version.");
      if (!contractsByVersion.has(version)) contractsByVersion.set(version, await readContract(root, version));
      const dimensionContract = contractsByVersion.get(version);
      validateSchema(dimensionContract.validators.AcceptedDimension, accepted, "DIMENSION_INVALID", "Accepted dimension data is invalid.");
      if (acceptedByDimension.has(accepted.dimension)) fail("DIMENSION_INVALID", "Accepted dimensions must be unique.");
      const observations = projectObservations(verified, accepted.dimension);
      const expectedInputHash = currentInputHash(currentCorpusHash, accepted.dimension, observations, dimensionContract.method);
      if (accepted.corpus_hash !== currentCorpusHash || accepted.input_hash !== expectedInputHash || canonicalJson(accepted.method) !== canonicalJson(dimensionContract.method)) {
        fail("INPUT_CHANGED", "Accepted dimension data was prepared against a different dataset or method.");
      }
      verifyAcceptedPartition(accepted, observations, accepted.dimension);
      acceptedByDimension.set(accepted.dimension, accepted);
    }
    if (DIMENSIONS.some((dimension) => !acceptedByDimension.has(dimension))) fail("DIMENSION_INVALID", "Exactly one accepted dimension is required for each dimension.");
    const finalBundle = makeFinalBundle(currentCorpusHash, contract.method, acceptedByDimension);
    validateSchema(contract.validators.FinalBundle, finalBundle, "INTERNAL_ERROR", "Final consolidation data failed local validation.");
    const canonical = canonicalJson(finalBundle);
    if (Buffer.byteLength(canonical, "utf8") > OUTPUT_LIMIT) fail("LIMIT_EXCEEDED", "The final consolidation bundle exceeds the response limit.");
    return canonical;
  }, "Consolidation finalization failed.");
}
