# /annotate-post

Analyze the specified post and enrich it with semantic metadata, link
annotations, image annotations, and knowledge prerequisites using the
blog's ontology.

## Architecture

This agent does the **deep semantic work** at authoring time. The
`difficulty.rb` plugin does **algebraic/calculative work** at build time:

- **LLM (now)**: Populates `knowledge_prerequisites`, `difficulty_computed.semantic`,
  `intended_audience`, `proficiency_level`, `difficulty_declared`, link/image annotations.
- **Plugin (build time)**: Merges lexical data (Gulpease), recomputes composite
  score, populates `termsdictionary` from all posts' prerequisites.

Formula changes in the plugin do NOT require re-running this agent.

## Series Detection

Before the main task, detect if the post belongs to a series:

- Look for `parte X` or `part X` pattern in the `title`
- Look for `{% post_link %}` references to other parts of the same series
- If the post appears to be part of a series, add a `series:` block:

```yaml
series:
  id: "<kebab-case-slug>"
  title: "<series title>"
  part: <N>
  total_parts: <M>
```

- `id`: derive from the post's URL slug, stripping `-parte-N` suffix (e.g. `dashboard-astrometria-parte-1` → `dashboard-astrometria`)
- `title`: extract from the `title` field, stripping `, parte N: ...` suffix (e.g. `"Il cielo in salotto, parte 1: Sistema Terra-Luna"` → `"Il cielo in salotto"`)
- `part`: the part number (1, 2, 3, etc.)
- `total_parts`: scan sibling posts in the same directory for matching series. Count all posts with the same `id` pattern. If uncertain, ask the user.

If the post has no series indicators, skip this step entirely.

## Task

1. The user provides a post path (e.g., `_posts/devops/2026-05-16-seo-automatico-jekyll.md`).

2. Read the post's full content (frontmatter + body).

3. Analyze the post for deep semantic attributes using the instructions
   in `_scripts/semantic-analysis-prompt.md`. Produce TWO JSON blocks:
   - `difficulty_computed.semantic` — quantitative metrics
   - `knowledge_prerequisites` — concept list with ontological grounding

4. Inject both blocks into the post's frontmatter YAML:
   - `difficulty_computed.semantic` under `difficulty_computed:`
   - `knowledge_prerequisites` under `knowledge_prerequisites:`
   Merge carefully with existing frontmatter (don't lose any existing fields).

5. Populate `intended_audience`, `proficiency_level`, and
   `difficulty_declared` in the frontmatter based on content analysis.

6. Scan the body for plain Markdown links (`[text](url)`) and
   images (`![alt](path)`). For each:

   **Links to external URLs**: Replace with `{% xlink "url" "text" role="..." context="..." target="..." description="..." %}`.
   - Classify role: `citation`, `source`, `definition`, `tool`,
     `prerequisite`, `deepening`, `related`, `demo`, `download`,
     `attribution`, `commercial`
   - Classify context: `supports-claim`, `provides-context`,
     `enables-step`, `validates-result`, `credits-author`,
     `offers-alternative`, `extends-topic`
   - Classify target: `internal`, `external-authoritative`,
     `external-community`, `external-commercial`, `external-ugc`
   - Get a suitable description: crawl the linked page and try to get a proper description of the resource. 

   **Links to internal posts**: Replace with
   `{% post_link "/url/" "text" role="..." context="..." %}`.

   **Links to GitHub repo files** (matching the repository in
   `_config.yml`): Replace with
   `{% repo_url "path" "text" role="source" context="supports-claim" %}`.

   **Images**: Replace `![alt](path)` with
   `{% cloudinary /path alt="alt" caption="..." role="screenshot|diagram|chart|photo|illustration|code" context="step|result|architecture|comparison|reference|evidence|ambient" %}`.
   - Classify role and context based on surrounding text, image content, caption and long description.

7. If the post has `master:` but no `image_meta:`, add one:
   ```yaml
   image_meta:
     role: illustration
     context: ambient
     caption: "Brief description"
   ```

8. For concepts that are **required** prerequisites but have no link in the
   article, consider adding an explicit `{% xlink %}` in the body at the
   first mention of the concept, pointing to Wikipedia or official docs. Consider annotating the link with the relevant Wikidata term, too.
   Use `role="prerequisite"` and `context="provides-context"` and `sameAs="<Wikidata Term"`>.

9. Write the modified content back to the file.

## Knowledge Prerequisites Guidelines

For the `knowledge_prerequisites` block, follow the full instructions
in `_scripts/semantic-analysis-prompt.md`. Key points:

- **Every concept** identified in the article gets an entry, including
  concepts that ARE defined inline (these get lower importance).
- `importance: "required"` = blocking (article can't be understood without it)
- `importance: "recommended"` = important but not blocking
- `importance: "helpful"` = enrichment / distant context
- `sameAs`: Wikidata URL for semantic grounding
- `depth`: prerequisite depth (0=common, 4+=specialist)
- `url`: external resource (Wikipedia, docs, official site)
- `concept`: canonical kebab-case identifier (consistent with termsdictionary)

**Blocking vs non-blocking heuristic**: Ask yourself "if the reader doesn't
know X, can they still understand the article and replicate the result?"
- Yes → `recommended` or `helpful`
- No → `required`

## Ontology Reference

- All roles, contexts, targets: see `frontmatter-schema.yml`
- Link → Schema.org mapping: see `_data/link_schema.yml`
- Image taxonomy: see `frontmatter-schema.yml` section "Image metadata"
- Difficulty/audience taxonomy: see `frontmatter-schema.yml` section
  "Content difficulty & audience"
- Full custom ontology: `metadata-schema.jsonld`
- Semantic analysis instructions: `_scripts/semantic-analysis-prompt.md`
- Existing glossary (for concept naming): `_data/glossary.yml`

## Image Placement Policy

After annotation, suggest optimal image placement for the post. Write your
suggestions as HTML comments — **one comment per placement, positioned inline at the exact body position where the image should go**, never as a single summary block at the end. Each comment must specify role and context.

### Article content type

First classify the post by its dominant structure:

- **narrative**: Long-form prose, linear exposition. Density target: 1 image every 400–500 words, minimum 1.
- **tutorial**: Step-by-step instructions with code/config. Density target: 1 image every 200–300 words. Every actionable step must have a visual.
- **conceptual**: Theory-heavy, definitional. Density target: 1 diagram per section plus one global overview.

### Placement rules

- An image **must** be adjacent to the paragraph it explains — never separated by unrelated text (prevents split-attention effect, Mayer spatial contiguity).
- Place images immediately after their section heading when introducing new concepts (supports layer-cake scanning pattern).
- Result images go **after** the steps that generate them (causal coherence).
- Architecture diagrams go **before** detailed explanation (pre-training principle).
- Do not cluster multiple images without text between them (reduces cognitive overload).

### Role selection by context

- `context=architecture` → use `role=diagram`
- `context=step` → use `role=screenshot`
- `context=result` → use `role=screenshot` or `role=chart`
- High concept density (`concept_density > 2`) → prefer `diagram`
- High conceptual difficulty (`difficulty_declared.conceptual >= 4`) → add `diagram` and step visuals

### Decorative image policy

- Decorative images (`role=decorative`) are allowed **only** as hero/cover (`master:` header image).
- Decorative images **must not** appear inside the content body.
- Tangentially meaningful ambient images (`context=ambient`) are allowed for semantic priming.
- Purely unrelated stock images are forbidden.

### Cognitive load adaptation

- If `concept_density > 3`: increase diagram count by +1 per section.
- If `external_knowledge_demand > 4`: insert explanatory visuals earlier (pre-training).
- If `gulpease < 50` (very low readability): reduce visual density to avoid overload.
- If `definition_coverage < 0.6`: add a diagram or annotated screenshot for each undefined concept.

### Coherence checks

- An image must be explainable by nearby text. If the caption cannot be derived from the adjacent paragraph, the image is misplaced.
- The image role must match the section's intent (a diagram in a pure YAML listing is suspicious).
- Images should not introduce new unexplained concepts (avoids cognitive split).

### Accessibility requirements

- Every informative image must have meaningful `alt` text.
- `diagram` and `chart` roles require `long_description`.
- `decorative` images require empty `alt=""`.

These rules are derived from `frontmatter-schema.yml` and `metadata-schema.jsonld`.


## Important

- **ONLY modify the specified post**, not others.
- **Preserve code blocks** (` ``` `), don't annotate links inside them.
- **Preserve existing Liquid tags** (`{% xlink %}`, `{% cloudinary %}`, etc.).
- **Use Shellwords.shellsplit-compatible quoting** in Liquid tags
  (double-quote paths and text).
- **Don't alter annotations to links and images already annotated** but add missing ones.
- **Analyze math formulas and code** for semantic signals (cognitive load,
  prerequisites) even though they're excluded from word counts.
- **Verify the YAML is valid** after injection.
- **Report what was changed** in a brief summary.
