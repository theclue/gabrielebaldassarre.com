import { fileURLToPath } from "node:url";
import {
  createExtractionAdapter,
  loadPluginSDK,
  prepareInputSchema,
  submitInputSchema,
} from "../../_scripts/author-extraction/native.mjs";

const { Plugin } = await loadPluginSDK();

function cancelledError() {
  const error = new Error("The extraction plugin is no longer active.");
  error.code = "CANCELLED";
  error.details = [];
  return error;
}

export default Plugin.define({
  id: "author-extraction",
  async setup(ctx) {
    const coreApi = await import("../../_scripts/author-extraction/core.mjs");
    const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
    const adapter = createExtractionAdapter(coreApi, repoRoot);
    const knownSessions = new Set();
    let unloaded = false;

    const execute = (method) => async (input, toolContext) => {
      if (unloaded) throw cancelledError();
      knownSessions.add(toolContext.sessionID);
      return method(input, {
        sessionId: toolContext.sessionID,
        agent: toolContext.agent,
        signal: toolContext.signal,
      });
    };

    const registration = await ctx.tool.transform((editor) => {
      editor.add({
        name: "author_extraction_prepare",
        description: "Prepare one allowlisted article for evidence-grounded extraction.",
        input: prepareInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => {
          const prepared = await execute(adapter.prepare)(input, toolContext);
          return {
            content: [{ type: "text", text: JSON.stringify(prepared) }],
            metadata: { truncated: false },
          };
        },
      });
      editor.add({
        name: "author_extraction_submit",
        description: "Submit a strict candidate JSON string for core validation.",
        input: submitInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => {
          const envelope = await execute(adapter.submit)(input, toolContext);
          return {
            content: [{ type: "text", text: JSON.stringify(envelope) }],
            metadata: { truncated: false },
          };
        },
      });
    });

    return async () => {
      unloaded = true;
      try {
        await registration.dispose();
      } finally {
        for (const sessionId of knownSessions) adapter.abort(sessionId);
        knownSessions.clear();
      }
    };
  },
});
