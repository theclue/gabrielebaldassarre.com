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
  - "_scripts/author-extraction/post-authoring-plugin.mjs"
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
  - ".opencode/commands/annotate-post.md"
  - ".gitignore"
created: "2026-10-15"
last_updated: "2026-10-20"
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
| `@opencode/plugin` | `2.0.31` | OpenCode plugin *[SDK](../glossary.md)* loaded by `native.mjs` |
| Ajv | `8.20.0` | JSON Schema validation; `native.mjs` constructs the strict Ajv 2020 validator |
| `yaml` | `2.8.1` | YAML parsing and alias inspection in `core.mjs` |

The package scripts invoke Node for tests and author-model/runtime compilation. They do not define a browser application build. The lockfile is Bun format version 2, config version 1; using Node for scripts does not turn that file into an npm lockfile.

### Wikidata Package and Independent SDK Boundaries

`_scripts/wikidata-integration/package.json` has one direct dependency, `@opencode/plugin` exactly `2.0.24`, resolved in its own npm lockfile. `index.mjs` dynamically loads `Plugin`, registers `wikidata_oracle`, and bridges requests to `_scripts/wikidata-oracle.rb`.

The author package's Bun lock resolves the OpenCode `ai`, `client`, `protocol`, `schema`, and `util` packages to **2.0.31**; the Wikidata npm lock independently resolves those packages to **2.0.24**. These are transitive SDK components, not separately declared application modules. Neither SDK pin declares the installed OpenCode executable version.

Both SDK dependency trees include Effect, OpenTelemetry, AWS credential helpers, and Google's authentication library; the Wikidata lock also includes Zod. Their presence does **not** identify selected project AI providers or prove that those services are configured or contacted. The two package locks are independent snapshots: for example, the Bun lock resolves `@aws-sdk/core` to `3.978.2`, while the Wikidata npm lock resolves it to `3.978.3`. Effect itself resolves to `4.0.1` in the author lock and `4.0.0-rc.112` in the Wikidata lock.

### Documented Installation Boundary

`docs/post-authoring.md` now documents a frozen Bun installation from the repository root:

```sh
bun install --cwd _scripts/author-extraction --frozen-lockfile
```

The author package has `bun.lock`, but no local `package-lock.json` or `npm-shrinkwrap.json`. The guide's `npm --prefix ... run ...` commands invoke package scripts; they are not npm installation instructions. The Wikidata npm lockfile cannot substitute for the author package's Bun snapshot.

**Historical evidence:** the 2026-10-15 version of this map recorded the guide's earlier `npm --prefix _scripts/author-extraction ci` command alongside the absence of a local npm lockfile. That was a documentation/package-manager discrepancy at that snapshot. The current guide's frozen Bun command resolves the documented mismatch; no installation was performed to validate it in this update.

### SDK Availability Versus Host Permission Support

For [Governed Post Authoring](../modules/governed-post-authoring.md), the SDK pin is separate from the running host's capabilities. `docs/post-authoring.md` requires **OpenCode 2.0.29 or newer**, documenting that earlier Promise-plugin contexts lack `permission.assert`. Installing SDK 2.0.31 does not add that API to an older host process, and neither manifest nor lockfile establishes the currently installed or running host version.

`post-authoring-plugin.mjs` checks `typeof ctx.permission?.assert === "function"` before invoking preparation planning/compilation or writing preparation artifacts. Missing or non-function support raises `AUTHOR_POST_HOST_UNSUPPORTED`; the plugin remains loaded and `/cancel-post` remains available. Creation asserts host `edit` and `shell` permissions for filesystem work and Rake; revision preparation asserts `edit` only and does not run Rake. The plugin uses the existing package dependencies and host `rake`; it does not install Ruby, gems, or providers.

The guide requires restarting the **server** after upgrading OpenCode, not merely reloading configuration or plugins. For the background service it documents stopping active operations first, then `opencode service restart`. This is operator recovery guidance, not evidence that an upgrade or restart has occurred.

## Annotation Workflow Dependencies

`.opencode/commands/annotate-post.md` describes command-level dependencies beyond the JavaScript manifests. Its semantic stage requires the read-only [Wikidata Oracle](../api/wikidata-oracle.md), including accepted proposal validation and confirmed run closure before the final snapshot check and single post write; it forbids shell/CLI fallback retrieval. Later link/image transformations are outside the semantic proposal's validation scope.

| Tool or service | Bounded authoring role |
|-----------------|------------------------|
| Chrome DevTools MCP | Captures existing or newly proposed live-page screenshot placeholders. Before the first capture, check authentication on the site's origin: continue if signed in, otherwise stop for the user to sign in and wait for their reply, asking at most once per run. Use `take_snapshot` and an element `uid` for `take_screenshot`; unmatched content requires clarification, not a whole-page capture. |
| Unsplash MCP and photo download | Best-effort hero selection only when both `master` and `header.overlay_image` are absent. Use `search_photos` with landscape orientation and high content filtering; skip and report if two queries find nothing suitable. Download the selected `urls.full`, call `track_download` with its photo ID, and preserve the returned photographer attribution and image-credit metadata. Download tracking is part of using a selected photo, not an optional substitute for attribution. |
| Host ImageMagick (`magick`) | Crops loose-text screenshots using browser bounding boxes scaled by `devicePixelRatio`, and optionally strips/resizes captures. The raw viewport image stays temporarily outside the repository because it may contain private data; crop to the intended content and delete the raw file. Hero processing uses a centered 16:9 crop, resizing, metadata stripping, and JPEG quality adjustment. |

Screenshots are saved as `assets/images/<slug>-<n>.png`; downloaded heroes use `assets/images/posts/<slug>.jpg`. The command requires inspecting captures and listing saved image paths for the user's private-data review before committing. These workflow requirements are **not newly declared npm dependencies**, nor proof that MCP servers, authentication, downloads, or host `magick` are available. ImageMagick in a Docker recipe does not establish its availability on the authoring host; none of these services or tools was exercised in this update.

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
