import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { it } from "node:test";
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
