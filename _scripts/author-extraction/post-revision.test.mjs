import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { authoringSha as sha } from "./post-authoring.mjs";
import { planAuthorRevision, prepareAuthorRevision, submitAuthorEditorialReview, verifyAuthorRevisionContext, verifyAuthorRevisionWritten } from "./post-revision.mjs";
import { setupPostAuthoring } from "./post-authoring-plugin.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TEMP = "/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode";
const target = "_drafts/revision-fixture.md";
const aspects = ["opening", "decision", "technical_transition", "limitation"];
const original = "---\ntitle: Fixture\n---\nOriginal synthetic fixture body, not a blog article.\n";
const revised = `---\ntitle: Fixture\n---\n${aspects.map((x) => `Synthetic ${x} passage for offline tests only.`).join("\n\n")}\n`;
const input = {
  target_path: target, request: "Rivedere una fixture preservando fatti e codice; valutare la voce senza certificarla.",
  task: { mode: "rewrite", content_type: "tutorial", language: "it", objective: "Revisionare la prosa della fixture senza inventare esperienze.", features: ["implementation_choices"] },
  references: [
    { article_id: "A09", reason: "Tutorial HA con scelte motivate e approssimazioni esplicite.", passages: [
      { aspect: "opening", quote: "La risposta è sì, con qualche compromesso." },
      { aspect: "decision", quote: "Volevo capire, allora, se fosse possibile stimare l'illuminamento con quello che già avevo" },
      { aspect: "limitation", quote: "La linearità brightness → lumen è un'approssimazione (i LED non sono perfettamente lineari), ma sufficiente per questo scopo." },
    ] },
    { article_id: "A19", reason: "Passaggio dalla spiegazione al codice nello stesso dominio applicativo.", passages: [
      { aspect: "technical_transition", quote: "Da qui in poi è tutta discesa. Una semplice `picture-entity`" },
    ] },
  ],
};

async function fixture(t) {
  const root = await mkdtemp(path.join(TEMP, "post-revision-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = ["docs/corpus.yaml", ".opencode/agents/author-extractor.md", "docs/author-pattern-results/v1.3/author-model.json",
    ...["author-model.schema.json", "author-runtime-profile.schema.json", "identifiers.schema.json", "runtime.mjs", "runtime-guardrails.mjs", "identifiers.mjs", "extraction.v1.3.schema.json"].map((p) => `_scripts/author-extraction/${p}`),
    "_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md", "_posts/home-assistant/2026-05-24-dashboard-astrometria-parte-3.md"];
  for (const file of files) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await cp(path.join(ROOT, file), path.join(root, file)); }
  await mkdir(path.join(root, "_drafts")); await writeFile(path.join(root, target), original);
  // There is deliberately no Rakefile: revision must never scaffold or run Rake.
  return root;
}
const decode = (v) => JSON.parse(v.content[0].text);
function host(root, storage = new Map()) {
  const tools = new Map(), hooks = new Map(), commands = new Map(), permissions = [];
  let deny = false, directory = root;
  const registration = (map, callback) => { callback({ add: (d) => map.set(d.name, d) }); return Promise.resolve({ async dispose() { map.clear(); } }); };
  const ctx = { app: { version: "2.0.31" },
    storage: { async get(k) { return structuredClone(storage.get(k)); }, async set(k, v) { storage.set(k, structuredClone(v)); }, async remove(k) { storage.delete(k); } },
    permission: { async assert(v) { permissions.push(v); if (deny) throw Object.assign(new Error("Denied"), { code: "DENIED" }); } },
    tool: { transform: (cb) => registration(tools, cb) }, command: { transform: (cb) => registration(commands, cb) },
    session: { async get() { return { location: { directory } }; }, async synthetic() {},
      async hook(k, cb) { hooks.set(k, cb); return { async dispose() { hooks.delete(k); } }; } },
  };
  return { ctx, tools, hooks, commands, permissions, storage, deny: () => { deny = true; }, move: (d) => { directory = d; },
    call: { sessionID: "session-1", agent: "build", id: "tool-1", messageID: "message-1", signal: new AbortController().signal },
    event: (sessionID = "session-1") => ({ sessionID, system: [], model: { providerID: "fixture", id: "no-provider" } }) };
}
function report(body = revised) {
  return { target_sha256: sha(body), summary: "Synthetic grounded comparison, not an author voice assessment.",
    comparisons: aspects.map((aspect) => {
      const reference = input.references.find((r) => r.passages.some((p) => p.aspect === aspect));
      return { aspect, status: "coherent", rationale: "Literal binding fixture only; semantic judgment is not validated by the test.",
        target_quote: `Synthetic ${aspect} passage for offline tests only.`,
        reference: { article_id: reference.article_id, quote: reference.passages.find((p) => p.aspect === aspect).quote } };
    }) };
}

describe("existing article revision and editorial evidence, no Rake or provider", () => {
  it("plans read-only, snapshots current user bytes and leaves the article untouched", async (t) => {
    const root = await fixture(t), before = await readdir(root, { recursive: true });
    const plan = await planAuthorRevision(root, input);
    assert.deepEqual(await readdir(root, { recursive: true }), before);
    const p = await prepareAuthorRevision(root, input, { plan });
    assert.equal(await readFile(path.join(root, target), "utf8"), original);
    assert.equal(await readFile(path.join(root, p.source_path), "utf8"), original);
    assert.equal(p.schema_version, "author-post-revision/1");
    assert.ok(p.receipt_path.startsWith(".opencode/authoring-revisions/"));
    assert.ok(p.editorial_context_markdown.includes(input.references[0].passages[0].quote));
    assert.ok(p.editorial_context_markdown.includes("non modifica il modello governato"));
    assert.equal(await verifyAuthorRevisionContext(root, p), p.instructions_markdown);
    const again = await prepareAuthorRevision(root, input);
    assert.notEqual(again.receipt_path, p.receipt_path);
  });
  it("rejects malformed paths, unsupported modes, self/duplicate references and invented quotes before writes", async (t) => {
    const root = await fixture(t), before = await readdir(root, { recursive: true });
    for (const change of [{ target_path: "../outside.md" }, { target_path: "_drafts/./revision-fixture.md" }, { target_path: "docs/notes.md" },
      { task: { ...input.task, mode: "generate" } }, { task: { ...input.task, mode: "review" } },
      { references: [input.references[0], input.references[0]] },
      { references: [{ ...input.references[0], passages: [{ aspect: "opening", quote: "Invented reference quotation." }] }, input.references[1]] },
      { references: [{ ...input.references[0], article_id: "A21" }, input.references[1]] },
      { target_path: "_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md" }, { disable_guardrails: true }]) {
      await assert.rejects(prepareAuthorRevision(root, { ...input, ...change }));
    }
    assert.deepEqual(await readdir(root, { recursive: true }), before);
    await symlink(path.join(root, target), path.join(root, "_drafts/link.md"));
    await assert.rejects(prepareAuthorRevision(root, { ...input, target_path: "_drafts/link.md" }));
  });
  it("does not overwrite user edits that arrive while permission is pending", async (t) => {
    const root = await fixture(t), plan = await planAuthorRevision(root, input);
    await writeFile(path.join(root, target), revised);
    await assert.rejects(prepareAuthorRevision(root, input, { plan }), { code: "AUTHOR_REVISION_SOURCE_CHANGED" });
    assert.equal(await readFile(path.join(root, target), "utf8"), revised);
    assert.ok(!(await readdir(path.join(root, ".opencode"))).includes("authoring-revisions"));
  });
  it("binds runtime, references and original snapshot, while permitting article edits", async (t) => {
    for (const field of ["source_path", "task_path", "instructions_path", "receipt_path"]) {
      const root = await fixture(t), p = await prepareAuthorRevision(root, input);
      await writeFile(path.join(root, target), revised);
      assert.equal(await verifyAuthorRevisionContext(root, p), p.instructions_markdown);
      await writeFile(path.join(root, p[field]), "changed");
      await assert.rejects(verifyAuthorRevisionContext(root, p));
    }
    const root = await fixture(t), p = await prepareAuthorRevision(root, input);
    await writeFile(path.join(root, "_posts/home-assistant/2026-05-24-dashboard-astrometria-parte-3.md"), "changed");
    await assert.rejects(verifyAuthorRevisionContext(root, p), { code: "AUTHOR_REVISION_REFERENCE_CHANGED" });
  });
  it("requires fresh grounded comparison and never turns it into human approval", async (t) => {
    const root = await fixture(t), p = await prepareAuthorRevision(root, input);
    await assert.rejects(verifyAuthorRevisionWritten(root, p), { code: "AUTHOR_REVISION_BODY_UNCHANGED" });
    await writeFile(path.join(root, target), revised);
    await assert.rejects(verifyAuthorRevisionWritten(root, p), { code: "AUTHOR_EDITORIAL_REQUIRED" });
    const candidate = report();
    await assert.rejects(submitAuthorEditorialReview(root, p, JSON.stringify({ ...candidate, target_sha256: "0".repeat(64) })), { code: "AUTHOR_EDITORIAL_STALE" });
    const invented = structuredClone(candidate); invented.comparisons[0].reference.quote = "Invented reference quote.";
    await assert.rejects(submitAuthorEditorialReview(root, p, JSON.stringify(invented)), { code: "AUTHOR_EDITORIAL_EVIDENCE_INVALID" });
    const wrongTarget = structuredClone(candidate); wrongTarget.comparisons[0].target_quote = "A sentence absent from this body.";
    await assert.rejects(submitAuthorEditorialReview(root, p, JSON.stringify(wrongTarget)), { code: "AUTHOR_EDITORIAL_EVIDENCE_INVALID" });
    await assert.rejects(submitAuthorEditorialReview(root, p, JSON.stringify({ ...candidate, human_approval: true })), { code: "AUTHOR_EDITORIAL_INPUT_INVALID" });
    const duplicate = JSON.stringify(candidate).replace('"summary":', '"target_sha256":"' + candidate.target_sha256 + '","summary":');
    await assert.rejects(submitAuthorEditorialReview(root, p, duplicate), { code: "AUTHOR_EDITORIAL_INPUT_INVALID" });
    const review = await submitAuthorEditorialReview(root, p, JSON.stringify(candidate));
    assert.equal(review.human_approval, false); await verifyAuthorRevisionWritten(root, p, review);
    const saved = JSON.parse(await readFile(path.join(root, review.report_path), "utf8"));
    assert.equal(saved.status, "candidate_pending_human");
    assert.ok(saved.verification_scope.includes("not_voice_quality"));
    await writeFile(path.join(root, target), `${revised}\nFurther user edit.\n`);
    await assert.rejects(verifyAuthorRevisionWritten(root, p, review), { code: "AUTHOR_EDITORIAL_STALE" });
  });
  it("does not allow needs-revision or entirely non-applicable reports to close writing", async (t) => {
    const root = await fixture(t), p = await prepareAuthorRevision(root, input); await writeFile(path.join(root, target), revised);
    const candidate = report(); candidate.comparisons[0].status = "needs_revision";
    const review = await submitAuthorEditorialReview(root, p, JSON.stringify(candidate));
    await assert.rejects(verifyAuthorRevisionWritten(root, p, review), { code: "AUTHOR_EDITORIAL_REVISION_NEEDED" });
    for (const c of candidate.comparisons) { c.status = "not_applicable"; c.target_quote = null; c.reference = null; }
    await assert.rejects(submitAuthorEditorialReview(root, p, JSON.stringify(candidate)), { code: "AUTHOR_EDITORIAL_INPUT_INVALID" });
  });
});

describe("revision plugin lifecycle and permission boundary", () => {
  it("permission denial or cancellation leaves no snapshot, edit or activation", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup); h.deny();
    await assert.rejects(h.tools.get("author_post_revision_prepare").execute(input, h.call), { code: "DENIED" });
    assert.equal(h.permissions.length, 1); assert.equal(h.permissions[0].action, "edit"); assert.equal(h.storage.size, 0);
    assert.equal(await readFile(path.join(root, target), "utf8"), original);
    assert.ok(!(await readdir(path.join(root, ".opencode"))).includes("authoring-revisions"));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(h.tools.get("author_post_revision_prepare").execute(input, { ...h.call, signal: controller.signal }), { name: "AbortError" });
  });
  it("keeps runtime/references active through revision and report, across reload, until explicit finish", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root);
    const p = decode(await h.tools.get("author_post_revision_prepare").execute(input, h.call));
    assert.deepEqual(h.permissions.map((x) => x.action), ["edit"]);
    const unrelated = h.event("other-session"); await h.hooks.get("context")(unrelated); assert.equal(unrelated.system.length, 0);
    const active = h.event(); await h.hooks.get("context")(active);
    assert.equal(active.system[1].text, p.instructions_markdown); assert.equal(active.system[2].text, p.editorial_context_markdown);
    await assert.rejects(h.tools.get("author_post_revision_prepare").execute(input, h.call), { code: "AUTHOR_POST_ACTIVE" });
    await writeFile(path.join(root, target), revised);
    await assert.rejects(h.tools.get("author_post_finish").execute({ outcome: "written" }, h.call), { code: "AUTHOR_EDITORIAL_REQUIRED" });
    const inspection = decode(await h.tools.get("author_post_editorial_prepare").execute({}, h.call));
    assert.equal(inspection.target_sha256, sha(revised)); assert.equal(inspection.human_approval, false);
    assert.equal(inspection.candidate_schema.properties.comparisons.minItems, 4);
    await h.tools.get("author_post_editorial_submit").execute({ candidate_json: JSON.stringify(report()) }, h.call);
    assert.equal((await h.ctx.storage.get([...h.storage.keys()][0])).context_hook_applications, 1);
    await cleanup();
    const again = host(root, h.storage), end = await setupPostAuthoring(again.ctx, root); t.after(end);
    const next = again.event(); await again.hooks.get("generate")(next); assert.equal(next.system[2].text, p.editorial_context_markdown);
    const finish = decode(await again.tools.get("author_post_finish").execute({ outcome: "written" }, again.call));
    assert.equal(finish.editorial_status, "candidate_pending_human"); assert.equal(finish.editorial_review.human_approval, false);
    assert.equal(finish.injection_ended, true); assert.equal(again.storage.size, 0);
    const after = again.event(); await again.hooks.get("context")(after); assert.equal(after.system.length, 0);
  });
  it("retains model-free cancellation when a reference becomes invalid", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    const p = decode(await h.tools.get("author_post_revision_prepare").execute(input, h.call));
    await writeFile(path.join(root, p.source_path), "tampered");
    await assert.rejects(h.hooks.get("context")(h.event()));
    await h.commands.get("cancel-post").execute({ sessionID: h.call.sessionID });
    assert.equal(h.storage.size, 0); assert.equal(await readFile(path.join(root, target), "utf8"), original);
  });
});
