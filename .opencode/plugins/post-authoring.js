import { fileURLToPath } from "node:url";
import { loadPluginSDK } from "../../_scripts/author-extraction/native.mjs";
import { setupPostAuthoring } from "../../_scripts/author-extraction/post-authoring-plugin.mjs";

const { Plugin } = await loadPluginSDK();

export default Plugin.define({
  id: "post-authoring",
  setup(ctx) {
    return setupPostAuthoring(ctx, fileURLToPath(new URL("../../", import.meta.url)));
  },
});
