---
title: "Wiki Log"
description: "Append-only history of wiki generation, its source baseline, verification limits, and outstanding concerns."
category: "root"
language: "en"
source_files:
  - "wiki/overview.md"
  - "wiki/architecture.md"
  - "wiki/getting-started.md"
  - "wiki/modules/blog-content.md"
  - "wiki/modules/governed-post-authoring.md"
  - "wiki/modules/opencode-integration.md"
  - "wiki/modules/author-consolidation.md"
  - "wiki/modules/author-review.md"
  - "wiki/modules/author-model.md"
  - "wiki/modules/cad-assets.md"
  - "wiki/modules/social-broadcast.md"
  - "wiki/components/site-presentation.md"
  - "wiki/components/semantic-metadata.md"
  - "wiki/api/native-author-tools.md"
  - "wiki/api/wikidata-oracle.md"
  - "wiki/concepts/governance-and-verification.md"
  - "wiki/config/build-and-automation.md"
  - "wiki/dependencies/dependency-map.md"
created: "2026-10-15"
last_updated: "2026-10-20"
---

# Wiki Log

## [2026-10-15] initial-generation | English project wiki catalog, operation log, and glossary

- Pages created: **25 total for initial generation** — 22 content pages created in preceding writer steps plus `wiki/index.md`, `wiki/log.md`, and `wiki/glossary.md` created by wiki-indexer in Step 5.
- Pages updated: 0 in this indexing step; all 22 existing content pages were read without modification.
- Pages deprecated: 0.
- Depth: **medium**, automatically selected from the supplied count of **52**; that input count was **not independently verified** as the actual repository count and is not the wiki page count.
- Commit: `55d1dfd99a64ddd84911c2fca1c5c89c4530e915` — supplied baseline HEAD, not a claim of a clean or frozen working tree.
- Catalog entries: 22 content entries and three support entries, 25 total.
- Glossary: alphabetical definitions with plain code-formatted source references; deliberately no content-page backlinks or term-anchor dependencies.

### Source snapshot and inspection method

- Documentation describes the **current working tree, including pre-existing uncommitted additions**. The baseline commit and a later `.last-updated-commit` watermark do not by themselves freeze or identify those uncommitted bytes. The coordinator owns watermark creation; the indexer did not create or change it.
- Codebase-memory refresh status: **`binary_found_no_refresh_script`**. The available indexed graph was only the unrelated `gabrielebaldassarre-agents` project. Repository source inspection was the fallback; **no codebase-memory refresh was performed**. These are supplied analyzer findings, not a newly refreshed graph or a new source-discovery run by the indexer.
- The analyzer's initial configuration-discovery command failed on the unmatched zsh `*.sln` glob. This was a discovery limitation, not evidence that the repository lacked configuration. The actual Jekyll, Make/Autoconf, container, OpenCode, editor/workspace, SEO, and workflow configurations are documented in the content pages.
- Generated output and installed/vendored dependency implementation directories were excluded from source analysis. Dependency manifests, lockfiles, and authored integration code were used to describe their boundaries; generated output was not inspected to establish publication behavior.
- All 22 content pages were read for their titles, descriptions, categories, dates, source references, and terminology before creating the three support files. Catalog descriptions derive from page frontmatter, with punctuation normalized where needed.

### Outstanding concerns and assurance limits

- **Package-manager mismatch:** `docs/post-authoring.md` documents `npm --prefix _scripts/author-extraction ci`, but the inspected package has `bun.lock` and no local `package-lock.json` or `npm-shrinkwrap.json`. An npm clean install is not verified for this checkout. No replacement lockfile was generated and no installation was attempted by this step.
- **Documentation exposure:** `_config.yml` lacks explicit `docs/` and `wiki/` exclusions. Whether these files reach public output is **unverified**; no site build or output inspection was performed, and the source configuration remains unchanged.
- **Evidence preservation:** this step did not edit source files, existing content pages, corpus declarations, reviewed artifacts, models, exact identifiers, or their recorded hashes. No source migration, review application, model promotion, runtime promotion, or release was performed. A documentation summary is not a fresh checksum verification of all source bytes.
- **No new execution claims:** no tests, builds, operational pipelines, provider/model calls, review decisions, releases, deployments, broadcasts, or Git commits were performed for this indexing step. Historical PASS statements and artifact counts remain attributed snapshot evidence, not newly reproduced results. No Paseo operations were performed.
- **Authority remains separate:** native review apply stays fail-closed; saved candidates do not replace the governed model. Retained semantic context is conceptual, not style. Rejected or discarded groups are not revived as operational instructions. Buffer draft processing is not confirmation of public social publication.

Future wiki operations must append new dated entries rather than rewriting this operation history.

## [2026-10-20] incremental-update | Creation/revision boundaries, annotation assets, authored social copy, and dependency guidance

- Pages created: **0**.
- Pages updated: **19 total** — **16 content pages** (13 substantive updates and three metadata-only repairs by delegated writers), plus `wiki/index.md`, `wiki/log.md`, and `wiki/glossary.md` updated by wiki-indexer. The other six content pages retain their earlier metadata dates; all page `created` fields are preserved. These are the final counts for this same incremental operation, not a new generation.
- Pages deprecated: **0**; no pages removed.
- Depth: **medium**, explicitly requested with the supplied **52 source files** count. That input was not independently verified as a repository-wide count and is not a wiki page count.
- Commit: `ffacd045bbc2a6759ff09a89410e872839202c93` — supplied current source HEAD. Previous watermark: `55d1dfd99a64ddd84911c2fca1c5c89c4530e915`. Neither SHA identifies a clean or frozen working tree.
- Catalog entries: **22 content pages + three support pages = 25**, unchanged in count. Titles, descriptions, and dates were read from all pages; unchanged content pages were not restamped.
- Glossary: eight terms added and four existing definitions refined; no terms removed. Alphabetical, case-insensitive ordering and plain source references are retained, without content-page backlinks or term-anchor dependencies.

### Content pages updated by the writers

The 13 substantive updates are:

- `wiki/architecture.md`
- `wiki/getting-started.md`
- `wiki/modules/blog-content.md`
- `wiki/modules/governed-post-authoring.md`
- `wiki/modules/opencode-integration.md`
- `wiki/modules/social-broadcast.md`
- `wiki/components/site-presentation.md`
- `wiki/components/semantic-metadata.md`
- `wiki/api/native-author-tools.md`
- `wiki/api/wikidata-oracle.md`
- `wiki/concepts/governance-and-verification.md`
- `wiki/config/build-and-automation.md`
- `wiki/dependencies/dependency-map.md`

Three additional pages received **metadata-only repairs** (`language: en` added and `last_updated` set to `2026-10-20`), with their bodies unchanged:

- `wiki/modules/author-consolidation.md`
- `wiki/modules/author-model.md`
- `wiki/modules/cad-assets.md`

### Source scope and inspection method

- This is **incremental documentation**, not initial generation. The existing wiki already described then-uncommitted code. Scope follows documentation impact, not an assumption that every one of the supplied 185 changed tracked paths requires a rewrite.
- Coverage includes committed changes since the previous watermark and the inspected **working-tree/untracked inputs**. The supplied source snapshot includes the original six tracked edits to `.opencode/commands/annotate-post.md`, `_data/ui-text.yml`, `_drafts/batterie-home-assistant-ricarica-stimata.md`, `_layouts/post.html`, `_scripts/broadcast.py`, and `frontmatter-schema.yml`, plus the untracked `_includes/image_credit.html` and two image assets: `assets/images/posts/batterie-home-assistant-ricarica-stimata.jpg` and `assets/images/batterie-home-assistant-ricarica-stimata-1.png`. These inputs are not newly created by the wiki task. Documenting the image references does not establish privacy, licensing, rendering, or live-service success.
- Codebase-memory status remains exactly **`binary_found_no_refresh_script`**. The coordinator's read-only MCP `list_projects` call found only the unrelated `/Users/gabriele.baldassarre/dev/gabrielebaldassarre-agents` project, not a graph index for this repository. Targeted source-file inspection was the fallback; **no refresh or reindex was attempted**. The indexer read wiki metadata and relevant page bodies without running source-discovery or operational tools.
- No application source, draft, image, reviewed artifact, model, corpus declaration, or existing content page was edited by the indexer. The original operation above remains historical evidence; only support-page metadata and this appended entry change its surrounding log file.
- The coordinator completed the documentation-only checks recorded below. **Final post-finalization validation and watermark advancement remain pending closure**; the coordinator will write `ffacd045bbc2a6759ff09a89410e872839202c93` as the final watermark step. The indexer did not change `wiki/.last-updated-commit`. A watermark is a commit reference, not a snapshot of uncommitted bytes.

### Documentation-only verification and same-operation resolution

- **Frontmatter and language warning resolved:** the coordinator parsed YAML frontmatter in all 25 pages. Its mandatory-key check identified only the three missing `language` fields previously reported by the indexer. A delegated writer has now added `language: en` and updated the dates in the three metadata-only pages listed above, without changing their bodies. The indexer reread current catalog metadata across all 25 pages and refreshed the three dates; these missing-language warnings are **resolved**, not outstanding.
- **Mechanical documentation checks completed by the coordinator:** every `source_files` target exists, every relative Markdown-link file target exists, and `git diff --check -- wiki` passed. These results precede this support-page finalization; the final coordinator recheck is not yet claimed.
- **Non-wiki source preservation:** the coordinator reports that its SHA-256 manifest of **all tracked and untracked non-wiki files** is unchanged from the operation's starting state. This is a documentation-task preservation result, not a claim of a clean working tree or an application-test result; existing working-tree and untracked inputs remain part of the documented snapshot.
- **Read-only documentation audit:** the coordinator's general audit found no blocking factual discrepancies. One writer-owned wording correction in `wiki/api/native-author-tools.md` clarified that actual host permission assertions occur after read-only planning/runtime compilation but before filesystem **writes** or process execution. This is distinct from the callable-capability check that precedes planning. No live host behavior or security certification is established by this documentation audit.

### Updated contracts and distinctions

- **Creation versus revision:** new-post preparation remains create-only and invokes Rake; explicit existing-article revision does not run Rake or edit the article during preparation. Revision preserves an immutable original snapshot, approved reference excerpts, and comparison context. Both routes share one active-article slot per session and session-local runtime injection; revision additionally injects its verified reference context. A current quote/hash-bound editorial comparison is required for revision completion, but remains a candidate pending human review, not voice validation, human approval, or model promotion.
- **Host capability versus release authority:** preparation checks the running host's callable `permission.assert` and fails with `AUTHOR_POST_HOST_UNSUPPORTED` before planning/writes when unsupported. When supported, read-only planning/runtime compilation precedes the actual edit/shell permission assertions, which gate filesystem writes/process execution. The documented host minimum is OpenCode **2.0.29+**; the author package separately pins SDK **2.0.31**, while Wikidata independently pins SDK **2.0.24**. Package versions do not prove installed host capabilities. Edit/shell permission assertions do not supply human release authorization; native review apply still fails closed with `AUTHORIZATION_UNAVAILABLE`.
- **Installation guidance supersedes the earlier discrepancy:** the current operator guide documents `bun install --cwd _scripts/author-extraction --frozen-lockfile`. The earlier `npm ci`/missing npm lockfile warning remains intact in the 2026-10-15 history, but is not the current guide's installation instruction. The Bun and Wikidata npm locks remain independent; no installation or service restart validated the new guidance.
- **Annotation assets and attribution:** screenshot placeholders require authentication handoff when needed, targeted capture, cropping/raw-capture handling, and user privacy review. Unsplash hero selection is best effort only when both hero fields are absent. Generic `image_credit` supplies localized visible attribution via the template; `image_meta`, hero alt text, and semantic collection are separate. Oracle acceptance covers the narrow semantic draft, not later image/social transformations. A single final article write is not a rollback-capable transaction for earlier asset writes or external effects.
- **Authored social copy and final assembly:** annotation stages reviewable `broadcast.<channel>.text`/hashtags without running Buffer or GitHub Models. The pipeline prefers usable nonblank authored strings per requested channel and generates only missing copy. Its separate social prompt, `text_budget` with a fixed 40-character hashtag reserve, case-insensitive appended-tag deduplication, and normally body-only truncation govern final assembly; authored wording is not byte-preserved by that pipeline. Buffer drafts and a sent-marker proposal remain distinct from public social publication.
- **Ignore rules versus site output:** root-anchored Git ignores cover local creation/revision evidence, but do not change Jekyll's exclusion configuration or establish that documentation is private.

### Outstanding concerns and assurance limits

- **Documentation exposure remains unverified:** `_config.yml` explicitly excludes neither `docs/` nor `wiki/`. No build or output inspection established their public exposure, and no source configuration was changed.
- **Pathological social tails remain unresolved:** oversized URL/tag tails in the current `build_post` can discard tags, still exceed the limit, or raise `IndexError`. This source behavior is documented, not repaired or freshly tested.
- **No new application execution or approval evidence:** no application tests, builds, installs, application pipelines, external/provider calls, live host checks, human review decisions, review application, model/runtime promotion, release, deployment, broadcast, or Git commit was performed for this indexing step. Historical tests, mock/integration checks, and live fixture PASS statements retain their original dates and scope. The completed documentation-only controls above do not establish new application-test or live-service evidence.
