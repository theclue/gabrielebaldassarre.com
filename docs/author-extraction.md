# Author extraction and pattern consolidation

This is a local, offline-capable workflow over the 12 positively approved entries in `docs/corpus.yaml`. Extraction stores candidate article-grounded observations; a separate, dimension-by-dimension consolidation stage proposes reviewable cross-article groups. Neither stage creates a verified author model, ontology, knowledge graph, durable ledger, score, fingerprint, or proof of human authorship. The corpus declaration itself says approval as a representative reference does not establish exclusive human authorship, absence of AI, or coauthorship. The excluded OpenSCAD article is not an eligible source.

The current extraction runtime is v1.2, with the v1.1 schema retained for verification of historical records. The detailed v1.1 contract and pilot notes below are explicitly historical. The current processing gate and consolidation workflow are documented next.

For practical invocation, example prompts, and result handling, see the [quick guide to using the author subagents](../_scripts/author-extraction/INTEGRATION.md#guida-rapida-usare-i-subagent-in-futuro). It covers the current agents; the v1.1 TUI notes below are historical.

## Scope and trust boundary

- Only the fixed `A01`–`A12` IDs in the corpus allowlist select source files. Callers/native tools accept no path, workspace root, or arbitrary source text. `path` in a prepared record is provenance from that allowlist, not user/model-controlled input.
- For extraction, read the corpus, selected post, version-matched extraction schema, and extractor instructions as bytes and hash them as specified below. For consolidation, read only the approved extracted-record directory, `patterns.schema.json`, and the consolidator instructions. Missing or unsafe required inputs fail closed. Do not treat old author-model front matter, other article metadata, or unrelated workspace files as extraction/consolidation facts.
- Core preparation, verification, candidate acceptance, and finalization are offline: no core model/provider/API request, provider default, HTTP client, service, or database. The native extractor and consolidator submit only bounded candidate proposals to the explicitly selected model; no model is used to read source posts or verify evidence.
- Extraction has four candidate dimensions: rhetorical, epistemic, semantic, and decisional. Each observation is a *candidate* inference with article/passage quote evidence; quote membership does not prove semantic entailment. Cross-article grouping is a separate review-candidate stage; it must not be presented as author identity, a stable trait, or proof of authorship.
- Counts are mechanical over the raw Markdown body and include code, mathematics, and template text. `advanced_stylometry` is explicitly `not_computed`, null, `OUT_OF_SCOPE_V1`; do not substitute readability, prose metrics, or a fingerprint.

## Current v1.2 processing and consolidation workflow

The extractor prepares `author-extraction/1.2` records with method versions `prepare/1`, `raw-blank-lines/1`, `raw-body-counts/1`, and `author-extractor/1.2`; its method also identifies `host-session-whole-article/1`. The v1.2 contract is `_scripts/author-extraction/extraction.v1.2.schema.json`; `_scripts/author-extraction/extraction.schema.json` remains the local v1.1 contract. Do not relabel historical v1.1 records or regenerate their provenance to make them eligible.

```text
prepareArticle(repoRoot, articleId) -> Promise<PreparedV12>
acceptCandidate(repoRoot, articleId, inputHash, candidateJson, hostOptions?) -> Promise<canonicalFinalJsonString>
verifyExtractionRecord(repoRoot, recordJson) -> Promise<{ record, record_fingerprint, processing_eligible, processing_reason }>
```

`hostOptions` is an internal core call option, not a model/tool field. Only the native adapter supplies `{ workflowReceipt }` after a successful preparation has been validated and returned in the same host session. The closed receipt is `{ workflow_version: "host-session-whole-article/1", mode: "whole_article", session_id, article_id, input_hash, prepare_returned: true }`; the core validates it against the current prepared article and hash. A direct core acceptance without a receipt remains `processing.status: "not_tracked"`, `article_processed: null`, and `receipt: null`; it must never be promoted to complete by inference from citations.

For v1.2, `processing` distinguishes `mode: "whole_article"` from a reserved `mode: "per_passage"`. Whole-article counts are code-derived: `passages_available` is the current prepared passage count and `passages_cited` is the number of distinct cited passage IDs. `complete` is an operational host workflow receipt, not evidence of exhaustive cognitive attention or coverage. The schema reserves the per-passage shape, but there is no per-passage producer; verification fails closed for that unsupported mode. Do not infer passage processing from citation counts.

`verifyExtractionRecord` parses strict bounded JSON, validates the complete local v1.1 or v1.2 schema, and verifies the allowlisted source path and hashes, method/schema provenance, source measurements, literal passage evidence, observation IDs, dimension counts, and processing-derived values. It does not compare historical `instructions_hash` values against today’s instruction file. It returns the unchanged verified record and canonical fingerprint. Legacy v1.1 and v1.2 `not_tracked` records remain ineligible with `PROCESSING_NOT_TRACKED`; invalid provenance or derived data rejects rather than being repaired or migrated.

The current consolidation method is closed and versioned as `consolidate/5`, `observation-projection/1`, and `author-pattern-consolidator/0.5`. It uses `patterns.v0.5.schema.json` with only local references to retained v0.1–v0.4 schemas. Its `schema_hash` is SHA-256 of canonical UTF-8 JSON `{base_schema_hash, rhetorical_schema_hash, semantic_schema_hash, decisional_schema_hash, epistemic_schema_hash}`, whose values hash the raw bytes of the v0.1–v0.5 schema files respectively; `instructions_hash` hashes the current agent file. Retained v0.4 omits `epistemic_schema_hash`; v0.3 also omits `decisional_schema_hash`; v0.2 retains canonical `{base_schema_hash, extension_schema_hash}` over its two files, and v0.1 hashes its single schema directly. The corpus hash covers the sorted twelve article IDs and their full-record fingerprints; the input hash binds that corpus hash, one dimension's projection, and the method. Changed records or contract bytes invalidate an input for that version. Old accepted records use their exact schema/instruction snapshots and are never silently relabelled.

### Rhetorical contract v0.2

Rhetorical proposals replace `classification` with two independent, required fields:

| Field | Vocabulary | Meaning |
| --- | --- | --- |
| `pattern_scope` | `rhetorical_strategy`, `explanatory_device`, `editorial_format`, `local_content_pattern` | The nature of the grouped operation, not its destination in an author model. |
| `author_relevance` | `candidate`, `uncertain`, `unlikely` | A review-candidate judgement, never author approval or demonstrated distinctiveness. |

For example, `pattern_scope: "editorial_format"` and `author_relevance: "candidate"` can coexist. Neither field determines the other. Counts alone cannot establish author relevance. Epistemic/decisional groups retain their existing `classification` vocabulary and semantic groups retain `semantic_kind`.

Code assigns **every accepted rhetorical group** an ID such as `APC::R0001` (`APC`: author pattern candidate; `R`: rhetorical). The model must not supply IDs. Groups are ordered by their sorted observation-ID membership, with locale-independent comparison, then numbered; changing labels, scope, relevance, or proposal order alone does not change IDs. Finalization preserves these IDs for retained cross-article groups instead of renumbering them. Reference a group by `(corpus_hash, input_hash, id)`: IDs are local to a versioned record, not a permanent cross-version identity. Adding/removing groups or splitting/merging membership can change numbering; comparisons must also check support. No automatic review approval, migration, or split/merge lineage is invented.

Example-based groupings must identify a shared explanatory operation, not merely the generic use of concrete examples. Where the prepared observations establish it, distinguish before/after-definition placement, everyday/numerical/implementation cases, reuse, abstract-to-perceptible scale translation, and illustration versus demonstration. Preserve supported differences and unknowns in descriptions, rationale, and variation notes; leave unsupported groupings unclustered rather than invent specificity. Generic conventions can have `uncertain` or `unlikely` author relevance.

This rhetorical shape was introduced with `author-pattern-dimension/0.2` and remains unchanged in v0.3. Existing v0.1/v0.2 dimension files are not rewritten or relabelled. The finalizer explicitly selects their retained local schema version and byte-identical instruction snapshot (`author-pattern-consolidator.v0.1.md` or `.v0.2.md`), rechecking source records, partition, counts, support, and version-specific hashes. A mixed bundle records each original method in `dimension_methods`. Changing one dimension's contract does not require another dimension or extraction run. Future new runs use current hashes; this compatibility path is not permission to fabricate historical acceptance or ignore stale inputs.

### Semantic group IDs v0.3

Every newly accepted semantic group has a required, code-generated `id`:

| `semantic_kind` | ID format | Meaning |
| --- | --- | --- |
| `concept` | `SPC::C0001` | Semantic pattern candidate, concept group. |
| `relation` | `SPC::R0001` | Semantic pattern candidate, relation group. |

`SPC` means **semantic pattern candidate**. Concept and relation counters start at
`0001` independently. Within each kind, groups are sorted by observation-ID
membership using locale-independent comparison; labels and proposal order do not
determine numbering. The prefix letter must agree with `semantic_kind`. Missing,
duplicate, forged, or reassigned IDs fail validation rather than being repaired.

The model's proposal shape is unchanged: it supplies `semantic_kind`, the existing
descriptive fields, and member observation IDs, **not `id`**. IDs are assigned after
partition/support verification, including to groups supported by only one article.
Finalization preserves IDs for retained cross-article groups; filtering a
`LOCAL_ONLY` group can leave gaps in the final view and never renumbers survivors.

These are review-group identifiers, not ontology concept/relation IDs or evidence
of confirmed truth or authorship. As with rhetorical IDs, use
`(corpus_hash, input_hash, id)` and support when linking reviews or comparing versions.
Membership splits/merges or a change of semantic kind need separate review; the
system invents no permanent identity or lineage.

This ID shape was introduced in `author-pattern-dimension/0.3` and is unchanged
in v0.4. Existing semantic v0.1/v0.2 records remain unchanged
and verifiable under their original contracts; their historical final view retains
`SRC::S…` identifiers rather than silently replacing them with `SPC`. The semantic
contract update alone does not run a model or regenerate `semantic.json`.

### Decisional group IDs v0.4

Only the code-generated `id` is added to accepted decisional groups. The existing
`classification` vocabulary and model proposal shape are unchanged:

| `classification` | Required ID format |
| --- | --- |
| `author_candidate` | `DPC:A0001` |
| `editorial_format` | `DPC:E0001` |
| `thematic` | `DPC:T0001` |

The separator is **one colon**, exactly `DPC:ANNNN`, `DPC:ENNNN`, or `DPC:TNNNN`.
Each subtype has its own counter starting at `0001`; membership, not labels or
proposal order, determines numbering within a subtype. The model must not submit
IDs. Validation rejects duplicates, mismatched letters, double-colon spellings,
and forged counters. Finalization preserves IDs and existing classification-based
routing into `patterns`, `editorial_format`, or `thematic`; it does not renumber
survivors when filtering `LOCAL_ONLY` groups. These are version-local review IDs,
not author approval or permanent identities. Use the record hashes and support
when comparing versions, as for the other dimensions.

This decisional shape was introduced in `author-pattern-dimension/0.4` and is
unchanged in v0.5. Historical v0.1–v0.3 records remain verifiable with
their retained local schemas and byte-identical instruction snapshots, including
`author-pattern-consolidator.v0.3.md`. A contract update does not regenerate
`decisional.json` or any other output without separate authorization.

### Epistemic group IDs v0.5

The existing `classification` and proposal fields remain unchanged; only the
accepted group's code-generated `id` is added:

| `classification` | Required ID format |
| --- | --- |
| `author_candidate` | `EPC:A0001` |
| `editorial_format` | `EPC:E0001` |
| `thematic` | `EPC:T0001` |

`EPC:ANNNN`, `EPC:ENNNN`, and `EPC:TNNNN` use **one colon**, with independent
membership-ordered counters starting at `0001`. The model must not supply IDs.
Validation checks the namespace, classification letter, uniqueness, counters,
and support; finalization preserves IDs and classification-based routing into
`patterns`, `editorial_format`, and `thematic` without renumbering survivors.
IDs are version-local review references, not author approval or permanent
identity. Use `(corpus_hash, input_hash, id)` and support for comparisons.

Current prepare/acceptance use `author-pattern-preparation/0.5` and
`author-pattern-dimension/0.5`. Previously accepted v0.1–v0.4 dimensions remain
verifiable against their retained schemas and byte-identical instructions,
including `author-pattern-consolidator.v0.4.md`. Regenerating epistemic does not
authorize another dimension, extraction, or step-3 run.

### Consolidation inputs and tools

The consolidator reads only the twelve extracted JSON records from the host-selected approved directory: `docs/author-extraction-results/v1.1` by default, or `docs/author-extraction-results/v1.2` when explicitly selected by host configuration. The directory is not a tool input. The core re-verifies each complete record through `verifyExtractionRecord`, requires all twelve to be processing-eligible, and only then returns observation projections. The corpus hash fingerprints the sorted set of twelve full-record fingerprints; the dimension input hash also binds the projected observations and current consolidation method, including local schema and agent-instruction hashes.

```text
prepareConsolidation(repoRoot, dimension, recordsDirectory?) -> Promise<PreparedDimension | BlockedPreparation>
acceptDimensionCandidate(repoRoot, dimension, corpusHash, inputHash, candidateJson, recordsDirectory?) -> Promise<canonicalAcceptedDimensionJson>
finalizeConsolidation(repoRoot, corpusHash, acceptedDimensionJsons, recordsDirectory?) -> Promise<canonicalFinalBundleJson>
```

The V2 plugin exposes only `author_pattern_consolidation_prepare({ dimension })` and `author_pattern_consolidation_submit({ dimension, corpus_hash, input_hash, candidate_json })`, authorized only to the restricted `author-pattern-consolidator` agent. Inputs contain no record directory or path; only host configuration selects an approved directory. A session covers one dimension and one submit attempt total, including a rejected attempt. Blocked preparation is terminal. Empty dimensions can be prepared, but the agent stops without a model grouping proposal; an empty dimension can be accepted offline when assembling the four dimensions. There is no native finalizer tool: the parent collects the four accepted dimension JSON strings and calls the offline core finalizer. Candidate JSON is limited to 256 KiB UTF-8; prepared results and acceptance envelopes are limited to 4 MiB UTF-8, with no truncation or partial success.

Preparation returns either a projection (`observation_id`, `article_id`, `dimension`, `label`, `description`, `inference_kind`, and exact `evidence_refs`) or a blocked result with diagnostics only. A candidate has exactly `groups` and `unclustered_observations`; each unclustered entry has `observation_id` and `reason`. Each group has `label`, `description`, `abstraction_kind`, `rationale`, `variation_notes`, and `member_observation_ids`, plus the dimension-specific fields documented above. The inference marker is `observed_regularities` or `inferred_generalization`. Groups require at least two members. The model supplies member observation IDs, not support mappings, counts, article totals, pattern IDs, processing status, or quotes. Core acceptance maps IDs back to verified article support and checks the exhaustive disjoint partition.

Offline finalization rechecks the current dataset, version-specific hashes/methods, four unique accepted dimensions, and support mappings. It creates `author_patterns` (`author-pattern-candidates/0.5`) with `patterns`, `editorial_format`, `thematic`, and `rhetorical_groups`, plus `semantic_recurrences` (`semantic-recurrence-candidates/0.5`) with `concepts` and `relations`, and root `dimension_methods`. Revised rhetorical groups stay in `rhetorical_groups` with both axes, so scope and author relevance are not collapsed into mutually exclusive buckets. Historical and other-dimension groups retain their original routing. Every support entry, observation count, article count, promotion status, and review status is code-derived; every group remains `unreviewed`. Groups supported by one article are moved to `LOCAL_ONLY` unclustered observations. All accepted IDs introduced for the four dimensions are preserved; remaining historical final IDs use the existing deterministic `APC`, `EFC`, `THC`, and `SRC` prefixes with locale-independent ordering. Two supporting articles yield `cross_article_candidate`; three or more yield `recurrent_candidate`. These mechanical incidence categories do not upgrade `author_relevance` or establish stable author traits. Finalization is offline and does not persist a file.

The current twelve v1.1 extracted records are source/evidence-valid but have `processing.status: "not_tracked"`. Therefore the default preparation is expected to return `blocked` with twelve `PROCESSING_NOT_TRACKED` diagnostics, without exposing projected observations or creating a consolidation artifact. Do not fabricate receipts, retroactively mark those records complete, bypass the gate, or launch another extraction. A future authorized corpus with verifiable complete v1.2 receipts is required to proceed under this policy.

The local unit/session tests and tool registration checks do not prove complete tool-result transfer in an actual host/provider runtime. The plugin’s `metadata.truncated: false` is not independent evidence of byte-for-byte delivery; that host/provider transfer branch remains unverified.

## Historical v1.1 extraction contract: versions, API, and hashes

Version literals are fixed for this contract:

| Field | Value |
| --- | --- |
| `schema_version` | `author-extraction/1.1` |
| `prepare_version` | `prepare/1` |
| `segmentation_version` | `raw-blank-lines/1` |
| `measurement_version` | `raw-body-counts/1` |
| `instructions_version` | `author-extractor/1.1` |

The preserved v1.1 extractor exported these operations:

```text
prepareArticle(repoRoot, articleId) -> Promise<Prepared>
acceptCandidate(repoRoot, articleId, inputHash, candidateJson) -> Promise<canonicalFinalJsonString>
```

Both operations are async: success fulfills the promise with exactly the documented value; every failure rejects the promise and never fulfills it with an error-shaped value. Rejections are `Error` instances with own `code` (string), `message` (at most 240 characters), and `details` (array of at most five safe schema-style JSON pointers; empty when there are none). No custom error class is exported. `prepareArticle` and `acceptCandidate` are stateless with respect to sessions and do not persist. `repoRoot` is a trusted, host-injected workspace root, never a tool argument. `articleId` is one approved ID. `candidateJson` is the model-supplied JSON text; it is parsed strictly and never silently repaired. Do not echo article text, candidate text, paths outside the approved relative path, or native/provider failures.

Hashes are lowercase SHA-256 hex over raw bytes for `corpus_hash` (`docs/corpus.yaml`), `file_hash` (selected post), `schema_hash` (this JSON schema), and `instructions_hash` (the companion instruction file). Decode source/body UTF-8 fatally. `input_hash` is SHA-256 over UTF-8 bytes of the compact canonical JSON serialization of exactly `{ "source": source, "method": method }`; object keys are recursively sorted, array order is preserved, and no whitespace is emitted. There are no timestamps, random IDs, model-selection fields, or generated defaults. Identical current source/method plus the same candidate produces identical final JSON bytes; semantic model outputs are not promised to be identical.

### v1.1 preparation rules

- Validate the corpus YAML with `yaml` `parseDocument`; parser errors, warnings, aliases (including alias expansion), malformed declarations, duplicate/unknown IDs, or missing approved source fail closed. Its structural precondition is an object-valued `contesto`, one `fonti` entry for each fixed ID A01–A12 with exactly `id`, `percorso`, and `rappresentativo_stile: true`, and an `esclusioni` array whose entries have string `percorso` and `motivo`. Each `percorso` is a safe relative path read from this corpus declaration, not an independently hardcoded path table. This checks dataset structure only, not human consent, exclusive human authorship, AI use, coauthorship, or any exact approval wording. Use alias limit zero; do not execute YAML tags or templates. Resolve only the selected approved ID; do not accept caller-supplied paths.
- Source is at most 262,144 raw bytes. The first line must be exactly `---` (LF or CRLF); a missing/incorrect opening delimiter rejects with `SOURCE_BOUNDARY`. The next exact `---` line closes front matter; if it is absent, reject with `SOURCE_INVALID`. Invalid UTF-8 or invalid front-matter YAML also rejects with `SOURCE_INVALID`. YAML front matter is parsed for validity and discarded. The body is the exact UTF-8 decoded byte remainder after the closing delimiter and its line terminator; do not normalize Unicode, line endings, whitespace, or Markdown.
- Split body on blank-line delimiters containing only zero or more spaces/tabs between line endings. Keep each non-empty raw span, assign `P0001` upwards, and report `start_cp` inclusive / `end_cp` exclusive offsets in Unicode code points from the body start. These are raw blank-line spans, not semantic Markdown paragraphs. Fail over 512 passages; never truncate.
- `utf8_bytes` is body UTF-8 byte length; `unicode_code_points` counts Unicode code points; `nonblank_lines` counts body lines containing a non-whitespace code point. A genuine zero is integer zero, not null. All count bounds are at most 262,144.
- Enforce a serialized `Prepared` response limit of 4 MiB, measured as UTF-8 bytes after JSON escaping at the native response boundary. Oversize rejects with `LIMIT_EXCEEDED` and produces no partial result or artifact; do not truncate or lower the limit to work around native shortening.

### v1.1 candidate and final record

`extraction.schema.json` uses JSON Schema Draft 2020-12 with `$id` `urn:gabrielebaldassarre:author-extraction:1.1`. Compile it locally with Ajv's Draft 2020-12 entry point and validate every referenced definition. No remote `$ref` loading, coercion, defaults, removal of extra properties, or partial validation. YAML is parsed with `yaml` 2.8.1; dependencies are exact-pinned in the private ESM package. The submit string is limited to 65,536 UTF-8 bytes by the core in addition to the schema's code-point length bound.

The schema root is `FinalRecord`; candidate validation targets `$defs/Candidate`. Every object is closed (`additionalProperties: false`), and all listed fields are required. String bounds use JSON Schema character/code-point lengths and `\\S` non-whitespace checks; do not trim or mutate payloads. The candidate root has exactly one field, `observations`, containing 1–12 observations; zero rejects with `NO_OBSERVATIONS`. It cannot supply legacy `coverage`, `attribute`, `interpretation`, `context`, `status: "candidate"`, typed dimension payloads or `data`, generated IDs/review status/counts, source/method/hash/measurement fields, paths, or other metadata.

Each candidate observation has exactly `dimension`, `label`, `description`, `inference_kind`, and `evidence`. `dimension` is one of `rhetorical`, `epistemic`, `semantic`, or `decisional`. `label` is a nonblank nominal summary (1–200 characters), not a proposition. `description` is one local natural-language proposition (1–2,000 characters). `inference_kind` is `explicit` or `inferred` and qualifies the description as a whole; if a directly stated move and an inferred function are both worth retaining, represent them as separate observations rather than one mixed description. A single condition-to-action proposition may remain one observation, while independent fallback actions/rules are separate observations. Each observation has 1–4 evidence items with exactly `article_id`, `passage_id`, and a nonblank quote of at most 2,000 characters. Verify current-article ID equality, passage membership, and exact contiguous quote membership in the cited passage and raw body. These checks establish literal membership, not proposition atomicity, logical entailment, or world truth; those require model discipline and human semantic review.

Semantic is a dimension label for the same local natural-language observation shape. Structured triples, rule arrays, graph/ontology payloads, and a separate semantic representation are deliberately deferred; do not infer them from `dimension: "semantic"`.

The final root is exactly `schema_version`, `source`, `method`, `measurements`, `dimension_presence`, `processing`, and `observations`. Code adds `id` and `review_status: "unreviewed"` to each accepted observation; IDs are `article_id::O0001` etc., sequential only within this accepted record and its input order, not global concept IDs or a deduplication registry. `unreviewed` marks pending local human semantic review; technical schema/native acceptance is not author approval, factual validation, or taxonomy approval.

`dimension_presence` has one entry for each of the four dimensions. Code derives `observation_count` from this record's observations and sets `status` to `observed` when the count is positive and `not_observed` when it is zero. `not_observed` means no candidate for that dimension was emitted in this record; it does not mean the article or author has none. `processing.status` is `not_tracked`; `passages_total` equals the prepared raw-passage count, `passages_processed` and `passages_failed` are null, and `passages_with_observations` counts distinct cited passage IDs. This is evidence incidence, not a receipt that all article passages were analyzed or processed; there are no per-chunk receipts or model-progress measurements.

Measurements remain code-derived raw-body `utf8_bytes`, `unicode_code_points`, `nonblank_lines`, and `advanced_stylometry: { status: "not_computed", value: null, reason_code: "OUT_OF_SCOPE_V1" }`. Do not invent or substitute word/POS/ngram/readability statistics. The final JSON is assembled and validated against the full schema, then serialized compactly with recursively lexicographically sorted object keys and original array order. A final record or serialized acceptance envelope over 1 MiB, measured as UTF-8 bytes after JSON escaping, rejects with `LIMIT_EXCEEDED` and produces no partial result or artifact; do not truncate or lower the limit to work around native shortening. Distinguish malformed JSON (`CANDIDATE_JSON_INVALID`) from candidate schema failure (`CANDIDATE_SCHEMA_INVALID`).

### v1.1 errors and validation precedence

Core error codes: `CORE_INVALID_ARGUMENT`, `UNKNOWN_ARTICLE`, `CORPUS_INVALID`, `SOURCE_BOUNDARY`, `SOURCE_INVALID`, `LIMIT_EXCEEDED`, `INPUT_CHANGED`, `CANDIDATE_JSON_INVALID`, `CANDIDATE_SCHEMA_INVALID`, `NO_OBSERVATIONS`, `EVIDENCE_INVALID`, `FINAL_SCHEMA_INVALID`, `INTERNAL_ERROR`. Check parseability first; for a parsed object with an observations array of length zero, reject with `NO_OBSERVATIONS` before schema-minItems rejection. For other schema failures reject with `CANDIDATE_SCHEMA_INVALID`. After schema pass, rebuild current preparation and compare `input_hash`; reject with `INPUT_CHANGED` before context-dependent evidence checks if it differs. Otherwise verify current source/evidence, derive final-record metadata, and validate the assembled final object. Each rejection follows the core `Error` shape above; messages and details never carry excerpts.

Native-layer codes (not core errors): `AGENT_DENIED`, `PROTOCOL_INVALID`, `ATTEMPT_LIMIT`, `CANCELLED`. Native failures never produce an accepted envelope. `INPUT_CHANGED` rejects when fresh source/schema/instructions-derived input no longer matches the submitted hash.

## Historical v1.1 native plugin and adapter contract

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

## Historical v1.1 corpus refresh notes (TUI)

When a refresh is explicitly authorized, start from the repository root and open `opencode`. Create a **new session** with `Ctrl+X`, then `N` (or `/new`). In that session, use `/agents` to select `author-extractor`, then `/models` to select the explicitly authorized provider/model; selecting the agent does not select a model, and no default or fallback is implied. See the OpenCode [TUI](https://opencode.ai/v2/docs/cli/tui/), [agents](https://opencode.ai/v2/docs/agents/), and [models](https://opencode.ai/v2/docs/models/) references.

Give one prompt for exactly one explicitly authorized allowlisted ID (`A01`–`A12`), with a stated per-turn step budget (at most six steps) and session submit budget (at most two received submits). The agent uses `author_extraction_prepare({ article_id })` and then, if authorized and ready, `author_extraction_submit({ article_id, input_hash, candidate_json })`; this is not a batch command. A correction, if specifically authorized, is limited to one resubmission for the same article and hash. Do not start recovery turns, replace a session, or use provider fallback without further authorization. A new session for a different explicitly authorized article is a separate extraction, not a recovery or counter reset; an accepted submit seals its session.

Inspect the native tool-result envelope: `completed` alone does not mean `accepted`; use its `canonical_json` as the authoritative accepted record. Acceptance remains `unreviewed`, and exact quote membership does not establish entailment. The plugin does not persist records: retain the result outside it only in an explicitly chosen destination, preserving the returned article ID, input hash, and provenance fields rather than reconstructing them. A future refresh runs against the then-current inputs and hash; it is a new execution, not an automatic corpus append, batch refresh, or approved checkpoint. OpenCode [plugin](https://opencode.ai/v2/docs/build/plugins/) documentation describes the native plugin context.

For this completed v1.1 corpus run, the twelve records are in [`docs/author-extraction-results/v1.1/`](author-extraction-results/v1.1/). The [final report](author-extraction-results/v1.1/final-report.md) records the technical and quality PASS outcomes, provenance, and limits; the [A12 pilot report](author-extraction-results/v1.1/pilot-report.md) retains the pilot gate history. This run's destination, article-specific choices, provider/model, and gate are not defaults for future sessions. Its observations remain `unreviewed` and processing remains `not_tracked`.

### Historical prototype v1 A12 pilot (not a v1.1 result)

One bounded A12 pilot was explicitly authorized with `github-copilot/gpt-6.1-sol`; it is not a global default and does not authorize another inference. In that same session, the first three agent steps led to a first submit rejected by the closed v1 schema because the coverage entry used plural `notes`. The user then explicitly authorized one corrective submit and up to six additional steps in a new user turn, without changing session. Recovery used two more steps; the second received submit was accepted: five observed agent steps total, two received submits, one accepted. The per-session two-submit counter was not reset. Provider retries can add cost/quota; there is no fixed USD cap, fallback, or batch mode.

That historical accepted object is prototype v1 only (`schema_version: "author-extraction/1"`, `instructions_version: "author-extractor/1"`): it used v1 `coverage` entries, `attribute`/`interpretation`/`context`, `status: "candidate"`, and dimension-specific payloads. Its six observations (two rhetorical, one epistemic, one semantic, two decisional) had eight literal quote-evidence items; all four coverage entries were observed with status and note. Raw-body mechanical measurements were 9,377 UTF-8 bytes, 137 nonblank lines, and 62 raw segments; its prepared JSON text was 24,013 bytes. Advanced stylometry remained `not_computed`; no word/POS/ngram/readability metrics were substituted. It is not an example of the current v1.1 candidate or final-record shape and remains a candidate, not human approval, a global invariant, or an authoring guarantee. There is no claimed lossless or deterministic v1-to-v1.1 migration; do not collapse mixed-inference observations or relabel them `explicit`.

The captured v1 accepted JSON is outside the repository at `/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode/t5-a12-github-copilot-gpt-6.1-sol-20261012-run1/accepted-a12.json` (SHA-256 `35ead2273cde23c5618201b5162bc8e6ec96f72085d0d0c0e1884628c6aaf114`). Its authoritative native source is the completed session/message/tool result, selected by session `ses_ecff4bd9bffe6bqCTbyVoQK5Fq`, message `msg_1302d6e8a001bcuSvOm77PKx3C`, and submit call `call_JiQkTUysqWVTWek5YSWZblr5`; the file is only a captured copy. At capture time the prepared v1 `input_hash` was `c96370e7cf66058a839e3ba4e2b6128ec0e6acf38fcbe3a9c83fbc1a68fde682` and the raw producer-prepared JSON SHA-256 was `a34ee61bc03fdb73fcc6968e5d0afde58716c2daeb1c1127a1ba12dd14259e65`. The local capture verifier byte-matched the prepare and submit tool results and checked the then-current corpus, A12 source, schema, and agent instructions under `inputs-before-instruction-fix/`, before the concurrent agent-instruction clarification. That snapshot is under `/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode/t5-a12-github-copilot-gpt-6.1-sol-20261012-run1/inputs-before-instruction-fix/`; the real-capture helper was `/private/var/folders/qm/5mfn0b0n5ds_d9xpg0l9jqgc0000gp/T/opencode/verify-author-extraction-native.mjs`. The v1.1 schema and instruction bytes differ while the captured corpus and A12 source bytes remain unchanged, so future method/input hashes differ; this historical acceptance must not be replayed or described as acceptance under v1.1. The checked A12 prepared text was below 51,200 bytes, so oversized native output remains unverified. These historical checks establish only exact transfer and record for that v1 snapshot, not v1.1 runtime behavior, semantic correctness, determinism, attention, or general readiness. No native v1.1 inference is documented or implied by this guide update.

## Verification notes and test runner

From `_scripts/author-extraction`, run `npm test`. The package runner invokes `core.test.mjs`, `native.test.mjs`, `consolidator.test.mjs`, and `consolidator-native.test.mjs`; these are local checks and do not request a model/provider or perform extraction. The consolidation suite also checks deterministic final ordering across process locales using synthetic non-ASCII labels. Schema/protocol tests establish neither semantic entailment nor author correctness. A passing local suite does not establish complete byte-for-byte delivery through an actual host/provider tool-output path; that branch remains unverified.
