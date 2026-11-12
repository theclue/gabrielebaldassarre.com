import Ajv2020 from "ajv/dist/2020.js";
import { authoringJson as json, authoringSha as sha, preparePostInputSchema } from "./post-authoring.mjs";
import { compileAuthorRuntimeProfile, readAuthorRuntimeInput as read } from "./runtime.mjs";

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const check = (signal) => signal?.throwIfAborted();
const text = (maxLength) => ({ type: "string", minLength: 1, maxLength, pattern: "\\S" });
const articlePath = "^(?:_drafts/[a-z0-9][a-z0-9-]*|_posts/(?:3d-printing|devops|fisica|home-assistant|meccanica|reti-sociali)/[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9-]*)\\.md$";

export const revisionInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request", "target_path", "task"],
  $defs: preparePostInputSchema.$defs,
  properties: {
    request: text(6000),
    target_path: { type: "string", maxLength: 300, pattern: articlePath },
    task: { $ref: "#/$defs/TaskContext" },
  },
};

const validateInput = new Ajv2020({ strict: false, allErrors: true }).compile(revisionInputSchema);
const bodyOf = (s) => /^---\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/.exec(s)?.[1];

export async function planAuthorRevision(root, input) {
  if (!validateInput(input) || !["rewrite", "expand"].includes(input.task.mode)) {
    fail("AUTHOR_REVISION_INPUT_INVALID", "Use an existing Markdown target and a closed rewrite/expand brief.");
  }
  const original = await read(root, input.target_path, 512 * 1024);
  if (!bodyOf(original.text)?.trim()) {
    fail("AUTHOR_REVISION_INPUT_INVALID", "The target must contain front matter and an existing article body.");
  }
  const compiled = await compileAuthorRuntimeProfile(root, JSON.stringify(input.task));
  const request = { ...input, task: JSON.parse(compiled.runtime_profile_json).task_context, source_sha256: sha(original.bytes) };
  const requestHash = sha(json(request));
  return { request, requestHash, target: input.target_path, compiled, original };
}

export async function prepareAuthorRevision(root, input, { signal, plan } = {}) {
  check(signal);
  const current = await planAuthorRevision(root, input);
  if (plan && (current.requestHash !== plan.requestHash || current.compiled.runtime_instructions_sha256 !== plan.compiled.runtime_instructions_sha256)) {
    fail("AUTHOR_REVISION_SOURCE_CHANGED", "The source or task changed while requesting permission; prepare again.");
  }
  const p = plan ?? current;
  check(signal);
  if (sha((await read(root, p.target, 512 * 1024)).bytes) !== p.request.source_sha256) {
    fail("AUTHOR_REVISION_SOURCE_CHANGED", "The article changed during preparation; no revision was activated.");
  }
  const profile = JSON.parse(p.compiled.runtime_profile_json);
  return {
    schema_version: "author-post-revision/2",
    request_sha256: p.requestHash,
    request: p.request,
    target_path: p.target,
    source_sha256: p.request.source_sha256,
    runtime_id: p.compiled.runtime_id,
    profile_sha256: p.compiled.runtime_profile_sha256,
    instructions_sha256: p.compiled.runtime_instructions_sha256,
    source_author_model_sha256: profile.source.author_model_sha256,
    instructions_markdown: p.compiled.runtime_instructions_markdown,
  };
}

export async function verifyAuthorRevisionContext(root, prepared) {
  if (!prepared || prepared.schema_version !== "author-post-revision/2") {
    fail("AUTHOR_REVISION_RECEIPT_CHANGED", "Revision state is invalid.");
  }
  const input = { request: prepared.request?.request, target_path: prepared.request?.target_path, task: prepared.request?.task };
  if (!validateInput(input) || !["rewrite", "expand"].includes(input.task.mode) ||
      sha(json(prepared.request)) !== prepared.request_sha256 ||
      prepared.request.target_path !== prepared.target_path ||
      prepared.request.source_sha256 !== prepared.source_sha256) {
    fail("AUTHOR_REVISION_SOURCE_CHANGED", "The bound revision request changed.");
  }
  const compiled = await compileAuthorRuntimeProfile(root, JSON.stringify(prepared.request.task));
  const profile = JSON.parse(compiled.runtime_profile_json);
  if (compiled.runtime_id !== prepared.runtime_id ||
      compiled.runtime_profile_sha256 !== prepared.profile_sha256 ||
      compiled.runtime_instructions_sha256 !== prepared.instructions_sha256 ||
      profile.source.author_model_sha256 !== prepared.source_author_model_sha256 ||
      compiled.runtime_instructions_markdown !== prepared.instructions_markdown) {
    fail("AUTHOR_REVISION_SOURCE_CHANGED", "The bound author runtime changed.");
  }
  await read(root, prepared.target_path, 512 * 1024);
  return compiled.runtime_instructions_markdown;
}

export async function verifyAuthorRevisionWritten(root, prepared) {
  const target = await read(root, prepared.target_path, 512 * 1024);
  if (!bodyOf(target.text)?.trim() || sha(target.bytes) === prepared.source_sha256) {
    fail("AUTHOR_REVISION_BODY_UNCHANGED", "The article has not been revised; cancel without claiming a written revision.");
  }
}
