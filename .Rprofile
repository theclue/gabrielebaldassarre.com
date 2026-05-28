# ── gabrielebaldassarre.com — R workspace configuration ──────────────
# Dual-mode: interactive (RStudio) vs batch (Docker/knitr)

# Reproducibility
options(
  repos = c(CRAN = "https://cran.rstudio.com"),
  blogdown.generator = "jekyll",
  blogdown.method = "custom",
  blogdown.subdir = "_posts"
)

# ── renv: only in interactive mode (Docker has its own library) ──────
if (interactive() && file.exists("renv/activate.R")) {
  source("renv/activate.R")
}

# ── rprojroot: find the git root ────────────────────────────────────
if (requireNamespace("rprojroot", quietly = TRUE)) {
  .root <- rprojroot::find_root(rprojroot::is_git_root)
} else {
  .root <- getwd()
}

# ── Theme (shared, only if ggplot2 is available) ────────────────────
theme_file <- file.path(.root, "R", "includes", "theme_gabriob.R")
if (file.exists(theme_file) && requireNamespace("ggplot2", quietly = TRUE)) {
  source(theme_file)
}

# ── NOTE: Do NOT call knitr::opts_chunk$set() here. ─────────────────
# Setting chunk options in .Rprofile forces early loading of knitr,
# which prevents R/build_one.R from overriding hooks correctly.
# Chunk options for batch mode are set in R/build_one.R.
# For interactive RStudio use, set them in the Rmd setup chunk.

message("[.Rprofile] Workspace: ", .root)
message("[.Rprofile] Mode: ", if (interactive()) "interactive (RStudio)" else "batch (CLI)")
