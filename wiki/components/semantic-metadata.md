---
title: "Semantic Metadata"
description: "Editorial taxonomies, runtime metadata derivation, and structured-data outputs in the Jekyll site."
category: "components"
language: en
source_files:
  - "_plugins/link_meta.rb"
  - "_plugins/post_link.rb"
  - "_plugins/repo_url.rb"
  - "_plugins/image_meta.rb"
  - "_plugins/cloudinary_url.rb"
  - "_plugins/readability.rb"
  - "_plugins/difficulty.rb"
  - "_plugins/series.rb"
  - "_plugins/validate.rb"
  - "_plugins/llms_full_generator.rb"
  - "_includes/seo.html"
  - "_includes/image_credit.html"
  - "_layouts/post.html"
  - ".opencode/commands/annotate-post.md"
  - "_data/link_schema.yml"
  - "_data/glossary.yml"
  - "frontmatter-schema.yml"
  - "metadata-schema.jsonld"
  - "docs/authoring-oracles.md"
  - "_posts/3d-printing/2026-06-18-openscad-tutorial-parte-2.md"
created: "2026-10-15"
last_updated: "2026-10-20"
---

# Semantic Metadata

## Purpose

This component turns editorial frontmatter and annotated Liquid tags into rendered links and images, in-memory reading indicators, series navigation data, *[JSON-LD](../glossary.md)*, and a text export for AI ingestion. It is a collection of Jekyll plugins and Liquid consumers, not a single schema-enforcement engine.

**Editorial annotations are inputs; arithmetic does not verify their meaning.** Audience, prerequisites, conceptual difficulty, link classifications, and image descriptions remain [author/LLM judgments](../concepts/governance-and-verification.md). The historical school-level and age strings attached to readability scores are lookup labels, not established educational requirements, reader-age assessments, or cognitive measurements. `docs/authoring-oracles.md` explicitly separates these boundaries from deterministic derivation.

## Props / Interface

| Input | Shape / values | Responsibility |
|-------|----------------|----------------|
| `intended_audience` | `general`, `curious`, `student`, `practitioner`, `specialist` | Editorial audience declaration. |
| `proficiency_level` | `beginner`, `intermediate`, `advanced`, `expert` | Editorial competence declaration. |
| `difficulty_declared` | `conceptual`, `technical`, `mathematical` numbers | Editorial axes; schema documents 1–5 for the first two and 0–5 for mathematics. |
| `knowledge_prerequisites` | Array of `concept`, `label`, optional `url` / `sameAs`, `importance`, `depth` | Annotated concepts; importance is `required`, `recommended`, or `helpful`. `sameAs` expresses an identity judgment, not a consequence of URL validity. |
| `difficulty_computed.semantic` | Annotated semantic metrics | Despite its parent name, this block is supplied by authoring analysis, not inferred by the Jekyll difficulty plugin. |
| Link tags | `xlink`, `post_link`, `repo_url` with `role`, optional `context` / `target` | Editorial link classification, interpreted during Liquid rendering. |
| `master` + `image_meta` | Image path plus semantic image hash | Frontmatter input for the master image. |
| `image_credit` | Optional `author`, `author_url`, `source`, `source_url` strings | Separate visible hero-credit input; not part of the `image_meta` whitelist or an automatic structured-data creator mapping. |
| `cloudinary` tag | Path, `alt`, caption and semantic attributes | Body-image input; `alt` belongs to the tag, not the frontmatter `image_meta` hash. |
| `series` | `id`, `title`, `part`, `total_parts` | Editorial membership and declared numbering; generated navigation fields are separate. |
| `_data/glossary.yml` | `term`, `description`, `url` records | Static editorial glossary consumed by SEO and merged into the runtime dictionary. |

`frontmatter-schema.yml` describes these interfaces. Actual accepted values, coercions, and fallback behavior come from the Ruby implementations; descriptive schema text alone does not establish enforcement.

## Usage

The following excerpts come from `_posts/3d-printing/2026-06-18-openscad-tutorial-parte-2.md`; they show authored inputs, not verified rendered output.

```yaml
intended_audience: practitioner
proficiency_level: intermediate
knowledge_prerequisites:
- concept: openscad
  label: OpenSCAD
  url: https://openscad.org/
  sameAs: https://www.wikidata.org/wiki/Q3353120
  importance: required
  depth: 2
```

```liquid
{% post_link /3d-printing/openscad-tutorial-parte-1/ "prima parte" role="prerequisite" context="provides-context" target="internal" %}
```

The same post supplies master-image metadata independently of its image path:

```yaml
image_meta:
  role: illustration
  context: ambient
  caption: Vista ortografica del passacavo parametrico con innesto a baionetta
```

## Link Taxonomy and Rendering

### Role, context, and target

`_plugins/link_meta.rb` defines three independent dimensions: what the link is (`role`), its narrative function (`context`), and its destination classification (`target`). The runtime role mapping matches `_data/link_schema.yml`, but the plugin uses its own `SCHEMA_MAP` constant rather than loading that YAML mapping.

| Role | Structured-data grouping property |
|------|-----------------------------------|
| `citation` | `citation` |
| `source`, `prerequisite` | `isBasedOn` |
| `definition` | `about` |
| `tool` | `mentions` |
| `deepening`, `related` | `relatedLink` |
| `self` | `mainEntityOfPage` |
| `demo` | `workExample` |
| `download` | `downloadUrl` |
| `attribution` | `creator` |
| `commercial` | `offers` |

Contexts are `supports-claim`, `provides-context`, `enables-step`, `validates-result`, `credits-author`, `offers-alternative`, and `extends-topic`. Targets are `internal`, `external-authoritative`, `external-community`, `external-commercial`, and `external-ugc`. These are declared classifications, not independently verified assessments of destination authority.

`LinkMeta.validated` rejects missing/unknown roles and discards invalid context or target values. It does not verify that an arbitrary URL exists or supports a claim. `LinkMeta.parse` reads URL/text positionally or by key and recognizes `role`, `context`, `target`, `doi`, `file_type`, `file_size`, `disclosure`, and `name`.

### Tag-specific behavior

- **`xlink`:** renders nothing if metadata validation fails. Otherwise it appends an object to `page.link_objects`, derives a canonical name from the URL host when no name is supplied, and emits link-role classes, an optional icon, disclosure, and file information. Missing/invalid target falls back to internal HTML behavior. External classifications open a new tab with `noopener`; community/UGC add `ugc` and `nofollow`, while commercial uses sponsored semantics.
- **`post_link`:** resolves a post by normalized URL or supported source/date-slug references and honors the site's `future` setting. It adds metadata only when a supplied role validates, with an internal target default. An unresolved reference becomes supplied text or the reference itself, with a warning deduplicated until site reset.
- **`repo_url`:** requires `site.repository`, a contained existing source path, and no `..` in the supplied path. It builds a GitHub `blob/main` URL and uses an external-authoritative metadata default when a role is supplied. Missing configuration or invalid/missing paths warn and fall back to text.

`post_link` and `repo_url` render their own anchors; they do not inherit all of `xlink`'s HTML `rel`, `target`, disclosure, and download presentation behavior.

**Propagation gap:** `description` and `sameAs` may appear in authored link tags, but the current link parser/normalizer does not preserve them in `link_objects`, and the link JSON-LD consumer does not emit them. This differs from prerequisite `sameAs`, which is retained in the runtime terms dictionary. See the implementation inventory in `docs/authoring-oracles.md`.

## Image Taxonomy and Collection

`_plugins/image_meta.rb` recognizes roles `decorative`, `screenshot`, `diagram`, `chart`, `photo`, `illustration`, and `code`; contexts are `step`, `result`, `architecture`, `comparison`, `reference`, `evidence`, and `ambient`. It normalizes caption, long description, step number, comparison path, and `representativeOfPage`.

These are whitelisted semantic fields. Photographer/source fields and the separate `image_credit` mapping are not parsed or merged into `image_objects`.

- Missing/invalid role yields no semantic image object; invalid context becomes absent.
- A positive `step` outside `context=step` is removed with a warning. `compare_with` outside `context=comparison` is likewise removed.
- A diagram/chart without `long_description` warns but is still accepted. The parser does not enforce the converse requirements that every step/comparison context must contain a step/comparison value.
- Decorative images are excluded from `image_objects`.

`_plugins/cloudinary_url.rb` separately renders body-image HTML. Decorative tags get empty alternative text and presentation semantics; other tags produce a figure, optional caption, and extended description for diagram/chart roles. Step context can add a figure ID, comparison metadata a data attribute, and ambient context presentation classes. These HTML paths are separate from `ImageMeta.parse`; they should not be assumed to share all validation rules.

**Collection timing limitation:** the image aggregation hook runs at site `pre_render`, reading `master`/`image_meta` and any already-present `image_meta_body`. However, the `cloudinary` tag appends `image_meta_body` during rendering. The aggregator also skips a post when `image_objects` already exists. These phases do not demonstrate that newly rendered body-image metadata reaches the same build's SEO output. Body-image completeness and repeated-build behavior require lifecycle verification; no such output verification is claimed here.

### Hero credit versus semantic metadata

`frontmatter-schema.yml` documents `image_credit` independently of `image_meta`. `_layouts/post.html` includes `_includes/image_credit.html` immediately after article content and before series navigation. The include tests `credit.author or credit.source` using *[Liquid](../glossary.md)* truthiness, not a trimmed/nonblank check: empty strings remain truthy, URLs alone do not enable the line, and no hero-image or role check is made. Names and corresponding optional URLs are HTML-escaped; this is not URL-scheme validation or schema enforcement. See [Site Presentation](./site-presentation.md#hero-credits-and-alternative-text) for localized labels, link attributes, and hero alt selection.

The include writes anchors directly with `link-meta link-role-attribution` classes; it does not invoke `xlink` or append `link_objects`. These classes therefore do **not** automatically create structured link records or `ImageObject.creator`. `_includes/seo.html` does not consume `image_credit`. Visible footer attribution, hero caption/alt, and semantic image collection remain separate paths.

## Command-Side Annotation Inputs

`.opencode/commands/annotate-post.md` describes additional authoring-time work, not metadata generated by the Ruby plugins:

- **Screenshots:** screenshot-comment placeholders supply a URL and what to show; the command instructs browser capture and replacement with a local `cloudinary` tag carrying `alt`, caption, role, and context.
- **Hero:** when both `master` and `header.overlay_image` are absent, best-effort image selection can supply `master`, `image_meta`, and `image_credit`. For an Unsplash selection, the command places the returned `attribution_text`, including the photographer's name, in `image_meta.caption`, which the post layout uses as nondecorative hero alt text. It separately fills `image_credit` for the template-rendered footer line, not a duplicate body credit.
- **Social:** for an eligible unsent `broadcast` mapping, the command drafts missing `broadcast.<channel>.text` and `hashtags`, preserving existing text and image configuration. See [Social Broadcast](../modules/social-broadcast.md#authoring-time-copy) for channel rules, prompt/budget handling, and downstream assembly rather than treating these as SEO-derived fields.

The command validates a draft limited to `knowledge_prerequisites` and `difficulty_computed.semantic` before these later transformations. Screenshot, hero/credit, and social-copy additions are outside that accepted semantic draft; *[oracle](../glossary.md)* acceptance does not validate the final transformed document or certify those outputs. Command instructions are not evidence that capture, retrieval, attribution tracking, or publication occurred.

## Runtime Derivation

### Readability

At site `pre_render`, `_plugins/readability.rb` computes `post.data.readability` only when it is not already present. It works on a duplicate of `post.content`, using regular expressions to remove selected SVG, backtick fences, inline code, comments, Liquid tokens, HTML tags, URLs, and Markdown decoration. It is **not an AST parser** and does not implement the proposed oracle's Markdown/Liquid/math extraction policy.

Words are whitespace-separated tokens; fewer than ten yields no result. Sentences are counted with punctuation including semicolons, with a minimum of one. Letters use a restricted Latin/Italian character set. The syllable heuristic counts individual Italian vowels per cleaned word with a minimum of one; it is not phonological syllabification.

With `W` words, `N` sentences, `L` letters, and `S` estimated syllables:

- Flesch–Vacca: `206 - 0.65 * (100 * S / W) - W / N`.
- GULPEASE: `89 - (100 * L / W) / 10 + 3 * (100 * N / W)`.

Both exposed scores are bounded to 0–100 and rounded to one decimal. The result also includes counts, average sentence length, labels, historical educational/age strings, and a source string. Label selection follows the actual Ruby range cases, not the proposed oracle's continuous threshold contract. Calculation errors are logged as warnings.

### Difficulty and display fields

`_plugins/difficulty.rb` preserves the supplied semantic block and adds/overwrites `difficulty_computed.lexical` from readability, including reading time `max(1, ceil(word_count / 150))`. It generates `difficulty_composite`, a translation-key label, audience key, display strings, and a comma-separated list of required prerequisites. If computed data, label, and composite are already present, its guard skips injection; neither this plugin nor readability guarantees unconditional fresh recomputation.

The composite uses positive declared axes after integer conversion, an inverted positive GULPEASE score, and an arithmetic combination of supplied semantic metrics:

| Semantic contribution | Weight within semantic score |
|-----------------------|------------------------------|
| Concept density | 20% |
| Prerequisite depth | 25% |
| Inverse definition coverage | 15% |
| External-knowledge demand relative to concept density | 15% |
| Blocking prerequisite pressure | 15% |
| Mean math/code density | 10% |

Declared, lexical, and semantic scores have nominal weights of 40%, 30%, and 30%, renormalized over components whose scores are positive. Missing or zero definition coverage uses a fallback inverse-coverage contribution of 2.5, so an absent semantic block does not necessarily produce a zero semantic score. `concept_count` and `jargon_ratio` are not used by this formula. The supplied `blocking_prerequisite_count` is not automatically replaced by a recount of the prerequisite array.

This is deterministic arithmetic over supplied inputs, not a validated measure of comprehension or cognitive load. Beginner/audience mismatches, low definition coverage, and disagreement with declared difficulty can produce warnings; long estimated reading time produces an informational message. The separate `pre_render` hooks do not constitute the explicit ordered injection adapter proposed in `docs/authoring-oracles.md`.

### Terms dictionary versus static glossary

`Difficulty.build_termsdictionary` creates `site.data.termsdictionary` in memory from all posts' prerequisites. It normalizes prerequisite concept IDs by trimming and lowercasing, preserves the first label, fills missing URL/`sameAs` from later entries, takes maximum depth, records unique post URLs, and sorts by descending `post_count`. The count increments per prerequisite occurrence, so duplicate concepts within one post can inflate it relative to the unique URL list.

The static glossary is merged using a separately slugified term key, without replacing existing concept entries. This does not establish synonym identity. Crucially, `_includes/seo.html` still reads **`site.data.glossary`**, not the generated dictionary, for `DefinedTerm` output. The oracle inventory reports no identified runtime template consumer for `termsdictionary`; descriptions in schema files that promise SEO/search integration are not proof of that integration.

### Series aggregation

At site `post_read`, `_plugins/series.rb` groups posts by `series.id` and sorts by **date**, not `series.part`. Each member receives `series.posts`, previous/next records, total reading time, and an approximate difficulty label. The editorial title, part, and total-parts declarations remain inputs.

Series reading time counts raw content with a word regex and divides by 150; it is not the cleaned readability count. Series difficulty uses the maximum declared three-axis average among members and its own threshold table, not the article composite. Missing axes count as zero in that three-axis average. Series estimates therefore should not be presented as equivalent to per-article indicators.

## Structured Data and AI Ingestion

`_includes/seo.html` combines ordinary title/description/canonical/social metadata with conditional JSON-LD blocks:

| Output | Data actually consumed |
|--------|------------------------|
| `BlogPosting` for dated pages; otherwise `WebSite` | Identity, author, dates, image, language; article audience/proficiency, tags, prerequisite label/URL, lexical reading time and readability properties when present. Prerequisite `sameAs`, importance, and depth are not serialized here. |
| `ItemList` | Declared series title/`total_parts` plus the generated, date-ordered post list; item positions come from iteration order. |
| `BreadcrumbList` and `Person` | Categories, page identity, author details, and author profile links. |
| `DefinedTerm` / `DefinedTermSet` | Static glossary: article terms selected by URL containing `page.category`; the complete set on non-article pages. |
| `ImageObject` array | Existing `page.image_objects`: content URL, caption, representative flag, role/context/step/comparison properties. Neither stored long description nor `image_credit`/`creator` is serialized by this block; it does not create a `HowToStep` graph. |
| Link-bearing `WebPage` | `page.link_objects` grouped by `schema_prop`, with `CreativeWork` URL/name, `gb:link_role`, optional context/target, and DOI identifier. |
| Mermaid `SoftwareSourceCode` | A conditional descriptor when `page.mermaid` is present, optionally including `page.mermaid_diagram_type`; this block does not embed diagram source text. |

`metadata-schema.jsonld` is a descriptive `DefinedTermSet` for custom vocabulary, including future-labelled cognitive fields and policy concepts. It is not executable validation, and its broader descriptions must be distinguished from current consumers. The link block declares the site's `gb` namespace explicitly; other custom metrics are emitted as property IDs or template-specific fields. No claim of schema.org conformance or tested output follows merely from these mappings.

`_plugins/llms_full_generator.rb` registers a site `post_write` hook that writes `llms-full.txt` under `site.dest` and adds it to `keep_files`. It orders posts newest first and emits title/date/URL/excerpt, optional audience/proficiency/tags/category, prerequisite labels, and `post.content` with HTML tags stripped and excessive newlines collapsed. This is a text-ingestion export, not a dump of all semantic metadata, a complete HTML-to-text parser, or evidence that an external AI service has ingested anything.

## Validation and Known Boundaries

`_plugins/validate.rb` runs at `post_read`. It extracts field/type hints from the **text lines** of `frontmatter-schema.yml`; it does not execute a complete YAML/JSON Schema validator. It checks selected required string fields, recognized enums, integer/numeric hints, certain numeric ranges, local `/assets/` paths, broadcast-channel values, and `series.part > series.total_parts`.

These checks log warnings and a summary rather than deliberately failing the build for each violation. Array-item schemas and children of missing parents are skipped; general boolean/object/array shapes, prerequisite-item completeness, semantic correctness, and all documented co-occurrence constraints are not comprehensively enforced. For example, the explicit difficulty-axis range check accepts 0–5 for all three axes despite the stricter descriptive minimum on two axes. Successful warning-oriented validation is not proof that frontmatter or rendered JSON-LD satisfies the entire documented contract.

`docs/authoring-oracles.md` freezes a proposed AST/Unicode readability engine, CLI, provenance hashes, and controlled in-memory injection. Its readability roadmap remains blocked at T1: the production `readability_analyze` oracle is **not implemented or delivered**. Feature probes and a temporary probe registration do not replace the legacy Ruby plugin. The separately documented Wikidata read-only oracle concerns evidence and proposal checks; it does not turn lexical indexes or identity annotations into semantic truth.

This page is based on source inspection, including the new, untracked `_includes/image_credit.html`, not a deployed-site result. No build, tests, external calls, or rendered-output validation were performed for this documentation pass.

## Related Sources

- `frontmatter-schema.yml`: editorial field reference and descriptive constraints.
- `metadata-schema.jsonld`: published vocabulary descriptions, including planned concepts.
- `docs/authoring-oracles.md`: implementation census, propagation gaps, and current-versus-proposed derivation boundaries.
- `_includes/seo.html`: actual structured-data serialization, distinct from vocabulary promises.
- `_includes/image_credit.html` and `_layouts/post.html`: visible hero attribution, separate from semantic collection.
- `.opencode/commands/annotate-post.md`: staged authoring instructions and the scope of semantic-draft validation.
