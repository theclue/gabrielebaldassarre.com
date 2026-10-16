const MAX_CORE_BYTES = 8 * 1024 * 1024;
const MAX_TOOL_RESULT_BYTES = 16 * 1024 * 1024;
const ALLOWED_AGENTS = new Set(["build", "plan"]);
const AUTHORIZATION_MESSAGE = "Hash-bound human release authorization is unavailable in this host. No review was applied or published.";

export const reviewInputSchema = Object.freeze({
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
});

export class ReviewAdapterError extends Error {
  constructor(code, message, details = []) {
    super(typeof message === "string" ? message.slice(0, 240) : "The review operation failed safely.");
    this.name = "ReviewAdapterError";
    this.code = code;
    this.details = (Array.isArray(details) ? details : []).filter((detail) => detail && typeof detail.pointer === "string" &&
      (detail.pointer === "" || /^\/(?:[^~/]|~[01])*(?:\/(?:[^~/]|~[01])*)*$/.test(detail.pointer)))
      .slice(0, 5)
      .map((detail) => ({ pointer: detail.pointer.slice(0, 200) }));
  }
}

function failure(code, message, details) {
  return new ReviewAdapterError(code, message, details);
}

function checkInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
    Reflect.ownKeys(input).length !== 0) {
    throw failure("INPUT_INVALID", "The review tool accepts an empty object only.", [{ pointer: "" }]);
  }
}

function checkContext(context, disposed) {
  if (disposed) throw failure("CANCELLED", "The review adapter is no longer active.");
  if (!context || typeof context.sessionId !== "string" || context.sessionId.length === 0) {
    throw failure("INVALID_CONTEXT", "A trusted host session is required.");
  }
  if (!ALLOWED_AGENTS.has(context.agent)) {
    throw failure("AGENT_DENIED", "This agent is not permitted to use author-review tools.");
  }
  if (context.signal !== undefined && (typeof context.signal.aborted !== "boolean" || typeof context.signal.addEventListener !== "function")) {
    throw failure("INVALID_CONTEXT", "The host cancellation signal is invalid.");
  }
  if (context.signal?.aborted) throw failure("CANCELLED", "The review operation was cancelled.");
}

function serializeCoreResult(value, message) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw failure("INTERNAL_ERROR", message);
  }
  if (typeof serialized !== "string") throw failure("INTERNAL_ERROR", message);
  if (Buffer.byteLength(serialized, "utf8") > MAX_CORE_BYTES) {
    throw failure("LIMIT_EXCEEDED", "The review result exceeds its size limit.");
  }
  return serialized;
}

function safeCoreError(error) {
  if (error instanceof ReviewAdapterError) return error;
  const safeMessages = {
    BINDING_INVALID: "The review inputs do not match the frozen sources.",
    DECISION_INVALID: "The completed review could not be verified.",
    IMMUTABLE_INVALID: "The frozen author-pattern inputs could not be verified.",
    MERGE_INVALID: "The completed semantic merges could not be verified.",
    REVIEW_INCOMPLETE: "The completed review is incomplete.",
    REVIEW_JSON_INVALID: "The completed review document is invalid.",
    SCHEMA_INVALID: "The review document does not match its contract.",
  };
  if (error && Object.hasOwn(safeMessages, error.code)) {
    const details = Array.isArray(error.details)
      ? error.details.filter((pointer) => typeof pointer === "string" && (pointer === "" || /^\/(?:[^~/]|~[01])*(?:\/(?:[^~/]|~[01])*)*$/.test(pointer))).slice(0, 5).map((pointer) => ({ pointer: pointer.slice(0, 200) }))
      : [];
    return failure(error.code, safeMessages[error.code], details);
  }
  return failure("INTERNAL_ERROR", "The review operation failed safely.");
}

async function runCore(operation, context, isDisposed) {
  checkContext(context, isDisposed());
  try {
    const result = await operation();
    checkContext(context, isDisposed());
    return result;
  } catch (error) {
    try {
      checkContext(context, isDisposed());
    } catch (cancelled) {
      throw cancelled;
    }
    throw safeCoreError(error);
  }
}

export function createReviewAdapter(coreApi, repoRoot) {
  if (!coreApi || typeof coreApi.validateAuthorPatterns !== "function" ||
    typeof coreApi.prepareAuthorReview !== "function" || typeof coreApi.applyAuthorReview !== "function" ||
    typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new TypeError("A review core API and trusted repository root are required.");
  }

  let disposed = false;
  const ensureActive = () => {
    if (disposed) throw failure("CANCELLED", "The review adapter is no longer active.");
  };

  return {
    async validate(input, context) {
      checkContext(context, disposed);
      checkInput(input);
      const result = await runCore(
        () => coreApi.validateAuthorPatterns(repoRoot),
        context,
        () => disposed,
      );
      return serializeCoreResult(result, "The review core returned an invalid validation report.");
    },

    async prepare(input, context) {
      checkContext(context, disposed);
      checkInput(input);
      const prepared = await runCore(
        () => coreApi.prepareAuthorReview(repoRoot),
        context,
        () => disposed,
      );
      if (typeof prepared !== "string" || Buffer.byteLength(prepared, "utf8") > MAX_CORE_BYTES) {
        throw failure("LIMIT_EXCEEDED", "The prepared review sheet is invalid or exceeds its size limit.");
      }
      try {
        JSON.parse(prepared);
      } catch {
        throw failure("INTERNAL_ERROR", "The review core returned invalid review-sheet JSON.");
      }
      return prepared;
    },

    async apply(input, context) {
      checkContext(context, disposed);
      checkInput(input);
      ensureActive();
      throw failure("AUTHORIZATION_UNAVAILABLE", AUTHORIZATION_MESSAGE);
    },

    dispose() {
      disposed = true;
    },
  };
}

export function textToolResult(text) {
  if (typeof text !== "string") throw failure("INTERNAL_ERROR", "The review tool returned invalid text.");
  const result = {
    content: [{ type: "text", text }],
    metadata: { truncated: false },
  };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_TOOL_RESULT_BYTES) {
    throw failure("LIMIT_EXCEEDED", "The review tool result exceeds its size limit.");
  }
  return result;
}

export const reviewLimits = Object.freeze({ MAX_CORE_BYTES, MAX_TOOL_RESULT_BYTES });
