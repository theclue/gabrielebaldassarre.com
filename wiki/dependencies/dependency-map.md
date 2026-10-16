---
title: "Dependency Map"
description: "Dependency consumers, declared versions, lockfile boundaries, and container build limitations."
category: "dependencies"
language: en
source_files:
  - "Gemfile"
  - "Gemfile.lock"
  - "_config.yml"
  - "_scripts/author-extraction/package.json"
  - "_scripts/author-extraction/bun.lock"
  - "_scripts/author-extraction/core.mjs"
  - "_scripts/author-extraction/native.mjs"
  - "_scripts/wikidata-integration/package.json"
  - "_scripts/wikidata-integration/package-lock.json"
  - "_scripts/wikidata-integration/index.mjs"
  - "requirements-seo.txt"
  - "_scripts/seo/r2.py"
  - "_scripts/seo/d1.py"
  - "_scripts/seo/search_console.py"
  - "_scripts/seo/trends.py"
  - "_scripts/seo/posts.py"
  - "_scripts/seo/dbt_runner.py"
  - "_dbt/profiles.yml"
  - "renv.lock"
  - ".Rprofile"
  - "R/build_one.R"
  - "R/build_blog.R"
  - "Dockerfile"
  - "Dockerfile.seo"
  - "containers/knitr/Dockerfile"
  - "containers/openscad/Dockerfile"
  - "Makefile.common"
  - "_scripts/cad/build.py"
  - "docs/post-authoring.md"
  - ".gitignore"
created: "2026-10-15"
last_updated: "2026-10-15"
---

# Dependency Map

## Purpose

Dependencies belong to separate publishing and authoring toolchains, not a single root application package. The repository root has no `package.json` or `package-lock.json`; the two JavaScript packages are private integration packages under `_scripts/`. Ruby builds the site, R generates article content and figures, Python supports SEO and CAD workflows, and Docker supplies alternative execution environments.

A **direct dependency** is declared by a consumer's manifest or installation recipe. A **version constraint** describes acceptable releases; a ***[lockfile](../glossary.md)*** records a resolved dependency snapshot, including transitive dependencies. Locked versions below describe repository files, not verified installed versions.

## Key Files and Consumers

| Consumer | Declaration | Resolution or installation boundary |
|----------|-------------|-------------------------------------|
| Jekyll site and plugins | `Gemfile`, `_config.yml` | `Gemfile.lock`; root `Dockerfile` also updates the bundle |
| Author extraction and authoring integration | `_scripts/author-extraction/package.json` | Local `bun.lock`; no local npm lockfile |
| Wikidata oracle integration | `_scripts/wikidata-integration/package.json` | Local npm `package-lock.json`, format version 3 |
| SEO collection and transformation | `requirements-seo.txt` | Ranges resolved by pip in `Dockerfile.seo` |
| R article and figure generation | `R/build_one.R`, `R/build_blog.R` | Interactive `renv.lock` snapshot versus independent container installs |
| CAD export and preview processing | `_scripts/cad/build.py`, `Makefile.common` | Native tools or Ubuntu/PPA packages in the CAD image |

## Ruby Publishing Dependencies

`Gemfile` declares Jekyll with `~> 4.4`, allowing versions from 4.4 up to, but not including, 5.0. Other direct gems have no explicit version constraint in that manifest; dependency requirements and the lockfile narrow their resolution.

| Dependency | Manifest declaration | Locked version | Consumer |
|------------|----------------------|----------------|----------|
| Jekyll | `~> 4.4` | `4.4.1` | Site build and development server invoked by `Makefile.common` |
| Liquid | Unconstrained direct gem | `4.0.4` | Jekyll templates and Liquid extensions |
| Kramdown | Unconstrained direct gem | `2.5.2` | Markdown processor selected in `_config.yml` |
| `kramdown-parser-gfm` | Unconstrained direct gem | `1.1.0` | Configured GFM input |
| Rouge | Unconstrained direct gem | `4.7.0` | Configured syntax highlighter |
| `kramdown-math-katex` | Unconstrained direct gem | `1.0.1` | Configured KaTeX math engine; pulls `katex` `0.10.0` and ExecJS |

Jekyll itself requires Liquid `~> 4.0`, Kramdown `~> 2.3, >= 2.3.1`, and Rouge `>= 3.0, < 5.0`. These transitive constraints are distinct from the project's unconstrained direct declarations. `Dockerfile` selects Node as the ExecJS runtime.

The `jekyll_plugins` group supplies feeds, include caching, redirects, emoji, mentions, sitemaps, pagination, Gists, figures, and tables of contents. `_config.yml` enables their corresponding plugins, plus the GFM parser and Liquid pluralization/reading-time extensions. `listen` and `rb-inotify` are development declarations; `activesupport` is also direct and resolves to `8.1.3.1`.

`Gemfile.lock` records Bundler `4.0.11` and platforms `aarch64-linux`, `arm64-darwin`, `x86_64-darwin`, and `x86_64-linux`, including platform-specific native gems. This is not a Ruby interpreter pin. Likewise, `JEKYLL_VERSION := 4.4.1` in `Makefile.common` controls image tagging and a build argument; the Dockerfile does not use it as an exact gem installation constraint.

## JavaScript Integration Dependencies

### Author Extraction Package

`_scripts/author-extraction/package.json` pins all three direct dependencies exactly:

| Dependency | Declared and Bun-locked version | Consumer |
|------------|--------------------------------|----------|
| `@opencode/plugin` | `2.0.24` | OpenCode plugin SDK loaded by `native.mjs` |
| Ajv | `8.20.0` | JSON Schema validation; `native.mjs` constructs the strict Ajv 2020 validator |
| `yaml` | `2.8.1` | YAML parsing and alias inspection in `core.mjs` |

The package scripts invoke Node for tests and author-model/runtime compilation. They do not define a browser application build. The lockfile is Bun format version 2, config version 1; using Node for scripts does not turn that file into an npm lockfile.

### Wikidata Package and Shared SDK Boundary

`_scripts/wikidata-integration/package.json` has one direct dependency, `@opencode/plugin` exactly `2.0.24`, resolved in its own npm lockfile. `index.mjs` dynamically loads `Plugin`, registers `wikidata_oracle`, and bridges requests to `_scripts/wikidata-oracle.rb`.

Both lockfiles resolve the OpenCode `ai`, `client`, `protocol`, `schema`, and `util` packages to `2.0.24`. These are transitive SDK components, not separately declared application modules. The pin is for the integration SDK, not a declaration of the installed OpenCode executable version.

The SDK brings additional packages such as Effect, Zod, OpenTelemetry, AWS credential helpers, and Google's authentication library. Their presence does **not** identify selected project AI providers or prove that those services are configured or contacted. The two package locks are independent snapshots: for example, the Bun lock resolves `@aws-sdk/core` to `3.978.2`, while the Wikidata npm lock resolves it to `3.978.3`, despite the same direct SDK pin.

### Documented npm Installation Gap

`docs/post-authoring.md` gives this command:

```sh
npm --prefix _scripts/author-extraction ci
```

Filesystem inspection on 2026-10-15 found `bun.lock` but neither `package-lock.json` nor `npm-shrinkwrap.json` in that package. The command therefore lacks the local npm lockfile that `npm ci` requires. The Wikidata package's lockfile cannot supply this boundary, and there is no root npm lockfile. This is an unresolved documentation/package-manager discrepancy, not an installation procedure validated here.

## Python SEO Dependencies

`requirements-seo.txt` declares ranges, not exact installed versions or a transitive lock:

| Package | Direct constraint | Consumer or scope |
|---------|-------------------|-------------------|
| `boto3` | `>=1.35,<2` | `_scripts/seo/r2.py`: S3-compatible client targeting Cloudflare R2, not evidence of AWS storage deployment |
| `httpx` | `>=0.28` | `_scripts/seo/d1.py`: Cloudflare D1 REST requests |
| `google-search-results` | `>=2.4` | `_scripts/seo/trends.py`: imports `serpapi.google_search.GoogleSearch` for Google Trends |
| `google-api-python-client` | `>=2.150` | `_scripts/seo/search_console.py`: builds the Search Console client |
| `google-auth` | `>=2.30` | Same module: service-account credentials |
| `pyyaml` | `>=6.0` | `_scripts/seo/posts.py`: post frontmatter parsing |
| `python-dateutil` | `>=2.9` | Declared SEO requirement; no direct call site established by the inspected consumer files |
| `dbt-sqlite` | `>=1.9` | SQLite adapter selected in `_dbt/profiles.yml`; `_scripts/seo/dbt_runner.py` invokes dbt and adapts compiled SQL for D1 |

Only boto3 has an upper bound in this requirements file. None of these ranges is a resolved version. `Dockerfile.seo` starts from the non-digest-pinned `python:3.14-slim` tag and runs pip against these requirements, independently of the Ruby, JavaScript, and R locks.

## R Content and Graphics Dependencies

`renv.lock` records R `4.5.3`, the CRAN repository, and package records including:

| Package | Snapshot version | Project consumer |
|---------|------------------|------------------|
| `knitr` | `1.51` | `R/build_one.R`: executes article chunks and writes Markdown |
| `svglite` | `2.2.2` | `R/build_one.R`: selected SVG graphics device |
| `blogdown` | `1.23` | `R/build_blog.R`: calls `build_site(run_hugo = FALSE)` |
| `renv` | `1.1.8` | Interactive project environment activated through `.Rprofile` |

`R/build_one.R` also uses `rprojroot`, sets figure/cache paths, and generates Cloudinary Liquid tags for plots. `.Rprofile` selects Jekyll as blogdown's generator and a custom build method; blogdown's upstream Hugo support does not mean this repository is a Hugo application.

The environment boundary is explicit: `.Rprofile` sources `renv/activate.R` **only in interactive sessions**. `containers/knitr/Dockerfile` instead starts from `rocker/verse:latest` and installs unversioned CRAN packages with `install2.r`, including knitr, blogdown, svglite, Cairo, Hmisc, igraph, and poweRlaw. It neither copies nor restores `renv.lock`. `R/build_blog.R` also uses pacman's package-loading mechanism, so its loading recipe is not an exact-version declaration.

The lock's package records and any installed `renv/library/` contents are third-party libraries, not project-authored modules. `.gitignore` excludes that installed library, `node_modules/`, and root `/vendor`.

## System Tools and Docker

| Image recipe | Base image | Dependency role and version boundary |
|--------------|------------|--------------------------------------|
| `Dockerfile` | `bretfisher/jekyll-serve:latest` | Ruby/Jekyll environment, ImageMagick, Node/npm, native build libraries; globally installs unversioned PurgeCSS and Mermaid CLI |
| `containers/knitr/Dockerfile` | `rocker/verse:latest` | R execution, graphics/statistical libraries, compilers and native system headers; unversioned CRAN installs |
| `containers/openscad/Dockerfile` | `ubuntu:24.04` | Adds the OpenSCAD releases PPA and installs unversioned `openscad-nightly`, ImageMagick, Python, and distribution PyYAML |
| `Dockerfile.seo` | `python:3.14-slim` | pip-installed SEO dependencies and the monitor entrypoint |

`_scripts/cad/build.py` invokes OpenSCAD for STL/3MF exports and delegates preview rendering to its preview module. ImageMagick handles cropping, resizing, compositing, and orthographic sheets; the helper prefers `magick` and falls back to `convert`. The CAD image's `python3-yaml` comes from apt, not the SEO pip requirements. None of these recipes pins OpenSCAD or ImageMagick to an exact release.

`Makefile.common` can use native R/OpenSCAD tools or Docker fallbacks. A host installation and a freshly built image therefore need not share dependency versions. CAD discovery in `build.py` explicitly skips vendored libraries and auxiliary includes as standalone build targets; those files should not be counted as authored application modules.

## Lockfile Boundaries and Build Limitations

Lockfiles help only within the installation flow that consumes them. They do not make these Docker recipes reproducible:

- **Ruby resolution is updated during image construction.** The root Dockerfile eventually copies `Gemfile*`, then executes:

  ```dockerfile
  RUN gem install --no-document bundler \
      && bundle update
  ```

  The following `bundle install` uses the result of that update, not necessarily the committed gem snapshot. The Bundler installation itself is unversioned.
- **Container bases are mutable.** Both `latest` tags float; `ubuntu:24.04` and `python:3.14-slim` also lack immutable image digests.
- **System and global tool versions float.** apt repositories, the OpenSCAD PPA, and global npm installation resolve available packages at build time.
- **R has two separate environments.** The interactive lock does not control the container's unversioned CRAN installs.
- **Python has constraints rather than a lock.** A fresh pip resolution can change direct and transitive versions.
- **JavaScript has package-local locks.** The author package's Bun snapshot and the Wikidata package's npm snapshot are not interchangeable and do not constrain the Docker recipes.

This map documents declarations and source consumers only. It does not attest to a successful installation, build, test run, or matching host/container environments.
