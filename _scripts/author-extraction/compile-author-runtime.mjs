import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { compileAuthorRuntimeProfile, readAuthorRuntimeInput } from "./runtime.mjs";

async function ensureDirectory(root, relative) {
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    try { await mkdir(current); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Object.assign(new Error("Unsafe runtime destination."), { code: "RUNTIME_PATH_INVALID" });
  }
}

export async function materializeAuthorRuntime(repoRoot, taskRelative, { checkOnly = false } = {}) {
  const task = await readAuthorRuntimeInput(repoRoot, taskRelative);
  const result = await compileAuthorRuntimeProfile(repoRoot, task.text);
  const directory = `docs/author-pattern-results/v1.3/author-runtimes/arp-${result.runtime_id.slice(4).toLowerCase()}`;
  const profilePath = `${directory}/author-runtime-profile.json`, promptPath = `${directory}/author-runtime-instructions.md`;
  const receipt = {
    schema_version: "author-runtime-artifacts/1", runtime_id: result.runtime_id,
    source_author_model_sha256: JSON.parse(result.runtime_profile_json).source.author_model_sha256,
    runtime_compiler_version: JSON.parse(result.runtime_profile_json).provenance.runtime_compiler_version,
    profile_path: profilePath, profile_sha256: result.runtime_profile_sha256,
    instructions_path: promptPath, instructions_sha256: result.runtime_instructions_sha256, counts: result.counts,
    guardrail_resolution: result.guardrail_resolution,
  };
  const files = [[profilePath, result.runtime_profile_json], [promptPath, result.runtime_instructions_markdown], [`${directory}/manifest.json`, `${JSON.stringify(receipt, null, 2)}\n`]];
  if (!checkOnly) await ensureDirectory(repoRoot, directory);
  for (const [relative, text] of files) {
    let exists = true;
    try { await lstat(path.join(repoRoot, relative)); } catch (error) { if (error.code === "ENOENT") exists = false; else throw error; }
    if (!exists && checkOnly) throw Object.assign(new Error("The requested runtime artifacts do not exist."), { code: "RUNTIME_MISSING" });
    if (exists && (await readAuthorRuntimeInput(repoRoot, relative, 48 * 1024)).text !== text) {
      throw Object.assign(new Error("Existing runtime bytes differ; nothing was overwritten."), { code: "RUNTIME_COLLISION" });
    }
  }
  if (!checkOnly) for (const [relative, text] of files) {
    try { await lstat(path.join(repoRoot, relative)); continue; } catch (error) { if (error.code !== "ENOENT") throw error; }
    const handle = await open(path.join(repoRoot, relative), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
    try { await handle.writeFile(text, "utf8"); await handle.sync(); } finally { await handle.close(); }
  }
  for (const [relative, text] of files) if ((await readAuthorRuntimeInput(repoRoot, relative, 48 * 1024)).text !== text) {
    throw Object.assign(new Error("Persisted runtime bytes differ from their compilation."), { code: "RUNTIME_COLLISION" });
  }
  return { operation: checkOnly ? "verified" : "materialized", ...receipt };
}

export async function main(args) {
  const taskIndex = args.indexOf("--task");
  if (taskIndex < 0 || !args[taskIndex + 1] || args[taskIndex + 1].startsWith("--") ||
      args.filter((arg) => arg === "--task").length !== 1 || args.filter((arg) => arg === "--check").length > 1 ||
      args.some((arg, index) => arg !== "--task" && arg !== "--check" && index !== taskIndex + 1)) {
    throw Object.assign(new Error("Usage: compile-author-runtime.mjs --task <repository-relative.json> [--check]"), { code: "RUNTIME_ARGUMENTS_INVALID" });
  }
  return materializeAuthorRuntime(fileURLToPath(new URL("../../", import.meta.url)), args[taskIndex + 1], { checkOnly: args.includes("--check") });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`${error.code ?? "RUNTIME_FAILED"}: ${error.message}`); process.exitCode = 1; }
}
