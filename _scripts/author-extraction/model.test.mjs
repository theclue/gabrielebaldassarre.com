import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parse as parseYaml } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import { compileAuthorModel, validateAuthorModelComposition } from "./model.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TEMP = "/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode";
const DIRECTORY = "docs/author-pattern-results/v1.3";
const schema = JSON.parse(await readFile(new URL("./author-model.schema.json", import.meta.url), "utf8"));
const compositionText = await readFile(new URL("./author-model.composition.json", import.meta.url), "utf8");
const composition = JSON.parse(compositionText);
const sources = {
  sourceReviewHash: composition.source_review_hash,
  author: JSON.parse(await readFile(join(ROOT, DIRECTORY, "reviewed-author-patterns.json"), "utf8")),
  semantic: JSON.parse(await readFile(join(ROOT, DIRECTORY, "reviewed-semantic-model.json"), "utf8")),
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const rejects = (change, code) => {
  const edited = structuredClone(composition); change(edited);
  assert.throws(() => validateAuthorModelComposition(edited, sources, schema), { code });
};

async function fixture(t) {
  const root = await mkdtemp(join(TEMP, "author-model-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of [
    "docs/corpus.yaml", "docs/author-extraction-results/v1.3", DIRECTORY,
    "_scripts/author-extraction/extraction.v1.3.schema.json",
    "_scripts/author-extraction/patterns.v0.6.schema.json",
    "_scripts/author-extraction/author-review.schema.json",
    "_scripts/author-extraction/author-model.schema.json", "_scripts/author-extraction/model.mjs",
    ".opencode/agents/author-extractor.md", ".opencode/agents/author-pattern-consolidator.md",
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

describe("author model compiler: coordinated composition, not new pattern review", () => {
  it("compiles all 29 approved patterns into six principles with valid closed output", async () => {
    const result = await compileAuthorModel(ROOT, compositionText);
    const model = JSON.parse(result.author_model_json);
    assert.deepEqual(result.counts, { source_patterns: 29, principles: 6, contextual_profiles: 4, devices: 6, guardrails: 10, semantic_context: 3 });
    const validate = new Ajv2020({ strict: false }).compile(schema);
    assert.ok(validate(model), JSON.stringify(validate.errors));
    assert.equal(model.schema_version, "author-model/1");
    assert.equal(model.source_review_hash, sources.author.provenance.completed_review_hash);
    assert.equal(result.author_model_sha256, sha(result.author_model_json));
    assert.ok(Buffer.byteLength(result.author_model_json) < 64 * 1024);
    assert.equal(model.compilation.status, "compiled_synthesis_not_separately_human_reviewed");
  });

  it("assigns exactly one primary principle and preserves risks, local support and audit pointers", async () => {
    const { author_model_json } = await compileAuthorModel(ROOT, compositionText);
    const model = JSON.parse(author_model_json);
    assert.deepEqual(model.principles.flatMap((p) => p.source_pattern_ids).sort(), sources.author.reviewed_entries.map((p) => p.source_pattern_id).sort());
    assert.equal(model.source_index.filter((s) => s.support_scope === "single_article").length, 6);
    assert.equal(model.source_index.filter((s) => s.overuse_risk === "high").length, 3);
    for (const item of model.source_index) {
      const index = Number(item.entry_pointer.split("/").at(-1));
      const source = sources.author.reviewed_entries[index];
      assert.equal(source.source_pattern_id, item.source_pattern_id);
      for (const key of ["dimension", "author_relevance", "generative_utility", "overuse_risk", "article_count", "observation_count"]) assert.equal(item[key], source[key]);
      const audit = sources.author.audit[Number(item.review_notes_pointer.split("/")[2])];
      assert.equal(audit.source_pattern_id, item.source_pattern_id);
      assert.equal(item.review_decision, audit.review.decision);
    }
    assert.ok(!model.source_index.some((s) => s.source_pattern_id === "DPC:T0010"));
  });

  it("is deterministic across composition formatting and writes no source artifacts", async () => {
    const paths = ["author-pattern-review.json", "reviewed-author-patterns.json", "reviewed-semantic-model.json", "decisional.json", "epistemic.json", "rhetorical.json", "semantic.json"];
    const before = await Promise.all(paths.map((p) => readFile(join(ROOT, DIRECTORY, p))));
    const a = await compileAuthorModel(ROOT, compositionText);
    const b = await compileAuthorModel(ROOT, JSON.stringify(composition));
    assert.equal(a.author_model_json, b.author_model_json);
    assert.equal(a.author_model_sha256, b.author_model_sha256);
    for (let i = 0; i < paths.length; i += 1) assert.deepEqual(await readFile(join(ROOT, DIRECTORY, paths[i])), before[i]);
  });

  it("keeps the three retained semantic groups optional and outside operative lineage", async () => {
    const a = JSON.parse((await compileAuthorModel(ROOT, compositionText)).author_model_json);
    assert.deepEqual(a.semantic_context.flatMap((s) => s.source_pattern_ids).sort(), ["SPC::C0001", "SPC::C0002", "SPC::R0001"]);
    assert.ok(a.semantic_context.every((s) => s.optional && s.usage === "conceptual_context_only_not_style"));
    const b = JSON.parse((await compileAuthorModel(ROOT, compositionText, { includeSemanticContext: false })).author_model_json);
    assert.deepEqual(b.semantic_context, []);
    assert.equal(b.provenance.reviewed_semantic_model, null);
    assert.deepEqual(a.principles, b.principles);
    assert.deepEqual(a.contextual_profiles, b.contextual_profiles);
    assert.deepEqual(a.devices, b.devices);
    assert.deepEqual(a.guardrails, b.guardrails);
  });

  it("preserves the key human qualifications and local activation cases in the authored synthesis", () => {
    const text = JSON.stringify(composition);
    for (const phrase of ["lapaliss", "lettore non capirebbe", "bilanciamento dimensionale", "meno frequenti", "piano reale", "rasoio di Occam"]) assert.ok(text.includes(phrase));
    const local = composition.contextual_profiles.find((p) => p.id === "C04");
    assert.deepEqual(local.rules.flatMap((r) => r.source_pattern_ids).sort(), ["APC::R0006", "APC::R0008", "EPC:T0008", "EPC:T0010"]);
    assert.equal(composition.contextual_profiles.find((p) => p.id === "C02").rules[1].source_pattern_ids[0], "DPC:T0005");
  });

  it("rejects a stale completed-review binding", () => rejects((c) => { c.source_review_hash = "0".repeat(64); }, "MODEL_BINDING_INVALID"));
  it("rejects a missing approved source instead of silently dropping it", () => rejects((c) => { c.principles[0].source_pattern_ids.pop(); }, "MODEL_COVERAGE_INVALID"));
  it("rejects overlapping primary principles", () => rejects((c) => { c.principles[1].source_pattern_ids.push(c.principles[0].source_pattern_ids[0]); }, "MODEL_COVERAGE_INVALID"));
  it("rejects rejected or invented source IDs", () => rejects((c) => { c.principles[0].source_pattern_ids[0] = "DPC:T0010"; }, "MODEL_LINEAGE_INVALID"));
  it("rejects a 29-command restatement instead of a smaller principle set", () => rejects((c) => {
    c.principles = sources.author.reviewed_entries.map((e, i) => ({ id: `P${String(i + 1).padStart(2, "0")}`, label: e.label, directive: e.description, source_pattern_ids: [e.source_pattern_id] }));
  }, "MODEL_NOT_COMPACT"));
  it("rejects duplicate component identifiers", () => rejects((c) => { c.devices[1].id = c.devices[0].id; }, "MODEL_REFERENCE_INVALID"));
  it("rejects dangling component references", () => rejects((c) => { c.devices[0].guardrail_ids.push("G99"); }, "MODEL_REFERENCE_INVALID"));
  it("rejects a contextual rule detached from its primary principle", () => rejects((c) => { c.contextual_profiles[3].principle_ids = ["P03"]; }, "MODEL_REFERENCE_INVALID"));
  it("rejects discarded semantic groups", () => rejects((c) => { c.semantic_context[0].source_pattern_ids = ["SPC::C0003"]; }, "MODEL_LINEAGE_INVALID"));
  it("rejects semantic lineage in principles and style usage in semantic context", () => {
    rejects((c) => { c.principles[0].source_pattern_ids[0] = "SPC::C0001"; }, "COMPOSITION_INVALID");
    rejects((c) => { c.semantic_context[0].usage = "imitate_style"; }, "COMPOSITION_INVALID");
  });
  it("rejects new judgments, scores, extra fields and whitespace-only instructions", () => {
    rejects((c) => { c.principles[0].score = 1; }, "COMPOSITION_INVALID");
    rejects((c) => { c.devices[0].decision = "accept"; }, "COMPOSITION_INVALID");
    rejects((c) => { c.guardrails[0].instruction = "  "; }, "COMPOSITION_INVALID");
    const remote = structuredClone(schema);
    remote.$defs.Text.$ref = "https://example.invalid/schema";
    assert.throws(() => validateAuthorModelComposition(composition, sources, remote), { code: "MODEL_SCHEMA_INVALID" });
  });

  it("rejects malformed, duplicate-key and oversized compositions before source loading", async () => {
    for (const value of ["{", compositionText.replace('"schema_version":', '"schema_version": "duplicate", "schema_version":'), " ".repeat(128 * 1024 + 1)]) {
      await assert.rejects(compileAuthorModel(ROOT, value), { code: "COMPOSITION_INVALID" });
    }
    await assert.rejects(compileAuthorModel(ROOT, compositionText, { allowNewReview: true }), { code: "MODEL_OPTIONS_INVALID" });
  });

  it("fails closed on edited released bytes or frozen sources; optional mode does not need a semantic output file", async (t) => {
    const root = await fixture(t);
    for (const name of ["reviewed-author-patterns.json", "reviewed-semantic-model.json"]) {
      const p = join(root, DIRECTORY, name); const bytes = await readFile(p);
      await writeFile(p, Buffer.concat([bytes, Buffer.from("\n")]));
      await assert.rejects(compileAuthorModel(root, compositionText), { code: "MODEL_SOURCE_MISMATCH" });
      await writeFile(p, bytes);
    }
    const semanticPath = join(root, DIRECTORY, "reviewed-semantic-model.json");
    await unlink(semanticPath);
    await assert.rejects(compileAuthorModel(root, compositionText), { code: "SOURCE_INVALID" });
    const optional = await compileAuthorModel(root, compositionText, { includeSemanticContext: false });
    assert.equal(optional.counts.semantic_context, 0);
    await cp(join(ROOT, DIRECTORY, "reviewed-semantic-model.json"), semanticPath);
    const authorPath = join(root, DIRECTORY, "reviewed-author-patterns.json");
    await unlink(authorPath); await symlink(join(ROOT, DIRECTORY, "reviewed-author-patterns.json"), authorPath);
    await assert.rejects(compileAuthorModel(root, compositionText), { code: "SOURCE_INVALID" });
    await unlink(authorPath); await cp(join(ROOT, DIRECTORY, "reviewed-author-patterns.json"), authorPath);
    const rawPath = join(root, DIRECTORY, "epistemic.json");
    await writeFile(rawPath, `${await readFile(rawPath, "utf8")}\n`);
    await assert.rejects(compileAuthorModel(root, compositionText), { code: "IMMUTABLE_INVALID" });
  });
});
