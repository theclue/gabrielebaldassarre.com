import { fileURLToPath } from "node:url";
import {
  createConsolidationAdapter,
  loadPluginSDK,
  prepareInputSchema,
  submitInputSchema,
} from "../../_scripts/author-extraction/consolidator-native.mjs?contract=0.6";
import { createReviewAdapter, reviewInputSchema, textToolResult } from "../../_scripts/author-extraction/review-native.mjs";
import { createModelAdapter, modelPrepareInputSchema, modelSubmitInputSchema, modelToolResult } from "../../_scripts/author-extraction/model-native.mjs";

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
    const coreApi = await import("../../_scripts/author-extraction/consolidator.mjs?contract=0.6");
    const reviewCoreApi = await import("../../_scripts/author-extraction/review.mjs");
    const modelCoreApi = await import("../../_scripts/author-extraction/model-agent.mjs");
    const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
    const hostConfig = ctx.options.recordsDirectory === undefined
      ? undefined
      : { recordsDirectory: ctx.options.recordsDirectory };
    const adapter = createConsolidationAdapter(coreApi, repoRoot, hostConfig);
    const reviewAdapter = createReviewAdapter(reviewCoreApi, repoRoot);
    const modelAdapter = createModelAdapter(modelCoreApi, repoRoot);
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
        name: "author_model_prepare",
        description: "Prepare verified reviewed patterns and notes for author-model composition. Only author-model-compiler may call this read-only tool.",
        input: modelPrepareInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => modelToolResult(await execute(modelAdapter.prepare)(input, toolContext)),
      });
      editor.add({
        name: "author_model_submit",
        description: "Validate a hash-bound author-model composition and save a separate immutable candidate. Never overwrites or promotes the current model.",
        input: modelSubmitInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => modelToolResult(await execute(modelAdapter.submit)(input, toolContext)),
      });
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
      editor.add({
        name: "author_patterns_validate",
        description: "Validate the immutable author-pattern sources. Uses only host-bound repository data and the trusted build or plan agent identity.",
        input: reviewInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => textToolResult(await reviewAdapter.validate(input, {
          sessionId: toolContext.sessionID,
          agent: toolContext.agent,
          signal: toolContext.signal,
        })),
      });
      editor.add({
        name: "author_review_prepare",
        description: "Prepare the complete pending author-review sheet as JSON text. This does not create review decisions or write files.",
        input: reviewInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => textToolResult(await reviewAdapter.prepare(input, {
          sessionId: toolContext.sessionID,
          agent: toolContext.agent,
          signal: toolContext.signal,
        })),
      });
      editor.add({
        name: "author_review_apply",
        description: "Fail-closed review-apply entrypoint. Hash-bound human release authorization is unavailable in this host; it never applies or publishes a review.",
        input: reviewInputSchema,
        options: { codemode: false },
        execute: async (input, toolContext) => textToolResult(await reviewAdapter.apply(input, {
          sessionId: toolContext.sessionID,
          agent: toolContext.agent,
          signal: toolContext.signal,
        })),
      });
    });

    return async () => {
      unloaded = true;
      try {
        await registration.dispose();
      } finally {
        for (const sessionId of knownSessions) adapter.abort(sessionId);
        knownSessions.clear();
        reviewAdapter.dispose();
        modelAdapter.dispose();
      }
    };
  },
});
