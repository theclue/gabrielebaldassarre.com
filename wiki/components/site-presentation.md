---
title: "Site Presentation"
description: "Reusable Jekyll layouts, navigation, responsive styling, themes, diagrams, CAD cards, and Cloudinary image presentation."
category: "components"
language: "en"
source_files:
  - "_layouts/default.html"
  - "_layouts/post.html"
  - "_layouts/post-index.html"
  - "_layouts/category.html"
  - "_layouts/asset-3d.html"
  - "_includes/head.html"
  - "_includes/navigation.html"
  - "_includes/page_meta.html"
  - "_includes/series_nav.html"
  - "_includes/series_index.html"
  - "assets/css/main.scss"
  - "assets/js/navigation.js"
  - "assets/js/theme-toggle.js"
  - "assets/js/mermaid-init.js"
  - "_plugins/cloudinary_transform.rb"
  - "_plugins/cloudinary_url.rb"
created: "2026-10-15"
last_updated: "2026-10-15"
---

# Site Presentation

## Purpose

The presentation layer combines Jekyll layout inheritance and Liquid includes with a shared Sass stylesheet and small browser scripts. It provides the document shell, article and archive presentation, series navigation, optional diagram rendering, and downloadable 3D-model cards. Ruby plugins generate Cloudinary image URLs and body-image markup at build time.

This page describes source behavior, not verified accessibility, performance, or deployed rendering. Vendored Mermaid implementation details are outside its scope.

## Props / Interface

These interfaces are Liquid page/site data and DOM hooks rather than component props.

| Input | Consumer | Behavior |
|-------|----------|----------|
| `page.title`, `subtitle`, `excerpt`, `date`, `last_modified_at`, `tags` | `post.html` | Title/subtitle, [BlogPosting metadata](./semantic-metadata.md), date display, and tag links; individual fields are conditional. |
| `page.master`, `page.header` | `post.html`, `post-index.html` | `master` takes precedence over `header.overlay_image`; the selected image passes through `cloudinary_hero`. |
| `page.image_meta.role`, `caption`, `header.overlay_alt` | Hero images | Decorative images receive empty alt text; otherwise caption precedes overlay alt and title. |
| `page.hide_title` | `post-index.html` | Suppresses the index title wrapper. |
| `page.category` | `category.html` | Selects `site.categories[page.category]`. |
| `page.show_nav == true` | `navigation.html` | Includes a page in the main navigation, in `site.pages` iteration order. |
| `read_time`, `words_per_minute`, `difficulty_*` | `page_meta.html` | Optional reading-time estimate and difficulty badge on the selected document. |
| `page.series` | Series includes | Supplies adjacent posts, series title, ordered posts, total reading time, and difficulty display. |
| `page["3d_model"]` | `asset-3d.html` | Enables the model card and supplies preview, specifications, downloads, and source path. |
| `page.mermaid` | `default.html` | Enables the vendored Mermaid runtime and authored initializer scripts. |
| `site.locale`, `site.data.ui-text`, `site.title`, `site.site_logo` | Shared shell/includes | Document language, localized labels, branding, and optional logo. |

Sources: the five layouts and five includes listed in frontmatter. The series and difficulty includes consume already supplied data; they do not calculate those data structures.

## Layout Composition and Usage

| Layout | Parent | Responsibility |
|--------|--------|----------------|
| `default` | None | Document shell, head, cached skip-link include, navigation, `main#main.container`, footer, and scripts. |
| `post` | `default` | BlogPosting article with optional hero, breadcrumbs, title, metadata, content, series controls, and tags. |
| `post-index` | `default` | Optional hero and title, followed by the supplied content. |
| `category` | `post-index` | Category entries grouped by changes in publication year; enables navigation through layout frontmatter. |
| `asset-3d` | `post` | Supplied content followed by an optional 3D-model download card inside the post content. |

`post.html` demonstrates reuse through the following actual include calls, with article content between metadata and series controls:

```liquid
{% include page_meta.html %}
```

```liquid
{% include series_nav.html %}

{% include series_index.html %}
```

Category entries reuse `page_meta.html` inside the post loop, alongside `post_status.html`, title links, and optional excerpts. Draft-path or future-dated entries receive `post-preview-unpublished`. The category layout iterates the supplied category collection without an explicit sort. Sources: `_layouts/category.html:9–35`, `_layouts/post.html:35–54`.

The default shell always sets `body#post-index`, including for posts. Consequently, the stylesheet's `#post-index article` card rules are not exclusive to archive pages. Sources: `_layouts/default.html:6`, `assets/css/main.scss:820–860`.

### Shared Head and Article Metadata

`head.html` includes [SEO output](./semantic-metadata.md), an optional Atom feed, viewport/color-scheme declarations, Dublin Core metadata, a JetBrains Mono preload, and `main.css`. It also loads local KaTeX CSS/runtime and auto-render resources; the auto-render call handles dollar and backslash delimiters, ignores existing `katex` classes, and sets `throwOnError: false`. Additional `site.head_scripts` are appended. Sources: `_includes/head.html:3–30,54–58`.

`page_meta.html` selects `post | default: page`, allowing the same include to serve listings and article pages. It prefers `last_modified_at` over `date`, formats visible dates using a hard-coded Italian month list, and obtains labels from locale data with fallbacks. Reading time uses stripped content word count and document/site/default speed, with a default of 200 words per minute and integer division for longer content. Difficulty display uses supplied labels and optional declared, Gulpease, and audience details in its tooltip. Source: `_includes/page_meta.html:1–42`.

### Series Navigation

`series_nav.html` renders previous/next pills only when adjacent posts exist, using `rel="prev"` and `rel="next"`. `series_index.html` requires more than one series post and lists titles, dates, and optional excerpts. The current entry is bold rather than linked and carries `aria-current="page"`; optional series-wide reading time and difficulty appear above the list. Visible dates again use Italian month names. Sources: `_includes/series_nav.html`, `_includes/series_index.html`.

## Navigation and Responsive Styling

`navigation.html` renders optional logo branding, site title, a menu toggle controlling `#nav-menu`, page links, and a theme button. The logo uses `cloudinary_logo: 80` only when `jekyll.environment == 'production'`; otherwise its source uses `relative_url`. Its declared display dimensions are 40 × 40 pixels.

`navigation.js` initializes on DOM readiness and exits if the toggle or menu is absent. Opening/closing synchronizes `aria-expanded` with the menu's `is-open` class. Clicking outside closes the menu; Escape closes it and focuses the toggle. Source: `assets/js/navigation.js:7–49`.

The shared stylesheet supplies:

- **Design tokens:** light/dark colors, fluid `clamp()` typography, spacing, radii, shadows, and motion durations.
- **Content sizing:** a 72rem outer container with fluid padding, a 72ch article-content measure, wider figures, and full-width code/highlight exceptions.
- **Layout utilities:** auto-fitting grids, Flexbox groups, and a `1fr 2fr` two-column grid from 48em upward.
- **Navigation:** a sticky translucent header; at widths up to 48em, the hamburger is displayed, navigation stacks vertically, and the menu transitions between zero height and a 30rem maximum height.
- **Reusable surfaces:** articles, link cards, breadcrumbs, pagination, tag pills, series controls, code highlighting, and asset cards share token-based styling.
- **Media and reading aids:** constrained images, horizontally scrollable code and display equations, focus-visible link outlines, skip-link styling, and reduced-motion overrides. Print rules hide navigation, footer, breadcrumbs, pagination, and tags.

Sources: `assets/css/main.scss:24–197,287–290,343–605,607–668,683–860,1008–1203,1369–1375`. These are implemented styling rules, not evidence of audited behavior. At small widths the menu's expansion depends on JavaScript adding `is-open`; the inspected stylesheet has no separate no-JavaScript expansion rule.

## Theme Selection

Theme behavior spans three files:

1. `_includes/head.html:42–52` reads `localStorage['theme']` in the head and applies a valid `light` or `dark` value to the root's `data-theme` attribute. Storage failures are caught.
2. `assets/css/main.scss:24–154,599–605` defines light defaults, explicit dark overrides, and automatic dark colors/icons under `prefers-color-scheme: dark` unless light was explicitly selected.
3. `assets/js/theme-toggle.js:13–71` determines the effective stored/system theme and toggles to its opposite. Clicking applies and stores an explicit choice and updates the clicked button's `aria-pressed`. System preference changes update button state only without a stored choice.

Despite the script header's description of an auto/light/dark cycle, `nextTheme()` implements a two-state light/dark toggle. There is no button action that restores automatic mode. Storage access is guarded, so persistence is not guaranteed when storage is unavailable.

## Mermaid Diagrams

`default.html:23–26` conditionally loads `/assets/vendor/mermaid/mermaid.min.js` before `/assets/js/mermaid-init.js`, both deferred. The latter is authored integration code consuming the vendored runtime, not an implementation of Mermaid itself.

The initializer exits when `mermaid` is unavailable. It converts `.language-mermaid code` and `code.language-mermaid` nodes to `pre.mermaid`, retaining original diagram text in `data-mermaid-code` for later rendering. The actual runtime configuration is:

```javascript
mermaid.initialize({
  startOnLoad: false,
  theme: effectiveTheme(),
  securityLevel: 'loose'
});
```

It explicitly runs Mermaid for `.mermaid` nodes. Light mode maps to Mermaid's `default` theme; dark mode maps to `dark`. An OS preference listener rerenders only without an explicit root theme, while a `MutationObserver` rerenders on `data-theme` changes. Rerendering restores saved code through `innerHTML` and removes `data-processed`. The configuration explicitly uses `securityLevel: 'loose'`; this integration should not be described as strict-mode rendering or a sanitizer. Source: `assets/js/mermaid-init.js:10–83`.

## CAD Download Cards

`asset-3d.html` renders a Schema.org `3DModel` section only when `page["3d_model"]` exists. It optionally shows a lazy-loaded isometric preview, `designed_for` description, material, dimensions in millimeters, nozzle/layer/infill/support settings, and license.

Important conditional details in `_layouts/asset-3d.html:31–116`:

- The specifications list requires `print_settings`, `material`, or `dimensions`; a license alone does not open the list.
- Dimensions display when `dimensions.width` exists. Printer settings display when `print_settings.nozzle` exists, with layer height `0.2` and infill `15% gyroid` as defaults.
- Thingiverse and Printables links can both appear. If either external URL exists, local STL/3MF links are suppressed. Otherwise available local exports are offered with download attributes and `MediaObject` encoding metadata.
- `sources.scad` produces a source link under the hard-coded GitHub repository's `main` branch; it does not embed an interactive CAD viewer.

`main.scss:1232–1363` styles the card as an `auto 1fr` grid with a fixed 260px preview column, flexible details, and wrapping action buttons. The inspected stylesheet has no card-specific narrow-screen stacking breakpoint; no mobile rendering outcome is asserted here.

## Cloudinary Image Presentation

### Hero, Card, and Logo Filters

`_plugins/cloudinary_transform.rb` registers `cloudinary_hero`, `cloudinary_card`, and `cloudinary_logo`. Hero/card filters resolve relative source paths against `site.url`, then generate Cloudinary fetch URLs using the environment cloud name or site configuration. Defaults are 1922 × 724 for heroes and 1200 × 680 for cards.

Hero/card processing supports `keystone` and `cinematic` distortion presets at low/medium/high intensities, followed by cropping and fill sizing. Without a matching preset, it uses the configured gravity or `auto`. Optional foreground overlays are fitted within 20% of canvas width; optional logos use a supplied path or `site_logo` when `logo: true`. The separate `social_url` helper defaults to 1200 × 630 and supports caption text, a bottom letterbox, overlays, and logos. Sources: `_plugins/cloudinary_transform.rb:5–23,27–34,56–219,221–249`.

The actual hero selection used in both article and index layouts is:

```liquid
{%- if page.master %}
  {%- assign overlay = page.master | cloudinary_hero: page.header %}
{%- elsif page.header.overlay_image %}
  {%- assign overlay = page.header.overlay_image | cloudinary_hero: page.header %}
{%- endif %}
```

Both layouts mark hero loading as eager and decoding as asynchronous; `post.html` additionally sets high fetch priority. These attributes express source intent, not measured performance.

### Body Images and Development Behavior

`_plugins/cloudinary_url.rb` registers a `cloudinary_url` filter and a `cloudinary` Liquid tag. The filter defaults to `q_auto,f_auto`. The tag defaults to lazy loading and asynchronous decoding, emitting a figure and optional caption, except decorative images return a bare image with empty alt text and presentation role. It accepts role/context metadata, step identifiers, comparison references, representative-image marking, numeric width classes, and extended descriptions for diagram/chart roles. When a role is supplied, it appends metadata to `page['image_meta_body']`. Sources: `_plugins/cloudinary_url.rb:13–21,24–137`.

[Environment handling](../config/build-and-automation.md) is deliberately worth distinguishing:

| Path | Development or missing configuration behavior |
|------|--------------------------------------------------|
| Hero/card transforms | Exact `ENV['JEKYLL_ENV'] == 'development'` bypasses processing and returns the original input path. Outside development, the underlying hero helper returns its input when the cloud name is `nil`; filters have already resolved relative paths to full URLs. |
| `cloudinary_url` filter/body tag | No Cloudinary URL when the cloud name is missing/empty or the environment is exactly `development`. The tag still emits its image/figure markup and metadata. |
| Navigation logo | Template invokes the Cloudinary filter only for `production`; all other Jekyll environments use `relative_url`. |
| `cloudinary_logo` filter itself | Bypasses in development, but otherwise constructs its URL without a missing-cloud-name guard. |

The `post_read` hook copies a nonempty `CLOUDINARY_CLOUD_NAME` into site configuration only when the configured name is unset. The transform module's context-free helpers, including `social_url`, read the cloud name from the environment rather than from site configuration. Thus the inspected code does not support a blanket claim that every nonproduction build bypasses Cloudinary, or that every helper handles missing/empty cloud names identically. Sources: `_plugins/cloudinary_url.rb:3–21,69–79`, `_plugins/cloudinary_transform.rb:27–38,64–68,121–125,221–249`, `_includes/navigation.html:4–11`.
