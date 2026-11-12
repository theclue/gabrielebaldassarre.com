import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { planAuthorRevision, prepareAuthorRevision, verifyAuthorRevisionContext, verifyAuthorRevisionWritten } from "./post-revision.mjs";
import { setupPostAuthoring } from "./post-authoring-plugin.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TEMP = tmpdir();
const target = "_drafts/revision-fixture.md";
const original = "---\ntitle: Fixture\n---\nOriginal synthetic fixture body, not a blog article.\n";
const revised = "---\ntitle: Fixture\n---\nRevised synthetic fixture body for offline tests.\n";
const input = {
  target_path: target,
  request: "Rivedere una fixture preservando fatti e codice.",
  task: { mode: "rewrite", content_type: "tutorial", language: "it", objective: "Revisionare la prosa della fixture senza inventare esperienze.", features: ["implementation_choices"] },
};

async function fixture(t) {
  const root = await mkdtemp(path.join(TEMP, "post-revision-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = ["docs/author-pattern-results/v1.3/author-model.json",
    ...["author-model.schema.json", "author-runtime-profile.schema.json", "identifiers.schema.json", "runtime.mjs", "runtime-guardrails.mjs", "identifiers.mjs"].map((p) => `_scripts/author-extraction/${p}`)];
  for (const file of files) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await cp(path.join(ROOT, file), path.join(root, file)); }
  await mkdir(path.join(root, "_drafts")); await writeFile(path.join(root, target), original);
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

describe("existing article revision in memory, no Rake or disk snapshots", () => {
  it("plans read-only, leaves the article untouched and creates no revision files on disk", async (t) => {
    const root = await fixture(t), before = await readdir(root, { recursive: true });
    const plan = await planAuthorRevision(root, input);
    assert.deepEqual(await readdir(root, { recursive: true }), before);
    const p = await prepareAuthorRevision(root, input, { plan });
    assert.deepEqual(await readdir(root, { recursive: true }), before);
    assert.equal(await readFile(path.join(root, target), "utf8"), original);
    assert.equal(p.schema_version, "author-post-revision/2");
    assert.equal(await verifyAuthorRevisionContext(root, p), p.instructions_markdown);
  });

  it("rejects malformed paths, unsupported modes and extra fields before activation", async (t) => {
    const root = await fixture(t), before = await readdir(root, { recursive: true });
    for (const change of [{ target_path: "../outside.md" }, { target_path: "_drafts/./revision-fixture.md" }, { target_path: "docs/notes.md" },
      { task: { ...input.task, mode: "generate" } }, { task: { ...input.task, mode: "review" } }, { disable_guardrails: true }]) {
      await assert.rejects(prepareAuthorRevision(root, { ...input, ...change }));
    }
    assert.deepEqual(await readdir(root, { recursive: true }), before);
    await symlink(path.join(root, target), path.join(root, "_drafts/link.md"));
    await assert.rejects(prepareAuthorRevision(root, { ...input, target_path: "_drafts/link.md" }));
  });

  it("detects concurrent edits that arrive while permission is pending", async (t) => {
    const root = await fixture(t), plan = await planAuthorRevision(root, input);
    await writeFile(path.join(root, target), revised);
    await assert.rejects(prepareAuthorRevision(root, input, { plan }), { code: "AUTHOR_REVISION_SOURCE_CHANGED" });
    assert.equal(await readFile(path.join(root, target), "utf8"), revised);
  });

  it("requires actual article body edits before finishing as written", async (t) => {
    const root = await fixture(t), p = await prepareAuthorRevision(root, input);
    await assert.rejects(verifyAuthorRevisionWritten(root, p), { code: "AUTHOR_REVISION_BODY_UNCHANGED" });
    await writeFile(path.join(root, target), revised);
    await verifyAuthorRevisionWritten(root, p);
  });
});

describe("revision plugin lifecycle and permission boundary", () => {
  it("permission denial or cancellation leaves no snapshot, edit or activation", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup); h.deny();
    await assert.rejects(h.tools.get("author_post_revision_prepare").execute(input, h.call), { code: "DENIED" });
    assert.equal(h.permissions.length, 1); assert.equal(h.permissions[0].action, "edit"); assert.equal(h.storage.size, 0);
    assert.deepEqual(h.permissions[0].resources, [path.join(await realpath(root), target)]);
    assert.equal(await readFile(path.join(root, target), "utf8"), original);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(h.tools.get("author_post_revision_prepare").execute(input, { ...h.call, signal: controller.signal }), { name: "AbortError" });
  });

  it("keeps runtime active across edits and reload until explicit finish", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root);
    const p = decode(await h.tools.get("author_post_revision_prepare").execute(input, h.call));
    assert.deepEqual(h.permissions.map((x) => x.action), ["edit"]);
    const unrelated = h.event("other-session"); await h.hooks.get("context")(unrelated); assert.equal(unrelated.system.length, 0);
    const active = h.event(); await h.hooks.get("context")(active);
    assert.equal(active.system[1].text, p.instructions_markdown);
    await assert.rejects(h.tools.get("author_post_revision_prepare").execute(input, h.call), { code: "AUTHOR_POST_ACTIVE" });
    await writeFile(path.join(root, target), revised);
    await cleanup();
    const again = host(root, h.storage), end = await setupPostAuthoring(again.ctx, root); t.after(end);
    const next = again.event(); await again.hooks.get("generate")(next); assert.equal(next.system[1].text, p.instructions_markdown);
    const finish = decode(await again.tools.get("author_post_finish").execute({ outcome: "written" }, again.call));
    assert.equal(finish.status, "written");
    assert.equal(finish.injection_ended, true); assert.equal(again.storage.size, 0);
    const after = again.event(); await again.hooks.get("context")(after); assert.equal(after.system.length, 0);
  });

  it("retains model-free cancellation when the model becomes invalid", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    await h.tools.get("author_post_revision_prepare").execute(input, h.call);
    await writeFile(path.join(root, "docs/author-pattern-results/v1.3/author-model.json"), "{}");
    await assert.rejects(h.hooks.get("context")(h.event()));
    await h.commands.get("cancel-post").execute({ sessionID: h.call.sessionID });
    assert.equal(h.storage.size, 0); assert.equal(await readFile(path.join(root, target), "utf8"), original);
  });
});
