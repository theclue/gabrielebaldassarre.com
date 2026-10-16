import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileAuthorModel } from "./model.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => !["--check", "--without-semantic-context"].includes(arg)) || new Set(args).size !== args.length) {
  console.error("Usage: node compile-author-model.mjs [--check] [--without-semantic-context]");
  process.exitCode = 1;
} else {
  try {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const composition = await readFile(new URL("./author-model.composition.json", import.meta.url), "utf8");
    const result = await compileAuthorModel(root, composition, { includeSemanticContext: !args.includes("--without-semantic-context") });
    const relative = "docs/author-pattern-results/v1.3/author-model.json";
    const destination = path.join(root, relative);
    if (args.includes("--check")) {
      const info = await lstat(destination);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 128 * 1024 || await readFile(destination, "utf8") !== result.author_model_json) {
        throw Object.assign(new Error("The existing model differs from the reproducible compilation."), { code: "MODEL_STALE" });
      }
    } else {
      // An existing model is never overwritten; regeneration is an explicit step.
      const handle = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
      try { await handle.writeFile(result.author_model_json, "utf8"); await handle.sync(); } finally { await handle.close(); }
    }
    console.log(JSON.stringify({ operation: args.includes("--check") ? "verified" : "created", path: relative,
      source_review_hash: result.source_review_hash, sha256: result.author_model_sha256, ...result.counts }, null, 2));
  } catch (error) {
    console.error(`${error.code ?? "MODEL_FAILED"}: ${error.message}`);
    process.exitCode = 1;
  }
}
