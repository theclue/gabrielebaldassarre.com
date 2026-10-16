import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createReviewAdapter,
  reviewInputSchema,
  reviewLimits,
  textToolResult,
} from "./review-native.mjs";

const ROOT = "/trusted/repository";
const context = (agent = "build", signal) => ({ sessionId: "session-1", agent, signal });

function coreFixture(overrides = {}) {
  const calls = [];
  const core = {
    async validateAuthorPatterns(root) {
      calls.push({ operation: "validate", root });
      return { schema_version: "author-pattern-validation/1", total_groups: 52 };
    },
    async prepareAuthorReview(root) {
      calls.push({ operation: "prepare", root });
      return '{\n  "schema_version": "author-pattern-review/1"\n}\n';
    },
    async applyAuthorReview(root, completeJson) {
      calls.push({ operation: "apply", root, completeJson });
      return { schema_version: "author-review-transformation/1" };
    },
    ...overrides,
  };
  return { core, calls };
}

describe("native author review adapter", () => {
  it("keeps the three tool inputs closed and validates trusted identity", async () => {
    assert.deepEqual(reviewInputSchema, {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
    const { core, calls } = coreFixture();
    const adapter = createReviewAdapter(core, ROOT);
    for (const agent of ["author-pattern-consolidator", "author-extractor", "author-pattern-orchestrator", "unknown"]) {
      await assert.rejects(adapter.validate({}, context(agent)), { code: "AGENT_DENIED" });
    }
    await assert.rejects(adapter.validate({}, { ...context(), sessionId: "" }), { code: "INVALID_CONTEXT" });
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await assert.rejects(adapter.validate({}, context("build", alreadyAborted.signal)), { code: "CANCELLED" });
    await assert.rejects(adapter.validate({ approval: true }, context()), { code: "INPUT_INVALID" });
    await assert.rejects(adapter.apply({ humanApproved: true, completeJson: "{}" }, context()), { code: "INPUT_INVALID" });
    assert.deepEqual(calls, []);
  });

  it("passes the trusted root, returns the report, and preserves exact prepared JSON text", async () => {
    const { core, calls } = coreFixture();
    const adapter = createReviewAdapter(core, ROOT);
    const reportText = await adapter.validate({}, context("plan"));
    assert.deepEqual(JSON.parse(reportText), { schema_version: "author-pattern-validation/1", total_groups: 52 });
    const preparedText = await adapter.prepare({}, context());
    assert.equal(preparedText, '{\n  "schema_version": "author-pattern-review/1"\n}\n');
    assert.equal(textToolResult(preparedText).content[0].text, preparedText);
    assert.deepEqual(calls, [
      { operation: "validate", root: ROOT },
      { operation: "prepare", root: ROOT },
    ]);
  });

  it("maps known core failures to safe codes and redacts unknown error content", async () => {
    const known = new Error("private source content");
    known.code = "IMMUTABLE_INVALID";
    known.details = ["/binding", "private text"];
    const { core } = coreFixture({
      async validateAuthorPatterns() { throw known; },
      async prepareAuthorReview() { throw new Error("secret value 123"); },
    });
    const adapter = createReviewAdapter(core, ROOT);
    await assert.rejects(adapter.validate({}, context()), (error) => {
      assert.equal(error.code, "IMMUTABLE_INVALID");
      assert.equal(error.message, "The frozen author-pattern inputs could not be verified.");
      assert.deepEqual(error.details, [{ pointer: "/binding" }]);
      return true;
    });
    await assert.rejects(adapter.prepare({}, context()), (error) => {
      assert.equal(error.code, "INTERNAL_ERROR");
      assert.equal(error.message, "The review operation failed safely.");
      assert.doesNotMatch(error.message, /secret|123/);
      return true;
    });
  });

  it("rejects oversized core data and oversized serialized tool wrappers without truncation", async () => {
    const { core } = coreFixture({
      async prepareAuthorReview() { return `{"payload":"${"x".repeat(reviewLimits.MAX_CORE_BYTES)}"}`; },
    });
    const adapter = createReviewAdapter(core, ROOT);
    await assert.rejects(adapter.prepare({}, context()), { code: "LIMIT_EXCEEDED" });
    assert.throws(() => textToolResult('"'.repeat(reviewLimits.MAX_CORE_BYTES)), { code: "LIMIT_EXCEEDED" });
  });

  it("cancels signal-bound and late work after adapter disposal", async () => {
    let finish;
    let calls = 0;
    const { core } = coreFixture({
      validateAuthorPatterns() {
        calls += 1;
        return new Promise((resolve) => { finish = resolve; });
      },
    });
    const adapter = createReviewAdapter(core, ROOT);
    const controller = new AbortController();
    const pendingAbort = adapter.validate({}, context("build", controller.signal));
    controller.abort();
    finish({ schema_version: "author-pattern-validation/1" });
    await assert.rejects(pendingAbort, { code: "CANCELLED" });

    const pendingDispose = adapter.validate({}, context());
    adapter.dispose();
    finish({ schema_version: "author-pattern-validation/1" });
    await assert.rejects(pendingDispose, { code: "CANCELLED" });
    await assert.rejects(adapter.validate({}, context()), { code: "CANCELLED" });
    await assert.rejects(adapter.validate({ fakeAuthority: true }, context()), { code: "CANCELLED" });
    assert.equal(calls, 2);
  });

  it("always fails apply closed and never calls the transformation core", async () => {
    const { core, calls } = coreFixture();
    const adapter = createReviewAdapter(core, ROOT);
    await assert.rejects(adapter.apply({}, context("build")), (error) => {
      assert.equal(error.code, "AUTHORIZATION_UNAVAILABLE");
      assert.equal(error.message, "Hash-bound human release authorization is unavailable in this host. No review was applied or published.");
      return true;
    });
    await assert.rejects(adapter.apply({}, context("plan")), { code: "AUTHORIZATION_UNAVAILABLE" });
    assert.deepEqual(calls, []);
  });
});
