import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { it } from "node:test";
import { Effect } from "effect";
import { fromPromise } from "@opencode/plugin/promise/adapter";
import { loadPluginSDK } from "./native.mjs";

it("loads the actual auto-discovered post-authoring entrypoint with the V2 SDK and a host-bound root", async () => {
  const url = new URL("../../.opencode/plugins/post-authoring.js", import.meta.url);
  const context = vm.createContext({ URL }), calls = [];
  const moduleOf = (exports) => new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context });
  const sdk = moduleOf({ loadPluginSDK }), nodeUrl = moduleOf({ fileURLToPath });
  const implementation = moduleOf({ setupPostAuthoring(ctx, root) { calls.push({ ctx, root }); return "cleanup-fixture"; } });
  const entrypoint = new vm.SourceTextModule(await readFile(url, "utf8"), { context, initializeImportMeta(meta) { meta.url = url.href; } });
  await entrypoint.link((specifier) => {
    if (specifier === "node:url") return nodeUrl;
    if (specifier === "../../_scripts/author-extraction/native.mjs") return sdk;
    if (specifier === "../../_scripts/author-extraction/post-authoring-plugin.mjs") return implementation;
    throw new Error(`Unexpected dependency: ${specifier}`);
  });
  await entrypoint.evaluate();
  const plugin = entrypoint.namespace.default, ctx = { options: { repoRoot: "/must-not-be-used" } };
  assert.equal(plugin.id, "post-authoring"); assert.equal(await plugin.setup(ctx), "cleanup-fixture");
  assert.equal(calls[0].ctx, ctx); assert.equal(calls[0].root, fileURLToPath(new URL("../../", import.meta.url)));
});

it("the installed SDK exposes permission.assert through its real Promise adapter", async () => {
  const { Plugin } = await loadPluginSDK(), calls = [];
  const input = { sessionID: "session-1", agent: "build", action: "edit", resources: ["_drafts/fixture.md"],
    source: { type: "tool", messageID: "message-1", id: "tool-1" } };
  const denied = new Error("Host permission denied");
  let reject = false;
  // Other host domains are inspected by the adapter, but must never be invoked.
  const unused = new Proxy(() => { throw new Error("Unexpected SDK host operation"); }, { get: () => unused });
  const host = new Proxy({ permission: {
    assert(value) { calls.push(value); return reject ? Effect.fail(denied) : Effect.void; },
  } }, { get: (target, name) => name in target ? target[name] : unused });
  const plugin = fromPromise(Plugin.define({ id: "permission-contract-fixture", async setup(ctx) {
    assert.equal(typeof ctx.permission.assert, "function");
    await ctx.permission.assert(input);
  } }));
  await Effect.runPromise(Effect.scoped(plugin.effect(host)));
  assert.deepEqual(calls[0], input);
  reject = true;
  await assert.rejects(Effect.runPromise(Effect.scoped(plugin.effect(host))), (error) => error === denied);
  assert.equal(calls.length, 2);
});
