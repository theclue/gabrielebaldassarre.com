# build.R — Custom blogdown build script
# =======================================
# Called by blogdown::build_site() for each .Rmd file.
# Delegates to build_one.R for actual knitting.
#
# This function signature is required by blogdown's custom method.

build_one <- function(io) {
  # io = c(input.Rmd, output.md)

  if (!blogdown:::require_rebuild(io[2], io[1])) {
    message("── [build] Skipping ", io[1], " (output is up to date)")
    return()
  }

  message("── [build] Knitting ", io[1])
  if (blogdown:::Rscript(shQuote(c("R/build_one.R", io))) != 0) {
    unlink(io[2])
    stop("Failed to compile ", io[1], " to ", io[2])
  }
}

# Find .Rmd files recursively under _posts/ and _drafts/
rmds <- list.files(
  c("_posts", "_drafts"),
  pattern = "[.]Rmd$",
  recursive = TRUE,
  full.names = TRUE
)

# Output .md in the same directory as the .Rmd
files <- cbind(rmds, xfun::with_ext(rmds, ".md"))

invisible(apply(files, 1, build_one))
