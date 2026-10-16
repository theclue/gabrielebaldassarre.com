# Author extraction and pattern consolidation

This workflow now covers the **20 positively approved entries A01–A20** in `docs/corpus.yaml`. The first twelve IDs retain their paths; the author explicitly approved the eight proposed additions on 2026-10-14. The byte-identical twelve-article declaration is retained as `docs/corpus.v1.2.yaml`. Extraction stores article-grounded candidates; separate dimension-by-dimension consolidation proposes reviewable groups. Neither stage creates a verified author model, ontology, knowledge graph, durable ledger, fingerprint, or proof of human authorship. Approval as an editorial reference does not establish exclusive human authorship, absence of AI, or coauthorship. The excluded OpenSCAD article remains ineligible.

The current extraction runtime is **v1.3**, consolidation **v0.6**. Historical schemas and instructions are retained, not edited or relabelled. The new full run is in [`author-extraction-results/v1.3/`](author-extraction-results/v1.3/) and [`author-pattern-results/v1.3/`](author-pattern-results/v1.3/); the corresponding reports preserve native session/message/call identities and exact-byte verification. The old v1.1/v1.2 result files remain unchanged. **The extraction/consolidation run stops after step 2.** The source-bound [`author-pattern-review.json`](author-pattern-results/v1.3/author-pattern-review.json) was created pending, then completed through 52 explicit human decisions. Its two reviewed JSON outputs were subsequently generated locally with separate completed-hash authorization; native apply remains fail-closed. [Step 4](author-model.md) composes the 29 approved author patterns into an operational model without reopening those decisions.

For practical invocation, example prompts, and result handling, see the [quick guide to using the author subagents](../_scripts/author-extraction/INTEGRATION.md#guida-rapida-usare-i-subagent-in-futuro). It covers the current agents; the v1.1 TUI notes below are historical.

## Scope and trust boundary

- Only fixed `A01`–`A20` IDs select current sources. Historical v1.1/v1.2 records use the preserved twelve-entry manifest. Callers/native tools accept no source path, workspace root, manifest selection, or arbitrary text. `path` in prepared data is allowlist provenance, not model-controlled input.
- For extraction, read the corpus, selected post, version-matched extraction schema, and extractor instructions as bytes and hash them as specified below. For consolidation, read only the approved extracted-record directory, `patterns.schema.json`, and the consolidator instructions. Missing or unsafe required inputs fail closed. Do not treat old author-model front matter, other article metadata, or unrelated workspace files as extraction/consolidation facts.
- Core preparation, verification, acceptance, and finalization are offline: no core model/provider/API request, provider default, HTTP client, service, or database. Models read only prepared bodies/projections through restricted native tools, not files or alternative sources; mechanical evidence verification is performed by code, not a model.
- Extraction has four candidate dimensions: rhetorical, epistemic, semantic, and decisional. Each observation is a *candidate* inference with article/passage quote evidence; quote membership does not prove semantic entailment. Cross-article grouping is a separate review-candidate stage; it must not be presented as author identity, a stable trait, or proof of authorship.
- Counts are mechanical over the raw Markdown body and include code, mathematics, and template text. `advanced_stylometry` is explicitly `not_computed`, null, `OUT_OF_SCOPE_V1`; do not substitute readability, prose metrics, or a fingerprint.

## Current v1.3 processing and consolidation workflow

The extractor prepares `author-extraction/1.3` records with `prepare/1`, `raw-blank-lines/1`, `raw-body-counts/1`, `author-extractor/1.3`, and `host-session-whole-article/1`. The current contract is `extraction.v1.3.schema.json`; v1.1/v1.2 schemas remain byte-preserved. Each article still permits 1–12 local observations, four dimensions, exact passage evidence, and the same byte/time/session bounds. Twenty articles therefore permit at most **240 observations**, not twenty observations per article. Italian is used for generated descriptions/labels, without translating or normalizing evidence quotes.

```text
prepareArticle(repoRoot, articleId) -> Promise<PreparedV13>
acceptCandidate(repoRoot, articleId, inputHash, candidateJson, hostOptions?) -> Promise<canonicalFinalJsonString>
verifyExtractionRecord(repoRoot, recordJson) -> Promise<{ record, record_fingerprint, processing_eligible, processing_reason }>
```

`hostOptions` is an internal core call option, not a model/tool field. Only the native adapter supplies `{ workflowReceipt }` after a successful preparation has been validated and returned in the same host session. The closed receipt is `{ workflow_version: "host-session-whole-article/1", mode: "whole_article", session_id, article_id, input_hash, prepare_returned: true }`; the core validates it against the current prepared article and hash. A direct core acceptance without a receipt remains `processing.status: "not_tracked"`, `article_processed: null`, and `receipt: null`; it must never be promoted to complete by inference from citations.

For v1.2/v1.3, `processing` distinguishes `mode: "whole_article"` from reserved `mode: "per_passage"`. Counts are code-derived: `passages_available` is the prepared passage count and `passages_cited` counts distinct cited IDs. `complete` is an operational host receipt, not proof of exhaustive cognitive attention. The per-passage shape has no producer and remains ineligible. Never infer processing from citation counts.

`verifyExtractionRecord` selects the declared v1.1/v1.2/v1.3 schema and its matching corpus scope, validates full bounded strict JSON, source path/hashes, measurements, evidence, IDs, counts, and receipts, and returns the unchanged record plus canonical fingerprint and eligibility. Old records are checked against `docs/corpus.v1.2.yaml`, not the expanded manifest. Historical instructions are not compared to today's instruction bytes. Untracked records stay ineligible; provenance/derived-data failures reject, never migrate or repair. The expanded dataset requires exactly twenty **new v1.3 records**: twelve old receipts plus eight new records cannot pass as a full rerun.

The current method is `consolidate/6`, `observation-projection/1`, `author-pattern-consolidator/0.6`. `patterns.v0.6.schema.json` is a **self-contained, locally materialized** twenty-article schema: `schema_hash` hashes its raw bytes directly, and `instructions_hash` hashes the current agent file. Retained v0.1–v0.5 contracts keep their original single/composite hash formulas and instruction snapshots. The consolidation corpus hash covers sorted IDs and full-record fingerprints for the selected dataset (twenty current records, twelve for historical datasets); it is different from the raw YAML hash in extraction `source.corpus_hash`. Dimension input hashes bind that verified dataset, projection, and method. No historical acceptance or review is silently transferred to the expanded run.

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

The active plugin explicitly selects `docs/author-extraction-results/v1.3`: exactly A01–A20, all v1.3 and processing-eligible. Directory and manifest are host configuration, never tool inputs. The core re-verifies every complete record before exposing projections. Missing/extra JSON, wrong filename/source identity, mixed versions, unsafe paths, stale hashes, or any ineligible record fail closed. The offline API's historical default remains v1.1; v1.1/v1.2 directories remain bounded twelve-record datasets, not aliases for the current run.

```text
prepareConsolidation(repoRoot, dimension, recordsDirectory?) -> Promise<PreparedDimension | BlockedPreparation>
acceptDimensionCandidate(repoRoot, dimension, corpusHash, inputHash, candidateJson, recordsDirectory?) -> Promise<canonicalAcceptedDimensionJson>
finalizeConsolidation(repoRoot, corpusHash, acceptedDimensionJsons, recordsDirectory?) -> Promise<canonicalFinalBundleJson>
```

The V2 plugin exposes only `author_pattern_consolidation_prepare({ dimension })` and `author_pattern_consolidation_submit({ dimension, corpus_hash, input_hash, candidate_json })`, authorized only to the restricted `author-pattern-consolidator` agent. Inputs contain no record directory or path; only host configuration selects an approved directory. A session covers one dimension and one submit attempt total, including a rejected attempt. Blocked preparation is terminal. Empty dimensions can be prepared, but the agent stops without a model grouping proposal; an empty dimension can be accepted offline when assembling the four dimensions. There is no native finalizer tool: the parent collects the four accepted dimension JSON strings and calls the offline core finalizer. Candidate JSON is limited to 256 KiB UTF-8; prepared results and acceptance envelopes are limited to 4 MiB UTF-8, with no truncation or partial success.

Preparation returns either a projection (`observation_id`, `article_id`, `dimension`, `label`, `description`, `inference_kind`, and exact `evidence_refs`) or a blocked result with diagnostics only. A candidate has exactly `groups` and `unclustered_observations`; each unclustered entry has `observation_id` and `reason`. Each group has `label`, `description`, `abstraction_kind`, `rationale`, `variation_notes`, and `member_observation_ids`, plus the dimension-specific fields documented above. The inference marker is `observed_regularities` or `inferred_generalization`. Groups require at least two members. The model supplies member observation IDs, not support mappings, counts, article totals, pattern IDs, processing status, or quotes. Core acceptance maps IDs back to verified article support and checks the exhaustive disjoint partition.

Offline finalization rechecks the dataset, version-specific hashes/methods, four unique dimensions, and support. It returns `author_patterns` and `semantic_recurrences` (v0.6) plus `dimension_methods`, preserving accepted IDs and classifications. Single-article groups become `LOCAL_ONLY` unclustered observations in the final view; they remain visible with IDs in the accepted dimension files. Every observation is represented exactly once; retained groups stay `unreviewed`. Two supporting articles yield `cross_article_candidate`, three or more `recurrent_candidate`: mechanical incidence, not proof of independent examples, distinctive style, or author approval. Related series parts and topic/period confounding require human judgement. The pure finalizer does not persist; the parent may save its canonical output as `consolidated-candidates.json`, a **step-2 candidate bundle**, not an author avatar or step-3 release.

The retained twelve v1.1 records remain source/evidence-valid but `not_tracked`; the historical default therefore remains blocked with twelve `PROCESSING_NOT_TRACKED` diagnostics. No receipts were fabricated or relabelled. The active v1.3 corpus passes through twenty fresh, host-tracked native extractions instead. Another future refresh still requires authorization; neither this run nor the preserved historical results authorize automatic inference or step 3.

Local tests and producer `metadata.truncated: false` alone do not prove runtime transfer. The v1.3 run reports separately document actual native prepare/submit byte comparisons, including source outputs above 51,200 bytes. Those checks establish the tested producer/native retrieval boundary, not provider attention, exhaustive analysis, semantic correctness, or permanent readiness for future inputs.

## Step 3: human-curated author-pattern review (pending)

Step 3 is a **human-curated review layer**, not another extraction or clustering
run, and not an avatar, voice prompt, authorship test, or automatic personality
model. It reviews all 52 original groups, including one-article/local groups;
it does not filter by recurrence, score, or presumed author relevance. The
pending sheet is a convenience for making explicit decisions, not evidence that
any reviewer has made them. Its full observation index, cited passage contexts,
and unclustered coverage are read-only context: they do not create extra review
rows or decisions.

The source-bound contract is `_scripts/author-extraction/author-review.schema.json`
(`author-pattern-review/1`). `review.mjs` exports offline
`validateAuthorPatterns(repoRoot)`, `prepareAuthorReview(repoRoot)`, and
`applyAuthorReview(repoRoot, completeJson)`. Preparation validates the frozen
corpus, records, four accepted dimensions, schemas, method, and passage context,
then returns a pretty-printed JSON string with a final newline. It writes
nothing. Applying a completed sheet is also pure: it returns canonical strings
and hashes for two transformations, and never writes or publishes them.

The pending sheet binds exact source-file SHA-256 values, each dimension's
`input_hash`, the consolidation corpus hash and method, raw/review schema hashes,
and a `review_source_hash` over the binding. For this snapshot the corpus hash is
`bc061167c298415d96547a6709c21aa6889a48814793726d55b670f4c46502f5`, the method
is `consolidate/6` / `observation-projection/1` /
`author-pattern-consolidator/0.6`, and the review schema hash is
`e7f861b8b7ea5f1f85328cb918db139c24be4e17aae5dcb5e6ccc8fbd917212b`. The source
SHA-256 values are rhetorical `c8b5cf945df6e43f477300df025c536f9168e65cf8eaa076d656fb2f8775dda0`,
epistemic `57544ad260e6418087922e883e5d7173516bd8ea7e74fb73519bb4915f90b8de`,
semantic `8fd77c9b3b248ab0ada18d49bc2e407c3dc360c18c8f9c4a6e8b906cffbcc4cd`,
and decisional `a070df8a4229fc3cb075d248f7da308f3388e7e448052f938a6d473b753b9d08`.
The `review_source_hash` is
`d8b3cf7c11e9328e37fbad296741e069b0c15a7ca0f12b1ad59be5cefa9223e6`. Each
dimension's binding also includes its own input hash. Equal input hashes alone
do not imply equal grouping: different accepted groupings can share an input
hash. Any stale or edited source-bound snapshot is rejected, not repaired.

The sheet contains 13 rhetorical, 16 epistemic, 9 semantic, and 14 decisional
groups; 16 groups have support from only one article. It indexes 217 observations
and 246 evidence references, provides 229 exact cited passage contexts, and
lists all 86 raw unclustered observations. Those counts are coverage and
provenance, not evidence of entailment, recurrence, independence, or correctness.
Every review field is initially `null`; `semantic_merges` is empty. Original
candidate fields and source IDs stay immutable. Candidate `variation_notes` are
group-level free prose: preserving them does not certify that every member
observation entails the same claim.

Record one decision per original group. For rhetorical, epistemic, and decisional
groups, the decision is `accept`, `revise`, `reject`, or `defer`; for semantic
groups it is `retain`, `merge`, `revise`, or `discard`. A visible single-article
approval is allowed but does not prove recurrence. The schema constrains review
values; there are no additional hidden score or eligibility filters. The
candidate's rhetorical `author_relevance` is immutable and separate from
`pattern_scope`; the review-row `author_relevance` is a distinct human
assessment, not an overwrite of the original candidate field. Original correctness
is judged against the cited passages (`yes`, `partial`, or `no`); applicability
and notes are explicit reviewer text. For accepted/revised R/E/D groups,
`author_relevance` (`high`, `contextual`, `none`), `generative_utility`
(`usable`, `descriptive_only`, `none`), and `overuse_risk` (`low`, `medium`,
`high`) are explicit qualitative assessments, not hidden gates. Semantic review
is limited to correctness, applicability, and notes, rather than the R/E/D
relevance, utility, or risk assessments.

`revise` approves an author-supplied effective change to the candidate label or
description, or to an existing type/classification/abstraction field where the
dimension permits it. A revise decision with no effective change is invalid;
the original source pattern ID and source membership are preserved. A decisional
candidate classified as `thematic` cannot be approved as-is; revise its
classification to a supported existing non-thematic value, or reject/defer it.

Semantic `merge` is allowed only when every participant consents to one explicit
merge specification for whole existing groups, with the final semantic kind and
formulation supplied. Cross-kind merges are possible. Partial memberships,
unclustered additions, overlapping groups, merge chains, and invented permanent
semantic IDs are not. The result records original source pattern IDs as lineage;
they are not relabelled as `SPC` identifiers. The non-semantic transformation
contains an audit and `reviewed_entries`; the semantic transformation contains
its own audit and corpus-concept/corpus-relation entries. Neither output is a
voice prompt.

The native adapter defines three empty-object tools: `author_patterns_validate`,
`author_review_prepare`, and `author_review_apply`. Native source allowlisting
is limited to the actual host identities `build` and `plan`; extractor,
consolidator, and custom-orchestrator roles are denied. Tool arguments cannot
select an identity, source path, or review file. The pinned OpenCode 2.0.24 SDK
does not expose a documented, registered non-paid tool-result executor for
these native operations, so VM/core tests do not establish real dispatch or
byte transfer. Real parent calls to validate/apply returned `AGENT_DENIED`; this
shows the guard is reachable, not that an allowed native call succeeded. No
successful native prepare or authorization-UI path is claimed. An operator may
select the actual `build` or `plan` primary in the OpenCode UI to attempt native
validation/preparation; no new slash command or identity argument exists.

Even for `build` and `plan`, native apply always rejects with
`AUTHORIZATION_UNAVAILABLE`: the current SDK has no hash-bound human approval
producer, and this tool never calls the core apply function or writes a preview.
No boolean, name, hash, token, ordinary permission, “Allow Always”, or
`ctx.permission.reply` is author consent. A future non-native publication would
require actual completed decisions and an operator's explicit authorization of
the exact canonical completed-review hash; the software cannot mechanically
certify the physical identity of that human. That is outside this phase. Keep
both destinations absent: `reviewed-author-patterns.json` and
`reviewed-semantic-model.json`. A pending sheet must fail as `REVIEW_INCOMPLETE`,
without authority claims or writes. Do not publish reviewed JSON in this phase.

## Identifier convention for new contracts

New identifier generation defaults to one `:` across observation and pattern
namespaces. The active retained extraction 1.1–1.3 and consolidation through 0.6
contracts explicitly preserve their legacy IDs, so all source records, reviews
and model hashes remain valid. New contracts must use the centralized formatter
and canonical schema consistently; this is not permission to rename frozen
artifacts in place. See [identifier conventions](author-identifiers.md).

## Step 4 — Author Model Compiler

The step-3 pending/preparation descriptions above preserve that phase's contract.
The corpus-20 human review has since been completed (52/52 decisions), and the
two reviewed JSON artifacts were subsequently generated locally with explicit
completed-hash authorization; native apply remains fail-closed. Step 4 is a
separate operational composition, documented in [Author Model Compiler](author-model.md).
It composes the 29 approved author patterns without changing any source decision
and treats the three retained semantic groups as optional conceptual context.

## Step 5 — Author Runtime Compiler

[The runtime compiler](author-runtime.md) makes a compact, resolved selection
from the governed model for a declared task. It emits a runtime profile and
ready-to-use instructions, with mandatory guardrail closure, explicit device
status and optional conceptual-only semantics. It performs no consolidation or
new pattern review and does not change the governed model or source artifacts.

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

From `_scripts/author-extraction`, run `npm test`. The package runner invokes `core.test.mjs`, `native.test.mjs`, `consolidator.test.mjs`, `consolidator-native.test.mjs`, `review.test.mjs`, and `review-native.test.mjs`; these are local checks and do not request a model/provider or perform extraction. The consolidation suite also checks deterministic final ordering across process locales using synthetic non-ASCII labels. Review schema/protocol tests establish neither semantic entailment nor author correctness, real host dispatch, byte transfer, or hash-bound human authorization. A passing local suite is not evidence of any of those claims.
