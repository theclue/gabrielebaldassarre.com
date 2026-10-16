import { fileURLToPath } from "node:url";
import {
  createConsolidationAdapter,
  loadPluginSDK,
  prepareInputSchema,
  submitInputSchema,
} from "../../_scripts/author-extraction/consolidator-native.mjs?contract=0.5";

const { Plugin } = await loadPluginSDK();

function cancelledError() {
  const error = new Error("The consolidation plugin is no longer active.");
  error.code = "CANCELLED";
  error.details = [];
  return error;
}

export default Plugin.define({
  id: "author-pattern-consolidator",
  async setup(ctx) {
    const coreApi = await import("../../_scripts/author-extraction/consolidator.mjs?contract=0.5");
    const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
    const hostConfig = ctx.options.recordsDirectory === undefined
      ? undefined
      : { recordsDirectory: ctx.options.recordsDirectory };
    const adapter = createConsolidationAdapter(coreApi, repoRoot, hostConfig);
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
        name: "author_pattern_consolidation_prepare",
        description: "Prepare one dimension from verified extraction records for consolidation.",
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
        name: "author_pattern_consolidation_submit",
        description: "Submit one dimension candidate for deterministic core validation.",
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
