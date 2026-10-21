---
title: "Social Broadcast"
description: "Authored social copy, targeted model generation, final-text assembly, Buffer drafts, and reviewable sent-marker proposals."
category: "modules"
language: en
source_files:
  - "_scripts/broadcast.py"
  - ".opencode/commands/annotate-post.md"
  - ".github/workflows/broadcast-social.yml"
  - ".github/workflows/collect-incubator-pr.yml"
  - ".github/workflows/cleanup-work-branches.yml"
  - "frontmatter-schema.yml"
created: "2026-10-15"
last_updated: "2026-10-20"
---

# Social Broadcast

## Purpose

The social broadcast pipeline reads eligible blog posts and prefers authored channel copy stored in *[Frontmatter]* (see [Glossary](../glossary.md)). It prepares channel-specific *[Cloudinary]* (see [Glossary](../glossary.md)) images, generates only missing requested copy through GitHub Models, and creates **Buffer drafts**. It proposes the resulting *[broadcast.sent]* (see [Glossary](../glossary.md)) changes through `work/broadcast/*` branches collected into an *[incubator]* (see [Glossary](../glossary.md)) pull request targeting `main`.

This is a **separate legacy social-copy path**. `_scripts/broadcast.py` and the authoring-time annotation command share the literal `SOCIAL_COPY_PROMPT` for social voice. The [governed author runtime](./author-runtime.md) serves article writing separately; model fallback here belongs to the broadcast script. `broadcast.sent: true` records successfully processed Buffer draft targets. Public social publication remains a separate action.

Sources: `_scripts/broadcast.py:74–125,202–221,275–393,641–703,839–912`; `.opencode/commands/annotate-post.md:224–267`; `.github/workflows/broadcast-social.yml:131–182`.

## Key Files

| File | Role |
|------|------|
| `_scripts/broadcast.py` | Frontmatter parsing, eligibility, authored-copy selection, missing-copy generation, text assembly, image URLs, Buffer drafts, and local sent-marker updates. |
| `.opencode/commands/annotate-post.md` | Step 11 drafts reviewable social copy during annotation and preserves existing channel text. |
| `.github/workflows/broadcast-social.yml` | Post selection after deployment or manual dispatch; script execution; per-post work branches and collector dispatch. |
| `.github/workflows/collect-incubator-pr.yml` | Collects *[work/\*]* (see [Glossary](../glossary.md)) contributions into `incubator` and creates or updates a PR targeting `main`. |
| `.github/workflows/cleanup-work-branches.yml` | Deletes work branches whose heads are ancestors of `main`; removes `incubator` after its merged PR. |
| `frontmatter-schema.yml` | Reference notation for broadcast configuration, authored text/hashtags, and per-channel images; executable assembly and image behavior qualify its comments. |

## Public API

The executable interface accepts one or more post paths, optionally with `--posts`, plus `--dry-run`. Missing files or any explicit `False` post result produce exit status 1; disabled/already-sent posts return `None` and do not by themselves fail the run. A dry run parses the post and reports its settings without calling the model, Buffer, or image warmup, and does not write frontmatter. It returns before copy selection and assembly, so it does not preview final post lengths.

| Function | Responsibility |
|----------|----------------|
| `get_broadcast_config(fm)` | Normalizes boolean, list, or mapping broadcast settings. |
| `get_frontmatter_copy(fm, channels)` | Selects nonblank string `broadcast.<channel>.text`, strips its outer whitespace, and collects optional hashtags. |
| `get_post_info(fm, body, filepath)` | Builds model context and the article URL from the filename and parent directory. |
| `text_budget(channel, url)` | Calculates the body allowance using the channel limit, URL length, separators, and fixed hashtag reserve. |
| `unique_hashtags(text, hashtags)` | Deduplicates appended tags case-insensitively, including tags detected inline in the body. |
| `build_post(text, post_url, hashtags, max_chars)` | Assembles the final post and returns it with the number of body characters removed. |
| `cloudinary_social_url(master_path, social_config, post_title, channel_type)` | Builds transformed image URLs with optional caption and logo composition. |
| `call_github_models(post_info, active_channels)` | Requests copy for the supplied missing channels, trying the primary model and then the script's fallback model. |
| `get_buffer_channels()` | Resolves service names to channel IDs in the first Buffer organization returned. |
| `create_buffer_draft(channel_id, text, photo_url=None, retries=3, label="")` | Creates a draft, with retry and image-free fallback behavior. |
| `broadcast_post(filepath, dry_run=False)` | Runs the per-post pipeline and conditionally updates its sent marker. |

Sources: `_scripts/broadcast.py:74–76,176–221,239–306,412–525,564–614,641–703,715–953`.

## Dependencies

```mermaid
graph LR
    Annotation["annotate-post social copy"] --> Posts["Post frontmatter and body"]
    Posts --> Broadcast["Broadcast workflow and Python script"]
    Broadcast --> Images["Cloudinary image fetch"]
    Broadcast -->|Missing requested copy| Models["GitHub Models legacy prompt"]
    Broadcast --> Buffer["Buffer drafts"]
    Broadcast --> Work["work/broadcast/* metadata proposals"]
    Work --> Collector["Collector"]
    Collector --> Review["incubator PR to main"]
    Review --> Cleanup["Ancestor-based branch cleanup"]
```

The broadcast workflow installs PyYAML and selects Python 3.14. The script otherwise uses Python standard-library modules, loads `site_logo` from `_config.yml`, and receives `CLOUDINARY_CLOUD_NAME`, `BUFFER_API_TOKEN`, and `GITHUB_TOKEN` from its environment. These are configuration/credential names, not embedded values. Broadcast, collection, and cleanup share the `work-pipelines` concurrency group with cancellation disabled.

Sources: `_scripts/broadcast.py:10–36,839–853`; `.opencode/commands/annotate-post.md:224–267`; `.github/workflows/broadcast-social.yml:15–42,106–119`; `.github/workflows/collect-incubator-pr.yml:12–14`; `.github/workflows/cleanup-work-branches.yml:12–14`.

## Eligibility and Channel Filtering

### Workflow selection

`Broadcast to Social` listens for completion of [`Deploy blog on Cloudflare Pages`](../config/build-and-automation.md) on `main` or `master`; the job proceeds only on a successful conclusion, unless manually dispatched. It checks out the triggering commit. A manual `post_path` is prefixed with `_posts/` and checked for existence; the script still applies its own broadcast eligibility rules.

Without an explicit path, the workflow scans `.md` and `.Rmd` posts, excluding files matching `broadcast: false` or `sent: true`. It also checks the corresponding remote `work/broadcast/{category-directory}-{slug}` branch for a sent marker before including files containing `broadcast:`. These are text searches, not YAML-aware checks: a matching string elsewhere in a file can affect selection.

Source: `.github/workflows/broadcast-social.yml:3–7,25–34,44–104`.

### Script configuration

| `broadcast` value | Script behavior |
|-------------------|-----------------|
| Missing, `null`, or `false` | Disabled. |
| `true` | Enabled with default channels. |
| List | Enabled with that list; an empty list uses defaults. |
| Mapping | Reads `channels` and `sent`; enabled unless `sent` is truthy. A string `channels` value becomes a one-item list. |

Defaults are `linkedin` and `mastodon`. A mapping's `enabled` field is not consulted. Channel names are matched as supplied against Buffer's lowercased service names; the script does not normalize requested names. Buffer discovery uses the first organization and stores one ID per service, so later channels for the same service overwrite earlier entries.

Requested channels absent from Buffer, or absent from `SOCIAL_CROPS`, are skipped rather than counted as failed draft targets. The missing-copy set is computed from the complete requested list, without intersecting it with Buffer availability or the crop table. A missing unavailable or unsupported channel can therefore still trigger a model request. Configured crop sizes and final text limits are:

| Channel | Image size | Final text limit |
|---------|------------|------------------|
| LinkedIn | 1200 × 627 | 800 characters |
| Mastodon | 1200 × 675 | 390 characters |
| Bluesky | 1200 × 675 | 300 characters |
| YouTube | 1280 × 720 | 5000 characters |

Sources: `_scripts/broadcast.py:38–67,176–221,564–614,777–778,839–879`.

## Social Images

The base image is `master`, falling back to `header.overlay_image`; otherwise drafts can be text-only. A nonempty `broadcast.{channel}_image` mapping can override the image with `overlay_image`. Without such a mapping, the script uses a basic Cloudinary fetch crop. With one, it constructs the social composition:

- Optional `keystone` or `cinematic` distortion, with `low`, `medium`, or `high` intensity and a safe crop afterward; otherwise a fill crop using `gravity` (default `auto`).
- Caption defaults to the post title when omitted or `true`; a false/empty caption disables it, and another truthy value supplies custom text. `color` defaults to white.
- A caption or logo adds a semi-transparent bottom bar. `logo: true` selects the site logo; a string can select a custom logo path/name. The script uses an 88-pixel circular logo.
- A colon splits the caption into a smaller first line and uppercase second line; otherwise the caption is uppercase on one line.

Only channels both available in Buffer and present in the crop table receive image preparation. Initial Cloudinary warmup makes up to five attempts; failure of any prepared image aborts that post **before** spending model tokens. During draft creation, images are warmed again, but that warmup result is not itself a gate on the Buffer call.

The reference schema documents a per-channel `overlay` foreground image, but this script never consumes it. Its logo/font implementation also differs from the schema's descriptive sizing comments; the executable code is authoritative for this path. The decorated URL builder returns no image when the cloud name is empty, whereas the basic URL builder has no equivalent guard.

Sources: `_scripts/broadcast.py:224–236,396–525,622–638,648–650,800–837`; `frontmatter-schema.yml:63–99`.

## Copy Selection and Social Voice

### Authoring-time copy

Step 11 of `/annotate-post` prepares copy for review before pushing when `broadcast` is a mapping and `broadcast.sent` is not `true`. It uses configured channels, defaulting to LinkedIn and Mastodon when absent, and handles only channels described by `SOCIAL_COPY_PROMPT`. Existing `broadcast.<channel>.text` is kept untouched, including manual edits. New text uses the whole article as context and YAML `|-` blocks with real paragraphs; `channels`, `sent`, and `*_image` stay unchanged. The command asks for a per-channel written/kept/skipped summary.

This authoring-time copy step follows the script's social prompt and body budget. Its preservation rule checks whether text already exists; the pipeline's separate usability check requires a nonblank string.

Sources: `.opencode/commands/annotate-post.md:224–267`; `_scripts/broadcast.py:202–221`; `frontmatter-schema.yml:48–61`.

### Pipeline precedence and model fallback

`get_frontmatter_copy` selects usable text for each requested channel and strips leading/trailing whitespace. Optional hashtags can be a list or a whitespace-separated string; list entries are converted to strings. Only requested channels missing usable authored text are sent to `call_github_models`, and returned entries are merged for those missing names. A complete authored set skips GitHub Models; Buffer discovery and any image warmup still run. If a missing-copy request fails, the entire post stops before creating drafts, including drafts whose manual copy was already available.

The model user prompt includes title, category, constructed article URL, excerpt, audience, proficiency, per-channel body budgets, and up to 1,500 characters of body text after stripping LaTeX and some Markdown. The URL uses the parent directory as the category path and the date-stripped filename as the *[Slug]* (see [Glossary](../glossary.md)); `canonical_url` is not consulted.

Requests go to GitHub Models with temperature `0.7`, first using `openai/gpt-4o`, then `openai/gpt-4o-mini` if the first attempt returns no truthy result. Missing `GITHUB_TOKEN` fails generation. Response handling strips Markdown code fences, parses JSON, and retries parsing after escaping literal newlines inside JSON strings. Failure of both models stops the post; there is no deterministic substitute copy.

The parsed JSON receives no channel-copy schema validation. An absent channel entry defaults to `{}` during draft assembly and can yield URL-only text. String entries supply the body with no separate tags; dictionary entries supply `text` and optional `hashtags`; other entry types are skipped.

Sources: `_scripts/broadcast.py:202–221,239–393,792–853,858–879`.

### Social prompt requirements

`SOCIAL_COPY_PROMPT` defines conversational Italian in an engineer's voice, with patient technical explanations, positive statements of approximation and limits, and occasional dry self-irony. It excludes contrastive negative comparisons and numerical metrics or configuration values from social copy; concrete details should describe mechanisms or observations, with the numbers left in the article.

- **LinkedIn:** Unicode-bold opening question, short paragraphs progressing toward a concrete article detail, and ordinary `#tag` syntax for inline hashtags. Remaining tags go in `hashtags`. A Unicode-bold closing question is optional when the budget allows.
- **Mastodon:** Concrete first-person opening, concise sentences, an article-specific detail, and trailing `#tag` hashtags.
- **Both:** Keep the article URL out of the body and use each hashtag once across body and appended tags. The literal prompt specifies LinkedIn and Mastodon formats; Bluesky and YouTube have crop/limit entries only.

Source: `_scripts/broadcast.py:78–125`.

## Text Assembly and Limits

Limits in `SOCIAL_CROPS` apply to the **assembled post**, including body, blank-line separators, URL, and appended hashtags. `text_budget(channel, url)` computes `max_chars - len(url) - 2 - 40`: two characters reserve the separator before the URL, and `HASHTAGS_RESERVE = 40` is a fixed allowance for appended tags and their separator. This heuristic is shared by annotation guidance and model requests; actual tag lengths can exceed the reserve.

`unique_hashtags` detects inline tags with `#\w+` and compares tag strings case-insensitively. It removes duplicates from the append list, including those already detected in the body. Repeated tags already inside the body remain unchanged.

`build_post` appends `\n\n` plus the article URL, followed by another blank line and space-joined tags when present. On overflow it trims only the body, attempts a word-boundary cut, removes trailing punctuation, and adds `…`, normally retaining the URL and tags. A single unbroken token can still be cut within the token. Authored text therefore supplies the preferred body, with outer whitespace stripped and the URL/tag tail recomposed; overflow can also change the reviewed wording.

Current edge cases limit fit guarantees:

- If the tail leaves no room for the shortened body and ellipsis, appended tags are discarded. An oversized URL can still produce an over-limit post.
- In the tag-discard branch, the recalculated room can retain an entire nonempty body; the subsequent `text[len(cut)]` access can then raise `IndexError`.

Sources: `_scripts/broadcast.py:38–76,283–298,715–751,867–887`; `.opencode/commands/annotate-post.md:239–265`; `frontmatter-schema.yml:52–61`.

## Buffer Drafts and Success Semantics

### Draft creation

Buffer calls use GraphQL `createPost` with `schedulingType: automatic`, `mode: addToQueue`, and, critically, **`saveToDraft: true`**. A returned post ID is treated as draft success; the script does not verify public publication.

The helper normally allows three attempts. Missing API results retry; errors containing `Not Found` or `image dimensions` retry; other mutation errors stop the image-bearing attempt loop. If image-bearing creation fails, it makes a final one-attempt text-only call. A successful text-only draft counts as success even though the requested image was not attached.

Source: `_scripts/broadcast.py:641–703`.

### Sent markers and partial success

`target_count` increases only immediately before an actual draft attempt, after channel/copy filtering. If no draft succeeds, the post fails. If at least one succeeds and all counted targets succeed, the script writes `broadcast.sent: true`; consequently, skipped requested channels do not prevent that marker. If some attempted targets fail, it returns `False` without setting the marker, but already-created Buffer drafts remain. No per-channel success state or rollback is recorded, so rerunning can duplicate those successful drafts.

Frontmatter updates deep-merge mappings, then serialize the complete YAML block with PyYAML; original formatting is not preserved exactly. When the old `broadcast` value was a boolean or list, replacing it with the sent mapping also loses that original shorthand channel configuration.

There is an additional workflow-level consequence: one explicit post failure makes the script exit nonzero, and the change-detection step runs only on `success()`. Thus drafts and local sent updates for other successful posts in the same invocation can exist without reaching work branches or the collector. The remote sent-marker check only helps when such metadata was actually persisted.

Sources: `_scripts/broadcast.py:145–173,858–912,930–949`; `.github/workflows/broadcast-social.yml:68–75,106–132,178–182`.

## Frontmatter Proposals and Review

When the broadcast step succeeds and post changes exist, the workflow saves each post, checks out or creates `work/broadcast/{category-directory}-{slug}` from `main`, refreshes an existing branch by merging `main`, and recreates it from `main` on a merge conflict. It copies the saved post back, commits, and pushes the work branch, then explicitly dispatches the collector.

The collector also listens for pushes to `work/**`. It starts from existing `incubator` when present, attempts a rebase onto `main`, and otherwise starts from `main`. It merges sorted work branches, reports and skips merge conflicts, and force-pushes `incubator` when its tree differs from `main`. It creates or updates an open `incubator` → `main` PR with branch lists, per-post changes, history, and a post diff. It does not auto-merge the PR or encode human approval as a release authorization.

Reviewers should distinguish the proposed repository marker from side effects already made in Buffer: rejecting a frontmatter proposal does not retract drafts. The collector's generated rejection guidance also overstates automation: its actual triggers do not include branch deletion, and retaining an existing `incubator` means deleting a work branch does not itself remove contributions already incorporated there. Any rejection needs inspection of the resulting PR diff, not reliance on that guidance alone.

Cleanup runs after a merged `incubator` PR targeting `main`/`master`, or by manual dispatch. It deletes only work branches whose current head is an ancestor of `origin/main`, retaining others; this is commit reachability, not patch equivalence. On the PR-triggered path it also deletes `incubator`. These workflow definitions describe mechanics, not evidence that deployment, merge, or publication has been approved.

Sources: `.github/workflows/broadcast-social.yml:131–182`; `.github/workflows/collect-incubator-pr.yml:3–6,26–168`; `.github/workflows/cleanup-work-branches.yml:3–20,29–77`.

## Usage Example

The draft configuration below is taken directly from `create_buffer_draft`; it shows why queue-related fields must not be mistaken for immediate publication:

```python
parts = [
    f'text: "{escaped_text}"',
    f'channelId: "{channel_id}"',
    'schedulingType: automatic',
    'mode: addToQueue',
    'saveToDraft: true'
]
```

Source: `_scripts/broadcast.py:652–659`.

## Documentation Scope

This update describes the inspected working-tree source, including uncommitted changes. It establishes no release or live-service result. No tests, builds, workflows, or external service calls were executed for this update.
