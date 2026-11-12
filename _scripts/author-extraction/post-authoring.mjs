import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import runtimeSchema from "./author-runtime-profile.schema.json" with { type: "json" };
import { compileAuthorRuntimeProfile, readAuthorRuntimeInput } from "./runtime.mjs";

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

export async function planAuthorPost(root, input) {
  if (!validate(input) || input.task.mode !== "generate") fail("AUTHOR_POST_INPUT_INVALID", "A closed new-post request with a generate task is required.");
  const date = input.date ?? today();
  if (!Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) fail("AUTHOR_POST_INPUT_INVALID", "Invalid article date.");
  const compiled = await compileAuthorRuntimeProfile(root, JSON.stringify(input.task));
  const request = { ...input, date, task: JSON.parse(compiled.runtime_profile_json).task_context };
  const requestHash = sha(json(request));
  const target = input.destination === "draft" ? `_drafts/${input.slug}.md`
    : `_posts/${input.category.toLowerCase().replaceAll(" ", "-")}/${date}-${input.slug}.md`;
  await assertNewTarget(root, target);
  return { request, compiled, target, requestHash };
}

// Never interpolate user values into a shell. Rake's task argument parser also
// needs its own escaping, independently of OS argv quoting.
const rakeArgument = (v) => v.replace(/[\\,\[\]]/g, "\\$&");
export const authorPostRakeInvocation = (input) => `${input.destination}[${[input.title, input.category, input.slug].map(rakeArgument).join(",")}]`;

export async function prepareAuthorPost(root, input, { signal } = {}) {
  check(signal);
  const plan = await planAuthorPost(root, input);
  check(signal);
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
  const profile = JSON.parse(plan.compiled.runtime_profile_json);
  return {
    schema_version: "author-post-preparation/2",
    request_sha256: plan.requestHash,
    request: plan.request,
    target_path: plan.target,
    rake_task: input.destination,
    rakefile_sha256: sha(rake.bytes),
    scaffold_sha256: sha(scaffold.bytes),
    runtime_id: plan.compiled.runtime_id,
    profile_sha256: plan.compiled.runtime_profile_sha256,
    instructions_sha256: plan.compiled.runtime_instructions_sha256,
    source_author_model_sha256: profile.source.author_model_sha256,
    instructions_markdown: plan.compiled.runtime_instructions_markdown,
  };
}

export async function verifyAuthorPostContext(root, prepared) {
  if (!prepared || prepared.schema_version !== "author-post-preparation/2" || !validate(prepared.request) ||
      sha(json(prepared.request)) !== prepared.request_sha256 || prepared.request.task.mode !== "generate") {
    fail("AUTHOR_POST_INPUT_CHANGED", "Authoring request changed.");
  }
  const compiled = await compileAuthorRuntimeProfile(root, JSON.stringify(prepared.request.task));
  const profile = JSON.parse(compiled.runtime_profile_json);
  if (compiled.runtime_id !== prepared.runtime_id ||
      compiled.runtime_profile_sha256 !== prepared.profile_sha256 ||
      compiled.runtime_instructions_sha256 !== prepared.instructions_sha256 ||
      profile.source.author_model_sha256 !== prepared.source_author_model_sha256 ||
      compiled.runtime_instructions_markdown !== prepared.instructions_markdown) {
    fail("AUTHOR_POST_INPUT_CHANGED", "The bound runtime changed.");
  }
  await readAuthorRuntimeInput(root, prepared.target_path, 512 * 1024);
  return compiled.runtime_instructions_markdown;
}

export async function verifyAuthorPostWritten(root, prepared) {
  const target = await readAuthorRuntimeInput(root, prepared.target_path, 512 * 1024);
  const body = /^---\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/.exec(target.text)?.[1];
  if (sha(target.bytes) === prepared.scaffold_sha256 || !body?.trim()) {
    fail("AUTHOR_POST_BODY_MISSING", "The new file still has no article body; use cancelled to end without writing.");
  }
}

export { json as authoringJson, sha as authoringSha };
