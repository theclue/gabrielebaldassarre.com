---
title: "Governance and Verification"
description: "Human approval boundaries, hash-bound provenance, and the scope of automated and live verification."
category: "concepts"
language: "en"
source_files:
  - "_scripts/author-extraction/package.json"
  - "_scripts/author-extraction/core.test.mjs"
  - "_scripts/author-extraction/review.test.mjs"
  - "_scripts/author-extraction/review-native.test.mjs"
  - "_scripts/author-extraction/model-agent.test.mjs"
  - "_scripts/author-extraction/runtime.test.mjs"
  - "_scripts/author-extraction/post-authoring.mjs"
  - "_scripts/author-extraction/post-authoring-plugin.mjs"
  - "_scripts/author-extraction/post-authoring.test.mjs"
  - "_scripts/author-extraction/post-revision.mjs"
  - "_scripts/author-extraction/post-revision.test.mjs"
  - "_scripts/author-extraction/plugin-loading.test.mjs"
  - "_scripts/author-extraction/post-authoring-loading.test.mjs"
  - "_scripts/author-extraction/site-packaging.test.mjs"
  - "test/wikidata_oracle_test.rb"
  - "test/vscode_process_rake_tasks_test.rb"
  - "docs/author-extraction-results/v1.3/final-report.md"
  - "docs/author-pattern-results/v1.3/final-report.md"
  - "docs/author-pattern-results/v1.3/author-runtime-validation-v1.1.md"
  - "docs/wikidata-oracle-e2e.md"
  - "docs/author-model.md"
  - "docs/author-extraction.md"
  - "docs/post-authoring.md"
  - ".opencode/commands/annotate-post.md"
created: "2026-10-15"
last_updated: "2026-10-20"
---

# Governance and Verification

## Overview

The author-analysis pipeline separates mechanically valid candidates, explicit human judgments, persisted artifacts, and release authority. A successful tool call or test establishes only its stated boundary: neither a *[hash](../glossary.md)* nor a `PASS` turns an interpretation into an approved author trait or authorizes publication. These controls govern the software workflow; they are not themselves evidence that the author generally writes or reasons this way.

This page describes checked-in contracts and historical reports. No tests, builds, pipeline runs, provider calls, or live validation were executed to write it.

## Human Gates and Artifact States

### Corpus and candidate acceptance

Corpus approval determines which source articles may enter extraction. The v1.3 extraction report records explicit approval of A13–A20, preservation of the earlier manifest and outputs, and twenty fresh sessions rather than retrofitted processing receipts. Approval of this source selection does not approve the observations subsequently inferred from it.

`core.test.mjs` checks allowlisted sources, strict JSON/schema validation, literal evidence membership, current input hashes, and code-derived fields. Accepted observations receive `review_status: "unreviewed"`. Direct core acceptance can be source/evidence-valid while remaining `processing.status: "not_tracked"` and ineligible for consolidation. A matching host workflow receipt establishes tracked whole-article processing, not semantic review.

The consolidation report likewise stops at candidate consolidation. Its exact-once accounting of all 217 observation IDs prevents support loss or invention; cross-article incidence is not evidence that examples are independent, stylistically distinctive, or attributable exclusively to one author. Related series, topics, periods, and generic technical conventions remain confounders.

### Review is explicit, not score-based promotion

`review.test.mjs` distinguishes preparation of a complete pending sheet from applying completed judgments. Preparation writes nothing and leaves review fields unset. The review covers all 52 original groups, including local-only groups, with observations and cited passage contexts preserved as immutable context.

| Review branch | Decisions | Effect |
| --- | --- | --- |
| Rhetorical, epistemic, decisional | `accept`, `revise`, `reject`, `defer` | Only explicit acceptance or effective revision enters the reviewed author entries. |
| Semantic | `retain`, `revise`, `merge`, `discard` | Retained concepts/relations stay separate from author-style instructions; discarded groups remain audited. |

Correctness, applicability, relevance, utility, and overuse risk are recorded judgments, not an undisclosed numerical eligibility filter. Tests deliberately permit explicitly approved local patterns and low-utility/high-risk assessments. They also reject no-op revisions and unchanged thematic decisional acceptance. Semantic merges require explicit whole-group participation, preserve original lineage, and reject invented identities, partial memberships, overlaps, and chains.

The pure review transformation returns output strings and hashes without writing or publishing them. Native `author_review_apply` is a different authority boundary: even an allowed `build` or `plan` identity receives `AUTHORIZATION_UNAVAILABLE` because the host lacks hash-bound human release authorization. A permission grant, identity argument, or approval-like boolean is not author consent. The preparation-time documentation records an earlier pending phase; its historical status must not be mistaken for the later reviewed inputs documented in `docs/author-model.md`.

### Saved model candidates are not released models

The model compiler uses effective reviewed sources and their qualifications. Its synthesis is marked `compiled_synthesis_not_separately_human_reviewed`: approval of the source patterns is not a second approval of every compressed directive.

`model-agent.test.mjs` exercises submission into separate hash-addressed candidate directories. Repetition is idempotent; conflicting bytes and unsafe paths fail without overwriting them. The receipt has `status: "compiled_candidate"` and identifies preparation, composition, model, and manifest artifacts. It does not replace the current composition/model, confer human approval, or publish anything. Selection and promotion remain a separately authorized coordinator action; cancellation may leave incomplete candidate files without promoting them.

### Creation and revision have separate completion gates

New-post preparation creates a new Rake scaffold and verified runtime artifacts after host edit/shell permission checks. Finishing ends session-context injection; it is not publication, deletion, or a prose-quality approval. Cancellation leaves the created scaffold in place. Tests allow the article body to change while protecting the runtime, task, instructions, and receipt. Creation's `written` gate does not require the editorial comparison used by the separate revision flow.

`author_post_revision_prepare` instead accepts an existing Markdown article and a `rewrite`/`expand` task. It requires host edit permission, replans after permission handling, and saves the original article, normalized request/task, and preparation receipt as *[create-only](../glossary.md)* evidence under `.opencode/authoring-revisions/<request-sha256>/<UUID>/`. Each attempt uses a fresh run directory; snapshots stay outside `docs/` so copied drafts do not become publishable pages. Preparation neither runs Rake nor edits the article. Concurrent changes detected before activation reject the preparation without overwriting the target; this is not a global editor lock, and interrupted preparation can leave evidence.

The brief selects 2–4 distinct approved reference articles, excluding the target itself, with literal body excerpts and reasons for comparability. Runtime instructions and this contextual comparison remain injected in the same session through editing, assessment, and corrections, including after reload. Verification binds the original snapshot, reference/corpus bytes, task, runtime, and editorial context while allowing the target to change. Reference selection does not promote new author patterns or prove editorial comparability.

`author_post_editorial_prepare` reads the current article hash and report schema without assessing prose or writing files. `author_post_editorial_submit` requires exactly the four aspects `opening`, `decision`, `technical_transition`, and `limitation`, with a rationale and status for each. Applicable comparisons need a literal current-body quote and the exact prepared reference quote for that aspect. `not_applicable` requires null quotes/references and an explanation; an entirely non-applicable report is rejected. Submission asserts report-edit permission and saves an immutable candidate, not a judgment certified by the core.

Even a verdict of `ready_for_human_review` retains `status: "candidate_pending_human"` and `human_approval: false`. Revision completion requires changed article bytes, a nonempty body, an observed context hook, and a current bound report with no `needs_revision` aspect. Later article edits make the report stale. Hashes, quote membership, and completion do **not** validate voice quality, semantic coherence, or human approval. Finish/cancellation ends injection without publishing, removing snapshots, or reverting edits. Sources: `post-revision.mjs`, `post-authoring-plugin.mjs`, and the [authoring operator guide](../../docs/post-authoring.md#revisioni-con-runtime-continuo-e-confronto-editoriale).

### Host execution permission is not release authority

The shared authoring-preparation gate requires an actually callable `ctx.permission.assert`; missing or non-callable APIs raise `AUTHOR_POST_HOST_UNSUPPORTED` before planning, runtime compilation, or output writes. Model-free `/cancel-post` remains available. Creation asserts edit and Rake shell permissions; revision preparation asserts edit only, and editorial submission separately asserts report-edit permission. The operator guide requires OpenCode 2.0.29 or newer, while the package pins the *[SDK](../glossary.md)* to 2.0.31. Updating that dependency does not upgrade a running host; the guide requires a server restart after upgrading OpenCode.

These checks authorize specific filesystem/process operations, **not hash-bound human release**. Native `author_review_apply` still denies `build` and `plan` with `AUTHORIZATION_UNAVAILABLE`; neither a working permission API nor a successful assertion changes that boundary. Sources: `post-authoring-plugin.mjs`, `review-native.test.mjs`, `_scripts/author-extraction/package.json`, and `docs/post-authoring.md`.

## Provenance and Hash Distinctions

| Value | What it binds | What it does not establish |
| --- | --- | --- |
| Extraction manifest `corpus_hash` | Raw corpus YAML bytes | Identity of the extracted dataset or approval of its interpretations |
| Extraction `input_hash` | Canonical source/method binding, including article, manifest, schema, and instruction hashes | A unique observation set; interpretation remains candidate-authored |
| Extraction record fingerprint | Canonical full accepted record | Independent factual or semantic correctness |
| Consolidation dataset `corpus_hash` | Twenty full-record fingerprints in the reported dataset | Equality with the raw manifest hash |
| Dimension `input_hash` | Prepared consolidation inputs and method | A unique grouping: different candidates can share prepared inputs |
| Review `review_source_hash` | Frozen source/schema/method binding | Completed decisions or release consent |
| `completed_review_hash` / model `source_review_hash` | Canonical completed review, including decisions | The differently named pending-input `review_source_hash` |
| Model-preparation `input_hash` | Verified projection, source artifacts, compiler, schema, instructions, and semantic option | Approval of a new synthesis |
| Revision `source_sha256` | Original target bytes retained in the immutable revision snapshot | The current editable target or approved content |
| Editorial `target_sha256` / report SHA-256 | Current article bytes / exact saved comparison candidate | Voice quality, correctness of the editorial judgment, or human approval |
| Artifact SHA-256 | Exact saved or transmitted bytes at the measured boundary | Receipt, comprehension, or compliance at an unmeasured boundary |

The tests intentionally distinguish byte binding from JSON equivalence. Whitespace-only changes to frozen source files invalidate review bindings even when their embedded `input_hash` stays unchanged. Conversely, formatting/key-order changes to equivalent completed-review JSON yield the same canonical decision hash and transformation bytes. Runtime tests also reject changed governed-model bytes and falsified clause lineage rather than silently recompiling historical artifacts in place.

Sources: `core.test.mjs`, `review.test.mjs`, `model-agent.test.mjs`, `runtime.test.mjs`, `post-revision.mjs`, the consolidation report, and `docs/author-model.md`.

## Verification Layers and Their Limits

| Layer | Checked evidence | Limit |
| --- | --- | --- |
| Literal evidence | Quote occurs exactly in the cited current article/passage; raw Markdown, Liquid, and code remain inert data | Membership does not entail the observation. A core test deliberately accepts an unsupported description with a valid quote. |
| Closed schemas and derived fields | Allowed fields, IDs, counts, reference integrity, current bindings | Structural validity is not factual correctness, authorship attribution, or an independently reviewed paraphrase. |
| Whole-article host receipt | Matching session, article, prepared input, and completed protocol | Not exhaustive cognitive attention or passage-by-passage coverage; cited-passage counts are not reading coverage. |
| Runtime projection | Deterministic task routing, mandatory applicable guardrail clauses, source lineage, and optional conceptual context | Not a generated-prose benchmark or a guarantee that an LLM obeys the instructions. |
| Authoring context hook | Exact verified runtime Markdown, plus prepared comparison context for revisions, appended to active-session context/generate events | Not proof of byte delivery to a provider or of prose compliance. |
| Editorial comparison candidate | Current-byte binding, four-aspect schema, literal target-body quotes, and exact selected reference excerpts for each applicable aspect | Not editorial truth, reference comparability, voice-quality validation, or human approval. |
| Wikidata validation | Snapshot, target identity, unchanged body, permitted frontmatter scope, concept preservation, and run-scoped identity provenance | Not semantic truth, a correctness guarantee for preserved identities, or enforcement of the later write. |

Runtime device statuses distinguish availability, contextual preference, and explicit task requirements. Applicable guardrails cannot be disabled by an input switch; their resolution records projection, coverage by a prohibition, or non-applicability. Optional semantic context neither activates style rules nor inserts topics automatically. These are compiler-policy checks, not general psychological claims about the author.

## Annotation Writes, Assets, and Privacy

The [annotation command](../../.opencode/commands/annotate-post.md) validates an in-memory semantic proposal that may change only `knowledge_prerequisites` and `difficulty_computed.semantic`, preserving the original body. Acceptance does not certify the later document with transformed links/images, image-credit metadata, or staged social copy. After those stages, the command requires confirmed oracle closure/reaping, rereads the original against its snapshot, and permits one final article-document write only if unchanged, with no intervening cleanup or awaited work.

That single write is **not an atomic transaction across article, assets, and services**. Screenshot PNGs, downloaded/cropped hero images, and Unsplash `track_download` calls occur earlier; a failed final article check does not roll back those outputs or service effects. Closing the oracle ends its run/process, not an asset transaction. The oracle remains consultive rather than enforcing every later writer action.

Screenshot handling requires checking sign-in on the site's origin, pausing for user login if necessary, and capturing the relevant element rather than an unmatched full page. Raw viewport captures must stay outside the repository, be cropped, and then be deleted. The command requires inspecting the saved PNG and listing image paths so the **user can review them for private data before committing**. Authentication handoff, privacy review, and asset/copy correctness are command/user responsibilities, not consequences of semantic validation. Source: `.opencode/commands/annotate-post.md:89–112,139–214,224–274`.

## Test Families and Side Effects

The suite names below come from `_scripts/author-extraction/package.json` and inspected tests. **All are UNEXECUTED for this 2026-10-20 wiki update**; these are source descriptions, not fresh execution results.

| Family | Scope and operational behavior |
| --- | --- |
| Package `test` | Lists `core`, `native`, `consolidator`, `consolidator-native`, `review`, `review-native`, `model`, `model-agent`, `identifiers`, `runtime`, `post-authoring`, and `post-revision` test files. Inspected core/review/model/runtime cases read repository evidence and use temporary synthetic or copied repositories for mutation/persistence checks. They are not all filesystem-pure. |
| Extraction core | Unicode/code-point offsets, raw-body measurements, strict schemas, evidence, stale inputs, containment, and receipt eligibility. Historical v1.1 checks are read-only and conditional on local seed availability. No advanced stylometry is computed. |
| Review and model-agent | Synthetic completed decisions, immutable snapshots, canonical hashes, bounded host identities/options, cancellation, redacted errors, and create-only candidate persistence in temporary fixtures. Synthetic approval rows are not actual human decisions. |
| Runtime | Task-specific selection/rendering, clause projection, tamper detection, and temporary materialization/collision handling. Seven real-article contexts check source hashes and routing without generating or editing posts. |
| Post authoring (`test:post-authoring`) | Runs actual Rake in isolated copied workspaces and exercises simulated host storage, permissions, session hooks, races, reload, cancellation, and tampering. The unsupported-host fixture supplies absent/non-callable permission APIs and expects no output writes, activation, or permission calls, with model-free cancellation still available. It writes scaffolds/runtime artifacts in supported-host fixtures, but makes no LLM/provider calls. It is not provider end-to-end authoring. |
| Post revision (`test:post-revision`, also package `test`) | `post-revision.test.mjs` uses temporary copied evidence and synthetic article bodies, deliberately without a Rakefile. Cases describe immutable snapshots, source/quote/path validation, permission denial, concurrent edits, cancellation/reload, stale reports, and candidate-versus-human-approval boundaries. It neither runs Rake nor calls a provider nor measures voice quality. |
| Package `test:integration` | Uses experimental VM modules for `plugin-loading.test.mjs` and `post-authoring-loading.test.mjs`. Actual entrypoints/SDK are loaded with synthetic core/host dependencies to check registration, routing, identity, output preservation, and disposal. A separate fixture traverses the installed SDK's real `fromPromise` adapter with an Effect-based simulated host, checking permission-assertion input forwarding and propagation of the same denial error; it does not manually stub the Promise permission API under test. Neither fixture demonstrates a live host session, permission decision, or catalog refresh. |
| Site packaging, separate suite | `site-packaging.test.mjs` is absent from both npm suite lists. It launches `bundle exec ruby`, loads production Jekyll configuration, and reads static-file selection. It checks that private consolidator tooling is excluded while `CNAME` remains selected—not a complete render, build, or deployment. |
| Wikidata Ruby oracle | Launches the actual Ruby JSONL CLI against loopback fake HTTP/WDQS endpoints and temporary documents. Covers provenance/document checks, preservation edge cases, budgets, partial results, retries with controlled clocks, protocol exits, and redacted failures. `validate` remains read-only; local sockets and subprocesses still run. |
| VS Code process/Rake regression | Checks process-task argument quoting, then invokes real Rake against temporary workspaces for post, draft, Rmd, and CAD scaffold creation. The knitr task receives argument-format inspection, not an actual knitr execution in this test. |

## Historical Live Evidence

The extraction and consolidation reports record successful native prepare/submit runs. Their transfer checks selected results by session, assistant message, tool name, and call ID, then compared exact retrieved text against producer replay. This is stronger than trusting `metadata.truncated: false` alone, but proves only the tested producer/native retrieval boundary—not provider byte delivery, attention, or entailment. Provider transport retry counts were not exposed.

The model live smoke documented in `docs/author-model.md` was **preparation-only**: it returned `ready`, 29 author patterns, and three semantic sources, with matching input/instruction hashes. It made no submission and created no real-workspace candidate directory. Full current-payload byte preservation was tested through the VM executor; persistence remains fixture/VM evidence, not a live native submission claim.

The Wikidata live fixture is separate evidence. `docs/wikidata-oracle-e2e.md` records the actual `/annotate-post` command on an isolated host with real Wikidata/WDQS retrieval, validation and close, independent proposal hashing, and one final writer patch to a temporary draft. Its 41 checker assertions do not validate every post, provider, semantic estimate, SEO consumer, cancellation path, or writer. The core's assurance is explicitly `provenance_and_document_checks`, with `write_enforcement: "not_provided_by_core"`. Existing post/draft hashes were preserved; concurrent unrelated changes prevented a whole-working-tree invariance claim.

That historical fixture recorded placement comments, not verification of the current screenshot/hero asset stages, download tracking, authentication/privacy handling, or social-copy preparation. No live creation or revision run, permission check, or annotation stage was reproduced for this update.

Historical totals are snapshots: the consolidation report records 73 core/adapter plus four integration tests, while runtime refinement 1.1 records 149 package plus six VM checks. Suites have since grown; neither number is a current execution result. Keep report date, input versions, artifact hashes, test family, side effects, and unverified boundaries attached to any later `PASS` claim.
