import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { applyAuthorReview } from "./review.mjs";

const DIRECTORY = "docs/author-pattern-results/v1.3";
const AUTHOR_PATH = `${DIRECTORY}/reviewed-author-patterns.json`;
const SEMANTIC_PATH = `${DIRECTORY}/reviewed-semantic-model.json`;
const SCHEMA_PATH = "_scripts/author-extraction/author-model.schema.json";
const COMPILER_PATH = "_scripts/author-extraction/model.mjs";
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_MODEL_BYTES = 128 * 1024;
const SECTIONS = ["principles", "contextual_profiles", "devices", "guardrails", "semantic_context"];

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

const canonicalJson = (value) => JSON.stringify(canonical(value));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

// JSON.parse alone accepts duplicate keys. Reject them before using an authored
// composition, rather than silently allowing the final key to redefine a rule.
function parseStrict(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > MAX_MODEL_BYTES) {
    fail("COMPOSITION_INVALID", "The composition is unavailable or exceeds its size bound.");
  }
  let index = 0;
  const ws = () => { while (/\s/.test(text[index] ?? "") && index < text.length) index += 1; };
  const string = () => {
    const start = index++;
    while (index < text.length) {
      const char = text[index++];
      if (char === '"') return JSON.parse(text.slice(start, index));
      if (char === "\\") index += 1;
    }
    throw new Error("invalid string");
  };
  const value = (depth = 0) => {
    if (depth > 64) throw new Error("depth");
    ws();
    if (text[index] === '"') { string(); return; }
    if (text[index] === "{") {
      index += 1; ws(); const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (true) {
        ws(); if (text[index] !== '"') throw new Error("key");
        const key = string(); if (keys.has(key)) throw new Error("duplicate"); keys.add(key);
        ws(); if (text[index++] !== ":") throw new Error("colon");
        value(depth + 1); ws(); const next = text[index++];
        if (next === "}") return; if (next !== ",") throw new Error("separator");
      }
    }
    if (text[index] === "[") {
      index += 1; ws(); if (text[index] === "]") { index += 1; return; }
      while (true) {
        value(depth + 1); ws(); const next = text[index++];
        if (next === "]") return; if (next !== ",") throw new Error("separator");
      }
    }
    const match = /^(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(index));
    if (!match) throw new Error("primitive"); index += match[0].length;
  };
  try {
    const parsed = JSON.parse(text);
    value(); ws(); if (index !== text.length) throw new Error("trailing");
    return parsed;
  } catch {
    fail("COMPOSITION_INVALID", "The composition must be bounded strict JSON without duplicate keys.");
  }
}

async function readFixed(root, relative, maximum = MAX_SOURCE_BYTES) {
  let current = root;
  const parts = relative.split("/");
  try {
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const info = await lstat(current);
      if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) throw new Error("unsafe");
    }
    const handle = await open(current, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > maximum) throw new Error("size");
      const bytes = await handle.readFile();
      if (bytes.length > maximum) throw new Error("size");
      return { bytes, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } finally { await handle.close(); }
  } catch {
    fail("SOURCE_INVALID", "A fixed compiler input is unavailable, unsafe, oversized, or invalid UTF-8.");
  }
}

function validatorsFor(schema) {
  const inspect = (value) => {
    if (Array.isArray(value)) return value.forEach(inspect);
    if (value === null || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (key === "$dynamicRef" || (key === "$ref" && (typeof entry !== "string" || !entry.startsWith("#/")))) {
        fail("MODEL_SCHEMA_INVALID", "The compiler schema must use only local static references.");
      }
      inspect(entry);
    }
  };
  if (schema.$id !== "urn:gabrielebaldassarre:author-model:1") fail("MODEL_SCHEMA_INVALID", "Unexpected compiler schema identity.");
  inspect(schema);
  const ajv = new Ajv2020({ allErrors: true, strict: false, coerceTypes: false, useDefaults: false, removeAdditional: false });
  return Object.fromEntries(["Composition", "AuthorModel"].map((name) => [name,
    ajv.compile({ $schema: schema.$schema, $defs: schema.$defs, $ref: `#/$defs/${name}` }),
  ]));
}

function requireSchema(validator, data) {
  if (!validator(data)) fail("COMPOSITION_INVALID", "The composition or model does not match the closed contract.");
}

// This pure validator checks a supplied allowlist; it does not authenticate it.
// The public compiler below always rederives its sources through the review core.
export function validateAuthorModelComposition(composition, sources, schema) {
  requireSchema(validatorsFor(schema).Composition, composition);
  if (composition.source_review_hash !== sources.sourceReviewHash) fail("MODEL_BINDING_INVALID", "The composition is bound to a different completed review.");
  const approved = new Set(sources.author.reviewed_entries.map((entry) => entry.source_pattern_id));
  const retained = new Set(sources.semantic.reviewed_entries.flatMap((entry) => entry.source_pattern_ids));
  if (!approved.size || composition.principles.length >= approved.size) fail("MODEL_NOT_COMPACT", "The principles must coordinate fewer units than the approved source patterns.");
  const byId = new Map();
  for (const section of SECTIONS) for (const component of composition[section]) {
    if (byId.has(component.id)) fail("MODEL_REFERENCE_INVALID", "Component identifiers must be unique.");
    byId.set(component.id, component);
  }
  const owner = new Map();
  const checkSources = (ids, allowed) => {
    if (ids.some((id) => !allowed.has(id))) fail("MODEL_LINEAGE_INVALID", "A component cites a missing, discarded, or wrong-dimension source pattern.");
  };
  for (const principle of composition.principles) {
    checkSources(principle.source_pattern_ids, approved);
    for (const id of principle.source_pattern_ids) {
      if (owner.has(id)) fail("MODEL_COVERAGE_INVALID", "Each approved source must have one primary principle, not overlapping independent principles.");
      owner.set(id, principle.id);
    }
  }
  if (owner.size !== approved.size) fail("MODEL_COVERAGE_INVALID", "Every approved author pattern must be preserved in a primary principle.");
  const references = (component) => {
    for (const field of ["principle_ids", "device_ids", "guardrail_ids"]) {
      if ((component[field] ?? []).some((id) => !byId.has(id))) fail("MODEL_REFERENCE_INVALID", "A component reference is dangling.");
    }
  };
  for (const component of [...composition.devices, ...composition.guardrails]) {
    checkSources(component.source_pattern_ids, approved); references(component);
    if (component.principle_ids && component.source_pattern_ids.some((id) => !component.principle_ids.includes(owner.get(id)))) {
      fail("MODEL_REFERENCE_INVALID", "A device must reference the primary principles of its sources.");
    }
  }
  for (const profile of composition.contextual_profiles) {
    references(profile);
    for (const rule of profile.rules) {
      checkSources(rule.source_pattern_ids, approved);
      if (rule.source_pattern_ids.some((id) => !profile.principle_ids.includes(owner.get(id)))) {
        fail("MODEL_REFERENCE_INVALID", "A contextual rule must remain attached to its primary principle.");
      }
    }
  }
  const semanticSeen = new Set();
  for (const context of composition.semantic_context) {
    checkSources(context.source_pattern_ids, retained);
    for (const id of context.source_pattern_ids) {
      if (semanticSeen.has(id)) fail("MODEL_LINEAGE_INVALID", "Semantic context must not duplicate source groups.");
      semanticSeen.add(id);
    }
  }
  return owner;
}

export async function compileAuthorModel(repoRoot, compositionJson, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((key) => key !== "includeSemanticContext") ||
      (options.includeSemanticContext !== undefined && typeof options.includeSemanticContext !== "boolean")) {
    fail("MODEL_OPTIONS_INVALID", "Only the boolean includeSemanticContext option is supported.");
  }
  const includeSemanticContext = options.includeSemanticContext ?? true;
  const composition = parseStrict(compositionJson);
  const root = await realpath(repoRoot);
  const [review, authorFile, schemaFile, compilerFile] = await Promise.all([
    readFixed(root, `${DIRECTORY}/author-pattern-review.json`), readFixed(root, AUTHOR_PATH),
    readFixed(root, SCHEMA_PATH, MAX_MODEL_BYTES), readFixed(root, COMPILER_PATH, MAX_MODEL_BYTES),
  ]);
  // Verifies the completed review, its immutable corpus context and output schemas.
  // This call is pure: it neither uses the native apply gate nor writes outputs.
  const derived = await applyAuthorReview(root, review.text);
  if (authorFile.text !== derived.reviewed_author_patterns_json) fail("MODEL_SOURCE_MISMATCH", "The released author-pattern bytes do not match the completed review.");
  let semanticFile = null;
  if (includeSemanticContext) {
    semanticFile = await readFixed(root, SEMANTIC_PATH);
    if (semanticFile.text !== derived.reviewed_semantic_model_json) fail("MODEL_SOURCE_MISMATCH", "The released semantic bytes do not match the completed review.");
  }
  const sources = {
    sourceReviewHash: derived.completed_review_hash,
    author: JSON.parse(derived.reviewed_author_patterns_json), semantic: JSON.parse(derived.reviewed_semantic_model_json),
  };
  const schema = JSON.parse(schemaFile.text);
  const owner = validateAuthorModelComposition(composition, sources, schema);
  const source_index = sources.author.reviewed_entries.map((entry, index) => {
    const auditIndex = sources.author.audit.findIndex((item) => item.dimension === entry.dimension && item.source_pattern_id === entry.source_pattern_id);
    if (auditIndex < 0) fail("MODEL_SOURCE_MISMATCH", "An approved entry has no review audit.");
    return {
      source_pattern_id: entry.source_pattern_id, dimension: entry.dimension, principle_id: owner.get(entry.source_pattern_id),
      review_decision: sources.author.audit[auditIndex].review.decision,
      author_relevance: entry.author_relevance, generative_utility: entry.generative_utility, overuse_risk: entry.overuse_risk,
      article_count: entry.article_count, observation_count: entry.observation_count,
      support_scope: entry.article_count === 1 ? "single_article" : "multiple_articles_not_proof_of_independence",
      entry_pointer: `/reviewed_entries/${index}`, applicability_pointer: `/reviewed_entries/${index}/applicability`,
      review_notes_pointer: `/audit/${auditIndex}/review/notes`,
    };
  });
  const model = {
    schema_version: "author-model/1", source_review_hash: sources.sourceReviewHash,
    ...Object.fromEntries(SECTIONS.map((section) => [section, section === "semantic_context" && !includeSemanticContext ? [] : composition[section]])),
    compilation: {
      method: "curated-operational-composition/1", status: "compiled_synthesis_not_separately_human_reviewed",
      activation: "contextual_selection_without_quotas",
      coordination: "source_scope_and_guardrails_constrain_principles_profiles_and_devices",
      risk_policy: "preserve_qualitative_source_judgments_without_scores_or_automatic_exclusion",
      semantic_policy: "optional_conceptual_context_never_a_style_rule",
      validation_limits: "structural_binding_and_lineage_not_semantic_entailment_or_new_human_approval",
    },
    provenance: {
      compiler_version: "author-model-compiler/1", compiler_sha256: hash(compilerFile.bytes), schema_sha256: hash(schemaFile.bytes),
      composition_sha256: hash(canonicalJson(composition)),
      reviewed_author_patterns: { path: AUTHOR_PATH, sha256: hash(authorFile.bytes) },
      reviewed_semantic_model: semanticFile ? { path: SEMANTIC_PATH, sha256: hash(semanticFile.bytes) } : null,
    },
    source_index,
  };
  requireSchema(validatorsFor(schema).AuthorModel, model);
  const author_model_json = `${JSON.stringify(canonical(model), null, 2)}\n`;
  if (Buffer.byteLength(author_model_json) > MAX_MODEL_BYTES) fail("MODEL_SIZE_INVALID", "The compiled model exceeds its bounded size.");
  // Ensure all 29 lineage entries remain metadata, not an extra instruction list.
  assert.equal(source_index.length, owner.size);
  return {
    source_review_hash: sources.sourceReviewHash, author_model_json, author_model_sha256: hash(author_model_json),
    counts: { source_patterns: source_index.length, principles: model.principles.length, contextual_profiles: model.contextual_profiles.length,
      devices: model.devices.length, guardrails: model.guardrails.length, semantic_context: model.semantic_context.length },
  };
}
