import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const operations = new Set(["open", "discover", "expand", "validate", "close"]);
const launcherKeys = new Set([
  "repositoryRoot", "projectID", "rubyExecutable", "userAgent", "apiEndpoint", "sparqlEndpoint", "limitsFile",
]);
const requestKeys = new Set(["operation", "input", "run_id"]);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rubySource = path.join(sourceRoot, "_scripts", "wikidata-oracle.rb");
const maxFrameBytes = 4 * 1024 * 1024;

function fail(message) {
  return new Error(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function contained(root, directory) {
  const relative = path.relative(root, directory);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateRequest(request, runID) {
  if (!isRecord(request) || Object.keys(request).some((key) => !requestKeys.has(key))) {
    throw fail("Invalid Wikidata oracle request.");
  }
  if (!operations.has(request.operation) || !isRecord(request.input)) {
    throw fail("Invalid Wikidata oracle request.");
  }
  if (request.operation === "open") {
    if (runID || Object.hasOwn(request, "run_id")) throw fail("A Wikidata oracle run is already open.");
    return;
  }
  if (!runID || typeof request.run_id !== "string" || request.run_id !== runID) {
    throw fail("Wikidata oracle run is not available to this request.");
  }
}

export function createWikidataOracleBridge(options) {
  if (!isRecord(options) || Object.keys(options).some((key) => !launcherKeys.has(key))) {
    throw fail("Invalid trusted Wikidata oracle launcher options.");
  }
  if (typeof options.repositoryRoot !== "string" || !path.isAbsolute(options.repositoryRoot) ||
      typeof options.projectID !== "string" || !options.projectID) {
    throw fail("A trusted repository root and project ID are required.");
  }

  const rootInput = options.repositoryRoot;
  const rubyExecutable = options.rubyExecutable ?? "ruby";
  const userAgent = options.userAgent ?? "Wikidata Oracle integration (https://gabrielebaldassarre.com)";
  let root;
  let child;
  let childClose;
  let buffer = "";
  let queue = Promise.resolve();
  let requestNumber = 0;
  let runID;
  let boundSession;
  let boundProject;
  let pending;
  let disposed = false;
  let childFailed = false;

  function settlePending(error, response) {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    current.cleanup();
    if (error) current.reject(error);
    else current.resolve(response);
  }

  function failChild(message = "Wikidata oracle process failed.") {
    childFailed = true;
    settlePending(fail(message));
  }

  function handleOutput(chunk) {
    buffer += chunk;
    if (Buffer.byteLength(buffer, "utf8") > maxFrameBytes) {
      failChild("Wikidata oracle returned an oversized response.");
      child?.kill("SIGTERM");
      return;
    }
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        failChild("Wikidata oracle returned an invalid response.");
        child?.kill("SIGTERM");
        return;
      }
      if (!pending || response?.request_id !== pending.requestID) {
        failChild("Wikidata oracle response did not match the active request.");
        child?.kill("SIGTERM");
        return;
      }
      settlePending(undefined, response);
    }
  }

  async function validateCaller(context) {
    if (!isRecord(context) || typeof context.sessionID !== "string" || !context.sessionID ||
        context.projectID !== options.projectID || typeof context.sessionDirectory !== "string" ||
        !context.signal || typeof context.signal.addEventListener !== "function" ||
        Object.keys(context).some((key) => !["sessionID", "projectID", "sessionDirectory", "signal"].includes(key))) {
      throw fail("Wikidata oracle caller context is not trusted.");
    }
    if (context.signal.aborted) throw fail("Wikidata oracle request was cancelled.");
    if (!root) {
      root = await realpath(rootInput);
      if (!(await stat(root)).isDirectory()) throw fail("Trusted repository root is not a directory.");
    }
    const directory = await realpath(context.sessionDirectory);
    if (!contained(root, directory)) throw fail("Wikidata oracle session is outside the trusted repository.");
    if (boundSession && (boundSession !== context.sessionID || boundProject !== context.projectID)) {
      throw fail("Wikidata oracle bridge is bound to another session.");
    }
    boundSession ??= context.sessionID;
    boundProject ??= context.projectID;
    return { ...context, sessionDirectory: directory };
  }

  function stopChild() {
    const current = child;
    if (!current) return Promise.resolve();
    if (current.exitCode !== null || current.signalCode !== null) return childClose ?? Promise.resolve();
    current.kill("SIGTERM");
    const timer = setTimeout(() => current.kill("SIGKILL"), 750);
    return (childClose ?? Promise.resolve()).finally(() => clearTimeout(timer));
  }

  function startChild() {
    if (disposed || childFailed) throw fail("Wikidata oracle bridge is no longer active.");
    if (child) return;
    const args = [rubySource, "--root", root, "--user-agent", userAgent];
    if (options.apiEndpoint) args.push("--api-endpoint", options.apiEndpoint);
    if (options.sparqlEndpoint) args.push("--sparql-endpoint", options.sparqlEndpoint);
    if (options.limitsFile) args.push("--limits-file", options.limitsFile);
    child = spawn(rubyExecutable, args, { stdio: ["pipe", "pipe", "ignore"], shell: false });
    childClose = new Promise((resolve) => child.once("close", resolve));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", handleOutput);
    child.on("error", () => failChild());
    child.on("close", () => {
      child = undefined;
      if (pending) failChild();
      runID = undefined;
      buffer = "";
    });
  }

  function send(request, context) {
    const requestID = `wikidata-${++requestNumber}`;
    const frame = JSON.stringify({
      protocol_version: 1,
      request_id: requestID,
      operation: request.operation,
      ...(request.run_id ? { run_id: request.run_id } : {}),
      input: request.input,
    }) + "\n";
    if (Buffer.byteLength(frame, "utf8") > maxFrameBytes) throw fail("Wikidata oracle request is too large.");
    startChild();
    return new Promise((resolve, reject) => {
      const signal = context.signal;
      const onAbort = () => {
        childFailed = true;
        settlePending(fail("Wikidata oracle request was cancelled."));
        child?.kill("SIGTERM");
      };
      const cleanup = () => signal.removeEventListener("abort", onAbort);
      pending = { requestID, resolve, reject, cleanup };
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) {
        onAbort();
        return;
      }
      child.stdin.write(frame, (error) => {
        if (error && pending?.requestID === requestID) failChild();
      });
    });
  }

  async function executeOne(request, context) {
    validateRequest(request, runID);
    const trustedContext = await validateCaller(context);
    if (trustedContext.signal.aborted) throw fail("Wikidata oracle request was cancelled.");
    const response = await send(request, trustedContext);
    if (trustedContext.signal.aborted || disposed) {
      childFailed = true;
      await stopChild();
      throw fail("Wikidata oracle request was cancelled.");
    }
    if (request.operation === "open" && response?.status === "ok" && typeof response.run_id === "string") {
      runID = response.run_id;
    }
    if (request.operation === "close" && response?.result?.closed === true) {
      runID = undefined;
      await stopChild();
      childFailed = true;
    }
    return response;
  }

  return {
    execute(request, context) {
      const task = queue.then(() => executeOne(request, context));
      queue = task.catch(() => {});
      return task;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      settlePending(fail("Wikidata oracle bridge was disposed."));
      await stopChild();
    },
  };
}

export async function createWikidataOraclePlugin() {
  const { Plugin } = await import("@opencode/plugin");
  return Plugin.define({
    id: "wikidata-oracle",
    async setup(ctx) {
      const repositoryRoot = await realpath(sourceRoot);
      const bridges = new Map();
      let unloaded = false;
      const registration = await ctx.tool.transform((editor) => {
        editor.add({
          name: "wikidata_oracle",
          description: "Run one read-only Wikidata oracle operation for the current post.",
          input: {
            type: "object",
            additionalProperties: false,
            required: ["operation", "input"],
            properties: {
              operation: { type: "string", enum: [...operations] },
              input: { type: "object", additionalProperties: true },
              run_id: { type: "string" },
            },
          },
          options: { codemode: false },
          async execute(input, toolContext) {
            if (unloaded) throw fail("Wikidata oracle plugin is no longer active.");
            const session = await ctx.session.get({ sessionID: toolContext.sessionID });
            if (!session || session.id !== toolContext.sessionID || !session.projectID || !session.location?.directory) {
              throw fail("Wikidata oracle caller session could not be verified.");
            }
            let bridge = bridges.get(toolContext.sessionID);
            if (!bridge) {
              bridge = createWikidataOracleBridge({ repositoryRoot, projectID: session.projectID });
              bridges.set(toolContext.sessionID, bridge);
            }
            const response = await bridge.execute(input, {
              sessionID: toolContext.sessionID,
              projectID: session.projectID,
              sessionDirectory: session.location.directory,
              signal: toolContext.signal,
            });
            if (input.operation === "close" && response?.result?.closed === true) {
              bridges.delete(toolContext.sessionID);
              await bridge.dispose();
            }
            return { content: JSON.stringify(response) };
          },
        });
      });
      return async () => {
        unloaded = true;
        try {
          await registration.dispose();
        } finally {
          await Promise.all([...bridges.values()].map((bridge) => bridge.dispose()));
          bridges.clear();
        }
      };
    },
  });
}
