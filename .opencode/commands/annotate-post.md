# /annotate-post

Analyze the specified post and enrich it with semantic metadata, link
annotations, and image annotations using the blog's ontology.

## Task

1. The user provides a post path (e.g., `_posts/devops/2026-05-16-seo-automatico-jekyll.md`).

2. Read the post's full content (frontmatter + body).

3. Analyze the post for deep semantic attributes using the instructions
   in `_scripts/semantic-analysis-prompt.md`. Produce the
   `difficulty_computed.semantic` JSON block.

4. Inject the semantic block into the post's frontmatter YAML under
   `difficulty_computed:`. Merge carefully with existing frontmatter
   (don't lose any existing fields).

5. Scan the body for plain Markdown links (`[text](url)`) and
   images (`![alt](path)`). For each:

   **Links to external URLs**: Replace with `{% xlink "url" "text" role="..." context="..." target="..." %}`.
   - Classify role: `citation`, `source`, `definition`, `tool`,
     `prerequisite`, `deepening`, `related`, `demo`, `download`,
     `attribution`, `commercial`
   - Classify context: `supports-claim`, `provides-context`,
     `enables-step`, `validates-result`, `credits-author`,
     `offers-alternative`, `extends-topic`
   - Classify target: `internal`, `external-authoritative`,
     `external-community`, `external-commercial`, `external-ugc`

   **Links to internal posts**: Replace with
   `{% post_link "/url/" "text" role="..." context="..." %}`.

   **Links to GitHub repo files** (matching the repository in
   `_config.yml`): Replace with
   `{% repo_url "path" "text" role="source" context="supports-claim" %}`.

   **Images**: Replace `![alt](path)` with
   `{% cloudinary /path alt="alt" caption="..." role="screenshot|diagram|chart|photo|illustration|code" context="step|result|architecture|comparison|reference|evidence|ambient" %}`.
   - Classify role and context based on surrounding text and image content.

6. If the post has `master:` but no `image_meta:`, add one:
   ```yaml
   image_meta:
     role: illustration
     context: ambient
     caption: "Brief description"
   ```

7. Add or update `intended_audience` and `proficiency_level` and
   `difficulty_declared` in the frontmatter based on the content analysis.

8. Write the modified content back to the file.

## Ontology Reference

- All roles, contexts, targets: see `frontmatter-schema.yml`
- Link → Schema.org mapping: see `_data/link_schema.yml`
- Image taxonomy: see `frontmatter-schema.yml` section "Image metadata"
- Difficulty/audience taxonomy: see `frontmatter-schema.yml` section
  "Content difficulty & audience"
- Full custom ontology: `metadata-schema.jsonld`

## Important

- **ONLY modify the specified post**, not others.
- **Preserve code blocks** (` ``` `), don't annotate links inside them.
- **Preserve existing Liquid tags** (`{% xlink %}`, `{% cloudinary %}`, etc.).
- **Use Shellwords.shellsplit-compatible quoting** in Liquid tags
  (double-quote paths and text).
- **Don't add role/context/target to links already annotated** with
  Liquid tags.
- **Verify the YAML is valid** after injection.
- **Report what was changed** in a brief summary.
