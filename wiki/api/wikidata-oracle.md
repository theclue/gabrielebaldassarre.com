---
title: "Wikidata Oracle"
description: "Bounded read-only Wikidata retrieval, proposal validation, and command-side asset, copy, and article-write boundaries."
category: "api"
language: en
source_files:
  - "_scripts/wikidata-oracle.rb"
  - "_scripts/wikidata-integration/index.mjs"
  - ".opencode/plugins/wikidata-oracle.js"
  - ".opencode/commands/annotate-post.md"
  - "_scripts/semantic-analysis-prompt.md"
  - "docs/authoring-oracles.md"
  - "docs/wikidata-oracle-e2e.md"
  - "_scripts/wikidata-integration/fixtures/annotate-post.md"
created: "2026-10-15"
last_updated: "2026-10-20"
---

# Wikidata Oracle

## Purpose and Boundaries

The Wikidata oracle supplies bounded candidate retrieval and local validation for the semantic phase of `/annotate-post`. The Ruby core reads an original document, retrieves evidence on request, and checks a complete proposed document. It does not write posts, call an LLM, run Jekyll, or maintain persistent caches. Editorial concept identification, contextual identity selection, importance, and prerequisite depth remain LLM/author judgments.

Retrieval is **not entailment**, and an available candidate or graph node does not prove a prerequisite relationship or strict `sameAs` identity. Even accepted validation certifies only the implemented [provenance and document checks](../concepts/governance-and-verification.md), not semantic truth. Preserved existing identities remain explicitly uncertified.

Sources: `_scripts/wikidata-oracle.rb:129–161,218–522`; `_scripts/semantic-analysis-prompt.md:175–212,249–254`; `docs/authoring-oracles.md:194–261`.

## Implementation and Tool Surface

| Source | Responsibility |
|---|---|
| `_scripts/wikidata-oracle.rb` | Stateful JSONL protocol, safe target reads, Wikidata API/WDQS retrieval, budgets, and proposal checks. |
| `_scripts/wikidata-integration/index.mjs` | Trusted launcher, serialized bridge requests, session binding, subprocess lifecycle, and tool registration. |
| `.opencode/plugins/wikidata-oracle.js` | Imports and exports the plugin factory result. |
| `.opencode/commands/annotate-post.md` | Consultive semantic workflow, later asset/copy stages, and the single final article-document write. |
| `_scripts/semantic-analysis-prompt.md` | Editorial semantic metrics and prerequisite rules. |

The plugin registers **one tool named `wikidata_oracle`**, with `codemode: false`. Its public input has only `operation`, `input`, and optional `run_id`; it is not five separately registered tools. The exported `createWikidataOracleBridge` exposes `execute(request, context)` and `dispose()`. Host-added aliases or prefixes are not names defined by this source.

The tool returns the serialized response in `Tool.Result.content`. If the host saves a large response in a managed output file, the command requires reading that exact delivered file before using its evidence. An unreadable response requires closing and stopping, not selecting unseen records or falling back to shell retrieval.

Sources: `_scripts/wikidata-integration/index.mjs:6–13,214–288`; `.opencode/plugins/wikidata-oracle.js:1–3`; `.opencode/commands/annotate-post.md:58–73`.

## Transport and Lifecycle

*[JSON Lines (JSONL)](../glossary.md)* means one UTF-8 JSON request or response per newline-delimited frame on the Ruby process's stdin/stdout. Requests are serial; the bridge generates protocol fields rather than accepting model-selected request IDs. Its actual frame construction is:

```javascript
const frame = JSON.stringify({
  protocol_version: 1,
  request_id: requestID,
  operation: request.operation,
  ...(request.run_id ? { run_id: request.run_id } : {}),
  input: request.input,
}) + "\n";
```

Each CLI request requires integer `protocol_version: 1`, a nonempty process-unique `request_id`, `operation`, and object `input`. Run operations after `open` also require the returned `run_id`. Responses contain `protocol_version`, `request_id`, `operation`, `run_id`, `status`, `result`, `error`, `warnings`, and `budget_remaining`; unavailable values use `null` and warnings default to `[]`.

Normal progression is `open → discover/expand → validate → close`; retrieval may repeat within shared limits. One process permits one successful opening. A well-formed validation attempt finalizes the run, accepted or not, and only `close` remains allowed. Malformed validation input is rejected without finalizing. EOF ends the process but is not a confirmed run closure. CLI exit codes are `0` for regular termination even with operational errors, `2` for fatal framing/version or launcher errors, and `3` for internal/output failures.

The CLI flags `--root`, `--user-agent`, `--api-endpoint`, `--sparql-endpoint`, and `--limits-file` are **trusted launcher configuration**, not tool arguments or JSONL operations. The command forbids manual CLI launches as a fallback. Defaults use the Wikidata API and WDQS over HTTPS; HTTP is allowed only for loopback endpoints. The core does not follow redirects, and the user agent must contain a public project URL.

Sources: `_scripts/wikidata-integration/index.mjs:162–190`; `_scripts/wikidata-oracle.rb:42–125,201–215,491–522,537–578,1025–1029,1173–1192`; `docs/authoring-oracles.md:198–205,301–305`.

## Operations

### `open`

**Request:** `input` contains `post_path` and `concepts`. The path is relative to the trusted repository root. Every concept contains exactly `concept_id`, `label`, `language`, and `context`; IDs must be unique, and context must occur verbatim in the original document. The caller freezes this registry before opening and cannot add concepts during the run.

**Behavior:** Opens a regular file read-only, rejecting absolute paths, traversal, backslashes, and symlinks in path components. It checks canonical containment and the opened file's device/inode identity. The core's containment rule is repository-relative, not an implemented `_posts/`-only path restriction. Opening performs no network access.

**Response:** `snapshot_id`, target metadata, registered concepts, existing identities, effective limits, and TTL; the envelope supplies `run_id`. Target metadata includes relative/canonical paths, SHA-256, device, inode, and byte size. The snapshot hash binds original bytes and file identity. Existing identities are read from original frontmatter, not supplied as caller assertions.

**Source:** `_scripts/wikidata-oracle.rb:129–199,745–763`.

### `discover`

**Request:** `input.concept_ids` is a unique list of registered IDs, up to 20 per call by default.

**Behavior:** Uses Wikibase `wbsearchentities`, followed by `wbgetentities`; candidates are retrieved, not invented by the model. Entity lookup requests labels, descriptions, aliases, sitelinks, claims, and revision information.

**Response:** `concept_results`, `evidence`, and `coverage`. Candidates have opaque `candidate_id`, `concept_id`, QID, label, description, language, aliases, sitelinks, and `evidence_ids`. Concept statuses distinguish `ok`, `no_match`, `ambiguous`, `unavailable`, `unprocessed`, and `partial`. A unique search result is not automatic identity approval.

**Source:** `_scripts/wikidata-oracle.rb:218–293`.

### `expand`

**Request:** `input.selections` contains records with exactly `concept_id`, `candidate_id`, `evidence_ids`, `rationale`, and `hop`. The candidate must belong to that concept and run; cited evidence must be nonempty, delivered, and attached to that candidate. Hop count is 1–2 by default.

**Behavior:** Queries incoming and outgoing direct-property edges through portable SPARQL. The fixed property allowlist is `P31`, `P279`, `P366`, `P2283`, `P1547`, `P361`, `P527`, and `P144`; callers cannot supply arbitrary SPARQL.

**Response:** `seeds`, `nodes`, `arcs`, `paths`, `evidence`, and `coverage`. RDF values preserve URI/literal/blank-node type and applicable language/datatype. Arc direction remains subject → object; path traversal is separately `forward` or `reverse`. Graph evidence uses a `truthy` direct-property projection and marks qualifiers/references missing. This projection is not a proof of truth, and graph hops must not be converted into editorial prerequisite depth.

**Source:** `_scripts/wikidata-oracle.rb:23,295–411,702–713`; `_scripts/semantic-analysis-prompt.md:202–212`.

### `validate`

**Request:** Complete UTF-8 `proposed_document`, exact `acknowledged_snapshot_id`, and one explicitly typed decision per registered concept:

| `type` | Additional fields | Meaning |
|---|---|---|
| `select` | `concept_id`, `candidate_id`, `evidence_ids`, `rationale`, `proposed_sameAs` | Select a delivered candidate with its delivered evidence; identity must use its canonical `https://www.wikidata.org/wiki/Q…` URL. |
| `abstain` | `concept_id`, `reason` | Introduce no new identity; reasons are `ambiguous`, `no_match`, `unavailable`, `unprocessed`, or `insufficient_evidence`. |
| `preserve_existing` | `concept_id` | Keep an original `sameAs` unchanged, without certifying it. |

**Checks:** `snapshot`, `target_identity`, `body_bytes`, `frontmatter_scope`, `concept_preservation`, and `identity_provenance`. The core rereads the target and checks identity/hash. Only `knowledge_prerequisites` and `difficulty_computed.semantic` may differ semantically; body bytes must match exactly. Other frontmatter values and array order are preserved, although YAML formatting/comments are not certified byte-identical.

Existing prerequisite entries and their original fields must survive, except a `sameAs` change authorized by selection. An absent prerequisite list starts empty; a present malformed/null value is not silently normalized. YAML uses `safe_load` with permitted dates/times and aliases disabled. Every new recognized Wikidata identity must be authorized from this run's delivered candidates/evidence, including identities elsewhere in the proposed prerequisite list.

**Response:** Acceptance, assurance, `write_enforcement: "not_provided_by_core"`, snapshot/target, exact proposed SHA-256 and size, six checks, new/preserved identities, and bounded violations. Acceptance uses `assurance: "provenance_and_document_checks"`; rejection uses `none`. A changed target yields `invalidated`; an expired run cannot be accepted. The report neither writes the proposal nor certifies semantic metrics or the rationale's correctness.

**Source:** `_scripts/wikidata-oracle.rb:413–515,765–996`.

### `close`

**Request:** Empty `input` object and the current `run_id`.

**Response:** `closed: true`, `validation_outcome` (`not_attempted`, `accepted`, `rejected`, or `invalidated`), HTTP requests used, and active retrieval milliseconds used. Closing is allowed after expiration and does not validate or write anything. On confirmed close, the bridge stops/reaps the child and removes the session bridge.

**Source:** `_scripts/wikidata-oracle.rb:201–215,517–522`; `_scripts/wikidata-integration/index.mjs:133–140,203–210,269–272`.

## Budgets, Evidence, and Failure Handling

All batches share the same run limits; new batches do not replenish them.

| Limit | Default |
|---|---:|
| Active retrieval work / monotonic state TTL | 60 seconds / 30 minutes |
| HTTP attempts / retries per request | 30 / 2 |
| Registry concepts / concepts per discovery / candidates per concept | 100 / 20 / 5 |
| Distinct entities / hops / arcs | 100 / 2 / 200 |
| Original or proposed document / input JSONL frame | 128 KiB / 1 MiB |
| Cumulative output / terminal reserve | 4 MiB / 64 KiB |
| Local validation | 5 seconds |

Active retrieval time includes HTTP, parsing, retry waits, and retrieval processing, not idle time between model calls. Exhaustion stops further network work but does not prevent local validation before TTL expiry or subsequent closure. Trusted limits files may only reduce defaults; terminal reserve cannot drop below 64 KiB. The bridge additionally bounds buffered frames at 4 MiB; this does not enlarge the core's 1 MiB input limit.

Evidence records identify source (`api_search`, `api_entity`, or `wdqs`), source URL, retrieval timestamp, optional revision, entity/language, bounded descriptive data, statement or RDF bindings, projection, and `missing_fields`. API statement evidence can include rank, qualifiers, and references; unsupported or omitted details are reported, not invented. References establish provenance, not truth.

`candidate_id` and `evidence_id` are opaque run-scoped references, distinct from a QID. The core marks them delivered only after emitting the response. Output exhaustion replaces complete record collections with structured omissions instead of truncating JSON; omitted/unseen evidence cannot authorize a selection. Coverage reports counts, omitted IDs, completeness, and reason codes.

Global statuses are `ok`, `no_match`, `ambiguous`, `partial`, `unavailable`, `invalid_request`, `invalidated`, and `rejected`. Interpret them with the operation and per-concept results: retrieval `ok` is not validation acceptance. API errors, no matches, and network failures remain distinct. The command requires abstention when usable contextual evidence is absent or insufficient, preserving existing values rather than manufacturing replacements.

Sources: `_scripts/wikidata-oracle.rb:15–22,97–109,537–642,692–717,1025–1151`; `.opencode/commands/annotate-post.md:75–107`; `docs/authoring-oracles.md:207–234`.

## Session Binding and Writer Boundary

The plugin resolves its repository root from its source location and obtains the actual caller through `ctx.session.get({ sessionID })`. A bridge requires a trusted project ID, session ID, abort signal, and a real session directory contained within that root. It binds to the first verified session/project pair and rejects another pair or a foreign run ID. Requests are queued, subprocess arguments use `shell: false`, and responses must match the pending request ID. An abort marks the child failed, rejects the pending request, and sends SIGTERM. Disposal and confirmed close await child shutdown, escalating to SIGKILL after 750 ms if needed. Plugin unload disposes registration and remaining bridges.

The documented support scope is the current canonical checkout, not arbitrary worktrees. These checks do not establish universal filesystem-race protection or cancellation of an entire host session.

`/annotate-post` keeps analysis and the semantic proposal in memory. It proceeds only with response status `ok`, `accepted: true`, and a proposed hash matching the exact submitted bytes. The later annotation stage must carry both approved semantic fields unchanged while adding legacy series/audience/difficulty, Liquid link/image annotations, placement suggestions, hero/credit metadata, and social copy where applicable. Existing code blocks, Liquid tags, and already annotated links/images must be preserved.

Sources: `_scripts/wikidata-integration/index.mjs:28–42,83–159,193–288`; `.opencode/commands/annotate-post.md:44–112,114–274,373–382`; `docs/authoring-oracles.md:228–240,259–261`.

### Command-side assets and copy

The [command instructions](../../.opencode/commands/annotate-post.md) define these post-validation stages outside the oracle:

- **Step 8 — screenshots:** Capture `<!-- screenshot: <url> | <what to show> -->` placeholders into targeted `assets/images/<slug>-<n>.png` files and stage corresponding `cloudinary` tags in the article. This also applies to screenshot placements suggested by the image policy. Check sign-in on the origin first; if login is needed, pause for the user, asking at most once per run. Inspect/crop the PNG and list saved paths for user privacy review before committing. Any raw viewport capture must be outside the repository, cropped, then deleted; an unmatched target requires asking, not a full-page capture.
- **Step 9 — hero and credit:** When neither `master` nor `header.overlay_image` exists, try Unsplash, skipping after two unsuitable searches. Download the selected hero to `assets/images/posts/<slug>.jpg`, crop/resize it, and call `track_download`; stage `master`, `image_meta`, and `image_credit`. The caption carries Unsplash attribution. Generic credit fields are `author`, `author_url`, `source`, and `source_url`, individually optional but requiring at least `author` or `source`; the command delegates the credit line to the template, not body prose. An existing `master` without `image_meta` receives metadata instead.
- **Step 11 — offline social copy:** Stage copy only when `broadcast` is a mapping and *[`broadcast.sent`](../glossary.md)* is not `true`. Use configured channels, defaulting to LinkedIn/Mastodon when absent, and only formats described by `_scripts/broadcast.py::SOCIAL_COPY_PROMPT`. Keep existing channel text and `channels`, `sent`, and `*_image` untouched. New Italian copy follows that prompt, not the article-writing runtime, with YAML `|-` paragraphs and the script's `text_budget(channel, url)` allowance for the final URL/hashtag tail. Report written/kept/skipped per channel. This prepares reviewable text, not a broadcast-script run or Buffer submission; downstream handling is covered in [Social Broadcast](../modules/social-broadcast.md).

Screenshot/hero asset writes, generic `image_credit`, and `broadcast.<channel>` copy are **command-side outputs**, not new oracle operations or schema-approved semantic fields supplied by `validate`. Only the two semantic fields may change in its submitted proposal; changing these other fields there fails `frontmatter_scope`. Acceptance does not validate the later document against the full frontmatter schema. Browser authentication handoff and image privacy review are command/user responsibilities, not oracle guarantees.

Sources: `.opencode/commands/annotate-post.md:114–214,224–267,307–316`; `_scripts/wikidata-oracle.rb:122–125,460–486,776–789`.

### Final article write and earlier side effects

**Step 12** requires confirmed close/reaping before rereading the original and comparing it with the opened snapshot. A changed original means stop without writing the article and restart from a fresh run. Otherwise write the fully composed article exactly once, with no cleanup, awaited work, or intermediate writes between that final check and the write. Failures must not be reported as success.

The **single final write applies to the article document only**. Earlier screenshot/hero asset writes, downloads, and Unsplash tracking are not rolled back if the final unchanged-snapshot check fails. `close` closes the oracle run/process, not an asset transaction. The core remains consultive: its receipt covers the exact semantic proposal, not the subsequently transformed body, image/credit or social-copy correctness, all writer implementations, or every possible bypass/race.

Sources: `.opencode/commands/annotate-post.md:139–206,269–274`; `_scripts/wikidata-oracle.rb:485,517–522`; `_scripts/wikidata-integration/index.mjs:203–210,269–272`; `docs/authoring-oracles.md:228,259–261`.

## Recorded Verification and Outstanding Work

`docs/wikidata-oracle-e2e.md` records a **2026-10-13 fixture-specific PASS**, using actual `/annotate-post` command dispatch through an isolated OpenCode 2.0.24 host, plugin/bridge, Ruby core, and live Wikidata/WDQS. The recorded sequence covered all five operations, 20 candidates, 42 arcs, 28 HTTP requests, seven decisions, three new identities, abstentions, accepted validation, confirmed closure, and one final temporary-draft patch. An independent checker passed 41/41 checks; the recorded final offline regressions were 48 Ruby tests/401 assertions and six Node tests.

The reusable source fixture is unpublished and contains a Z shell exercise, a Markdown link inside code that must stay verbatim, an existing `xlink`, and optional Unix/POSIX background. The run used a temporary copy, authorized initial semantic annotation in memory, and subsequently removed that copy. Checksums of 37 pre-existing posts/drafts were unchanged; concurrent unrelated modifications mean this is not a clean-working-tree claim. Final YAML validation belonged to the independent checker, not the command's permission-denied YAML check.

These are recorded snapshot-specific observations, not new executions or deterministic golden semantic values. They do not prove correctness for other posts, worktrees, providers, SEO consumers, or universal writer security. The placement comments do not verify the current screenshot/hero asset stages, authentication/privacy handling, or step 11 social copy. No runtime tests, builds, command dispatches, or external-service calls/checks were performed for this **2026-10-20 documentation update**. The formal security audit remains **pending**, not passed.

The AST-based readability oracle described separately in `docs/authoring-oracles.md` is a frozen proposal with limited probes: `readability_analyze` is **not an implemented production tool**. Its proposed AST engine, CLI, and adapters must not be confused with this implemented Wikidata API.

Sources: `docs/wikidata-oracle-e2e.md:1–130`; `_scripts/wikidata-integration/fixtures/annotate-post.md:1–27`; `docs/authoring-oracles.md:82–89,158–184,252–261`.
