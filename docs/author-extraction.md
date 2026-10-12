# Author-extraction contract v1

This is a local, offline, repeatable extraction boundary for the 12 positively approved entries in `docs/corpus.yaml`. It stores candidate article-grounded observations, not an author model, ontology, knowledge graph, durable ledger, score, fingerprint, or proof of human authorship. The corpus declaration itself says approval as a representative reference does not establish exclusive human authorship, absence of AI, or coauthorship. The excluded OpenSCAD article is not an eligible source.

## Scope and trust boundary

- Only the fixed `A01`–`A12` IDs in the corpus allowlist select source files. Callers/native tools accept no path, workspace root, or arbitrary source text. `path` in a prepared record is provenance from that allowlist, not user/model-controlled input.
- Read `docs/corpus.yaml`, the selected raw post, `_scripts/author-extraction/extraction.schema.json`, and `.opencode/agents/author-extractor.md` as bytes. Hash the first three input artifacts as specified below. The instruction file is an expected companion supplied by the native-plugin owner; missing or unreadable required input fails closed. Do not treat old author-model front matter, other article metadata, or unrelated workspace files as extraction facts.
- This phase is offline. It makes no model/provider/API request, has no provider default, no HTTP client, and no service or database. A user separately chooses a provider/model for a future manual pilot; supporting a model in a catalog is not a test of credentials or availability.
- Four candidate layers only: rhetorical, epistemic, semantic, and decisional. Each observation is a *candidate* inference with article/passage quote evidence; quote membership does not prove semantic entailment. No cross-article identity, invariant, cluster, or author trait is inferred from a single record.
- Counts are mechanical over the raw Markdown body and include code, mathematics, and template text. `advanced_stylometry` is explicitly `not_computed`, null, `OUT_OF_SCOPE_V1`; do not substitute readability, prose metrics, or a fingerprint.

## Frozen versions, API, and hashes

Version literals are fixed for this contract:

| Field | Value |
| --- | --- |
| `schema_version` | `author-extraction/1` |
| `prepare_version` | `prepare/1` |
| `segmentation_version` | `raw-blank-lines/1` |
| `measurement_version` | `raw-body-counts/1` |
| `instructions_version` | `author-extractor/1` |

Core exports exactly these operations:

```text
prepareArticle(repoRoot, articleId) -> Promise<Prepared>
acceptCandidate(repoRoot, articleId, inputHash, candidateJson) -> Promise<canonicalFinalJsonString>
```

Both operations are async: success fulfills the promise with exactly the documented value; every failure rejects the promise and never fulfills it with an error-shaped value. Rejections are `Error` instances with own `code` (string), `message` (at most 240 characters), and `details` (array of at most five safe schema-style JSON pointers; empty when there are none). No custom error class is exported. `prepareArticle` and `acceptCandidate` are stateless with respect to sessions and do not persist. `repoRoot` is a trusted, host-injected workspace root, never a tool argument. `articleId` is one approved ID. `candidateJson` is the model-supplied JSON text; it is parsed strictly and never silently repaired. Do not echo article text, candidate text, paths outside the approved relative path, or native/provider failures.

Hashes are lowercase SHA-256 hex over raw bytes for `corpus_hash` (`docs/corpus.yaml`), `file_hash` (selected post), `schema_hash` (this JSON schema), and `instructions_hash` (the companion instruction file). Decode source/body UTF-8 fatally. `input_hash` is SHA-256 over UTF-8 bytes of the compact canonical JSON serialization of exactly `{ "source": source, "method": method }`; object keys are recursively sorted, array order is preserved, and no whitespace is emitted. There are no timestamps, random IDs, model-selection fields, or generated defaults. Identical current source/method plus the same candidate produces identical final JSON bytes; semantic model outputs are not promised to be identical.

## Preparation rules

- Validate the corpus YAML with `yaml` `parseDocument`; parser errors, warnings, aliases (including alias expansion), malformed declarations, duplicate/unknown IDs, or missing approved source fail closed. Its structural v1 precondition is an object-valued `contesto`, an `esclusioni` array, and a `fonti` array containing exactly the fixed A01–A12 allowlist entries, each once, with its exact approved path and `rappresentativo_stile: true`; no other entry may be treated as eligible. This checks dataset structure only, not human consent, exclusive human authorship, AI use, coauthorship, or any exact approval wording. Use alias limit zero; do not execute YAML tags or templates. Verify the requested ID against the exact positively approved map; do not accept arbitrary paths.
- Source is at most 262,144 raw bytes. The first line must be exactly `---` (LF or CRLF); a missing/incorrect opening delimiter rejects with `SOURCE_BOUNDARY`. The next exact `---` line closes front matter; if it is absent, reject with `SOURCE_INVALID`. Invalid UTF-8 or invalid front-matter YAML also rejects with `SOURCE_INVALID`. YAML front matter is parsed for validity and discarded. The body is the exact UTF-8 decoded byte remainder after the closing delimiter and its line terminator; do not normalize Unicode, line endings, whitespace, or Markdown.
- Split body on blank-line delimiters containing only zero or more spaces/tabs between line endings. Keep each non-empty raw span, assign `P0001` upwards, and report `start_cp` inclusive / `end_cp` exclusive offsets in Unicode code points from the body start. These are raw blank-line spans, not semantic Markdown paragraphs. Fail over 512 passages; never truncate.
- `utf8_bytes` is body UTF-8 byte length; `unicode_code_points` counts Unicode code points; `nonblank_lines` counts body lines containing a non-whitespace code point. A genuine zero is integer zero, not null. All count bounds are at most 262,144.
- Enforce a serialized `Prepared` response limit of 4 MiB, measured as UTF-8 bytes after JSON escaping at the native response boundary. Oversize rejects with `LIMIT_EXCEEDED` and produces no partial result or artifact; do not truncate or lower the limit to work around native shortening.

## Candidate and final record

`extraction.schema.json` uses JSON Schema Draft 2020-12. Compile it locally with Ajv's Draft 2020-12 entry point and validate every referenced definition. No remote `$ref` loading, coercion, defaults, removal of extra properties, or partial validation. YAML is parsed with `yaml` 2.8.1; dependencies are exact-pinned in the private ESM package. The submit string is limited to 65,536 UTF-8 bytes by the core in addition to the schema's code-point length bound.

The schema root is `FinalRecord`; candidate validation targets `$defs/Candidate`. Every object is closed (`additionalProperties: false`), all listed fields are required, and nullable fields are required-but-nullable. String bounds use JSON Schema character/code-point lengths and `\\S` non-whitespace checks; do not trim or mutate payloads. Candidate root has exactly `coverage` and `observations`. It may not supply source, hashes, measurements, paths, generated metadata, or current-human-confirmed traits.

`coverage` requires exactly four entries: `rhetorical`, `epistemic`, `semantic`, `decisional`. Each has a status `observed` or `not_observed` and a nonblank 1–500 character note. `observed` must correspond to at least one observation of that dimension; `not_observed` must correspond to none. `not_observed` is a local absence report, not an author assertion. A coverage mismatch is `COVERAGE_INVALID`.

There must be 1–12 typed observations (zero rejects with `NO_OBSERVATIONS`, never fabricated coverage). Shared fields are `dimension`, `attribute` (1–200), `interpretation` (1–2000), `context` (1–1000), `status: "candidate"`, `inference_kind: "explicit" | "inferred"`, and 1–4 evidence items. Evidence fields are `article_id`, `passage_id`, and a nonblank quote of at most 2,000 characters. Verify ID equality to the current source and exact contiguous quote membership in both the cited passage and current body; schema validation alone cannot establish either. Each dimension has its own disjoint typed payload:

| Dimension | Required payload |
| --- | --- |
| rhetorical | `move`, `function` (each 1–1,000 characters) |
| epistemic | `claim` (1–1,000), `basis`, `qualification` (each required; nullable or nonblank 1–1,000) |
| semantic | `subject`, `relation`, `object` (each 1–1,000), `claim_nature` (`definition`, `causal`, `procedural`, `comparative`, `descriptive`, or `other`) |
| decisional | `choice`, `rationale` (each 1–1,000), `tradeoff`, `condition` (each required; nullable or nonblank 1–1,000) |

The final record is assembled by code from current preparation data plus validated coverage/observations: exactly `schema_version`, `source`, `method`, `measurements`, `coverage`, and `observations`. Validate the full final record again. `canonicalFinalJsonString` is compact JSON with recursively lexicographically sorted object keys and original array order. A final serialized record or serialized acceptance envelope over 1 MiB, measured as UTF-8 bytes after JSON escaping, rejects with `LIMIT_EXCEEDED` and produces no partial result or artifact; do not truncate or lower the limit to work around native shortening. Distinguish malformed JSON (`CANDIDATE_JSON_INVALID`) from JSON that fails the candidate schema (`CANDIDATE_SCHEMA_INVALID`).

## Errors and validation precedence

Core error codes: `CORE_INVALID_ARGUMENT`, `UNKNOWN_ARTICLE`, `CORPUS_INVALID`, `SOURCE_BOUNDARY`, `SOURCE_INVALID`, `LIMIT_EXCEEDED`, `INPUT_CHANGED`, `CANDIDATE_JSON_INVALID`, `CANDIDATE_SCHEMA_INVALID`, `NO_OBSERVATIONS`, `COVERAGE_INVALID`, `EVIDENCE_INVALID`, `FINAL_SCHEMA_INVALID`, `INTERNAL_ERROR`. Check parseability first; for a parsed object with an observations array of length zero, reject with `NO_OBSERVATIONS` before schema-minItems rejection. For other schema failures reject with `CANDIDATE_SCHEMA_INVALID`. After schema pass, rebuild current preparation and compare `input_hash`; reject with `INPUT_CHANGED` before context-dependent evidence or coverage checks if it differs. Otherwise verify source/evidence and coverage correspondence, then validate the assembled final object. Each rejection follows the core `Error` shape above; messages and details never carry excerpts.

Native-layer codes (not core errors): `AGENT_DENIED`, `PROTOCOL_INVALID`, `ATTEMPT_LIMIT`, `CANCELLED`. Native failures never produce an accepted envelope. `INPUT_CHANGED` rejects when fresh source/schema/instructions-derived input no longer matches the submitted hash.

## Native plugin and adapter contract (T3/T4 handoff)

The package is a local OpenCode native plugin plus a native-discovered `.opencode/agents/author-extractor.md` agent; OpenCode 2.0.24 does not autodiscover an `.mjs` plugin, so the owner must provide a `.js` loader. Plugin tool names and closed JSON inputs are:

```text
author_extraction_prepare({ article_id })
author_extraction_submit({ article_id, input_hash, candidate_json })
```

Use the pinned native package's actual tool schemas and `options.codemode: false`. Restrict tool execution to session agent `author-extractor`. Agent permissions are ordered deny-all-action/resource first and then allow only these two `author_extraction_*` resources. A prompt instructs behavior but is not the enforcement boundary. Never add a provider call, fallback, batch mode, client, persistence, or global OpenCode configuration.

For implementation and tests, `createExtractionAdapter(coreApi, repoRoot)` is the fixed injection point. `coreApi` is the imported module exposing exactly `prepareArticle(repoRoot, articleId)` and `acceptCandidate(repoRoot, articleId, inputHash, candidateJson)`. `repoRoot` is injected by the host/plugin and is never caller-controlled. The returned adapter has:

```text
prepare({ article_id }, { sessionId, agent, signal }) -> Promise<Prepared>
submit({ article_id, input_hash, candidate_json }, { sessionId, agent, signal }) -> Promise<AcceptanceEnvelope>
abort(sessionId) -> void
```

`sessionId` is the host's actual OpenCode session ID normalized by the loader; `agent` is the active agent name normalized by the loader; `signal` is an optional `AbortSignal`. Adapter methods are async. Core or adapter failure rejects with an `Error` instance carrying the same own `code`, `message`, and `details` fields defined above (native-only codes use the same shape); the adapter does not return an error-shaped value or envelope. The native tool boundary maps that rejection to a rejected/nonaccepted tool result, never successful tool content. It serializes successful `Prepared` as one JSON text item. Successful submit serializes the `AcceptanceEnvelope` as exactly one compact JSON text item, with no additional content items, assistant-final-text substitution, or surrounding prose. The T3 loader must map these normalized values to the real V2.0.24 event/context/session fields rather than assuming the normalized property names are native SDK fields.

Adapter state is volatile and keyed to the host session/article only: first preparation binds the session to one article and input hash; repeated same-article prepare returns the same prepared value and does not reset attempts; a different article or submitted hash is `PROTOCOL_INVALID`. Count each submission received by adapter before local validation; allow at most two, including malformed candidate JSON. Tool-schema rejections that occur before execution do not count. Serialize concurrent submissions. A valid accepted submit seals the session; no further submits/prepares. Abort, cancellation, and plugin unload end session state without silently creating a replacement. The two-submit allowance is per active session, separate from the six-agent-step allowance, which is per user turn in the pinned runtime. An exhausted turn does not autonomously create another turn/session or reset the submit counter; a further user turn requires explicit step/submit-budget and cost/quota authorization.

For evidence retrieval, use the native message retrieval API's pagination or direct-message lookup to select by session, assistant message, and submit tool-call/result identity—not the latest arbitrary JSON, assistant prose, or a new public endpoint/custom HTTP client. On OpenCode 2.0.24 the ordinary tool-output cap is 51,200 bytes / 2,000 lines. The prehandled-output hook in `packages/core/src/tool-output.ts` skips that ordinary limiter when `metadata.truncated` is defined; inspect `packages/core/src/session/runner/to-llm-message.ts` as part of verifying that the model-message projection adds no shortening. Producer-supplied `metadata.truncated: false` declares that output was already bounded and complete, but is not independent proof of complete delivery. Before claiming transfer readiness, compare the retrieved prepare tool-result text byte-for-byte with its exact producer `Prepared` JSON text and the retrieved submit tool-result text byte-for-byte with the exact compact producer acceptance-envelope JSON text (including its canonical record); check expected item count and shape, message/tool identity, caller identity from source/envelope metadata, status, documented output path, and absence of truncation or other shortening markers (`metadata.truncated: true` fails closed). Do not treat the producer flag alone as proof, select arbitrary output, or mistake complete transfer for LLM attention, semantic correctness, entailment, or determinism. A quote-membership check can mechanically pass while its interpretation remains unsupported; it is not a security/readiness guarantee. The A12 pilot's prepared output was below 51,200 bytes, so the oversized native-output branch remains unverified; cover it in a pinned-runtime test if a prepared output exceeds that size. If it does not and no documented non-paid native dispatch harness exists, record the oversized case as unverified; it may be combined with a separately authorized single pilot without another inference. Do not fabricate proof or increase global output settings.

For OpenCode CLI evidence, use OpenAPI operation-ID mode so parameters are applied, with the absolute repo directory in the documented `location[directory]` parameter:

```text
opencode api location.get --param 'location[directory]=<ABSOLUTE_REPO>'
opencode api agent.get --param 'agentID=author-extractor' --param 'location[directory]=<ABSOLUTE_REPO>'
opencode api plugin.list --param 'location[directory]=<ABSOLUTE_REPO>'
opencode api session.message.get --param 'sessionID=<SESSION_ID>' --param 'messageID=<MESSAGE_ID>' --param 'location[directory]=<ABSOLUTE_REPO>'
```

In raw `METHOD/PATH` mode, put the URL-encoded `location[directory]` query in the path itself; do not rely on an additional `--param`, which is ignored in that mode. `location.get` returns `directory` and `project` directly; `agent.get` and `plugin.list` wrap their result in `location`/`data`; `session.message.get` returns direct `SessionMessageInfo` assistant information. A full API response printed to a terminal may be preview-truncated: parse/filter it locally or save the full response, and never use the display preview as transfer evidence.

One bounded A12 pilot was explicitly authorized with the user-selected `github-copilot/gpt-6.1-sol`; this is not a global or contract default and does not authorize another inference. In the same session, the first three agent steps led to a first submit rejected by the closed schema because the coverage entry used plural `notes`; the user then explicitly authorized one corrective submit and up to six additional steps. Recovery used two more steps, and the second received submit was accepted: five observed agent steps total, two received submits total, one accepted. The extension was a distinct user turn, not a new session or reset of the adapter counter. Provider retries can add cost/quota; there is no fixed USD cap, fallback, or batch mode.

This pilot's accepted record is a candidate only, not human approval, a global invariant, or an authoring guarantee: six observations (two rhetorical, one epistemic, one semantic, two decisional), eight literal quote-evidence items, and all four coverage entries marked observed with status and note. Raw-body mechanical measurements were 9,377 UTF-8 bytes and 62 raw segments; the prepared JSON text was 24,013 bytes. Advanced stylometry remained `not_computed`; no word/POS/ngram/readability metrics were substituted. These facts describe this record only and do not establish semantic entailment, correctness, determinism, attention, or general release/readiness.

The captured accepted JSON is outside the repository at `/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode/t5-a12-github-copilot-gpt-6.1-sol-20261012-run1/accepted-a12.json` (SHA-256 `35ead2273cde23c5618201b5162bc8e6ec96f72085d0d0c0e1884628c6aaf114`). Its authoritative native source is the completed session/message/tool result, selected by session `ses_ecff4bd9bffe6bqCTbyVoQK5Fq`, message `msg_1302d6e8a001bcuSvOm77PKx3C`, and submit call `call_JiQkTUysqWVTWek5YSWZblr5`; the file is a captured copy, not a replacement for native identity/source metadata. At capture time the prepared `input_hash` was `c96370e7cf66058a839e3ba4e2b6128ec0e6acf38fcbe3a9c83fbc1a68fde682` and the raw producer-prepared JSON SHA-256 was `a34ee61bc03fdb73fcc6968e5d0afde58716c2daeb1c1127a1ba12dd14259e65`. The byte-comparison check used the then-current corpus, A12 source, schema, and agent instructions in `inputs-before-instruction-fix/` before the concurrent agent-instruction clarification. That clarification changes `instructions_hash` and therefore future `input_hash`; this historical acceptance must not be replayed or described as acceptance under the new instructions. These captured checks establish only the exact pre-fix transfer and record, not the >51,200-byte branch or broader readiness. No T1 schema/dependency checks invoke a model.

## Verification notes

The schema should be locally compiled with `Ajv2020` from `ajv/dist/2020.js`. Smoke validation should include one minimal valid typed observation for each dimension and reject a wrong dimension/payload pairing and an extra property. Core tests additionally own raw source fixtures, hash/change detection, YAML/front-matter boundaries, exact quote membership, coverage correspondence, canonical bytes, size limits, and failure codes. Native tests own agent authorization, normalized adapter binding, counters, concurrent submits, sealing, abort/unload, and exactly-one-text-item success. Do not add checked-in test fixtures outside the separately owned `core.test.mjs` and `native.test.mjs`.
