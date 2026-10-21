---
title: "Build and Automation Configuration"
description: "Configuration layers, native and container builds, editor entry points, and deployment and SEO automation."
category: "config"
language: en
source_files:
  - "_config.yml"
  - "_seo-monitor.yml"
  - ".env.example"
  - ".Renviron.example"
  - "configure.ac"
  - ".build_config.in"
  - "Makefile"
  - "Makefile.common"
  - "Makefile.win"
  - "Dockerfile"
  - "Dockerfile.seo"
  - ".vscode/tasks.json"
  - "paseo.json"
  - "_dbt/dbt_project.yml"
  - "_dbt/profiles.yml"
  - ".github/workflows/deploy-on-cloudflare-pages.yml"
  - ".github/workflows/seo-pipeline.yml"
  - ".github/workflows/seo-monitor.yml"
  - ".gitignore"
  - "_scripts/author-extraction/post-authoring.mjs"
  - "_scripts/author-extraction/post-revision.mjs"
  - "Rakefile"
  - "_scripts/seo/monitor.py"
  - "_scripts/seo/d1.py"
  - "_scripts/seo/dbt_runner.py"
  - "_dbt/models/analytics/schema.yml"
  - "_dbt/tests/properties.yml"
  - ".github/lighthouse/lighthouserc.json"
  - "test/vscode_process_rake_tasks_test.rb"
created: "2026-10-15"
last_updated: "2026-10-20"
---

# Build and Automation Configuration

## Purpose

The repository separates Jekyll publishing settings, host-tool detection, container execution, and SEO analytics configuration. Make is the shared build interface; editor tasks and deployment automation mostly delegate to it. This reference describes source configuration, not a verified execution: no builds, tests, containers, or workflows were run for this page.

## Configuration Layers

| Layer | Source | Responsibility |
|-------|--------|----------------|
| Site | `_config.yml` | Identity, URLs, Italian locale, rendering, plugins, post/page defaults, publication policy, and input exclusions |
| Host capabilities | `configure.ac`, `.build_config.in` | Generate the local `.build_config` consumed by Make |
| Build orchestration | `Makefile.common`, `Makefile`, `Makefile.win` | Shared recipes, overridable tools/images/locales, platform-specific help and cleanup |
| Containers | `Dockerfile`, `Dockerfile.seo` | Jekyll toolchain and Python/dbt SEO runtime |
| Runtime credentials | `.env.example`, `.Renviron.example` | Names for local SEO and R environment configuration; actual credentials are not stored in these templates |
| Analytics | `_seo-monitor.yml`, `_dbt/dbt_project.yml`, `_dbt/profiles.yml` | Alert thresholds, collection windows, model layout, and local SQLite profile |
| Entry points | `.vscode/tasks.json`, `paseo.json`, `.github/workflows/*.yml` | Editor commands, workspace script declarations, and remote automation |

These are not one merged settings file. Make optionally includes `.build_config`; `make seo` explicitly loads `.env` through Docker. The workflows inject GitHub Secrets directly. Nothing in these entry points establishes `.Renviron` as a universal environment source for containers or CI.

### Site and Publication Settings

`_config.yml` sets `future: false`, the Europe/Rome timezone, category/title permalinks, ten-post pagination, Kramdown/GFM Markdown, Rouge highlighting, KaTeX math, and compressed Sass. Post defaults enable the author profile, reading time, sharing, related content, and table of contents; page defaults differ.

| Behavior | Production (`make site`) | Development (`make dev`) |
|----------|--------------------------|--------------------------|
| Jekyll command | `bundle exec jekyll build` | `bundle exec jekyll serve --host 0.0.0.0 --drafts --future` |
| Environment | Production | Development |
| Drafts and future posts | No draft flag; future posts disabled by site config | Both explicitly enabled |
| Ports | No server mapping | Host ports 4000 and 35729 mapped |
| Cloudinary environment forwarding | Forwards `CLOUDINARY_CLOUD_NAME` | No corresponding forwarding in the recipe |

Both recipes depend on the Jekyll image build and diagrams. Neither depends on `knitr` or `cad`: generating Markdown or CAD assets is a separate operation. Mapping port 35729 is not evidence that live reload is enabled; the development command has no `--livereload` flag. (`Makefile.common`.)

HTML compression is configured to ignore development, and Cloudinary has `only_prod: true`. Jekyll excludes R Markdown sources, container/build inputs, and SEO scripts, dbt files, monitoring configuration, and several CI artifacts. **Neither `docs/` nor `wiki/` is explicitly excluded.** Git ignore rules, including the local authoring transaction rules below, are separate from Jekyll exclusions and do not establish publication privacy. Treatment in generated output and public exposure remain unverified; this page does not claim that publication was tested. (`_config.yml`, `.gitignore`.)

### Environment and Secret Names

Only names are listed here; do not copy real credential values into documentation.

| Consumer | Names |
|----------|-------|
| Local SEO template | `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID`, `SERPAPI_API_KEY`, `GSC_SERVICE_ACCOUNT_B64` |
| R environment template | `CLOUDINARY_CLOUD_NAME`, `BUFFER_API_TOKEN` |
| Deployment and warmup | `CLOUDINARY_CLOUD_NAME`, `CLOUDFLARE_PAGES_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TOKEN` |
| Post-deploy SEO additions | `PAGESPEED_API_KEY`, `CLOUDFLARE_R2_SEO_BUCKET`; `HERMES_API_KEY` appears only in the disabled Hermes job |
| Alternate Search Console input checked by the monitor | `GSC_SERVICE_ACCOUNT_JSON` |

The R template contains commented examples. The SEO template does not list all names used by workflows, notably the Pages credentials, PageSpeed key, and R2 bucket override. A local `.env` is consumed by `make seo`; the inspected workflow steps instead supply environment variables explicitly. (`.env.example`, `.Renviron.example`, `Makefile.common`, the three workflow files, `_scripts/seo/monitor.py`.)

`.gitignore` ignores `.env`, `.Renviron`, `.build_config`, Autoconf runtime artifacts, Jekyll output/cache files, local libraries, Python caches, SEO alerts/reports, and dbt output/logs. It also ignores `*.lock` with explicit exceptions for `renv.lock` and the author-extraction Bun lockfile; an ignore rule alone does not establish whether a file is already tracked.

### Local Authoring Transactions

`.gitignore` adds two root-anchored rules for local authoring evidence:

| Ignore rule | Source-defined contents |
|-------------|-------------------------|
| `/.opencode/authoring-revisions/` | Existing-article revisions use `<request-hash>/<UUID>/` directories containing `request.json`, `task.json`, the original `source.md` snapshot, and `preparation.json`; submitted editorial comparisons are saved under `editorial/<report-hash>.json`. Each preparation selects a new UUID, even for an identical brief. |
| `/docs/authoring-runs/` | New-post preparation uses `<request-hash>/` directories containing `request.json`, `task.json`, and `preparation.json`. The receipt binds the separate Rake-created draft/post scaffold and runtime artifacts; the article itself is not stored in this transaction directory. |

These are *[create-only]* artifacts (see [Glossary](../glossary.md)): the shared evidence writer can reuse identical bytes but rejects conflicting existing contents rather than overwriting them. Revision preparation snapshots an existing article without invoking Rake; new-post preparation invokes Rake and refuses an existing target. Ignoring these local transactions is a Git policy, not a change to `_config.yml` or proof that `docs/authoring-runs/` is excluded from a local site build. (`.gitignore`, `_scripts/author-extraction/post-authoring.mjs`, `_scripts/author-extraction/post-revision.mjs`.)

## Native Detection and Build Targets

### Host Probes

The sequence documented in `configure.ac` is:

```text
autoreconf -i
./configure
```

Autoconf 2.71 or later is declared. Configuration substitutes `.build_config.in` into `.build_config`; it does not generate a Makefile. Reconfiguration is needed after changing installed tools.

| Setting | Actual probe | Effect in `Makefile.common` |
|---------|--------------|-----------------------------|
| `HAS_KNITR` | Finds `Rscript` | Native R Markdown and diagram execution when detected; does not verify R packages |
| `HAS_OPENSCAD` | Finds `openscad` | Native mesh exports and native Python preview orchestration when detected |
| `PYTHON3_BIN` | Resolves `python3`, otherwise substitutes its command name | Selects the native CAD orchestration interpreter; not a separate native/container capability flag |
| `HAS_IMAGEMAGICK` | Finds `convert` | Recorded in generated config, but not used to select a branch in the shared Makefile |

Missing `.build_config` is tolerated. Make defaults native capability flags to zero and allows tool overrides through `RSCRIPT_BIN`, `OPENSCAD_BIN`, and `PYTHON3_BIN`. Presence probes do not establish working versions, package availability, or rendering capability.

### Target Reference

| Target | Source-defined behavior |
|--------|-------------------------|
| `help` | Default goal |
| `build` | Builds the Jekyll image with version and locale build arguments |
| `build-knitr`, `build-seo`, `build-cad` | Build the respective R, SEO, and OpenSCAD images |
| `site` | Produces `_site/` through Docker in production mode, after image build and diagrams |
| `dev` | Runs the Docker development server, after image build and diagrams |
| `knitr` | Discovers `_drafts/*.Rmd` and `_posts/**/*.Rmd`; rebuilds matching Markdown through `R/build_one.R` when dependencies require it |
| `cad` | Discovers `_cad/*/*.scad`; exports STL/3MF in print mode and also invokes `cad-png` |
| `cad-png` | Always invokes `_scripts/cad/build.py --png-only` |
| `diagrams` | Dependency-driven `R/diagrams/*.R` to `assets/images/diagrams/*.svg` |
| `seo` | Builds the SEO image, mounts the repository, loads `.env`, and forwards `SEO_ARGS` to the monitor |
| `clean` | Deletes `_site/`; POSIX and Windows entry files supply different deletion commands |

The knitr container branch builds its image before conversion. STL/3MF container recipes run the CAD image without building it first; the `cad-png` container branch builds it. Diagram container execution also assumes its R image is available. If diagram regeneration fails, the recipe accepts an existing target SVG; without that file, it fails. This fallback can preserve a previously committed diagram rather than regenerate it. (`Makefile.common`.)

Examples actually printed by `Makefile` include:

```text
make dev
make site
make assets/3d/cable-grommet-60mm/cable-grommet-60mm.stl
make assets/3d/cable-grommet-60mm/cable-grommet-60mm.3mf
```

**Entry-point caveats:** POSIX help advertises `make configure`, but neither Make entry file nor the shared file defines an explicit `configure` target. The editor and workspace configuration use `./configure` directly. `Makefile.win` selects `cmd.exe`, but shared recipes include POSIX shell constructs; cross-platform compatibility was not executed or established here.

### Container Reproducibility

The Jekyll image uses a `latest` base image, installs native build libraries, Node/npm tooling, PurgeCSS, and Mermaid CLI, then installs Bundler, runs **`bundle update`**, and runs `bundle install`. Although Make labels the image with a Jekyll version, this Dockerfile is not a [frozen dependency resolution](../dependencies/dependency-map.md): dependency updates and unpinned external packages can change rebuilds. (`Dockerfile`, `Makefile.common`.)

The SEO image uses Python 3.14 slim, installs `requirements-seo.txt`, and checks `dbt --version`. Its entry point is `_scripts/seo/monitor.py`; the local Make recipe provides the scripts through the repository mount. The version check is not an analytics or integration test. (`Dockerfile.seo`.)

## Editor and Workspace Entry Points

`.vscode/tasks.json` exposes Make tasks for build, development, cleanup, knitr, and CAD, plus direct `./configure`. Development is the default build task. Rake process tasks create posts, drafts, R Markdown workbooks, and 3D projects; another runs `knit` on the current file. Shell tasks include image conversion and single/current CAD exports. The current-CAD command uses POSIX command substitution and utilities, so it is not a platform-neutral process invocation.

The all-Rmd editor task calls `rake knit_all`, but the inspected `Rakefile` has no `knit_all` definition or task-loading code. This is a static mismatch, not a reproduced editor failure; `make knitr` is the defined aggregate conversion entry point. Also, `rake knit` always uses Docker, unlike Make's native/container selection.

`paseo.json` declares `./configure` as worktree setup, a login-shell terminal, a development service on port 4000, and scripts for site, clean, knitr, diagrams, CAD, previews, image builds, and configuration. It also contains branch, commit-message, and Italian pull-request text conventions. These are declarations only; documenting them does not start services or operate workspaces.

## Deployment and SEO Automation

### Deployment Workflow

`.github/workflows/deploy-on-cloudflare-pages.yml` runs on manual dispatch and path-filtered pushes or pull requests targeting `main`/`master`. Filters cover assets, Sass, scripts, bibliography, HTML/JavaScript/Liquid/Markdown/R/Ruby/YAML, and Gemfiles. README and selected workflow files—including the deployment workflow itself—are excluded. Makefiles, Dockerfiles, and R Markdown sources are not explicitly included as standalone path patterns; a regenerated Markdown or asset change can independently trigger the workflow.

The workflow:

1. Checks out full history and configures Docker Buildx.
2. Runs `make site`, then requires `_site/` to exist.
3. Checks local image paths extracted from changed post Markdown/Rmd files, comparing `HEAD~1` with `HEAD` when available, otherwise scanning posts.
4. Deploys `_site/` to Cloudflare Pages only for non-PR events.
5. After successful push builds/deployments, runs a separate Cloudinary warmup job for affected hero/body images and shared assets; individual warmup requests tolerate failure.

Despite its image-and-link label, the pre-deploy script checks existence of selected local image references; it is not a general link crawler or a complete PR-range content audit. PR runs build and validate but skip the deployment step. Concurrency is grouped by PR number or ref, without cancellation of in-progress runs.

### Post-Deploy SEO

`.github/workflows/seo-pipeline.yml` responds to completion of the named deployment workflow on `main`/`master`, or manual dispatch with optional URL inputs. Active jobs require a successful upstream conclusion unless manually dispatched. That condition checks workflow success, not a separately verified deployment result.

The jobs notify IndexNow, collect mobile/desktop PageSpeed reports, collect Lighthouse reports, and record post changes in R2/D1. Automatic URL selection uses changed posts from `HEAD~1..HEAD`; absent changed posts, URL-based jobs skip collection. PageSpeed/Lighthouse artifacts retain reports for 30 days and upload JSON to R2.

Quality signals are largely **informational**, not release gates:

- Unexpected IndexNow HTTP responses log warnings rather than explicitly failing the step.
- Missing PageSpeed credentials skip analysis; API errors continue; low performance/accessibility scores produce warnings without a threshold failure exit.
- Lighthouse has job-level `continue-on-error`, tolerates collection/assertion failures, and uses warning-level assertions from `.github/lighthouse/lighthouserc.json`.
- Hermes is explicitly disabled with `if: false`; its comment attributes this to rate-limit stalls pending debugging.

This does not mean every operational failure is suppressed: dependency installation or storage uploads can still fail. These jobs run after the build/deployment workflow, not as pre-deployment quality gates.

### Weekly Monitor and dbt

`.github/workflows/seo-monitor.yml` runs Mondays at 08:00 UTC and on manual dispatch, using Python 3.14 and injected credentials. It uploads alerts and monthly Markdown reports with 90-day retention, including on failed runs when files exist. `_scripts/seo/monitor.py` coordinates post synchronization, keyword extraction, Trends/Search Console retrieval, R2-to-D1 ETL, dbt transformations, alerts, and reports. Monthly reports run on the first Monday or with `--force-report`.

`_seo-monitor.yml` configures score alerts below 50/80/70 for performance/accessibility/SEO, mobile LCP above 4000, and CLS above 0.25. Trends use Italy and a three-month lookback; Search Console uses a 14-day safety window and query limit of 500. Daily R2 keys and the D1 natural-key unique index with `INSERT OR IGNORE` support repeated Search Console collection without accumulating duplicate rows.

**Dry-run is not side-effect-free.** The monitor calls `d1.ensure_schema(SCHEMA_SQL)` before any dry-run guard; that client issues HTTP SQL requests. Trends and configured Search Console fetches also still run. Dry-run skips guarded data uploads, ETL, transformations, alerts, and reports, but should not be treated as an offline or read-only credential check. (`_scripts/seo/monitor.py`, `_scripts/seo/d1.py`.)

dbt declares staging views and analytics tables, with a local, single-thread SQLite development profile. The remote path compiles SQL and applies it through the D1 HTTP client rather than a D1 dbt adapter. The monitor invokes `dbt_compile()` and `apply_to_d1()` directly, not the runner's test-bearing CLI. (`_dbt/dbt_project.yml`, `_dbt/profiles.yml`, `_scripts/seo/monitor.py`, `_scripts/seo/dbt_runner.py`.)

## Validation and Coverage Limits

- The inspected deployment/SEO workflows do not invoke the repository's Ruby or JavaScript source test suites. Build success, local-image checks, and live-site metrics are [narrower evidence than source-level regression coverage](../concepts/governance-and-verification.md).
- `test/vscode_process_rake_tasks_test.rb` checks five process-task argument forms and exercises post/draft/Rmd/3D creation in temporary workspaces. It does not run the current-file knit command, `knit_all`, Make builds, Docker, native probes, or cloud deployment.
- `_dbt/models/analytics/schema.yml` declares model contracts and column tests. `_dbt/tests/properties.yml` contains comments and a version declaration, not test definitions. The runner CLI can invoke `dbt test`, but explicitly continues after test failure; the weekly monitor bypasses that test call entirely.
- The runner returns no compiled models on compile failure, and the monitor logs warnings for missing models or transformation exceptions. Its completion message alone is therefore not proof that every analytics stage succeeded.
- The advertised configure target, absent editor task, container reproducibility, Windows portability, and documentation-output exposure are source-review caveats. None was executed to establish a failure or a passing result during this documentation pass.
