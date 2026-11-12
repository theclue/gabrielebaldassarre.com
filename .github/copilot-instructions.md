# Copilot Instructions for gabrielebaldassarre.com

## Project Overview
This is a **Jekyll-based personal blog** hosted on Cloudflare Pages. The codebase combines Jekyll (Ruby templating) with R/knitr content generation, OpenSCAD 3D asset pipelines, and automated SEO/social workflows. Primary content language is Italian (`it-IT`).

## Architecture & Build Pipeline

### Core Stack
- **Static Site Generator**: Jekyll 4.4.1 (Ruby)
- **Image CDN**: Cloudinary fetch transforms (`_plugins/cloudinary_url.rb`, `_plugins/cloudinary_transform.rb`)
- **Hosting**: Cloudflare Pages
- **Content Generation**: R + knitr (`R/build_one.R` converts `.Rmd` → adjacent `.md` + SVGs in `assets/figures/<slug>/`)
- **3D Assets**: OpenSCAD (`_cad/<slug>/<slug>.scad` → `assets/3d/<slug>/`, `assets/images/3d/`, `assets/overlays/`)

### Development Commands
- `make build` - Build Docker image with Jekyll 4.4.1
- `make knitr` - Convert changed `.Rmd` files into `.md` alongside the source `.Rmd`
- `make diagrams` - Render `R/diagrams/*.R` into `assets/images/diagrams/*.svg`
- `make cad` - Compile `.scad` models into STL, 3MF, and blueprint PNG previews
- `make dev` - Start local dev server (Jekyll watch mode, ports 4000/35729)
- `make site` - Full production build (`_site/`)
- `make clean` - Remove `_site/`, `.jekyll-cache/`, dbt build artifacts, and Python caches
- `python3 _scripts/ci/validate_assets.py --all` - Validate that all local assets referenced across posts, drafts, pages, and config exist on disk

## Project Structure

```
_posts/                # Published articles grouped by category (3d-printing/, devops/, fisica/, home-assistant/, meccanica/, reti-sociali/)
_drafts/               # Draft articles (.md and .Rmd)
_cad/                  # Parametric OpenSCAD sources (_cad/<slug>/<slug>.scad)
_layouts/              # Liquid templates (post.html, asset-3d.html, default.html, post-index.html)
_includes/             # Reusable Liquid partials (seo.html, head.html, etc.)
_pages/                # Category and static pages
_plugins/              # Custom Jekyll plugins (Cloudinary tags, difficulty/Gulpease, ontology, etc.)
_scripts/              # Automation scripts:
  author-extraction/   # In-memory author runtime compiler and OpenCode post-authoring plugin
  cad/                 # OpenSCAD build and blueprint preview generator
  ci/                  # CI helper scripts (changed_posts.py, validate_assets.py, warmup_cloudinary.py)
  seo/                 # SEO monitoring, Search Console, PageSpeed/Lighthouse R2 storage, post history
  wikidata-integration/# Read-only Wikidata oracle plugin for /annotate-post
assets/
  images/
    site/              # Site-wide images, author avatar, category headers, 1x1-black.png
    posts/             # Post master/overlay/teaser images (<slug>.jpg/.png) and per-post folders (posts/<slug>/)
    diagrams/          # R-generated SVG diagrams
    3d/                # OpenSCAD isometric and orthographic preview PNGs
  figures/             # R Markdown knitr SVG figures
  3d/                  # Downloadable STL and 3MF models
  overlays/            # CAD overlay PNGs
```

## OpenCode Authoring Commands
- `/create-post`: Compiles the governed author runtime in memory, scaffolds a new draft/post via Rake, and writes the article.
- `/revise-post`: Activates the governed author runtime in memory on an existing draft/post for revision.
- `/annotate-post`: Grounds `knowledge_prerequisites` via `wikidata_oracle`, converts Markdown links/images into Liquid tags (`{% xlink %}`, `{% post_link %}`, `{% cloudinary %}`), captures screenshots into `assets/images/posts/<slug>/`, fetches an Unsplash hero if `master:` is absent, and drafts social copy.
- `/create-rmd`: Scaffolds and writes an `.Rmd` article.

## GitHub Actions Workflows (`.github/workflows/`)
- `deploy-on-cloudflare-pages.yml`: Builds `_site/`, validates local asset references via `_scripts/ci/validate_assets.py`, deploys to Cloudflare Pages, and warms Cloudinary URLs via `_scripts/ci/warmup_cloudinary.py`.
- `seo-pipeline.yml`: Runs post-deploy IndexNow notification, PageSpeed Insights, Lighthouse CI, and post change history tracking using `_scripts/ci/changed_posts.py` and `_scripts/seo/r2.py`.
- `broadcast-social.yml`: Creates Buffer drafts for unsent posts via `_scripts/broadcast.py` and opens/updates a single `automation/social-broadcast` PR to mark `broadcast.sent: true`.
- `seo-monitor.yml`: Weekly scheduled SEO monitoring job.
- `dependabot.yml`: Automated dependency verification and minor/patch auto-merge.
