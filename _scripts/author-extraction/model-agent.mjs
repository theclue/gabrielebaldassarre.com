import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { applyAuthorReview } from "./review.mjs";
import { compileAuthorModel } from "./model.mjs";

const DIRECTORY = "docs/author-pattern-results/v1.3";
const CANDIDATES = `${DIRECTORY}/author-model-candidates`;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_PREPARED_BYTES = 256 * 1024;
const HEX = /^[a-f0-9]{64}$/;
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value !== null && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const json = (value) => JSON.stringify(canonical(value));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function active(signal) { if (signal?.aborted) fail("CANCELLED", "The model compilation was cancelled."); }

async function readFixed(root, relative, limit = MAX_SOURCE_BYTES) {
  let current = root;
  try {
    const parts = relative.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const info = await lstat(current);
      if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())) throw new Error("unsafe");
    }
    const handle = await open(current, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > limit) throw new Error("size");
      const bytes = await handle.readFile();
      if (bytes.length > limit) throw new Error("size");
      return { bytes, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } finally { await handle.close(); }
  } catch { fail("SOURCE_INVALID", "A fixed model-agent input is unavailable, unsafe or oversized."); }
}

export async function prepareAuthorModelCandidate(repoRoot, includeSemanticContext = true) {
  if (typeof includeSemanticContext !== "boolean") fail("INPUT_INVALID", "The semantic-context option must be boolean.");
  const root = await realpath(repoRoot);
  const [review, author, schema, compiler, instructions, preparation] = await Promise.all([
    readFixed(root, `${DIRECTORY}/author-pattern-review.json`),
    readFixed(root, `${DIRECTORY}/reviewed-author-patterns.json`),
    readFixed(root, "_scripts/author-extraction/author-model.schema.json", MAX_PREPARED_BYTES),
    readFixed(root, "_scripts/author-extraction/model.mjs", MAX_PREPARED_BYTES),
    readFixed(root, ".opencode/agents/author-model-compiler.md", MAX_PREPARED_BYTES),
    readFixed(root, "_scripts/author-extraction/model-agent.mjs", MAX_PREPARED_BYTES),
  ]);
  const derived = await applyAuthorReview(root, review.text);
  if (author.text !== derived.reviewed_author_patterns_json) fail("MODEL_SOURCE_MISMATCH", "The released author patterns do not match their completed review.");
  let semantic = null;
  if (includeSemanticContext) {
    semantic = await readFixed(root, `${DIRECTORY}/reviewed-semantic-model.json`);
    if (semantic.text !== derived.reviewed_semantic_model_json) fail("MODEL_SOURCE_MISMATCH", "The released semantic model does not match its completed review.");
  }
  const authorData = JSON.parse(author.text);
  const semanticData = JSON.parse(derived.reviewed_semantic_model_json);
  const reviewFor = (dimension, id) => authorData.audit.find((item) => item.dimension === dimension && item.source_pattern_id === id)?.review;
  const author_patterns = authorData.reviewed_entries.map((entry) => ({
    ...Object.fromEntries(["source_pattern_id", "dimension", "label", "description", "applicability", "abstraction_kind", "type",
      "author_relevance", "generative_utility", "overuse_risk", "article_count", "observation_count"].map((key) => [key, entry[key]])),
    review_notes: reviewFor(entry.dimension, entry.source_pattern_id).notes,
  }));
  const semantic_context_sources = includeSemanticContext ? semanticData.reviewed_entries.map((entry) => ({
    ...Object.fromEntries(["source_pattern_ids", "semantic_kind", "label", "description", "applicability", "abstraction_kind", "article_count", "observation_count"].map((key) => [key, entry[key]])),
    review_notes: entry.source_pattern_ids.map((id) => ({ source_pattern_id: id, notes: reviewFor("semantic", id).notes })),
  })) : [];
  const localSchema = JSON.parse(schema.text);
  const body = {
    schema_version: "author-model-preparation/1", status: "ready", source_review_hash: derived.completed_review_hash,
    include_semantic_context: includeSemanticContext,
    method: {
      compiler_sha256: sha(compiler.bytes), schema_sha256: sha(schema.bytes), instructions_sha256: sha(instructions.bytes),
      preparation_sha256: sha(preparation.bytes), reviewed_author_patterns_sha256: sha(author.bytes),
      reviewed_semantic_model_sha256: semantic ? sha(semantic.bytes) : null,
    },
    author_patterns, semantic_context_sources,
    candidate_schema: { ...localSchema, $ref: "#/$defs/Composition" },
  };
  const result = { ...body, input_hash: sha(json(body)) };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_PREPARED_BYTES) fail("LIMIT_EXCEEDED", "The complete model preparation exceeds its size bound.");
  return result;
}

async function safeDirectory(root, relative) {
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    try { await mkdir(current); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) fail("CANDIDATE_PATH_INVALID", "The candidate directory is unsafe.");
  }
}

async function existingFile(root, relative) {
  try { await lstat(path.join(root, relative)); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  return (await readFixed(root, relative, MAX_PREPARED_BYTES)).text;
}

export async function submitAuthorModelCandidate(repoRoot, sourceReviewHash, inputHash, candidateJson,
  { includeSemanticContext = true, signal } = {}) {
  if (typeof sourceReviewHash !== "string" || typeof inputHash !== "string" || !HEX.test(sourceReviewHash) || !HEX.test(inputHash)) fail("INPUT_INVALID", "Both prepared hashes must be supplied.");
  active(signal);
  const root = await realpath(repoRoot);
  const prepared = await prepareAuthorModelCandidate(root, includeSemanticContext);
  active(signal);
  if (prepared.source_review_hash !== sourceReviewHash || prepared.input_hash !== inputHash) {
    fail("MODEL_INPUT_CHANGED", "The prepared sources, schema, compiler, instructions or options changed.");
  }
  let result;
  try { result = await compileAuthorModel(root, candidateJson, { includeSemanticContext }); }
  catch (error) {
    // Add schema locations for the single permitted correction, not raw source
    // or candidate prose. The compiler remains the authoritative validator.
    if (error?.code === "COMPOSITION_INVALID") {
      try {
        const validate = new Ajv2020({ strict: false, allErrors: true }).compile(prepared.candidate_schema);
        if (!validate(JSON.parse(candidateJson))) error.details = [...new Set(validate.errors.map((entry) => entry.instancePath))].slice(0, 5);
      } catch { /* Strict JSON failures still carry their original safe code. */ }
    }
    throw error;
  }
  active(signal);
  const model = JSON.parse(result.author_model_json);
  if (result.source_review_hash !== sourceReviewHash || model.provenance.compiler_sha256 !== prepared.method.compiler_sha256 ||
      model.provenance.schema_sha256 !== prepared.method.schema_sha256 ||
      model.provenance.reviewed_author_patterns.sha256 !== prepared.method.reviewed_author_patterns_sha256 ||
      (model.provenance.reviewed_semantic_model?.sha256 ?? null) !== prepared.method.reviewed_semantic_model_sha256) {
    fail("MODEL_INPUT_CHANGED", "The compiler binding changed during candidate validation.");
  }
  // Strict duplicate-key and schema checks have already run in the compiler.
  const candidate = JSON.parse(candidateJson);
  if (!includeSemanticContext && candidate.semantic_context.length !== 0) fail("COMPOSITION_INVALID", "An omitted semantic context must remain empty in the candidate composition.");
  const compositionJson = `${JSON.stringify(canonical(candidate), null, 2)}\n`;
  const candidate_dir = `${CANDIDATES}/${inputHash}/${result.author_model_sha256}`;
  const manifest = {
    schema_version: "author-model-candidate/1", status: "compiled_candidate",
    source_review_hash: sourceReviewHash, input_hash: inputHash, include_semantic_context: includeSemanticContext,
    candidate_dir, composition_path: `${candidate_dir}/composition.json`, author_model_path: `${candidate_dir}/author-model.json`,
    preparation_path: `${candidate_dir}/preparation.json`,
    composition_sha256: sha(compositionJson), author_model_sha256: result.author_model_sha256, counts: result.counts,
  };
  const files = [
    [manifest.preparation_path, `${json(prepared)}\n`],
    [manifest.composition_path, compositionJson], [manifest.author_model_path, result.author_model_json],
    [`${candidate_dir}/manifest.json`, `${JSON.stringify(canonical(manifest), null, 2)}\n`],
  ];
  if (files.some(([, text]) => Buffer.byteLength(text) > MAX_PREPARED_BYTES)) fail("LIMIT_EXCEEDED", "A candidate artifact exceeds its size bound.");
  active(signal);
  await safeDirectory(root, candidate_dir);
  // Preflight every existing file before writing any missing file. Identical
  // hash-addressed runs are idempotent; no existing byte is overwritten.
  for (const [relative, expected] of files) {
    const existing = await existingFile(root, relative);
    if (existing !== null && existing !== expected) fail("CANDIDATE_COLLISION", "An existing candidate artifact differs from the validated bytes.");
  }
  for (const [relative, text] of files) {
    active(signal);
    if (await existingFile(root, relative) !== null) continue;
    const handle = await open(path.join(root, relative), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
    try { await handle.writeFile(text, "utf8"); await handle.sync(); } finally { await handle.close(); }
  }
  active(signal);
  for (const [relative, expected] of files) {
    if ((await readFixed(root, relative, MAX_PREPARED_BYTES)).text !== expected) fail("CANDIDATE_COLLISION", "A persisted candidate differs from the validated bytes.");
  }
  return manifest;
}
