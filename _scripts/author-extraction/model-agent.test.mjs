import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parse as parseYaml } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import { prepareAuthorModelCandidate, submitAuthorModelCandidate } from "./model-agent.mjs";
import { createModelAdapter, modelPrepareInputSchema, modelSubmitInputSchema, modelToolResult } from "./model-native.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TEMP = tmpdir();
const DIR = "docs/author-pattern-results/v1.3";
const composition = await readFile(new URL("./author-model.composition.json", import.meta.url), "utf8");
const schema = JSON.parse(await readFile(new URL("./author-model.schema.json", import.meta.url), "utf8"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const bind = (body) => ({ ...body, input_hash: sha(JSON.stringify(canonical(body))) });

async function fixture(t) {
  const root = await mkdtemp(join(TEMP, "author-model-agent-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of [
    DIR, "docs/corpus.yaml", "docs/author-extraction-results/v1.3",
    "_scripts/author-extraction/extraction.v1.3.schema.json", "_scripts/author-extraction/patterns.v0.6.schema.json",
    "_scripts/author-extraction/author-review.schema.json", "_scripts/author-extraction/author-model.schema.json",
    "_scripts/author-extraction/model.mjs", "_scripts/author-extraction/model-agent.mjs",
    ".opencode/agents/author-extractor.md", ".opencode/agents/author-pattern-consolidator.md", ".opencode/agents/author-model-compiler.md",
  ]) {
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await cp(join(ROOT, relative), join(root, relative), { recursive: true });
  }
  const corpus = parseYaml(await readFile(join(root, "docs/corpus.yaml"), "utf8"));
  for (const entry of corpus.fonti) {
    await mkdir(dirname(join(root, entry.percorso)), { recursive: true });
    await cp(join(ROOT, entry.percorso), join(root, entry.percorso));
  }
  return root;
}

function preparedFixture(include = true) {
  return bind({
    schema_version: "author-model-preparation/1", status: "ready", source_review_hash: "a".repeat(64), include_semantic_context: include,
    method: { compiler_sha256: "b".repeat(64), schema_sha256: "c".repeat(64), instructions_sha256: "d".repeat(64), preparation_sha256: "e".repeat(64),
      reviewed_author_patterns_sha256: "1".repeat(64), reviewed_semantic_model_sha256: include ? "2".repeat(64) : null },
    author_patterns: ["EPC:A0001", "EPC:E0001"].map((id) => ({ source_pattern_id: id, dimension: "epistemic", label: "Fixture", description: "Fixture.",
      applicability: "Fixture only.", review_notes: null, article_count: 1, observation_count: 2, author_relevance: "contextual", generative_utility: "usable", overuse_risk: "high" })),
    semantic_context_sources: [], candidate_schema: { ...schema, $ref: "#/$defs/Composition" },
  });
}
function receipt(prepared) {
  const modelHash = "f".repeat(64);
  const dir = `${DIR}/author-model-candidates/${prepared.input_hash}/${modelHash}`;
  return { schema_version: "author-model-candidate/1", status: "compiled_candidate", source_review_hash: prepared.source_review_hash,
    input_hash: prepared.input_hash, include_semantic_context: prepared.include_semantic_context, candidate_dir: dir,
    composition_path: `${dir}/composition.json`, author_model_path: `${dir}/author-model.json`, preparation_path: `${dir}/preparation.json`,
    composition_sha256: "3".repeat(64), author_model_sha256: modelHash,
    counts: { source_patterns: 2, principles: 1, contextual_profiles: 1, devices: 0, guardrails: 1, semantic_context: 0 } };
}
const context = (id = "session") => ({ sessionId: id, agent: "author-model-compiler", signal: new AbortController().signal });
const invoke = (adapter, method, input, ctx) => Promise.resolve().then(() => adapter[method](input, ctx));
const submission = (p) => ({ source_review_hash: p.source_review_hash, input_hash: p.input_hash, candidate_json: "{}" });

describe("model-agent bounded preparation and immutable candidate core", () => {
  it("projects only approved effective sources, review notes and optional conceptual context", async () => {
    const p = await prepareAuthorModelCandidate(ROOT);
    assert.equal(p.author_patterns.length, 29); assert.equal(p.semantic_context_sources.length, 3);
    const { input_hash, ...body } = p; assert.equal(input_hash, sha(JSON.stringify(canonical(body))));
    assert.ok(!p.author_patterns.some((entry) => entry.source_pattern_id === "DPC:T0010"));
    assert.ok(p.author_patterns.find((entry) => entry.source_pattern_id === "DPC:E0001").review_notes.includes("non capirebbe"));
    assert.ok(p.author_patterns.every((entry) => !Object.hasOwn(entry, "support") && !Object.hasOwn(entry, "evidence")));
    const text = JSON.stringify(p); assert.ok(Buffer.byteLength(text) < 256 * 1024);
    const wrapped = modelToolResult(p); assert.equal(wrapped.content[0].text, text); assert.equal(wrapped.metadata.truncated, false);
    const without = await prepareAuthorModelCandidate(ROOT, false);
    assert.deepEqual(without.semantic_context_sources, []); assert.notEqual(without.input_hash, p.input_hash);
    assert.equal(without.method.reviewed_semantic_model_sha256, null);
  });

  it("saves a separate hash-addressed candidate idempotently without changing any current artifact", async (t) => {
    const root = await fixture(t);
    const names = (await readdir(join(root, DIR))).filter((name) => name.endsWith(".json") || name.endsWith(".md"));
    const before = await Promise.all(names.map((name) => readFile(join(root, DIR, name))));
    const p = await prepareAuthorModelCandidate(root);
    const first = await submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, composition);
    const modelPath = join(root, first.author_model_path); const info = await stat(modelPath);
    const second = await submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, composition);
    assert.deepEqual(first, second); assert.equal((await stat(modelPath)).mtimeMs, info.mtimeMs);
    assert.equal(sha(await readFile(modelPath)), first.author_model_sha256);
    assert.equal(sha(await readFile(join(root, first.composition_path))), first.composition_sha256);
    assert.equal(JSON.parse(await readFile(join(root, first.preparation_path), "utf8")).input_hash, p.input_hash);
    assert.deepEqual(JSON.parse(await readFile(join(root, first.candidate_dir, "manifest.json"), "utf8")), first);
    assert.equal(first.counts.source_patterns, 29); assert.equal(first.status, "compiled_candidate");
    for (let index = 0; index < names.length; index += 1) assert.deepEqual(await readFile(join(root, DIR, names[index])), before[index]);
    await writeFile(modelPath, "user candidate edit");
    await assert.rejects(submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, composition), { code: "CANDIDATE_COLLISION" });
    assert.equal(await readFile(modelPath, "utf8"), "user candidate edit");
  });

  it("binds options, instructions and sources and rejects invalid, cancelled or unsafe candidates", async (t) => {
    const root = await fixture(t);
    const p = await prepareAuthorModelCandidate(root);
    await assert.rejects(submitAuthorModelCandidate(root, p.source_review_hash, "0".repeat(64), composition), { code: "MODEL_INPUT_CHANGED" });
    await assert.rejects(submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, "{}"), { code: "COMPOSITION_INVALID" });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, composition, { signal: controller.signal }), { code: "CANCELLED" });
    const instructions = join(root, ".opencode/agents/author-model-compiler.md");
    await writeFile(instructions, `${await readFile(instructions, "utf8")}\n`);
    await assert.rejects(submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, composition), { code: "MODEL_INPUT_CHANGED" });
    const current = await prepareAuthorModelCandidate(root);
    const other = join(root, "unrelated"); await mkdir(other);
    await symlink(other, join(root, DIR, "author-model-candidates"));
    await assert.rejects(submitAuthorModelCandidate(root, current.source_review_hash, current.input_hash, composition), { code: "CANDIDATE_PATH_INVALID" });
    assert.deepEqual(await readdir(other), []);
  });

  it("can omit semantic context but cannot smuggle unprepared semantic entries into the candidate", async (t) => {
    const root = await fixture(t); const p = await prepareAuthorModelCandidate(root, false);
    await assert.rejects(submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, composition, { includeSemanticContext: false }), { code: "COMPOSITION_INVALID" });
    const candidate = JSON.parse(composition); candidate.semantic_context = [];
    const result = await submitAuthorModelCandidate(root, p.source_review_hash, p.input_hash, JSON.stringify(candidate), { includeSemanticContext: false });
    assert.equal(result.counts.semantic_context, 0);
  });
});

describe("model native protocol: host identity, binding, bounds and cancellation", () => {
  it("uses closed input schemas and denies forged caller identities or paths", async () => {
    const ajv = new Ajv2020({ strict: true });
    assert.ok(ajv.compile(modelPrepareInputSchema)({})); assert.ok(ajv.compile(modelSubmitInputSchema)(submission(preparedFixture())));
    const core = { prepareAuthorModelCandidate: async () => { throw new Error("must not run"); }, submitAuthorModelCandidate: async () => { throw new Error("must not run"); } };
    const adapter = createModelAdapter(core, ROOT);
    for (const agent of ["build", "plan", "author-extractor", "author-pattern-consolidator"]) {
      await assert.rejects(invoke(adapter, "prepare", {}, { ...context(agent), agent }), { code: "AGENT_DENIED" });
    }
    await assert.rejects(invoke(adapter, "prepare", { root: "/other" }, context()), { code: "INPUT_INVALID" });
    await assert.rejects(invoke(adapter, "prepare", { agent: "author-model-compiler" }, context()), { code: "INPUT_INVALID" });
    await assert.rejects(invoke(adapter, "prepare", {}, { ...context(), sessionId: "" }), { code: "PROTOCOL_INVALID" });
  });

  it("binds one preparation and options, saves through the trusted core and seals after acceptance", async () => {
    const calls = []; let p;
    const adapter = createModelAdapter({
      async prepareAuthorModelCandidate(root, include) { calls.push(["prepare", root, include]); return p = preparedFixture(include); },
      async submitAuthorModelCandidate(...args) { calls.push(["submit", ...args]); return receipt(p); },
    }, ROOT);
    const ctx = context();
    const first = await adapter.prepare({ include_semantic_context: false }, ctx);
    assert.deepEqual(await adapter.prepare({ include_semantic_context: false }, ctx), first); assert.equal(calls.length, 1);
    await assert.rejects(invoke(adapter, "prepare", {}, ctx), { code: "PROTOCOL_INVALID" });
    const result = await adapter.submit(submission(first), ctx);
    assert.equal(result.status, "compiled_candidate"); assert.equal(calls[1][1], ROOT); assert.equal(calls[1].at(-1).includeSemanticContext, false);
    assert.equal(typeof calls[1].at(-1).signal.aborted, "boolean");
    await assert.rejects(invoke(adapter, "submit", submission(first), ctx), { code: "PROTOCOL_INVALID" });
  });

  it("counts rejected received submissions and permits only one bounded correction", async () => {
    let attempts = 0; const p = preparedFixture();
    const adapter = createModelAdapter({ prepareAuthorModelCandidate: async () => p, async submitAuthorModelCandidate() {
      attempts += 1; throw Object.assign(new Error("do not echo this raw candidate"), { code: "COMPOSITION_INVALID" });
    } }, ROOT);
    const ctx = context(); await adapter.prepare({}, ctx);
    await assert.rejects(invoke(adapter, "submit", { ...submission(p), override: true }, ctx), { code: "INPUT_INVALID" });
    await assert.rejects(invoke(adapter, "submit", submission(p), ctx), { code: "COMPOSITION_INVALID", message: "The composition does not match its closed contract." });
    await assert.rejects(invoke(adapter, "submit", submission(p), ctx), { code: "ATTEMPT_LIMIT" }); assert.equal(attempts, 1);
  });

  it("blocks stale sessions, redacts unknown failures and rejects inconsistent core receipts", async () => {
    const p = preparedFixture();
    const adapter = createModelAdapter({ prepareAuthorModelCandidate: async () => p,
      async submitAuthorModelCandidate() { throw Object.assign(new Error("secret"), { code: "MODEL_INPUT_CHANGED" }); } }, ROOT);
    const ctx = context(); await adapter.prepare({}, ctx);
    await assert.rejects(invoke(adapter, "submit", { ...submission(p), input_hash: "0".repeat(64) }, ctx), { code: "PROTOCOL_INVALID" });
    await assert.rejects(invoke(adapter, "submit", submission(p), ctx), { code: "MODEL_INPUT_CHANGED" });
    await assert.rejects(invoke(adapter, "prepare", {}, ctx), { code: "PROTOCOL_INVALID" });
    const bad = createModelAdapter({ prepareAuthorModelCandidate: async () => p, submitAuthorModelCandidate: async () => ({ ...receipt(p), author_model_path: "../../escape" }) }, ROOT);
    const other = context("receipt"); await bad.prepare({}, other);
    await assert.rejects(invoke(bad, "submit", submission(p), other), { code: "INTERNAL_ERROR" });
    const unknown = createModelAdapter({ prepareAuthorModelCandidate: async () => { throw new Error("secret"); }, submitAuthorModelCandidate: async () => null }, ROOT);
    await assert.rejects(invoke(unknown, "prepare", {}, context("unknown")), { code: "INTERNAL_ERROR", message: "The model operation failed safely." });
  });

  it("rejects oversized and malformed preparation or composition without truncation", async () => {
    const p = preparedFixture();
    const core = { prepareAuthorModelCandidate: async () => ({ ...p, input_hash: "0".repeat(64) }), submitAuthorModelCandidate: async () => null };
    await assert.rejects(invoke(createModelAdapter(core, ROOT), "prepare", {}, context()), { code: "INTERNAL_ERROR" });
    core.prepareAuthorModelCandidate = async () => ({ ...p, extra: "x".repeat(256 * 1024) });
    await assert.rejects(invoke(createModelAdapter(core, ROOT), "prepare", {}, context("big")), { code: "LIMIT_EXCEEDED" });
    core.prepareAuthorModelCandidate = async () => p;
    const adapter = createModelAdapter(core, ROOT); const ctx = context("candidate"); await adapter.prepare({}, ctx);
    await assert.rejects(invoke(adapter, "submit", { ...submission(p), candidate_json: "è".repeat(100000) }, ctx), { code: "LIMIT_EXCEEDED" });
  });

  it("cancels in-flight work and propagates plugin disposal to the core's signal", async () => {
    const p = preparedFixture(); let release; let signal;
    const adapter = createModelAdapter({ prepareAuthorModelCandidate: async () => p,
      submitAuthorModelCandidate: (...args) => { signal = args.at(-1).signal; return new Promise((resolve) => { release = resolve; }); } }, ROOT);
    const ctx = context(); await adapter.prepare({}, ctx);
    const pending = adapter.submit(submission(p), ctx); await Promise.resolve();
    adapter.dispose(); assert.equal(signal.aborted, true); release(receipt(p));
    await assert.rejects(pending, { code: "CANCELLED" });
    await assert.rejects(invoke(adapter, "prepare", {}, context("later")), { code: "CANCELLED" });
  });
});

describe("author-model-compiler agent configuration", () => {
  it("uses V2 file-based subagent permissions, inherits its model and permits only the two bounded tools", async () => {
    const text = await readFile(join(ROOT, ".opencode/agents/author-model-compiler.md"), "utf8");
    const frontmatter = parseYaml(text.split("---")[1]);
    assert.equal(frontmatter.mode, "subagent"); assert.equal(frontmatter.model, undefined); assert.equal(frontmatter.permission, undefined);
    assert.deepEqual(frontmatter.permissions, [
      { action: "*", resource: "*", effect: "deny" },
      { action: "author_model_prepare", resource: "*", effect: "allow" },
      { action: "author_model_submit", resource: "*", effect: "allow" },
    ]);
    const config = JSON.parse(await readFile(join(ROOT, ".opencode/opencode.json"), "utf8"));
    assert.ok(config.agents["copilot-pipeline-orchestrator"].permissions.some((r) => r.action === "subagent" && r.resource === "author-model-compiler" && r.effect === "allow"));
    assert.ok(text.includes("never overwrites the current model"));
  });
});
