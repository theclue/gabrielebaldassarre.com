import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parse as yaml } from "yaml";
import { planAuthorPost, prepareAuthorPost, verifyAuthorPostContext } from "./post-authoring.mjs";
import { setupPostAuthoring } from "./post-authoring-plugin.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TEMP = "/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode";
const PACKAGE = "_scripts/author-extraction";
const request = {
  request: "Una bozza tutorial sulla modellazione di una matita parametrica in OpenSCAD.",
  title: "Matita parametrica in OpenSCAD", category: "3D Printing", slug: "matita-openscad", destination: "draft", date: "2026-10-15",
  task: { mode: "generate", content_type: "tutorial", language: "it", objective: "Spiegare la modellazione parametrica di una matita in OpenSCAD.",
    features: ["implementation_choices", "configuration_choices"], constraints: ["Non inventare prove di stampa.", "Articolo autonomo."] },
};
const decode = (value) => JSON.parse(value.content[0].text);

async function fixture(t) {
  const root = await mkdtemp(path.join(TEMP, "post-authoring-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of ["Rakefile", "docs/author-pattern-results/v1.3/author-model.json", ...["author-model.schema.json", "author-runtime-profile.schema.json", "identifiers.schema.json", "runtime.mjs", "runtime-guardrails.mjs", "identifiers.mjs"].map((p) => `${PACKAGE}/${p}`)]) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true }); await cp(path.join(ROOT, relative), path.join(root, relative));
  }
  return root;
}

function host(root, storage = new Map()) {
  const tools = new Map(), hooks = new Map(), commands = new Map(), permissions = [], synthetic = [];
  const toolContext = { sessionID: "session-1", agent: "build", messageID: "message-1", id: "tool-1", signal: new AbortController().signal };
  let deniedAction, directory = root, disposals = 0;
  const register = async (map, callback) => {
    callback({ add(definition) { map.set(definition.name, definition); } });
    return { async dispose() { disposals += 1; map.clear(); } };
  };
  const ctx = {
    storage: {
      async get(key) { const value = storage.get(key); return value === undefined ? undefined : structuredClone(value); },
      async set(key, value) { storage.set(key, structuredClone(value)); }, async remove(key) { storage.delete(key); },
    },
    session: {
      async get() { return { location: { directory } }; }, async synthetic(value) { synthetic.push(value); },
      async hook(kind, callback) { hooks.set(kind, callback); return { async dispose() { hooks.delete(kind); disposals += 1; } }; },
    },
    tool: { transform: (callback) => register(tools, callback) }, command: { transform: (callback) => register(commands, callback) },
    permission: { async assert(input) { permissions.push(input); if (deniedAction === "*" || deniedAction === input.action) throw Object.assign(new Error("Denied"), { code: "DENIED" }); } },
  };
  const event = (sessionID = "session-1") => ({ sessionID, model: { providerID: "fixture", id: "no-provider-call" }, system: [], tools: {}, messages: [], options: {} });
  return { ctx, tools, hooks, commands, permissions, synthetic, storage, toolContext, event, deny: (action = "*") => { deniedAction = action; },
    move: (value) => { directory = value; }, disposals: () => disposals };
}

describe("new post authoring: runtime gate and actual Rake, isolated files only", () => {
  it("plans without writes and creates a tutorial draft with a new verified C02 runtime", async (t) => {
    const root = await fixture(t), before = await readdir(root);
    const plan = await planAuthorPost(root, request);
    assert.deepEqual(await readdir(root), before); assert.equal(plan.target, "_drafts/matita-openscad.md");
    const prepared = await prepareAuthorPost(root, request);
    const profile = JSON.parse(await readFile(path.join(root, prepared.profile_path), "utf8"));
    assert.deepEqual(profile.active_profile_ids, ["C02"]); assert.equal(profile.semantic_context.length, 0);
    assert.ok(!profile.devices.some((d) => d.status === "required"));
    assert.equal(profile.task_context.content_type, "tutorial");
    assert.ok((await readFile(path.join(root, prepared.target_path), "utf8")).includes("title:"));
    assert.equal(await verifyAuthorPostContext(root, prepared), prepared.instructions_markdown);
    assert.notEqual(prepared.runtime_id, "ARP:4B5275EA8296FB42E66217BE");
    const receipt = JSON.parse(await readFile(path.join(root, prepared.receipt_path), "utf8"));
    assert.equal(receipt.instructions_sha256, prepared.instructions_sha256);
    assert.ok(!Object.hasOwn(receipt, "instructions_markdown"));
  });

  it("uses the post Rake task and the requested date/category", async (t) => {
    const root = await fixture(t);
    const p = await prepareAuthorPost(root, { ...request, destination: "post", category: "Home Assistant", date: "2027-01-02" });
    assert.equal(p.target_path, "_posts/home-assistant/2027-01-02-matita-openscad.md");
    assert.equal(p.rake_task, "post");
    assert.ok((await readFile(path.join(root, p.target_path), "utf8")).includes("category: Home Assistant"));
  });

  it("escapes Rake argv and YAML titles without invoking a shell", async (t) => {
    const root = await fixture(t), title = 'Matita, [OpenSCAD]: "parametri" \\ $(touch SHOULD_NOT_EXIST)';
    const p = await prepareAuthorPost(root, { ...request, title });
    const text = await readFile(path.join(root, p.target_path), "utf8");
    assert.equal(yaml(text.split("---")[1]).title, title);
    assert.ok(!(await readdir(root)).includes("SHOULD_NOT_EXIST"));
  });

  it("rejects unsupported/invalid requests before creating runtime or article files", async (t) => {
    const root = await fixture(t), before = await readdir(root);
    for (const changed of [{ slug: "../bad" }, { title: "first\nsecond" }, { category: "Unknown" }, { destination: "publish" }, { date: "2026-02-30" },
      { task: { ...request.task, mode: "rewrite" } }, { task: { ...request.task, content_type: "other" } },
      { task: { ...request.task, content_type: "mixed" } }, { task: { ...request.task, disable_guardrails: true } }]) {
      await assert.rejects(prepareAuthorPost(root, { ...request, ...changed }));
    }
    assert.deepEqual(await readdir(root), before);
  });

  it("never overwrites a draft or follows symlinked targets/parents", async (t) => {
    const root = await fixture(t); await mkdir(path.join(root, "_drafts"));
    await writeFile(path.join(root, "_drafts/matita-openscad.md"), "User's existing draft");
    await assert.rejects(prepareAuthorPost(root, request), { code: "AUTHOR_POST_EXISTS" });
    assert.equal(await readFile(path.join(root, "_drafts/matita-openscad.md"), "utf8"), "User's existing draft");
    await symlink(path.join(root, "Rakefile"), path.join(root, "_drafts/link.md"));
    await assert.rejects(prepareAuthorPost(root, { ...request, slug: "link" }), { code: "AUTHOR_POST_EXISTS" });
    await symlink(path.join(root, "docs"), path.join(root, "_posts"));
    await assert.rejects(prepareAuthorPost(root, { ...request, destination: "post" }), { code: "AUTHOR_POST_PATH_INVALID" });
  });

  it("stops if governed model verification fails, before Rake or output materialization", async (t) => {
    const root = await fixture(t); await writeFile(path.join(root, "docs/author-pattern-results/v1.3/author-model.json"), "{}");
    await assert.rejects(prepareAuthorPost(root, request));
    assert.ok(!(await readdir(root)).includes("_drafts"));
    assert.ok(!(await readdir(path.join(root, "docs"))).includes("authoring-runs"));
  });

  it("reports a Rake failure without generating fallback prose or removing files", async (t) => {
    const root = await fixture(t); await writeFile(path.join(root, "Rakefile"), "abort 'fixture failure'\n");
    await assert.rejects(prepareAuthorPost(root, request), { code: "AUTHOR_POST_RAKE_FAILED" });
    assert.deepEqual(await readdir(path.join(root, "_drafts")), []);
    assert.ok((await readdir(path.join(root, "docs/authoring-runs"))).length === 1);
  });

  it("keeps written article bytes editable but rejects changed runtime, task or receipt bytes", async (t) => {
    for (const target of ["instructions_path", "profile_path", "task_path", "receipt_path"]) {
      const root = await fixture(t), p = await prepareAuthorPost(root, request);
      await writeFile(path.join(root, p.target_path), "---\ntitle: Matita\n---\nFixture body, not an article.\n");
      assert.equal(await verifyAuthorPostContext(root, p), p.instructions_markdown);
      await writeFile(path.join(root, p[target]), "{}\n");
      await assert.rejects(verifyAuthorPostContext(root, p));
    }
  });

  it("cancels before writes when the signal is already aborted", async (t) => {
    const root = await fixture(t), controller = new AbortController(); controller.abort();
    await assert.rejects(prepareAuthorPost(root, request, { signal: controller.signal }), { name: "AbortError" });
    assert.ok(!(await readdir(root)).includes("_drafts"));
  });

  it("allows at most one creation when identical preparations race", async (t) => {
    const root = await fixture(t);
    const results = await Promise.allSettled([prepareAuthorPost(root, request), prepareAuthorPost(root, request)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.deepEqual(await readdir(path.join(root, "_drafts")), ["matita-openscad.md"]);
    const p = results.find((r) => r.status === "fulfilled").value;
    assert.equal(await verifyAuthorPostContext(root, p), p.instructions_markdown);
  });
});

describe("OpenCode V2 authoring hook, session scope and permissions (no LLM calls)", () => {
  it("fails closed with an actionable error when the host cannot assert permissions", async (t) => {
    for (const permission of [undefined, {}, { assert: null }, { assert: true }]) {
      const root = await fixture(t), h = host(root);
      h.ctx.app = { version: "2.0.24" };
      h.ctx.permission = permission;
      const cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
      const before = await readdir(root, { recursive: true });
      await assert.rejects(h.tools.get("author_post_prepare").execute(request, h.toolContext), {
        code: "AUTHOR_POST_HOST_UNSUPPORTED", message: /OpenCode 2\.0\.29.*permission\.assert.*2\.0\.24/,
      });
      assert.deepEqual(await readdir(root, { recursive: true }), before);
      assert.equal(h.storage.size, 0); assert.equal(h.permissions.length, 0);
      // Unsupported hosts must still allow model-free cancellation, not fail setup.
      await h.commands.get("cancel-post").execute({ sessionID: "session-1" });
      assert.equal(h.synthetic.length, 1);
    }
  });

  it("asserts host edit permission before any runtime/scaffold writes", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup); h.deny();
    await assert.rejects(h.tools.get("author_post_prepare").execute(request, h.toolContext), { code: "DENIED" });
    assert.equal(h.permissions[0].action, "edit"); assert.equal(h.permissions[0].agent, "build");
    assert.ok(!(await readdir(root)).includes("_drafts")); assert.equal(h.storage.size, 0);
    h.deny("shell");
    await assert.rejects(h.tools.get("author_post_prepare").execute(request, h.toolContext), { code: "DENIED" });
    assert.equal(h.permissions.at(-1).action, "shell");
    assert.ok(!(await readdir(root)).includes("_drafts")); assert.equal(h.storage.size, 0);
  });

  it("injects the complete exact Markdown automatically, only for the active session", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    const p = decode(await h.tools.get("author_post_prepare").execute(request, h.toolContext));
    assert.deepEqual(h.permissions.map((p) => p.action), ["edit", "shell"]);
    const unrelated = h.event("session-2"); await h.hooks.get("context")(unrelated); assert.deepEqual(unrelated.system, []);
    const event = h.event(); await h.hooks.get("context")(event);
    assert.equal(event.system.at(-1).text, p.instructions_markdown);
    assert.deepEqual(event.options, {}); assert.equal(event.model.providerID, "fixture");
    const generated = h.event(); await h.hooks.get("generate")(generated); assert.equal(generated.system.at(-1).text, p.instructions_markdown);
    await assert.rejects(h.tools.get("author_post_finish").execute({ outcome: "written" }, h.toolContext), { code: "AUTHOR_POST_BODY_MISSING" });
    await writeFile(path.join(root, p.target_path), "---\ntitle: Matita\n---\nSynthetic test body, not a generated article.\n");
    const finish = decode(await h.tools.get("author_post_finish").execute({ outcome: "written" }, h.toolContext));
    assert.equal(finish.context_hook_applications, 2); assert.equal(finish.injection_ended, true);
    assert.ok(finish.verification_scope.includes("not_prose_compliance"));
    const next = h.event(); await h.hooks.get("context")(next); assert.deepEqual(next.system, []);
  });

  it("does not claim successful injection before a model-context hook was applied", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    await h.tools.get("author_post_prepare").execute(request, h.toolContext);
    await assert.rejects(h.tools.get("author_post_finish").execute({ outcome: "written" }, h.toolContext), { code: "AUTHOR_POST_NOT_INJECTED" });
    await assert.rejects(h.tools.get("author_post_prepare").execute({ ...request, slug: "other" }, h.toolContext), { code: "AUTHOR_POST_ACTIVE" });
    const cancelled = decode(await h.tools.get("author_post_finish").execute({ outcome: "cancelled" }, h.toolContext));
    assert.equal(cancelled.status, "cancelled"); assert.equal(h.storage.size, 0);
    assert.ok((await readdir(path.join(root, "_drafts"))).includes("matita-openscad.md"));
  });

  it("retains verified activation on reload and disposes hooks/tools on unload", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root);
    const p = decode(await h.tools.get("author_post_prepare").execute(request, h.toolContext));
    const stale = h.tools.get("author_post_prepare");
    await cleanup(); assert.equal(h.disposals(), 4); assert.equal(h.hooks.size, 0); assert.equal(h.tools.size, 0);
    await assert.rejects(stale.execute(request, h.toolContext), { code: "AUTHOR_POST_UNLOADED" });
    const again = host(root, h.storage), end = await setupPostAuthoring(again.ctx, root); t.after(end);
    const event = again.event(); await again.hooks.get("context")(event); assert.equal(event.system.at(-1).text, p.instructions_markdown);
  });

  it("fails closed after runtime tampering, with model-free /cancel-post recovery", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    const p = decode(await h.tools.get("author_post_prepare").execute(request, h.toolContext));
    await writeFile(path.join(root, p.instructions_path), "tampered");
    const event = h.event(); await assert.rejects(h.hooks.get("context")(event)); assert.deepEqual(event.system, []);
    await h.commands.get("cancel-post").execute({ sessionID: "session-1" });
    assert.equal(h.storage.size, 0); assert.equal(h.synthetic.length, 1);
    await h.hooks.get("context")(event); assert.deepEqual(event.system, []);
  });

  it("rejects cross-location preparation and injection rather than using the wrong checkout", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    h.move(path.dirname(root));
    await assert.rejects(h.tools.get("author_post_prepare").execute(request, h.toolContext), { code: "AUTHOR_POST_LOCATION_INVALID" });
    h.move(root); await h.tools.get("author_post_prepare").execute(request, h.toolContext); h.move(path.dirname(root));
    await assert.rejects(h.hooks.get("context")(h.event()), { code: "AUTHOR_POST_LOCATION_INVALID" });
  });

  it("does not let concurrent or pre-cancelled tool calls create a second scaffold", async (t) => {
    const root = await fixture(t), h = host(root), cleanup = await setupPostAuthoring(h.ctx, root); t.after(cleanup);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(h.tools.get("author_post_prepare").execute(request, { ...h.toolContext, signal: controller.signal }), { name: "AbortError" });
    assert.equal(h.permissions.length, 0);
    assert.ok(!(await readdir(root)).includes("_drafts"));
    const first = h.tools.get("author_post_prepare").execute(request, h.toolContext);
    await assert.rejects(h.tools.get("author_post_prepare").execute(request, h.toolContext), { code: "AUTHOR_POST_BUSY" });
    await first;
  });
});
