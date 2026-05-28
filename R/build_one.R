# build_one.R — Knit a single .Rmd to .md
# =======================================
# Called by blogdown/R/build.R for each .Rmd file.
# Generates SVG figures + {% cloudinary %} Liquid tags + lineage metadata.
#
# Usage:
#   Rscript R/build_one.R <input.Rmd> <output.md>

local({
  `%||%` <- function(x, y) if (is.null(x) || is.na(x) || !nzchar(x)) y else x

  # ── Parse args ──────────────────────────────────────────────────────
  a <- commandArgs(TRUE)
  if (length(a) < 2) stop("Usage: Rscript R/build_one.R input.Rmd output.md")

  input_file  <- a[1]
  output_file <- a[2]

  # ── Derive post slug from input path ────────────────────────────────
  slug <- gsub("^_posts/|^_drafts/|\\.[Rr]md$", "", input_file)
  slug <- gsub("/", "-", slug)

  # ── Libraries ───────────────────────────────────────────────────────
  library(svglite)
  library(knitr)
  library(rprojroot)

  root <- find_root(is_git_root)

  # ── Lineage: scan Rmd for packages and data sources ─────────────────
  rmd_lines <- readLines(input_file)

  # Exclude YAML frontmatter and comments
  content_lines <- rmd_lines[!grepl("^---$|^#", rmd_lines)]

  # Package detection: extract from library/require/p_load calls
  pkg_matches <- content_lines[grepl("library|require|requireNamespace|p_load", content_lines)]
  pkgs <- gsub(
    ".*(?:library|require|requireNamespace|p_load)\\s*\\(\\s*[\"']?([^\"'\\s,)]+).*",
    "\\1", pkg_matches, perl = TRUE
  )
  .lineage_packages <- unique(pkgs[nzchar(pkgs) & !grepl("library|require|p_load|\\(|\\s", pkgs)])

  # Data source detection
  .lineage_data <- unique(trimws(
    content_lines[grepl(
      "read\\.(csv|table|csv2|RDS|rds|feather|parquet|json)\\s*\\(|readr::read_|load\\s*\\(",
      content_lines
    )]
  ))

  # ── Figure output: scoped to post slug ───────────────────────────
  fig_dir <- file.path("assets", "figures", slug)
  dir.create(file.path(root, fig_dir), showWarnings = FALSE, recursive = TRUE)

  # ── Chunk options: svglite device + paths ────────────────────────
  knitr::opts_chunk$set(
    echo       = FALSE,
    warning    = FALSE,
    message    = FALSE,
    cache      = TRUE,
    comment    = NA,
    dev        = "svglite",
    dev.args   = list(bg = "transparent"),
    fig.retina = 2,
    fig.path   = paste0(fig_dir, .Platform$file.sep),
    cache.path = file.path("cache", slug, "")
  )

  # ── Plot hook: {% cloudinary %} Liquid tag ─────────────────────────
  # Overrides render_jekyll() plot hook. Generates one tag per plot.
  knitr::knit_hooks$set(plot = function(x, options) {
    role    <- options$fig.role    %||% "chart"
    context <- options$fig.context %||% "result"
    alt     <- options$fig.alt    %||% options$fig.cap %||% ""
    caption <- options$fig.cap    %||% ""

    sprintf(
      '{%% cloudinary /%s alt="%s" caption="%s" role="%s" context="%s" %%}',
      x, alt, caption, role, context
    )
  })

  # ── Knit ────────────────────────────────────────────────────────────
  knit(input_file, output_file, quiet = FALSE, encoding = "UTF-8")

  # ── Inject lineage metadata into frontmatter ────────────────────────
  md_content <- readLines(output_file)
  fm_marks <- which(md_content == "---")

  if (length(fm_marks) >= 2) {
    # Build YAML block functionally
    pkg_lines <- if (length(.lineage_packages) > 0) {
      paste0("    - ", .lineage_packages)
    } else {
      "    []"
    }

    data_lines <- if (length(.lineage_data) > 0) {
      c("  data_sources:", sprintf('    - "%s"', gsub('"', '\\\\"', .lineage_data)))
    }

    lineage <- c(
      "_computation:",
      sprintf("  r_version: \"%s.%s\"", R.version$major, R.version$minor),
      "  packages:",
      pkg_lines,
      data_lines,
      sprintf("  rendered_at: \"%s\"", Sys.time()),
      "  knitr_device: svglite"
    )

    fm_close <- fm_marks[2]
    new_content <- c(
      md_content[1:(fm_close - 1)],
      lineage,
      md_content[fm_close:length(md_content)]
    )
    writeLines(new_content, output_file)
  }

  message("── [build_one] ", basename(output_file))
  message("   Figures : ", fig_dir)
  message("   Packages: ", paste(.lineage_packages, collapse = ", "))
  if (length(.lineage_data) > 0) message("   Data    : ", length(.lineage_data), " source(s)")
})
