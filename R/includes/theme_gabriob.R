# theme_gabriob.R — ggplot2 theme matching the blog's design system
# ===================================================================
# Usage: source("R/includes/theme_gabriob.R"); + theme_gabriob()

library(ggplot2)

# ── Design tokens (from main.scss) ──────────────────────────────────
.color_bg         <- "#fefefe"   # light bg
.color_text        <- "#2d2d2d"   # body text
.color_text_muted  <- "#6b7280"   # muted text
.color_accent      <- "#00a693"   # accent (teal)
.color_accent_warm <- "#d97706"   # warm accent (amber)
.color_grid        <- "#e5e7eb"   # grid lines
.color_palette     <- c("#00a693", "#d97706", "#7c3aed", "#db2777", "#2563eb", "#059669")

# ── Font stack (matches blog) ───────────────────────────────────────
.font_sans <- "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
.font_mono <- "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace"

# ── Theme ────────────────────────────────────────────────────────────
theme_gabriob <- function(base_size = 11, base_family = "") {
  theme_minimal(base_size = base_size, base_family = base_family) %+replace%
    theme(
      # Background
      plot.background  = element_rect(fill = .color_bg, color = NA),
      panel.background = element_rect(fill = .color_bg, color = NA),

      # Grid
      panel.grid.major = element_line(color = .color_grid, linewidth = 0.3),
      panel.grid.minor = element_blank(),

      # Text
      text             = element_text(color = .color_text, family = base_family),
      plot.title       = element_text(face = "bold", size = base_size + 3, hjust = 0),
      plot.subtitle    = element_text(color = .color_text_muted, size = base_size),
      plot.caption     = element_text(color = .color_text_muted, size = base_size - 1, hjust = 1),
      axis.title       = element_text(size = base_size - 1, color = .color_text_muted),
      axis.text        = element_text(size = base_size - 1),

      # Axis
      axis.line        = element_blank(),
      axis.ticks       = element_line(color = .color_grid, linewidth = 0.3),
      axis.ticks.length = unit(3, "pt"),

      # Legend
      legend.position  = "bottom",
      legend.title     = element_text(size = base_size - 2),
      legend.text      = element_text(size = base_size - 2),
      legend.key       = element_rect(fill = .color_bg, color = NA),

      # Facets
      strip.background = element_rect(fill = .color_grid, color = NA),
      strip.text       = element_text(face = "bold", size = base_size - 1),

      # Margins
      plot.margin      = margin(12, 12, 8, 8)
    )
}

# ── Default scale for consistent colors ─────────────────────────────
scale_color_gabriob <- function(...) {
  scale_color_manual(values = .color_palette, ...)
}

scale_fill_gabriob <- function(...) {
  scale_fill_manual(values = .color_palette, ...)
}

# ── Set as default ggplot theme ──────────────────────────────────────
ggplot2::theme_set(theme_gabriob())
