---
title: "Getting Started"
description: "Prerequisites, safe inspection, and separate setup paths for the site, author tools, R, CAD, and SEO."
category: "root"
source_files:
  - "Makefile"
  - "Makefile.common"
  - "Rakefile"
  - "configure.ac"
  - ".build_config.in"
  - "Dockerfile"
  - "_scripts/author-extraction/package.json"
  - "_scripts/author-extraction/bun.lock"
  - "docs/post-authoring.md"
  - ".env.example"
  - "containers/knitr/Dockerfile"
  - "containers/openscad/Dockerfile"
  - "Dockerfile.seo"
  - "requirements-seo.txt"
  - ".Rprofile"
  - "R/build_one.R"
  - "_scripts/cad/build.py"
  - "_scripts/seo/monitor.py"
created: "2026-10-15"
last_updated: "2026-10-15"
---

# Getting Started

Choose the workflow you need rather than installing every toolchain. The Jekyll site, Node author tools, R rendering, CAD exports, and SEO monitor have [distinct dependencies](./dependencies/dependency-map.md) and execution paths. Commands below are documented entrypoints, not a record of successful installation or execution during this documentation pass.

## Prerequisites

| Workflow | Prerequisites | Source |
|----------|---------------|--------|
| Site build and preview | Make, Docker CLI, and a running Docker engine. The image supplies Ruby/Bundler, Jekyll dependencies, Node, and supporting system tools. | `Makefile.common`, `Dockerfile` |
| Guided Markdown authoring | An OpenCode V2 session opened at the repository root, the local post-authoring plugin, dependencies from `_scripts/author-extraction`, and host Ruby with `rake` available. The plugin does not install these prerequisites. | `docs/post-authoring.md`, `Rakefile` |
| Node author-tool development | Node.js for ES modules and the declared scripts; npm is used by the documented commands. Direct dependencies are `@opencode/plugin` 2.0.24, `ajv` 8.20.0, and `yaml` 2.8.1. The manifest declares no Node engine range or package-manager version. | `_scripts/author-extraction/package.json` |
| [R Markdown and diagrams](./modules/r-publishing.md) | Native `Rscript` with the required R packages, or the separate knitr Docker image. Single-file knitting explicitly loads `svglite`, `knitr`, and `rprojroot`; individual articles and diagrams can require more packages. | `R/build_one.R`, `containers/knitr/Dockerfile`, `Makefile.common` |
| [CAD exports and previews](./modules/cad-assets.md) | Native OpenSCAD; Python 3 with PyYAML and ImageMagick for the preview orchestration; or the separate CAD image. The image installs `openscad-nightly`, Python, PyYAML, and ImageMagick. | `_scripts/cad/build.py`, `containers/openscad/Dockerfile` |
| [SEO monitoring](./modules/seo-monitoring.md) | Docker and the dedicated Python image, plus authorized service configuration in `.env`. The image uses Python 3.14 and installs `requirements-seo.txt`, including dbt-sqlite. | `Dockerfile.seo`, `Makefile.common`, `.env.example` |

Host Node dependencies are not installed by building the Jekyll image. Conversely, installing the author-tool package does not supply the site, R, CAD, or SEO environments.

## Installation

### Inspect before changing anything

Run inspection commands from the repository root. These examples list configuration, tasks, or installed tool versions; they do not request a build, installation, provider call, or publication:

```sh
make help
rake -T
docker --version
node --version
npm --version
sed -n '1,180p' Makefile.common
sed -n '1,80p' configure.ac
ls -l _scripts/author-extraction/package.json _scripts/author-extraction/bun.lock
ls -l _scripts/author-extraction/package-lock.json
```

Version commands and `rake -T` require those tools to be installed already. The last `ls` is expected to report a missing file in the inspected checkout. Read `.env.example`, not a populated `.env`, when reviewing configuration; do not print credentials into logs or documentation.

`make` defaults to the help target. **Bare `rake` is not an inspection command:** its default task builds the site through `make site` (`Makefile.common`, `Rakefile`).

### Site container setup

**Side effects — image build, network access, and dependency installation:** `make build` builds the Jekyll image and tags it as both `gabrielebaldassarre/blog:4.4.1` and `gabrielebaldassarre/blog:latest`. It is also a prerequisite of `make dev` and `make site`; a separate manual build is therefore not mandatory (`Makefile.common`).

Do not treat the image as a reproducible locked environment. `Dockerfile` starts from `bretfisher/jekyll-serve:latest`, installs unversioned system/global npm packages and Bundler, and runs `bundle update` before `bundle install`. The image tag/build argument does not by itself freeze the dependency resolution, even though `Gemfile*` is copied into the image. The R image also uses a floating base and unversioned CRAN installs; CAD installs a nightly package; SEO requirements use version ranges (`containers/knitr/Dockerfile`, `containers/openscad/Dockerfile`, `requirements-seo.txt`).

### Optional native R and CAD detection

`configure.ac` requires Autoconf 2.71 or newer to generate the [detection script](./config/build-and-automation.md). A generated `configure` is present in the inspected checkout. The documented sequence is:

```sh
# Side effects: generate Autoconf files; needed when regenerating configure.
autoreconf -i

# Side effects: probe the host and write .build_config and configuration outputs.
./configure
```

Re-run detection after installing or removing tools. `.build_config.in` generates `HAS_KNITR`, `HAS_OPENSCAD`, `PYTHON3_BIN`, and `HAS_IMAGEMAGICK`; do not hand-edit the generated file.

Detection is limited: `HAS_KNITR=1` means `Rscript` was found, not that knitr or article-specific packages were validated. OpenSCAD detection similarly checks the executable name, not export capabilities. Python detection falls back to the name `python3` if no full path is found. ImageMagick detection checks `convert`; the preview helper itself prefers `magick` and otherwise uses `convert` (`configure.ac`, `_scripts/cad/build.py`).

With no configuration file, Make defaults the native R/OpenSCAD flags to zero. Native selection applies to Make's R/diagram and CAD branches, **not** to every workflow:

- Site build and development remain Docker-based.
- `rake knit[...]` always uses Docker, unlike Make's native-or-Docker knitting rule.
- SEO remains Docker-based.
- `.Rprofile` activates renv only for interactive R sessions; batch knitting does not automatically restore that environment.

Sources: `Makefile.common`, `Rakefile`, `.Rprofile`.

**Known entrypoint mismatch:** `make help` advertises `configure`, but the inspected Makefiles define no `configure` target. Use the documented `./configure` entrypoint, not `make configure`.

### Author-tool dependency caveat

`docs/post-authoring.md` recommends `npm --prefix _scripts/author-extraction ci`. However, read-only filesystem inspection on 2026-10-15 found `bun.lock` and **no** `_scripts/author-extraction/package-lock.json` or `npm-shrinkwrap.json`. The Bun lock's direct dependency versions match `package.json`, but it is not an npm lockfile.

The documented npm clean-install instruction is therefore **not verified for this checkout**. Resolve the package-manager/lockfile policy with the maintainer before installing. Do not silently generate a replacement lockfile or present an unlocked install as equivalent. Any eventual dependency installation is a side-effecting operation that writes dependencies/cache and can access the network. No install command was run for this guide.

### Optional R, CAD, and SEO containers

These are separate, side-effecting setup targets, not onboarding checks:

| Command | Effect and limitation |
|---------|-----------------------|
| `make build-knitr` | Builds the R image from `containers/knitr/`. Make's Docker knitting branch also builds it when needed; the diagram branch only runs the named image. |
| `make build-cad` | Builds the CAD image from `containers/openscad/`. The Docker PNG branch also builds it; the direct STL/3MF rules only run the named image. |
| `make build-seo` | Builds the SEO image and installs Python dependencies. It is already a prerequisite of `make seo`. |

Sources: `Makefile.common`, the corresponding Dockerfiles.

**CAD caveat:** the CAD image declares `ENTRYPOINT ["python3"]`, while Make's Docker STL/3MF rules pass `openscad` as the command without overriding that entrypoint. Do not assume those fallback rules work identically to native OpenSCAD; this command/entrypoint mismatch needs validation or repair before relying on Docker mesh exports (`Makefile.common`, `containers/openscad/Dockerfile`).

For SEO, `.env.example` identifies R2 endpoint/access credentials, D1 account/token/database identifiers, a SerpAPI key, and a base64-encoded Google Search Console service-account document. Creating/populating `.env` writes a local configuration file and should only be done for authorized SEO work. The site development target does not consume this SEO env file; `make seo` explicitly does (`Makefile.common`). Never commit or reproduce secret values.

## Running Locally

### Preview the site

**Side effects — builds an image, may regenerate diagrams, writes generated site/cache files, and starts a server:**

```sh
make dev
```

Open `http://localhost:4000`. The target mounts the checkout into the container, maps ports 4000 and 35729, and runs `bundle exec jekyll serve --host 0.0.0.0 --drafts --future`. Drafts and future-dated articles are deliberately visible in this preview; it is not a production-publication check. Port mapping and binding are not restricted to loopback by this recipe (`Makefile.common`).

**Side effects — production output:** `make site` builds the image, processes diagram prerequisites, and runs Jekyll with `JEKYLL_ENV=production` into `_site/`. It forwards `CLOUDINARY_CLOUD_NAME` from the host environment; it does not use SEO's `--env-file .env`. Diagram regeneration failures may fall back to an existing committed SVG, so a completed site build does not prove every diagram was freshly rendered (`Makefile.common`).

Other generation commands are opt-in:

| Command | Side effects |
|---------|--------------|
| `make knitr` | Rebuilds discovered Markdown outputs when their R Markdown prerequisites are newer; knitting can execute article code and write figures, cache, and lineage metadata. |
| `make diagrams` | Regenerates out-of-date diagram SVGs from R scripts. |
| `make cad` | Exports mesh targets and always runs PNG rendering. It is not merely a dependency check. |
| `make clean` | Deletes `_site/` recursively. |

Sources: `Makefile`, `Makefile.common`, `R/build_one.R`.

**Do not use operational workflows as onboarding checks.** Corpus reruns, author-review release/application, deployment, publication, and broadcasting are outside this guide. `make seo` is also an operational pipeline, not a harmless environment probe: it uses service credentials and performs remote work. Even the monitor's `--dry-run` option is not a blanket read-only guarantee: `main()` calls `d1.ensure_schema(...)` before its dry-run-aware processing (`_scripts/seo/monitor.py`).

## Project Conventions

### New Markdown authoring

Once dependencies and plugin availability are resolved, use [`/create-post`](./modules/governed-post-authoring.md) in a **new root-directory OpenCode session**, not in a subagent or another checkout. This is a side-effecting writing workflow: it creates task/runtime evidence, invokes host Rake, and fills one new Markdown file. The default destination is `_drafts/<slug>.md`; an explicitly requested post goes to `_posts/<category>/<date>-<slug>.md` (`docs/post-authoring.md`).

The command stays with the active model/provider and does not launch subagents or implicitly switch providers. If the plugin/gate is unavailable, stop rather than bypassing it. It does not overwrite existing drafts, publish an existing draft, create CAD assets implicitly, or perform commit, push, build, deploy, or broadcast. R Markdown creation and existing-article revisions are separate workflows.

Use `/cancel-post` to end an interrupted author-runtime activation after stopping any preparation still running. Cancellation ends injection but leaves files and evidence intact; changing the topic is not cancellation. Successful preparation and hook application do not certify factual accuracy or approve the final prose (`docs/post-authoring.md`).

### File creation and publication boundaries

[Rake's Markdown `post` and `draft` tasks](./modules/blog-content.md) require title, category, and slug, create frontmatter, and refuse to overwrite an existing destination. Use kebab-case slugs as documented. Posts use a dated filename in a normalized category directory; drafts use an undated slug filename (`Rakefile`).

`rake publish[...]` is a separate, side-effecting task that copies draft content into a dated post and deletes the draft. It is not part of dependency verification or the `/create-post` path. Keep creation, rendering, review, and publication as explicit, separate decisions.
