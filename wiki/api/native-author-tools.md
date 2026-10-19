---
title: "Native Author Tools"
description: "Local authoring tool contracts, trusted host bindings, submission limits, and release boundaries"
category: "api"
language: en
source_files:
  - "_scripts/author-extraction/native.mjs"
  - "_scripts/author-extraction/consolidator-native.mjs"
  - "_scripts/author-extraction/review-native.mjs"
  - "_scripts/author-extraction/model-native.mjs"
  - "_scripts/author-extraction/post-authoring-plugin.mjs"
  - ".opencode/plugins/author-extraction.js"
  - "plugins/author-pattern-consolidator/index.js"
  - "_scripts/author-extraction/core.mjs"
  - "_scripts/author-extraction/consolidator.mjs"
  - "_scripts/author-extraction/review.mjs"
  - "_scripts/author-extraction/model-agent.mjs"
  - "_scripts/author-extraction/post-authoring.mjs"
  - "_scripts/author-extraction/post-revision.mjs"
  - ".opencode/commands/revise-post.md"
  - "docs/post-authoring.md"
  - "_scripts/author-extraction/extraction.v1.3.schema.json"
  - "_scripts/author-extraction/patterns.schema.json"
  - "_scripts/author-extraction/patterns.v0.6.schema.json"
  - "_scripts/author-extraction/author-runtime-profile.schema.json"
  - "_scripts/author-extraction/identifiers.mjs"
created: "2026-10-15"
last_updated: "2026-10-19"
---

# Native Author Tools

## Interface Scope

These are local host-registered tools, not HTTP endpoints or a general API server. The extraction plugin registers two tools; the consolidation plugin registers consolidation, review, and model tools. `setupPostAuthoring` registers creation, revision, editorial-comparison, and shared completion tools plus session hooks. The three revision/editorial tools use `options: { codemode: true }` and are called through Code Mode; the other tools retain `codemode: false`. Results are text content with `metadata: { truncated: false }`.

Extraction and consolidation acceptance means [deterministic contract validation](../concepts/governance-and-verification.md), **not human approval**. Extraction observations remain `review_status: "unreviewed"`; offline consolidation finalization also produces unreviewed candidates. Model submission creates a separate immutable candidate, not a promoted model. No native finalizer or functioning native review-release operation is exposed.

Sources: `.opencode/plugins/author-extraction.js:18–76`, `plugins/author-pattern-consolidator/index.js:20–134`, `_scripts/author-extraction/post-authoring-plugin.mjs:13–174`, `_scripts/author-extraction/core.mjs:695–731`, `_scripts/author-extraction/consolidator.mjs:496–515`.

## Trusted Host Binding

| Tool family | Trusted identity | Binding enforced outside model arguments |
|---|---|---|
| Extraction | `author-extractor` | Host session, cancellation signal, one article and its prepared `input_hash` |
| Consolidation | `author-pattern-consolidator` | Host session, cancellation signal, one dimension, `corpus_hash`, and `input_hash` |
| Review | `build` or `plan` | Nonempty host session, cancellation/disposal state, fixed frozen repository sources; no caller-supplied review or path |
| Model composition | `author-model-compiler` | Host session, cancellation signal, cached preparation, semantic-context option, completed-review hash, and input hash |
| Post authoring | No adapter-level named-agent allowlist | Host session must resolve to the repository root; creation asserts edit and shell permissions, revision preparation and editorial submission assert edit permission only, using calling-agent/tool provenance |

Extraction/consolidation entrypoints derive the repository root from their module location and translate `toolContext.sessionID`, `agent`, and `signal` into adapter context. Model arguments cannot choose the root or impersonate that context. Extraction, consolidation, and model adapters require a nonblank session ID of at most 256 characters; review requires a nonempty string.

Consolidation's `recordsDirectory` is a **host option**, never a tool argument. The adapter allows only `docs/author-extraction-results/v1.1`, `v1.2`, or `v1.3`, defaulting to `v1.1` when omitted. The first two datasets contain twelve records; `v1.3` contains twenty. Review/model sources are independently fixed to the `v1.3` workflow; changing consolidation's dataset does not rebind review.

Sources: `_scripts/author-extraction/native.mjs:70–92,271–310`, `_scripts/author-extraction/consolidator-native.mjs:116–129,320–373`, `_scripts/author-extraction/review-native.mjs:29–49`, `_scripts/author-extraction/model-native.mjs:141–179`, `_scripts/author-extraction/post-authoring-plugin.mjs:19–43,79–145`, `_scripts/author-extraction/consolidator.mjs:15–24`, `_scripts/author-extraction/review.mjs:9–23`.

## Tools

All input objects are closed contracts: additional fields are rejected. Hash inputs are lowercase 64-character hexadecimal strings. Dimensions are `rhetorical`, `epistemic`, `semantic`, or `decisional`. Table responses describe the JSON contained in the text result, not a second transport endpoint.

### Extraction

| Tool | Input | Successful response |
|---|---|---|
| `author_extraction_prepare` | `article_id`: `A01`–`A20` | Prepared record: schema version, source/method hashes, `input_hash`, complete raw Markdown `body`, passages with code-point offsets, and basic measurements |
| `author_extraction_submit` | `article_id`, prepared `input_hash`, `candidate_json` string | `{ status: "accepted", canonical_json }`; the string contains the validated extraction record |

The candidate contains only `observations` (1–12). Each observation supplies `dimension`, `label`, `description`, `inference_kind` (`explicit` or `inferred`), and 1–4 evidence entries containing `article_id`, `passage_id`, and an exact `quote`. The core rereads current source/method inputs, rejects duplicate-key JSON, verifies quotations against the specified passage and body, and derives observation IDs, dimension presence, and citation counts.

The adapter supplies the `host-session-whole-article/1` receipt itself, then checks the returned record against the prepared schema, article, input hash, host session, processing flags, and passage counts. The caller cannot supply processing receipts in the candidate.

Sources: `_scripts/author-extraction/extraction.v1.3.schema.json` (`Prepared`, `Candidate`, `PrepareInput`, `SubmitInput`), `_scripts/author-extraction/core.mjs:653–731`, `_scripts/author-extraction/native.mjs:212–268,314–364`.

### Consolidation

| Tool | Input | Successful response |
|---|---|---|
| `author_pattern_consolidation_prepare` | `dimension` | `ready` preparation with corpus/input hashes, method, and projected verified observations; or `blocked` with corpus hash and diagnostics |
| `author_pattern_consolidation_submit` | `dimension`, prepared `corpus_hash`, prepared `input_hash`, `candidate_json` string | `{ status: "accepted", canonical_json }`; the string contains one validated dimension |

The candidate contains `groups` and `unclustered_observations`. Groups supply labels/descriptions, `abstraction_kind`, rationale, variation notes, and `member_observation_ids`; rhetorical groups additionally use `pattern_scope` and `author_relevance`, semantic groups use `semantic_kind`, and epistemic/decisional groups use `classification`. Unclustered entries contain `observation_id` and `reason`.

Every prepared observation must occur exactly once across grouped and unclustered support. Groups need at least two observations; support article IDs, counts, ordering, and group IDs are derived rather than trusted from candidate JSON. Preparation can block on incomplete/untracked extraction processing. An empty ready dimension cannot be submitted through the native tool: it must be accepted offline without an LLM submission.

Sources: `_scripts/author-extraction/patterns.v0.6.schema.json` (`CandidateRhetorical`, `CandidateSemantic`, `CandidateNonsemantic`), `_scripts/author-extraction/consolidator-native.mjs:228–317,339–427`, `_scripts/author-extraction/consolidator.mjs:341–370,614–662`.

### Review

| Tool | Input | Response |
|---|---|---|
| `author_patterns_validate` | `{}` only | JSON validation report with frozen binding, per-dimension counts, and totals |
| `author_review_prepare` | `{}` only | Complete pending review-sheet JSON text: source binding, candidates, observation/passage context, unclustered coverage, null review decisions, and an empty semantic-merge list |
| `author_review_apply` | `{}` only | Always fails with `AUTHORIZATION_UNAVAILABLE` after context/input checks; never calls the apply core |

Native review application fails closed **even if completed reviews and released outputs already exist**. Its fixed message is: `Hash-bound human release authorization is unavailable in this host. No review was applied or published.` Neither validation nor preparation creates decisions or writes repository files. Their source binding includes frozen dimension files, schemas, corpus, and verified extraction records.

Sources: `_scripts/author-extraction/review-native.mjs:1–11,114–149`, `_scripts/author-extraction/review.mjs:262–369`, `plugins/author-pattern-consolidator/index.js:87–119`.

### Model Composition

| Tool | Input | Successful response |
|---|---|---|
| `author_model_prepare` | Optional `include_semantic_context` boolean; defaults to `true` | `author-model-preparation/1`, `ready`, `source_review_hash`, `input_hash`, method hashes, reviewed author patterns/notes, optional semantic sources, and the composition schema |
| `author_model_submit` | Exact prepared `source_review_hash`, `input_hash`, and `candidate_json` string | `author-model-candidate/1`, `compiled_candidate`, bound hashes/option, artifact paths, composition/model hashes, and component counts |

Preparation validates the completed review and checks that released reviewed-pattern bytes equal the core's derived transformation; included semantic sources receive the same check. This internal read-only `applyAuthorReview` validation does not bypass or enable the disabled native review-release tool.

Submission re-prepares inputs, validates compactness, lineage, coverage, references, and option binding through the compiler, then saves an immutable candidate under `docs/author-pattern-results/v1.3/author-model-candidates/<input_hash>/<author_model_sha256>/`. It does **not** overwrite or promote the current author model. Identical existing artifacts are reusable; differing bytes cause `CANDIDATE_COLLISION`.

Sources: `_scripts/author-extraction/model-native.mjs:13–24,40–96,169–195`, `_scripts/author-extraction/model-agent.mjs:42–86,104–171`.

### Post Preparation and Completion

| Tool | Input | Successful response |
|---|---|---|
| `author_post_prepare` | Required `request`, `title`, `category`, `slug`, `destination`, `task`; optional `date` | `ready`, preparation receipt fields/paths/hashes, runtime instructions, and `context_injection: "automatic_for_this_session_until_author_post_finish"` |
| `author_post_finish` | Exactly `outcome`: `written` or `cancelled` | Outcome, runtime/target/receipt identifiers, instructions hash, hook count, `injection_ended: true`, and explicit verification scope; revisions also return `editorial_review` and `editorial_status: "candidate_pending_human"` |

The effective `author_post_prepare` contract is narrower than the reusable task schema: **`task.mode` must be `generate`**. It remains create-only: it creates a new scaffold, not prose, and refuses an existing target. Existing articles require the explicit revision preparation below.

| Request field | Contract |
|---|---|
| `request`, `title`, `slug` | Nonblank request ≤6,000 characters; title ≤240 excluding CR/LF and U+0000–U+001F; lowercase alphanumeric hyphenated slug ≤100 |
| `category` | `3D Printing`, `DevOps`, `Fisica`, `Home Assistant`, `Meccanica`, or `Reti Sociali` |
| `destination`, `date` | `draft` or `post`; optional real calendar date in `YYYY-MM-DD`, otherwise local current date |
| Required task fields | `mode: "generate"`, `content_type`, `language`, `objective` (≤1,600 characters). Content type: `scientific_explainer`, `project_article`, `tutorial`, `mixed`, or `other`; language matches `xx` or `xx-YY` |
| Optional task fields | `audience`, `topic`, `series_context`, `constraints`, `features`, `local_topics`, `semantic_topics`, `device_requests`; closed enums/bounds are defined by `TaskContext` |
| Conditional task fields | `mixed` requires 2–3 distinct `mixed_content_types`; nonempty `semantic_topics` requires `topic`. Planned continuation requires `continuation_topic`; device requests use `Dnn` and `available`, `preferred`, or `required` |

Before filesystem/process work, the plugin asserts host **edit** permission for the target, authoring-run directory, and runtime tree, plus **shell** permission for the Rake invocation. The core creates `_drafts/<slug>.md` or `_posts/<category-slug>/<date>-<slug>.md` using `execFile("rake", ...)`, not interpolated shell code. Rake has a 30-second timeout and 64 KiB output buffer. No provider is selected and no text generation is performed by preparation.

Session `context` and `generate` hooks verify runtime integrity and inject instructions. For creation, `written` completion additionally requires an observed hook application and a changed scaffold with a nonempty body; it does **not** automatically require an editorial report. `cancelled` removes activation without writing checks. Neither completion publishes or deletes a file. The registered `/cancel-post` command also removes activation, but refuses while an authoring operation is busy.

Sources: `_scripts/author-extraction/post-authoring.mjs:14–25,70–156`, `_scripts/author-extraction/author-runtime-profile.schema.json:23–61`, `_scripts/author-extraction/post-authoring-plugin.mjs:24–96,149–172`.

### Revision Preparation and Editorial Comparison

These tools require the calling session at the repository root. Creation and revision share one active-article slot; editorial tools require an explicit active revision, not a prior creation receipt. The current session's agent edits the target; preparation and comparison tools do not write article prose.

| Tool (Code Mode) | Input | Successful response |
|---|---|---|
| `author_post_revision_prepare` | Required `request`, `target_path`, `task`, `references` | `status: "ready"`, `author-post-revision/1` receipt fields, snapshot/request/task/receipt paths, source/runtime/profile/instruction/editorial-context hashes, full runtime and comparison Markdown, and automatic session-injection status |
| `author_post_editorial_prepare` | `{}` only | Read-only `target_path`, current whole-file `target_sha256`, `candidate_schema`, `status: "comparison_required"`, `human_approval: false`, and a limitation note; no prose assessment or file writes |
| `author_post_editorial_submit` | `candidate_json` string | `status: "editorial_candidate_saved"`, immutable report path/hash, bound target hash, derived verdict, `human_approval: false`, and `verification_scope: "literal_evidence_not_editorial_truth"` |

| Revision request field | Contract |
|---|---|
| `request`, `target_path` | Nonblank request ≤6,000 characters; relative target ≤300 characters matching `_drafts/<slug>.md` or `_posts/<supported-category>/<YYYY-MM-DD>-<slug>.md`. Slugs use lowercase letters, digits, and hyphens, starting with a letter/digit. Target must exist with YAML frontmatter and a nonempty body |
| `task` | Reuses `TaskContext` fields/conditional rules above, but requires `mode: "rewrite"` or `"expand"` |
| `references` | 2–4 distinct approved corpus articles (`A01`–`A20`), excluding the target itself; each supplies nonblank `reason` ≤500 characters and 1–4 `passages` |
| Reference passage | `aspect`: `opening`, `decision`, `technical_transition`, or `limitation`; literal approved-body `quote`: 8–1,500 characters. Total selected quote length ≤6,000 characters |

Before evidence writes, revision preparation asserts host **edit permission** for the target, the new revision directory, and the existing runtime tree. It requests no shell permission, runs no Rake, and does not modify the article. Replanning after permission detects changed target/reference/task inputs; a final target-hash check precedes receipt persistence and activation. Each run uses a fresh UUID beneath `.opencode/authoring-revisions/<request-sha256>/<UUID>/`, containing immutable `request.json`, `task.json`, original-byte `source.md`, and `preparation.json`. Snapshots stay outside `docs/` to avoid becoming publishable Jekyll pages. Runtime artifacts remain under `docs/author-pattern-results/v1.3/author-runtimes/`.

Hooks reverify the snapshot, request/task, approved source and corpus hashes, runtime, and exact comparison context, then inject both the runtime and comparison Markdown. Activation survives reload/compaction and stays active through editing, comparison, and corrections until explicit finish or cancellation. This is not a global editing lock or sandbox.

The editorial candidate is a closed JSON object with `target_sha256`, nonblank `summary` (≤2,000 characters), and exactly four `comparisons`, one for each aspect. Each comparison has `aspect`, `status` (`coherent`, `needs_revision`, `not_applicable`), nonblank `rationale` (≤2,000), `target_quote`, and `reference`. Applicable aspects require a literal current-body quote (8–2,000 characters) plus `{ article_id, quote }` exactly matching an excerpt prepared for that aspect. Non-applicable aspects require null `target_quote` and `reference` and an explicit rationale; an entirely non-applicable report is rejected. Duplicate JSON keys, stale whole-file hashes, and invalid literal evidence are rejected.

Submission asserts edit permission for `editorial/**` under the active revision directory and saves `editorial/<report-sha256>.json` create-only. The persisted `author-editorial-comparison/1` report binds the preparation, runtime, comparison context, and current target hash. Its verdict is `needs_revision` if any aspect has that status, otherwise `ready_for_human_review`. **Both verdicts remain `status: "candidate_pending_human"` with `human_approval: false`.** The saved report's verification scope is `literal_evidence_and_current_bytes_not_voice_quality_or_human_approval`; substring membership does not validate comparability, editorial judgment, or the author's voice.

For revisions, shared `author_post_finish` with `written` revalidates context, requires an observed hook and changed nonempty article content, then requires the latest saved report to match current article bytes and have verdict `ready_for_human_review`. Any later edit makes that report stale and requires resubmission; failed completion leaves injection active. Successful finish ends injection, not pending human review. A later revision requires a new preparation. No tool promotes the model, corpus, or patterns or grants human approval.

Sources: `_scripts/author-extraction/post-revision.mjs:13–54,70–213`, `_scripts/author-extraction/post-authoring-plugin.mjs:24–64,98–172`, `.opencode/commands/revise-post.md`, `docs/post-authoring.md:142–197`.

## Submission Budgets and Lifecycle

Budgets below are adapter-level counters. Calls rejected by the host before adapter execution do not reach these counters. Extraction, consolidation, and model operations are serialized per session.

| Family | Submission budget and counting point | Terminal state |
|---|---|---|
| Extraction | **2** attempts. After context/active/signal checks, incremented **before enqueueing**, input validation, or checking preparation. Invalid input, missing preparation, and mismatched binding consume an attempt | Successful acceptance seals the session; further prepare/submit fails. Re-preparation cannot change article/hash or reset attempts |
| Consolidation | **1** attempt. Reserved **before enqueueing** and validation, after context/active/signal checks. Malformed, unprepared, mismatched, and empty-dimension submissions consume it | Acceptance seals; blocked preparation prevents subsequent native prepare/submit. Re-preparation cannot change dimension/hashes or reset attempts |
| Model | **2** received submissions **after preparation**. Inside the queue, preparation is checked first, then the counter increments before input/schema/byte/hash checks. Pre-prepare rejection does not consume an attempt | Acceptance seals. Core `MODEL_INPUT_CHANGED` blocks further operations. Repeated prepare returns cached data and cannot change semantic option or reset attempts |
| Review | No numeric submission budget or success seal | Cancellation/disposal prevents use; native apply remains unavailable |
| Post creation/revision | No numeric attempt budget; one active article per session; preparation and editorial submission use the shared busy guard | Finish/cancel ends injection, not a permanent seal; editorial submission alone does not end injection; a later new preparation is possible |

Sources: `_scripts/author-extraction/native.mjs:139–199,285–371`, `_scripts/author-extraction/consolidator-native.mjs:162–215,339–433`, `_scripts/author-extraction/model-native.mjs:122–199`, `_scripts/author-extraction/review-native.mjs:37–49,151–153`, `_scripts/author-extraction/post-authoring-plugin.mjs:24–47,111–172`.

### Size Bounds

KiB/MiB below mean powers of 1,024. Candidate schemas also impose string `maxLength`; UTF-8 byte checks are separate and may reject a shorter non-ASCII string.

| Family | Candidate/input bound | Result bound |
|---|---|---|
| Extraction | `candidate_json`: 1–65,536 characters and ≤65,536 UTF-8 bytes; source file ≤262,144 bytes, ≤512 passages | Prepared JSON ≤4 MiB; accepted record and acceptance-envelope JSON each ≤1 MiB |
| Consolidation | `candidate_json`: 1–262,144 characters and ≤256 KiB UTF-8 bytes | Preparation, accepted dimension, and serialized acceptance envelope each ≤4 MiB |
| Model | `candidate_json`: 1–131,072 characters and ≤128 KiB UTF-8 bytes | Serialized result ≤256 KiB; wrapped tool result ≤512 KiB; each persisted candidate artifact ≤256 KiB |
| Review | Empty input only | Validation JSON or pending-sheet text ≤8 MiB; wrapped tool result ≤16 MiB |
| Post creation | Field-specific schema bounds above; no creation submit-candidate tool | No aggregate result-byte cap in the plugin wrapper; core verification reads editable articles with a 512 KiB limit |
| Post revision/editorial | Field-specific bounds above; editorial `candidate_json`: 1–32,000 characters and ≤32,000 UTF-8 bytes | No aggregate result-byte cap in the plugin wrapper; revision target/snapshot reads ≤512 KiB, report verification reads ≤64 KiB |

Sources: `_scripts/author-extraction/core.mjs:17–20,653–660,725–729`, `_scripts/author-extraction/native.mjs:201–218,259–268`, `_scripts/author-extraction/consolidator-native.mjs:41–42,314–316,356,387–390`, `_scripts/author-extraction/model-native.mjs:7–8,34–38,188,202–205`, `_scripts/author-extraction/model-agent.mjs:152`, `_scripts/author-extraction/review-native.mjs:1–2,51–63,133–140,157–165`, `_scripts/author-extraction/post-authoring.mjs:147–155`, `_scripts/author-extraction/post-revision.mjs:20–54,89–109,162–172,204–209`.

### Cancellation and Unload

- **Extraction/consolidation:** host abort signals mark session state aborted and detach listeners. Active checks before/after awaited core calls suppress successful return after cancellation; no cancellation signal is passed into these read-only cores. Plugin unload removes registrations and aborts known sessions.
- **Model:** abort/dispose also aborts an internal controller passed to candidate persistence. Unload disposes the adapter and cancels every session. Writes use cancellation checkpoints, not a transaction: cancellation need not remove already-created immutable artifacts.
- **Review:** context is rechecked around awaited core work; disposal invalidates the adapter. These checks do not claim to interrupt an already-running core operation.
- **Post:** abort/unload cancels preparation controllers, including the creation-only Rake subprocess signal. Errors do not imply rollback; creation scaffolds or revision evidence may remain. Durable activation is deliberately retained across reloads, scoped to the original session, and not inherited by child sessions. Finish/cancel does not remove snapshots, reports, or article edits.

Sources: `.opencode/plugins/author-extraction.js:66–73`, `plugins/author-pattern-consolidator/index.js:122–131`, `_scripts/author-extraction/native.mjs:148–199,301–302,354`, `_scripts/author-extraction/consolidator-native.mjs:168–215,416`, `_scripts/author-extraction/model-native.mjs:129–166,190–198`, `_scripts/author-extraction/model-agent.mjs:153–171`, `_scripts/author-extraction/review-native.mjs:85–99`, `_scripts/author-extraction/post-authoring-plugin.mjs:24–47,66–74,149–183`, `_scripts/author-extraction/post-authoring.mjs:108–115`, `_scripts/author-extraction/post-revision.mjs:100–131`.

## Write Ownership and Offline Boundaries

| Operation | Core effects | Native adapter/plugin effects |
|---|---|---|
| Extraction prepare/accept | Reads sources/contracts; returns prepared data or canonical record JSON. **No repository writes** | In-memory session binding, receipt creation, validation, and wrapping; does not save extraction-result files |
| Consolidation prepare/accept | Reads/verifies records; returns preparation or canonical dimension JSON. **No repository writes** | Session binding, partition/derived-value checks, wrapping; does not save dimension files or finalize a bundle |
| Review validate/prepare | Reads frozen inputs and returns report/pending sheet. Offline `applyAuthorReview` returns transformed JSON, not persisted files | Read-only native calls; native apply throws without invoking the core |
| Model prepare/submit | Preparation is read-only. Submission writes `preparation.json`, `composition.json`, `author-model.json`, and `manifest.json` in its hash-addressed candidate directory, using exclusive file creation | Session control and receipt verification; no promotion or replacement of current model |
| Post creation prepare/finish | Preparation writes immutable request/task/receipt evidence, materializes the runtime, and invokes Rake for one new scaffold; completion verifies files without automatically requiring editorial comparison | Host permission assertions, durable activation storage, instruction injection, and activation removal; no prose-writing or publishing step |
| Revision prepare / editorial prepare / editorial submit / finish | Revision preparation saves immutable request/task/snapshot/receipt and materializes the runtime, never Rake or article writes. Editorial preparation is read-only; submission saves an immutable candidate report; completion verifies changed article and current report | Edit-permission assertions for preparation/submission, shared durable activation, runtime plus comparison-context injection, latest-report binding, and explicit activation removal; no model/corpus promotion or human approval |

Saving returned extraction/dimension JSON is a separate caller-controlled operation. `finalizeConsolidation` exists in the core but is **not registered as a native tool**; it verifies exactly one accepted input per dimension and returns a candidate bundle. Empty-dimension acceptance is likewise offline-only at the native boundary. Completing human review, persisting reviewed releases, and promoting a model are not authorized by native acceptance receipts or existing release files.

Sources: `_scripts/author-extraction/core.mjs:615–736`, `_scripts/author-extraction/consolidator.mjs:610–721`, `_scripts/author-extraction/review.mjs:545–587`, `_scripts/author-extraction/model-agent.mjs:139–171`, `_scripts/author-extraction/post-authoring.mjs:89–130`, `_scripts/author-extraction/post-revision.mjs:100–213`, `_scripts/author-extraction/post-authoring-plugin.mjs:98–172`, `plugins/author-pattern-consolidator/index.js:46–120`.

## Receipt and Identifier Caveats

- `truncated: false`, complete-body fields, `prepare_returned: true`, and `article_processed: true` describe adapter output/workflow bookkeeping. They do **not** prove byte-for-byte provider delivery, LLM attention to every passage, or semantic completeness of the observations.
- Post completion explicitly reports `verification_scope: "runtime_integrity_and_context_hook_application_not_prose_compliance_or_provider_delivery"`. Hook counts prove observed hook application, not provider receipt or prose compliance.
- Revision reports validate current bytes and literal quotations, not semantic voice quality. `ready_for_human_review` is a candidate verdict, not human approval; the persisted report remains `candidate_pending_human` with `human_approval: false`. Offline temporary-fixture revision tests do not certify generation or authorial quality.
- The canonical convention for **new contracts** is a single colon, for example `A01:O0001`, `APC:R0001`, and `SPC:C0001`; `EPC:A0001`/`DPC:A0001` also use a single colon. Retained extraction contracts `1.1`–`1.3` and pattern preparation/dimension contracts `0.1`–`0.6` preserve their original formatting, including double-colon observation/APC/SPC IDs. The native contracts documented here therefore must not be silently relabeled.
- Identifier normalization helpers operate on recognized whole identifiers and can detect collisions; they do not migrate artifacts, rewrite quotes/URLs, update hashes, or preserve provenance automatically.

Sources: `_scripts/author-extraction/native.mjs:228–251`, `_scripts/author-extraction/post-authoring-plugin.mjs:49–64,168–172`, `_scripts/author-extraction/post-revision.mjs:162–201`, `docs/post-authoring.md:199–221`, `_scripts/author-extraction/identifiers.mjs:1–61`, `_scripts/author-extraction/model-native.mjs:5–6`.
