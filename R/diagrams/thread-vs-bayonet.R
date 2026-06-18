# thread-vs-bayonet.R — Comparison diagram: filettatura vs innesto a baionetta
# ============================================================================
# Base R graphics — no external dependencies.
# Usage: Rscript R/diagrams/thread-vs-bayonet.R
# Output: assets/images/3d/thread-vs-bayonet-comparison.png

# ── Design tokens ─────────────────────────────────────────────────────────
.color_bg          <- "#fefefe"
.color_text        <- "#2d2d2d"
.color_text_muted  <- "#6b7280"
.color_accent      <- "#00a693"
.color_warm        <- "#d97706"
.color_danger      <- "#dc2626"
.color_grid        <- "#e5e7eb"
.color_female      <- "#e2e8f0"
.color_male        <- "#cbd5e1"
.color_slot        <- "#f1f5f9"
.color_pin         <- "#00a693"

# ── Output ────────────────────────────────────────────────────────────────
out_dir <- "assets/images/3d"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
svg_file <- file.path(out_dir, "thread-vs-bayonet-comparison.svg")
png_file <- file.path(out_dir, "thread-vs-bayonet-comparison.png")

svg(svg_file, width = 10, height = 4.8, bg = .color_bg,
    family = "sans", pointsize = 11)

par(mfrow = c(1, 2), mar = c(2.5, 2.5, 3, 2), bg = .color_bg,
    family = "sans")

# ═══════════════════════════════════════════════════════════════════════════
#  LEFT — FILETTATURA
#        Vertical layout: manicotto (left) and vite (right), separated by gap
#        Threads offset by half-pitch, NOT interpenetrating
# ═══════════════════════════════════════════════════════════════════════════
plot(0, 0, type = "n", xlim = c(0, 10), ylim = c(0, 10),
     axes = FALSE, xlab = "", ylab = "", asp = 1)
title("Filettatura", line = 1.2, col.main = .color_danger,
      cex.main = 1.4, font.main = 2)
mtext("sezione trasversale — sporgenze e tolleranze", side = 3, line = -0.2,
      col = .color_text_muted, cex = 0.8)

# ── Geometry ───────────────────────────────────────────────────────────────
# Female wall (manicotto/dado): left rectangle
fx_female <- 1.5
fw_female <- 1.5             # width
fy_bottom <- 1.5
fy_top    <- 9.0
fx_female_right <- fx_female + fw_female

# Male wall (vite): right rectangle  
fx_male   <- 7.0
fw_male   <- 1.5
fx_male_left <- fx_male

# Gap between parts
gap_center <- (fx_female_right + fx_male_left) / 2
gap_half   <- 0.3            # half-gap on each side

# Thread parameters
pitch     <- 1.8
depth     <- 0.55            # tooth protrusion — must be < gap for no interpenetration!
y0        <- 2.2
n_teeth   <- 4

# Draw walls
rect(fx_female, fy_bottom, fx_female_right, fy_top,
     col = .color_female, border = .color_text, lwd = 0.8)
rect(fx_male,   fy_bottom, fx_male + fw_male, fy_top,
     col = .color_male,   border = .color_text, lwd = 0.8)

# Labels
text(fx_female + fw_female/2, fy_top + 0.3, "manicotto",
     col = .color_text, cex = 0.6, font = 3)
text(fx_male   + fw_male/2,   fy_top + 0.3, "vite",
     col = .color_text, cex = 0.6, font = 3)

# ── Thread teeth — female protrudes right, male protrudes left ────────────
# Female threads start from left wall, female ones offset by half-pitch
# so they visually "would mesh" but there's a gap.

valley_x <- numeric(0)

for (i in 0:(n_teeth - 1)) {
  yb <- y0 + i * pitch

  # Female tooth: protrudes right from fx_female_right, stops before gap_center
  polygon(
    c(fx_female_right, fx_female_right + depth, fx_female_right + depth, fx_female_right),
    c(yb - 0.55, yb - 0.22, yb + 0.22, yb + 0.55),
    col = .color_female, border = .color_text, lwd = 0.5
  )

  # Male tooth: protrudes left from fx_male_left, offset by half-pitch
  yb2 <- yb + pitch / 2
  polygon(
    c(fx_male_left, fx_male_left - depth, fx_male_left - depth, fx_male_left),
    c(yb2 - 0.55, yb2 - 0.22, yb2 + 0.22, yb2 + 0.55),
    col = .color_male, border = .color_text, lwd = 0.5
  )
}

# Gap annotation — thin dashed lines marking the clearance zone
gap_y_positions <- seq(fy_bottom + 0.5, fy_top - 0.5, length.out = 3)
for (gy in gap_y_positions) {
  segments(fx_female_right + depth + 0.1, gy,
           fx_male_left - depth - 0.1, gy,
           col = .color_warm, lwd = 0.4, lty = 3)
}
text(gap_center, fy_top - 0.3, "gioco", col = .color_warm,
     cex = 0.55, font = 3, adj = c(0.5, 0))

# ── Support X marks — at the male thread overhang ─────────────────────────
# Male teeth printed horizontally: the lower face overhangs.
# Place X at the root of each male tooth (left side, bottom corner)
for (i in 0:(n_teeth - 1)) {
  yb2 <- y0 + pitch/2 + i * pitch
  sx <- fx_male_left - depth * 0.45
  sy <- yb2 - 0.55 + 0.2   # near the lower-left root
  points(sx, sy, pch = 4, col = .color_danger, cex = 0.85, lwd = 1.1)
}

# Support callout
callout_y <- y0 + pitch/2 + 1 * pitch   # second male tooth
callout_x <- fx_male_left - depth * 0.45
lx <- fx_male + fw_male + 0.5
ly <- callout_y + 0.6
arrows(lx, ly, callout_x + 0.25, callout_y - 0.25,
       length = 0.05, col = .color_danger, lwd = 0.7)
text(lx, ly, "punti di supporto\nper sporgenze > 45°",
     col = .color_text_muted, cex = 0.5, adj = c(0, 1.15))

# Tolerance arrow — across the gap
tol_x0 <- fx_female_right + depth + 0.1
tol_x1 <- fx_male_left - depth - 0.1
tol_y  <- y0 + 2.5 * pitch
arrows(tol_x0, tol_y, tol_x1, tol_y,
       code = 3, length = 0.04, col = .color_warm, lwd = 1)
text(gap_center, tol_y - 0.3, "tolleranza",
     col = .color_warm, cex = 0.55, font = 2)

# Print axis indicator
arrows(fx_male + fw_male/2, fy_bottom + 0.4,
       fx_male + fw_male/2, fy_bottom + 0.05,
       length = 0.06, col = .color_text_muted, lwd = 0.6)
text(fx_male + fw_male/2, fy_bottom + 0.6, "asse stampa",
     col = .color_text_muted, cex = 0.45, adj = c(0.5, 0))

# ═══════════════════════════════════════════════════════════════════════════
#  RIGHT — INNESTO A BAIONETTA (unwrapped inner wall)
# ═══════════════════════════════════════════════════════════════════════════
plot(0, 0, type = "n", xlim = c(0, 10), ylim = c(0, 10),
     axes = FALSE, xlab = "", ylab = "", asp = 1)
title("Innesto a baionetta", line = 1.2, col.main = .color_accent,
      cex.main = 1.4, font.main = 2)
mtext("sviluppo piano della parete interna", side = 3, line = -0.2,
      col = .color_text_muted, cex = 0.8)

# Wall
wall_x0 <- 1.0; wall_x1 <- 9.0
wall_y0 <- 1.2; wall_y1 <- 9.0
rect(wall_x0, wall_y0, wall_x1, wall_y1,
     col = .color_female, border = .color_text, lwd = 1)

# L-slot
slot_x0   <- 2.8; slot_y0 <- wall_y0
entry_w   <- 1.6; entry_h <- 3.8
corr_w    <- 3.8; corr_h  <- 1.2
notch_w   <- 0.7; notch_h <- 0.45

entry_x1 <- slot_x0 + entry_w
corr_x1  <- entry_x1 + corr_w
corr_y0  <- slot_y0 + entry_h - corr_h
corr_y1  <- slot_y0 + entry_h
notch_x0 <- corr_x1 - notch_w; notch_x1 <- corr_x1
notch_y0 <- corr_y0 - notch_h; notch_y1 <- corr_y0

rect(slot_x0, slot_y0, entry_x1, corr_y1, col = .color_slot, border = .color_text, lwd = 0.7)
rect(entry_x1, corr_y0, corr_x1, corr_y1,  col = .color_slot, border = .color_text, lwd = 0.7)
rect(notch_x0, notch_y0, notch_x1, notch_y1, col = .color_slot, border = .color_text, lwd = 0.7)

text(slot_x0 + entry_w/2, slot_y0 + entry_h * 0.55, "1", col = .color_text_muted, cex = 0.85, font = 2)
text(entry_x1 + corr_w/2, corr_y0 + corr_h/2, "2", col = .color_text_muted, cex = 0.85, font = 2)
text(notch_x0 + notch_w/2, notch_y0 + notch_h/2, "3", col = .color_text_muted, cex = 0.85, font = 2)

legend_str <- "1 Ingresso verticale    2 Corridoio orizzontale    3 Tacca di ritenzione"
text((wall_x0 + wall_x1)/2, wall_y0 - 0.35, legend_str,
     col = .color_text_muted, cex = 0.52, adj = c(0.5, 0.5))

# Pin
pin_w <- 0.9; pin_h <- 0.75
pin_entry_x <- slot_x0 + entry_w/2; pin_entry_y <- slot_y0 + 1.5
pin_lock_x  <- notch_x0 + notch_w/2; pin_lock_y  <- notch_y0 + notch_h/2

draw_pin <- function(cx, cy, alpha) {
  rect(cx - pin_w/2, cy - pin_h/2, cx + pin_w/2, cy + pin_h/2,
       col = adjustcolor(.color_pin, alpha.f = alpha),
       border = .color_text, lwd = 0.7)
}
draw_pin(pin_entry_x, pin_entry_y, 0.35)
draw_pin(pin_lock_x, pin_lock_y, 1.0)

# Travel arrows
arrows(pin_entry_x, pin_entry_y + pin_h/2,
       pin_entry_x, corr_y0 + corr_h * 0.5 - pin_h/2,
       length = 0.05, col = .color_accent, lwd = 0.9, lty = 2)
arrows(pin_entry_x + pin_w/2, corr_y0 + corr_h * 0.5,
       pin_lock_x - pin_w/2, corr_y0 + corr_h * 0.5,
       length = 0.05, col = .color_accent, lwd = 0.9, lty = 2)
arrows(pin_lock_x, corr_y0 + corr_h * 0.5 - pin_h/2,
       pin_lock_x, pin_lock_y + pin_h/2,
       length = 0.05, col = .color_accent, lwd = 0.9, lty = 2)

# Pin label
pl_x <- pin_lock_x + pin_w * 0.8; pl_y <- pin_lock_y - pin_h * 0.5
arrows(pl_x, pl_y, pin_lock_x + pin_w/2 + 0.05, pin_lock_y,
       length = 0.05, col = .color_text, lwd = 0.5)
text(pl_x + 0.15, pl_y, "pin", col = .color_text, cex = 0.65, font = 2, adj = c(0, 0.5))

# Clearance — label on the LEFT side
clear_x <- slot_x0 + entry_w * 0.5; clear_y <- slot_y0 + entry_h * 0.8
cl_x <- wall_x0 - 0.4; cl_y <- clear_y
arrows(cl_x, cl_y, clear_x - 0.2, clear_y,
       length = 0.05, col = .color_accent, lwd = 0.7)
text(cl_x, cl_y, "gioco costante\nsu tutto il percorso",
     col = .color_text_muted, cex = 0.5, adj = c(1, 0.5))

# Badge
b_x0 <- 6.4; b_x1 <- 8.6; b_y0 <- wall_y1 - 0.55; b_y1 <- wall_y1 - 0.05
rect(b_x0, b_y0, b_x1, b_y1, col = .color_bg, border = .color_accent, lwd = 0.7)
text((b_x0 + b_x1)/2, (b_y0 + b_y1)/2, "nessun supporto",
     col = .color_accent, cex = 0.6, font = 2)

# ═══════════════════════════════════════════════════════════════════════════
mtext("Filettatura vs Innesto a baionetta", side = 3, line = -1.2,
      outer = TRUE, col = .color_text, cex = 1.1, font = 2)

dev.off()
system2("rsvg-convert", c("-w", "1600", svg_file, "-o", png_file))
message("── Done: ", png_file)
