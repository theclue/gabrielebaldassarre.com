// Operator-side capture only. No inference, tool invocation, receipt invention,
// assistant-text substitution, arbitrary source path, or overwrite of old runs.
import { spawnSync } from "node:child_process";
import { openSync, closeSync, readFileSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { prepareArticle, acceptCandidate, verifyExtractionRecord } from "./core.mjs";
import { prepareConsolidation, acceptDimensionCandidate } from "./consolidator.mjs";

const [mode, key, session, audit] = process.argv.slice(2);
const root = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const articles = Array.from({ length: 20 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`);
const dimensions = ["rhetorical", "epistemic", "semantic", "decisional"];
const base = "/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode/";
if (!(mode === "extraction" ? articles.includes(key) : mode === "consolidation" && dimensions.includes(key)) ||
  !/^ses_[A-Za-z0-9]+$/.test(session ?? "") || !audit?.startsWith(base) || audit.includes("..")) {
  throw new Error("Expected one approved article/dimension, native session, and operator audit directory.");
}
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function api(operation, params, name) {
  const filename = `${audit}/${mode}-${key}-${name}.json`, fd = openSync(filename, "w");
  const args = ["api", operation];
  for (const [parameter, value] of Object.entries(params)) args.push("--param", `${parameter}=${value}`);
  try {
    const result = spawnSync("opencode", args, { stdio: ["ignore", fd, "pipe"], encoding: "utf8", timeout: 20000 });
    if (result.status !== 0) throw new Error("Native API retrieval failed.");
  } finally { closeSync(fd); }
  return JSON.parse(readFileSync(filename, "utf8"));
}
const response = api("session.get", { sessionID: session }, "session");
const info = response.data ?? response;
if (info.location?.directory !== root) throw new Error("Native session belongs to another checkout.");
const expectedAgent = mode === "extraction" ? "author-extractor" : "author-pattern-consolidator";
const tools = [];
let cursor, pageNumber = 0;
do {
  const page = api("session.message.list", { sessionID: session, limit: "1", ...(cursor ? { cursor } : { order: "asc" }) }, `page-${++pageNumber}`);
  for (const listed of page.data ?? []) {
    if (listed.type !== "assistant") continue;
    const direct = api("session.message.get", { sessionID: session, messageID: listed.id }, listed.id);
    const message = direct.data ?? direct;
    if (message.agent !== expectedAgent) throw new Error("Unexpected native assistant agent.");
    for (const part of message.content ?? []) if (part.type === "tool") {
      if (JSON.stringify(part) !== JSON.stringify((listed.content ?? []).find((item) => item.id === part.id))) throw new Error("Collection/direct native result mismatch.");
      tools.push({ message: message.id, part });
    }
  }
  cursor = page.cursor?.next;
  if (pageNumber > 16) throw new Error("Unexpected session message count.");
} while (cursor);
const prefix = mode === "extraction" ? "author_extraction" : "author_pattern_consolidation";
const prepares = tools.filter(({ part }) => part.name === `${prefix}_prepare`);
const submits = tools.filter(({ part }) => part.name === `${prefix}_submit`);
if (tools.length !== 2 || prepares.length !== 1 || submits.length !== 1) throw new Error("Expected exactly one native prepare and submit.");
const prepare = prepares[0], submit = submits[0];
for (const { part } of [prepare, submit]) {
  if (part.state.status !== "completed" || part.state.metadata?.truncated !== false ||
    part.state.content?.length !== 1 || part.state.content[0].type !== "text") throw new Error("Native result failed or is incomplete.");
}
const prepared = mode === "extraction" ? await prepareArticle(root, key)
  : await prepareConsolidation(root, key, "docs/author-extraction-results/v1.3");
const preparedText = JSON.stringify(prepared);
if (prepare.part.state.content[0].text !== preparedText) throw new Error("Native preparation/producer byte mismatch.");
const input = submit.part.state.input;
const envelope = JSON.parse(submit.part.state.content[0].text);
if (envelope.status !== "accepted" || typeof envelope.canonical_json !== "string") throw new Error("No accepted native envelope.");
const record = JSON.parse(envelope.canonical_json);
if (input.input_hash !== prepared.input_hash || (mode === "extraction" ? input.article_id !== key : input.dimension !== key || input.corpus_hash !== prepared.corpus_hash)) throw new Error("Native submission hash/identity mismatch.");
let reproduced;
if (mode === "extraction") {
  if (record.schema_version !== "author-extraction/1.3" || record.processing?.receipt?.session_id !== session) throw new Error("Wrong extraction version or host receipt.");
  reproduced = await acceptCandidate(root, key, input.input_hash, input.candidate_json, { workflowReceipt: record.processing.receipt });
  if (!(await verifyExtractionRecord(root, reproduced)).processing_eligible) throw new Error("Record failed processing eligibility.");
} else {
  if (record.schema_version !== "author-pattern-dimension/0.6") throw new Error("Wrong consolidation version.");
  reproduced = await acceptDimensionCandidate(root, key, input.corpus_hash, input.input_hash, input.candidate_json, "docs/author-extraction-results/v1.3");
}
if (envelope.canonical_json !== reproduced || submit.part.state.content[0].text !== JSON.stringify({ status: "accepted", canonical_json: reproduced })) throw new Error("Native acceptance/producer byte mismatch.");
const protectedHashes = JSON.parse(await readFile(`${audit}/protected-hashes.json`, "utf8"));
for (const [relative, expected] of Object.entries(protectedHashes)) if (sha(await readFile(`${root}/${relative}`)) !== expected) throw new Error("Historical artifact or source changed during the run.");
const directory = mode === "extraction" ? "docs/author-extraction-results/v1.3" : "docs/author-pattern-results/v1.3";
await mkdir(`${root}/${directory}`, { recursive: true });
await writeFile(`${root}/${directory}/${key}.json`, Buffer.from(reproduced, "utf8"), { flag: "wx" });
if ((await readFile(`${root}/${directory}/${key}.json`, "utf8")) !== envelope.canonical_json) throw new Error("Saved bytes differ from the native result.");
const receipt = {
  mode, key, session, model: info.model, accepted: true,
  prepare_message: prepare.message, prepare_call: prepare.part.id, submit_message: submit.message, submit_call: submit.part.id,
  input_hash: input.input_hash, schema_version: record.schema_version, canonical_bytes: Buffer.byteLength(reproduced), canonical_sha256: sha(reproduced),
  prepared_bytes: Buffer.byteLength(preparedText), prepared_sha256: sha(preparedText), native_producer_byte_match: true,
  ...(mode === "extraction" ? { source: record.source, observations: record.observations.length, evidence_refs: record.observations.reduce((n, item) => n + item.evidence.length, 0), processing: record.processing.status }
    : { corpus_hash: record.corpus_hash, groups: record.groups.length, grouped_observations: record.groups.reduce((n, item) => n + item.support.length, 0), unclustered_observations: record.unclustered_observations.length }),
};
await writeFile(`${audit}/receipt-${key}.json`, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(receipt));
