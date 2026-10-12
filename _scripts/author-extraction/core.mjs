import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { isAlias, parseDocument } from "yaml";

const ARTICLE_IDS = Array.from({ length: 12 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`);
const SCHEMA_PATH = "_scripts/author-extraction/extraction.schema.json";
const CORPUS_PATH = "docs/corpus.yaml";
const INSTRUCTIONS_PATH = ".opencode/agents/author-extractor.md";
const SOURCE_LIMIT = 262144;
const CANDIDATE_LIMIT = 65536;
const PREPARED_LIMIT = 4 * 1024 * 1024;
const ACCEPTED_LIMIT = 1024 * 1024;
const VERSION = Object.freeze({
  schema_version: "author-extraction/1",
  prepare_version: "prepare/1",
  segmentation_version: "raw-blank-lines/1",
  measurement_version: "raw-body-counts/1",
  instructions_version: "author-extractor/1",
});

function coreError(code, message, details = []) {
  const error = new Error(String(message).slice(0, 240));
  error.code = code;
  error.details = details.filter((detail) => typeof detail === "string").slice(0, 5);
  return error;
}

function isCoreError(error) {
  return error instanceof Error && typeof error.code === "string" && Array.isArray(error.details);
}

function fail(code, message, details) {
  throw coreError(code, message, details);
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

function validateSchema(errors, value, code, message) {
  if (errors(value)) return;
  const details = (errors.errors ?? [])
    .map((entry) => entry.instancePath || "")
    .filter((pointer, index, all) => all.indexOf(pointer) === index)
    .slice(0, 5);
  fail(code, message, details);
}

async function getValidators(root) {
  let schemaBytes;
  try {
    schemaBytes = await readRootFile(root, SCHEMA_PATH);
  } catch {
    fail("INTERNAL_ERROR", "The local extraction schema is unavailable.");
  }

  let schema;
  try {
    schema = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(schemaBytes));
    const ajv = new Ajv2020({
      allErrors: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
      strict: false,
    });
    ajv.addSchema(schema);
    const compiled = { schemaHash: sha256(schemaBytes) };
    compiled.final = ajv.getSchema(schema.$id);
    for (const name of Object.keys(schema.$defs ?? {})) {
      compiled[name] = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
      if (!compiled[name]) throw new Error("A schema definition could not be compiled.");
    }
    if (!compiled.final || !compiled.Prepared || !compiled.Candidate) throw new Error("Required schemas were not compiled.");
    return compiled;
  } catch {
    fail("INTERNAL_ERROR", "The local extraction schema is invalid.");
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
    if (isCoreError(error)) throw error;
    fail("CORE_INVALID_ARGUMENT", "The workspace root is unavailable.");
  }
}

async function readRootFile(root, relativePath, maximumBytes = Number.MAX_SAFE_INTEGER) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.startsWith("/") || relativePath.includes("\\") || relativePath.includes("\0")) {
    throw new Error("Invalid internal relative path.");
  }
  const parts = relativePath.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) throw new Error("Invalid internal relative path.");
  let current = root.path;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const info = await lstat(current);
    if (info.isSymbolicLink() || info.dev !== root.device) throw new Error("Unsafe workspace path.");
    if (index < parts.length - 1 ? !info.isDirectory() : !info.isFile()) throw new Error("Unexpected workspace file type.");
  }
  const absolute = await realpath(current);
  if (absolute !== root.path && !absolute.startsWith(`${root.path}${path.sep}`)) throw new Error("Workspace path escapes the root.");
  const handle = await open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.dev !== root.device) throw new Error("Unexpected workspace file type.");
    if (info.size > maximumBytes) {
      const error = new Error("Workspace file exceeds its size limit.");
      error.tooLarge = true;
      throw error;
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function yamlDocument(bytes, code, message) {
  let document;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    document = parseDocument(text, { uniqueKeys: true, maxAliasCount: 0, strict: true, prettyErrors: false });
    if (document.errors.length || document.warnings.length) fail(code, message);
    const containsAlias = (node) => {
      if (!node || typeof node !== "object") return false;
      if (isAlias(node)) return true;
      if (Array.isArray(node)) return node.some(containsAlias);
      if (Array.isArray(node.items) && node.items.some(containsAlias)) return true;
      return containsAlias(node.key) || containsAlias(node.value);
    };
    if (containsAlias(document.contents)) fail(code, message);
    return document;
  } catch (error) {
    if (isCoreError(error)) throw error;
    fail(code, message);
  }
}

async function parseCorpus(root) {
  let bytes;
  try {
    bytes = await readRootFile(root, CORPUS_PATH);
  } catch {
    fail("CORPUS_INVALID", "The approved corpus declaration is unavailable or unsafe.");
  }
  const doc = yamlDocument(bytes, "CORPUS_INVALID", "The approved corpus declaration is invalid.");
  let corpus;
  try {
    corpus = doc.toJS({ maxAliasCount: 0 });
  } catch {
    fail("CORPUS_INVALID", "The approved corpus declaration is invalid.");
  }
  if (!corpus || typeof corpus !== "object" || Array.isArray(corpus) || !corpus.contesto ||
    typeof corpus.contesto !== "object" || Array.isArray(corpus.contesto) || !Array.isArray(corpus.fonti) || !Array.isArray(corpus.esclusioni)) {
    fail("CORPUS_INVALID", "The approved corpus declaration is invalid.");
  }
  const approved = new Map();
  for (const entry of corpus.fonti) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !== "id,percorso,rappresentativo_stile" ||
      typeof entry.id !== "string" || !ARTICLE_IDS.includes(entry.id)) {
      fail("CORPUS_INVALID", "The approved corpus declaration is invalid.");
    }
    if (approved.has(entry.id) || typeof entry.percorso !== "string" || typeof entry.rappresentativo_stile !== "boolean") {
      fail("CORPUS_INVALID", "The approved corpus declaration is invalid.");
    }
    if (entry.percorso.startsWith("/") || entry.percorso.includes("\\") || entry.percorso.includes("\0") || entry.percorso.split("/").some((part) => !part || part === "." || part === "..")) {
      fail("CORPUS_INVALID", "The approved corpus declaration is invalid.");
    }
    if (entry.rappresentativo_stile) approved.set(entry.id, entry.percorso);
  }
  for (const exclusion of corpus.esclusioni) {
    if (!exclusion || typeof exclusion !== "object" || Array.isArray(exclusion) ||
      typeof exclusion.percorso !== "string" || typeof exclusion.motivo !== "string") {
      fail("CORPUS_INVALID", "The approved corpus declaration is invalid.");
    }
  }
  if (ARTICLE_IDS.some((id) => !approved.has(id))) fail("CORPUS_INVALID", "The approved corpus declaration is incomplete.");
  return { approved, bytes };
}

function decodeSource(bytes) {
  if (bytes.length > SOURCE_LIMIT) fail("LIMIT_EXCEEDED", "The approved source exceeds the size limit.");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("SOURCE_INVALID", "The approved source is not valid UTF-8.");
  }

  let offset;
  if (text.startsWith("---\r\n")) offset = 5;
  else if (text.startsWith("---\n")) offset = 4;
  else fail("SOURCE_BOUNDARY", "The approved source has no valid opening front-matter boundary.");

  let closingStart = -1;
  let bodyStart = -1;
  while (offset <= text.length) {
    const newline = text.indexOf("\n", offset);
    const lineEnd = newline === -1 ? text.length : newline;
    const rawLine = text.slice(offset, lineEnd);
    const line = newline !== -1 ? rawLine.replace(/\r$/, "") : rawLine;
    if (line === "---") {
      closingStart = offset;
      bodyStart = newline === -1 ? text.length : newline + 1;
      break;
    }
    if (newline === -1) break;
    offset = newline + 1;
  }
  if (closingStart === -1) fail("SOURCE_INVALID", "The approved source front matter is not closed.");

  const frontMatter = text.slice(text.startsWith("---\r\n") ? 5 : 4, closingStart);
  yamlDocument(Buffer.from(frontMatter, "utf8"), "SOURCE_INVALID", "The approved source front matter is invalid.");
  return text.slice(bodyStart);
}

function splitPassages(body) {
  const ranges = [];
  const delimiter = /(?:\r\n|\n)[\t ]*(?:\r\n|\n)(?:[\t ]*(?:\r\n|\n))*/g;
  let start = 0;
  for (const match of body.matchAll(delimiter)) {
    if (match.index > start) ranges.push([start, match.index]);
    start = match.index + match[0].length;
  }
  if (start < body.length) ranges.push([start, body.length]);
  if (ranges.length > 512) fail("LIMIT_EXCEEDED", "The source has too many raw passages.");

  const codePointOffsets = new Uint32Array(body.length + 1);
  let codePoint = 0;
  for (let index = 0; index < body.length;) {
    const width = body.codePointAt(index) > 0xffff ? 2 : 1;
    codePointOffsets[index] = codePoint;
    if (width === 2) codePointOffsets[index + 1] = codePoint;
    index += width;
    codePoint += 1;
    codePointOffsets[index] = codePoint;
  }
  return ranges.map(([startIndex, endIndex], index) => ({
    passage_id: `P${String(index + 1).padStart(4, "0")}`,
    start_cp: codePointOffsets[startIndex],
    end_cp: codePointOffsets[endIndex],
    text: body.slice(startIndex, endIndex),
  }));
}

function measureBody(body) {
  return {
    scope: "raw_markdown_body",
    utf8_bytes: Buffer.byteLength(body, "utf8"),
    unicode_code_points: Array.from(body).length,
    nonblank_lines: body.split(/\r\n|\n|\r/).filter((line) => /\S/u.test(line)).length,
    advanced_stylometry: { status: "not_computed", value: null, reason_code: "OUT_OF_SCOPE_V1" },
  };
}

async function prepareWith(root, articleId, schema) {
  if (typeof articleId !== "string") fail("CORE_INVALID_ARGUMENT", "An article ID is required.");
  if (!ARTICLE_IDS.includes(articleId)) fail("UNKNOWN_ARTICLE", "The article ID is not approved.");
  const corpus = await parseCorpus(root);
  const relativePath = corpus.approved.get(articleId);
  if (!relativePath) fail("UNKNOWN_ARTICLE", "The article ID is not approved.");

  let sourceBytes;
  try {
    sourceBytes = await readRootFile(root, relativePath, SOURCE_LIMIT);
  } catch (error) {
    if (error?.tooLarge) fail("LIMIT_EXCEEDED", "The approved source exceeds the size limit.");
    fail("SOURCE_INVALID", "The approved source is unavailable, unsafe, or exceeds the size limit.");
  }
  const body = decodeSource(sourceBytes);
  let instructionsBytes;
  try {
    instructionsBytes = await readRootFile(root, INSTRUCTIONS_PATH);
  } catch {
    fail("INTERNAL_ERROR", "The companion extraction instructions are unavailable.");
  }
  const source = {
    article_id: articleId,
    path: relativePath,
    corpus_hash: sha256(corpus.bytes),
    file_hash: sha256(sourceBytes),
  };
  const method = {
    prepare_version: VERSION.prepare_version,
    segmentation_version: VERSION.segmentation_version,
    measurement_version: VERSION.measurement_version,
    instructions_version: VERSION.instructions_version,
    schema_hash: schema.schemaHash,
    instructions_hash: sha256(instructionsBytes),
  };
  const prepared = {
    schema_version: VERSION.schema_version,
    source,
    method,
    input_hash: sha256(Buffer.from(canonicalJson({ source, method }), "utf8")),
    body,
    passages: splitPassages(body),
    measurements: measureBody(body),
  };
  validateSchema(schema.Prepared, prepared, "INTERNAL_ERROR", "Prepared extraction data failed local validation.");
  if (Buffer.byteLength(canonicalJson(prepared), "utf8") > PREPARED_LIMIT) fail("LIMIT_EXCEEDED", "Prepared extraction data exceeds the response limit.");
  return prepared;
}

async function prepareCurrent(repoRoot, articleId) {
  const root = await trustedRoot(repoRoot);
  const schema = await getValidators(root);
  return prepareWith(root, articleId, schema);
}

function parseStrictJson(text) {
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
  value();
  whitespace();
  if (index !== text.length) throw new Error("Invalid JSON.");
  return JSON.parse(text);
}

function validateCandidateEvidence(candidate, prepared) {
  const passages = new Map(prepared.passages.map((passage) => [passage.passage_id, passage.text]));
  for (let observationIndex = 0; observationIndex < candidate.observations.length; observationIndex += 1) {
    const observation = candidate.observations[observationIndex];
    for (let evidenceIndex = 0; evidenceIndex < observation.evidence.length; evidenceIndex += 1) {
      const evidence = observation.evidence[evidenceIndex];
      if (evidence.article_id !== prepared.source.article_id || !passages.has(evidence.passage_id) ||
        !passages.get(evidence.passage_id).includes(evidence.quote) || !prepared.body.includes(evidence.quote)) {
        fail("EVIDENCE_INVALID", "Evidence must quote the current article passage exactly.", [
          `/observations/${observationIndex}/evidence/${evidenceIndex}`,
        ]);
      }
    }
  }
}

function validateCoverage(candidate) {
  const dimensions = ["rhetorical", "epistemic", "semantic", "decisional"];
  for (const dimension of dimensions) {
    const observed = candidate.observations.some((observation) => observation.dimension === dimension);
    if ((candidate.coverage[dimension].status === "observed") !== observed) {
      fail("COVERAGE_INVALID", "Coverage must match the candidate observations.", [`/coverage/${dimension}`]);
    }
  }
}

export async function prepareArticle(repoRoot, articleId) {
  try {
    const prepared = await prepareCurrent(repoRoot, articleId);
    return JSON.parse(canonicalJson(prepared));
  } catch (error) {
    if (isCoreError(error)) throw error;
    throw coreError("INTERNAL_ERROR", "Article preparation failed.");
  }
}

export async function acceptCandidate(repoRoot, articleId, inputHash, candidateJson) {
  try {
    if (typeof articleId !== "string") fail("CORE_INVALID_ARGUMENT", "An article ID is required.");
    if (!ARTICLE_IDS.includes(articleId)) fail("UNKNOWN_ARTICLE", "The article ID is not approved.");
    if (typeof inputHash !== "string" || !/^[a-f0-9]{64}$/.test(inputHash) || typeof candidateJson !== "string") {
      fail("CORE_INVALID_ARGUMENT", "The candidate submission arguments are invalid.");
    }
    if (Buffer.byteLength(candidateJson, "utf8") > CANDIDATE_LIMIT) fail("LIMIT_EXCEEDED", "The candidate submission exceeds the size limit.");

    let candidate;
    try {
      candidate = parseStrictJson(candidateJson);
    } catch {
      fail("CANDIDATE_JSON_INVALID", "The candidate is not valid JSON.");
    }
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && Array.isArray(candidate.observations) && candidate.observations.length === 0) {
      fail("NO_OBSERVATIONS", "At least one candidate observation is required.", ["/observations"]);
    }

    const root = await trustedRoot(repoRoot);
    const schema = await getValidators(root);
    validateSchema(schema.Candidate, candidate, "CANDIDATE_SCHEMA_INVALID", "The candidate does not match the extraction schema.");

    const prepared = await prepareWith(root, articleId, schema);
    if (prepared.input_hash !== inputHash) fail("INPUT_CHANGED", "The prepared source or method has changed.");
    validateCandidateEvidence(candidate, prepared);
    validateCoverage(candidate);

    const finalRecord = {
      schema_version: VERSION.schema_version,
      source: prepared.source,
      method: prepared.method,
      measurements: prepared.measurements,
      coverage: candidate.coverage,
      observations: candidate.observations,
    };
    validateSchema(schema.final, finalRecord, "FINAL_SCHEMA_INVALID", "The assembled final record failed local validation.");
    const finalJson = canonicalJson(finalRecord);
    const envelopeJson = JSON.stringify({ status: "accepted", canonical_json: finalJson });
    if (Buffer.byteLength(finalJson, "utf8") > ACCEPTED_LIMIT || Buffer.byteLength(envelopeJson, "utf8") > ACCEPTED_LIMIT) {
      fail("LIMIT_EXCEEDED", "The accepted record exceeds the response limit.");
    }
    return finalJson;
  } catch (error) {
    if (isCoreError(error)) throw error;
    throw coreError("INTERNAL_ERROR", "Candidate acceptance failed.");
  }
}
