import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import runtimeSchema from "./author-runtime-profile.schema.json" with { type: "json" };
import { compileAuthorRuntimeProfile, readAuthorRuntimeInput } from "./runtime.mjs";
import { materializeAuthorRuntime } from "./compile-author-runtime.mjs";

const run = promisify(execFile);
const categories = ["3D Printing", "DevOps", "Fisica", "Home Assistant", "Meccanica", "Reti Sociali"];
export const preparePostInputSchema = {
  type: "object", additionalProperties: false,
  required: ["request", "title", "category", "slug", "destination", "task"],
  $defs: Object.fromEntries(["Text", "DeviceId", "Status", "SeriesContext", "DeviceRequest", "TaskContext"].map((key) => [key, runtimeSchema.$defs[key]])),
  properties: {
    request: { type: "string", minLength: 1, maxLength: 6000, pattern: "\\S" },
    title: { type: "string", minLength: 1, maxLength: 240, pattern: "^[^\\r\\n\\x00-\\x1f]+$" },
    category: { enum: categories }, slug: { type: "string", maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    destination: { enum: ["draft", "post"] }, date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
    task: { $ref: "#/$defs/TaskContext" },
  },
};
const validate = new Ajv2020({ strict: false, allErrors: true }).compile(preparePostInputSchema);
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, stable(v[key])])) : v;
const json = (v) => `${JSON.stringify(stable(v), null, 2)}\n`;
const sha = (v) => createHash("sha256").update(v).digest("hex");
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const check = (signal) => signal?.throwIfAborted();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function safeDirectory(root, relative, create = false) {
  let current = await realpath(root);
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (create) try { await mkdir(current); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) fail("AUTHOR_POST_PATH_INVALID", "An authoring directory must not be a symlink.");
  }
}

async function assertNewTarget(root, target) {
  const parent = path.dirname(target);
  // Check existing ancestors without creating output directories during planning.
  let current = await realpath(root);
  for (const part of parent.split("/")) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) fail("AUTHOR_POST_PATH_INVALID", "Unsafe post destination.");
    } catch (error) { if (error.code === "ENOENT") break; throw error; }
  }
  try { await lstat(path.join(root, target)); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  fail("AUTHOR_POST_EXISTS", "The target already exists; no existing post or draft will be overwritten.");
}

async function immutable(root, relative, text, limit = 64 * 1024) {
  await safeDirectory(root, path.dirname(relative), true);
  try {
    const handle = await open(path.join(root, relative), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
    try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
  } catch (error) { if (error.code !== "EEXIST") throw error; }
  if ((await readAuthorRuntimeInput(root, relative, limit)).text !== text) fail("AUTHOR_POST_COLLISION", "Existing authoring evidence differs; nothing was overwritten.");
}

export async function planAuthorPost(root, input) {
  if (!validate(input) || input.task.mode !== "generate") fail("AUTHOR_POST_INPUT_INVALID", "A closed new-post request with a generate task is required.");
  const date = input.date ?? today();
  if (!Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) fail("AUTHOR_POST_INPUT_INVALID", "Invalid article date.");
  const compiled = await compileAuthorRuntimeProfile(root, JSON.stringify(input.task));
  const request = { ...input, date, task: JSON.parse(compiled.runtime_profile_json).task_context };
  const requestHash = sha(json(request));
  const directory = `docs/authoring-runs/${requestHash}`;
  const target = input.destination === "draft" ? `_drafts/${input.slug}.md`
    : `_posts/${input.category.toLowerCase().replaceAll(" ", "-")}/${date}-${input.slug}.md`;
  await assertNewTarget(root, target);
  return { request, compiled, directory, target, requestHash };
}

// Never interpolate user values into a shell. Rake's task argument parser also
// needs its own escaping, independently of OS argv quoting.
const rakeArgument = (v) => v.replace(/[\\,\[\]]/g, "\\$&");
export const authorPostRakeInvocation = (input) => `${input.destination}[${[input.title, input.category, input.slug].map(rakeArgument).join(",")}]`;

export async function prepareAuthorPost(root, input, { signal } = {}) {
  check(signal);
  const plan = await planAuthorPost(root, input);
  check(signal);
  const requestPath = `${plan.directory}/request.json`, taskPath = `${plan.directory}/task.json`;
  await immutable(root, requestPath, json(plan.request));
  await immutable(root, taskPath, json(plan.request.task));
  check(signal);
  await materializeAuthorRuntime(root, taskPath);
  const runtime = await materializeAuthorRuntime(root, taskPath, { checkOnly: true });
  if (runtime.profile_sha256 !== plan.compiled.runtime_profile_sha256 || runtime.instructions_sha256 !== plan.compiled.runtime_instructions_sha256) {
    fail("AUTHOR_POST_INPUT_CHANGED", "Runtime inputs changed during preparation; no article template was created.");
  }
  const instructions = (await readAuthorRuntimeInput(root, runtime.instructions_path, 48 * 1024)).text;
  const rake = await readAuthorRuntimeInput(root, "Rakefile", 64 * 1024);
  await safeDirectory(root, path.dirname(plan.target), true);
  await assertNewTarget(root, plan.target);
  check(signal);
  const invocation = authorPostRakeInvocation(input);
  try {
    await run("rake", ["--rakefile", "Rakefile", invocation], {
      cwd: root, env: { ...process.env, date: plan.request.date }, signal, timeout: 30_000, maxBuffer: 64 * 1024,
    });
  } catch (error) {
    if (signal?.aborted) check(signal);
    fail("AUTHOR_POST_RAKE_FAILED", "Rake failed. Inspect the target; no fallback or automatic cleanup was attempted.");
  }
  check(signal);
  const scaffold = await readAuthorRuntimeInput(root, plan.target, 64 * 1024);
  const receipt = {
    schema_version: "author-post-preparation/1", request_sha256: plan.requestHash,
    request_path: requestPath, task_path: taskPath, target_path: plan.target, rake_task: input.destination,
    rakefile_sha256: sha(rake.bytes), scaffold_sha256: sha(scaffold.bytes),
    runtime_id: runtime.runtime_id, manifest_path: `${path.dirname(runtime.profile_path)}/manifest.json`,
    profile_path: runtime.profile_path, profile_sha256: runtime.profile_sha256,
    instructions_path: runtime.instructions_path, instructions_sha256: runtime.instructions_sha256,
    source_author_model_sha256: runtime.source_author_model_sha256,
  };
  const receiptPath = `${plan.directory}/preparation.json`;
  await immutable(root, receiptPath, json(receipt));
  return { ...receipt, receipt_path: receiptPath, instructions_markdown: instructions };
}

export async function verifyAuthorPostContext(root, prepared) {
  const saved = JSON.parse((await readAuthorRuntimeInput(root, prepared.receipt_path, 64 * 1024)).text);
  const { receipt_path, instructions_markdown, ...expected } = prepared;
  if (json(saved) !== json(expected)) fail("AUTHOR_POST_RECEIPT_CHANGED", "Authoring receipt changed.");
  const requestFile = await readAuthorRuntimeInput(root, saved.request_path, 32 * 1024);
  const request = JSON.parse(requestFile.text);
  if (!validate(request) || sha(json(request)) !== saved.request_sha256 || request.task.mode !== "generate") fail("AUTHOR_POST_INPUT_CHANGED", "Authoring request changed.");
  const taskFile = await readAuthorRuntimeInput(root, saved.task_path);
  if (json(JSON.parse(taskFile.text)) !== json(request.task)) fail("AUTHOR_POST_INPUT_CHANGED", "Authoring task changed.");
  const runtime = await materializeAuthorRuntime(root, saved.task_path, { checkOnly: true });
  if (runtime.runtime_id !== saved.runtime_id || runtime.instructions_sha256 !== saved.instructions_sha256 || runtime.profile_sha256 !== saved.profile_sha256 ||
      `${path.dirname(runtime.profile_path)}/manifest.json` !== saved.manifest_path || runtime.profile_path !== saved.profile_path || runtime.instructions_path !== saved.instructions_path ||
      runtime.source_author_model_sha256 !== saved.source_author_model_sha256) fail("AUTHOR_POST_INPUT_CHANGED", "The bound runtime changed.");
  const instructions = (await readAuthorRuntimeInput(root, saved.instructions_path, 48 * 1024)).text;
  if (sha(instructions) !== saved.instructions_sha256 || instructions !== instructions_markdown) fail("AUTHOR_POST_INPUT_CHANGED", "Authoring instructions changed.");
  // The article is editable, but must still be a regular file inside this repo.
  await readAuthorRuntimeInput(root, saved.target_path, 512 * 1024);
  return instructions;
}

export async function verifyAuthorPostWritten(root, prepared) {
  const target = await readAuthorRuntimeInput(root, prepared.target_path, 512 * 1024);
  const body = /^---\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/.exec(target.text)?.[1];
  if (sha(target.bytes) === prepared.scaffold_sha256 || !body?.trim()) fail("AUTHOR_POST_BODY_MISSING", "The new file still has no article body; use cancelled to end without writing.");
}

// Shared create-only evidence primitives; revision never invokes the Rake path.
export { json as authoringJson, sha as authoringSha, immutable as immutableAuthoringEvidence };
