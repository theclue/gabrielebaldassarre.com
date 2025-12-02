# Copilot Instructions for gabrielebaldassarre.com

## Project Overview
This is a **Jekyll-based personal blog** hosted on Cloudflare Pages. The codebase combines Jekyll (Ruby templating) with R-based content generation for technical articles. It's a static site generator project with multi-language support (Italian primary).

## Architecture & Build Pipeline

### Core Stack
- **Static Site Generator**: Jekyll 4.4.1 (Ruby)
- **Hosting**: Cloudflare Pages
- **Content Generation**: R + knitr (for dynamic Rmd → md conversion)
- **Styling**: SCSS + Liquid templates
- **CI/CD**: GitHub Actions

### Build Workflow
```
Source Files (.md, .Rmd, .R) → [R build_blog.R] → Generated content
                                     ↓
                          [Docker + Jekyll build]
                                     ↓
                           Static HTML in _site/
                                     ↓
                        [Cloudflare Pages deploy]
```

**Key insight**: `.Rmd` files must be processed by R scripts (`R/build_blog.R`) *before* Jekyll runs, converting them to `.md` in `_drafts/generated/`.

### Development Commands
- `make build` - Build Docker image with Jekyll 4.4.1
- `make knitr` - Run R scripts to generate `.md` from `.Rmd` files
- `make dev` - Start local dev server (Jekyll watch mode, ports 4000/35729)
- `make site` - Full production build (_site/)
- `make clean` - Remove _site/ and Gemfile.lock

**Locale parametrization** (default: `it_IT`, `it-IT`):
- `make LOCALE=en_US LOCALE_LANG=en-US build` - Build for different locale
- `make LOCALE=fr_FR LOCALE_LANG=fr-FR dev` - Dev server with French locale
- All locale vars propagated through: Makefile → Docker build args → Dockerfile ENV → Container runtime

## Project Structure

```
_posts/                # Published articles organized by topic (fisica/, meccanica/, reti-sociali/)
_drafts/               # Draft articles; subdirectory _drafts/generated/ for R-generated content
_layouts/              # Liquid templates (post.html, default.html, post-index.html)
_includes/             # Reusable Liquid partials (header, footer, analytics, search)
_pages/                # Static pages (devops.html, fisica.html, SNA.html)
_sass/                 # SCSS partials (_variables.scss, _main.scss, etc.)
_data/                 # YAML data files (ui-text.yml for localization, mapping.yml)
R/                     # R scripts for content generation; data/ and data-raw/ for dependencies
assets/                # Static assets (CSS, images, PDFs, figures)
_site/                 # Generated output (created by Jekyll build, not committed)
.github/workflows/     # GitHub Actions: deploy-on-cloudflare-pages.yml is the main pipeline
```

## Localization & Content Patterns

- **Primary language**: Italian (it_IT)
- **Config**: `_config.yml` sets `locale: it-IT`, environment variables in Dockerfile
- **Data-driven UI**: `_data/ui-text.yml` provides translated strings
- **Article organization**: Posts grouped by subdirectories in `_posts/` (topic-based hierarchy)

## Docker & Deployment

- **Dockerfile**: Multi-stage setup with imagemagick, npm (for purgecss), and Ruby dependencies
- **Deployment trigger**: Pushes/PRs affecting content (.md, .Rmd, .R, layouts, assets, _config.yml) → GitHub Actions → `make site` → Cloudflare deploy
- **Secrets required**: `CLOUDFLARE_PAGES_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TOKEN`

## Common Patterns & Conventions

### Adding New Posts
1. Create file in `_posts/{category}/YYYY-MM-DD-slug.md` with Jekyll front matter
2. For R-generated content: add `.Rmd` → run `make knitr` → outputs to `_drafts/generated/`
3. Build locally: `make dev` (watches for changes, auto-rebuilds)

### Jekyll Front Matter
Standard YAML front matter required (inferred from layouts):
```yaml
---
title: "Post Title"
date: YYYY-MM-DD
categories: [category]
excerpt: "Brief description"
---
```

### Template System
- Layouts in `_layouts/` use Liquid syntax
- Reusable components in `_includes/` (breadcrumbs, pagination, citation)
- Custom Liquid filters: `liquid_pluralize`, `liquid_reading_time` (gems in Gemfile)
- **Important**: Keep Liquid syntax in front-end files; avoid adding Ruby logic outside Jekyll

## Dependencies & Gotchas

- **Locale configuration**: Now parametrized via `LOCALE` (e.g., `it_IT`) and `LOCALE_LANG` (e.g., `it-IT`) in Makefile; propagates through Docker build args to Dockerfile ENV vars
- **R dependency**: Must run `make knitr` for `.Rmd` files; CI doesn't do this automatically (modify workflow if needed)
- **Imagemagick**: Included in Docker for image processing; used by jekyll-imagemagick plugin
- **PurgeCSS**: NPM global install for CSS optimization (referenced in purgecss.config.js)
- **Kramdown GFM**: Parser for GitHub-flavored markdown in Jekyll

## GitHub Actions Workflow
File: `.github/workflows/deploy-on-cloudflare-pages.yml`
- Triggers on: push to main/master, PRs to main/master, manual workflow_dispatch
- Ignores: README.md, lighthouse results, unrelated workflows
- Steps: checkout → setup Docker Buildx → `make site` → verify `_site/` → deploy via wrangler

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails with missing .md files | Run `make knitr` to generate from .Rmd |
| Local dev doesn't show changes | Ensure `make dev` is running; check `_config.yml` excludes |
| Locale-dependent formatting wrong | Verify Italian locale set in Docker (Dockerfile line ~40) |
| Deploy fails silently | Check Cloudflare secrets; verify `_site/` directory exists post-build |
