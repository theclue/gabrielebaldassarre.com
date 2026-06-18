// ─── E-drum Cable Organizer — Snap-in cable clamp for drum rack ───
// Snap-on clamp for tubular rack (Ø 38 mm default) with tangent cable
// plate and trapezoidal tie-slot bosses.

// License : MIT License
// Author : Gabriele Baldassarre
// Created: 2026-06-13

/* [Tube] */
// Tube outer diameter (mm)
tube_diameter  = 38;       // [20:1:60]

/* [Clamp] */
// Clamp width along tube (mm)
clamp_height    = 18;      // [10:1:40]
// Clamp radial thickness (mm)
clamp_thickness = 3.5;     // [2:0.5:8]
// Snap-in gap width (mm)
snap_opening    = 32;      // [20:1:50]

/* [Cable plate] */
// Plate width along tube — Z (mm)
plate_axial      = 28;     // [12:1:50]
// Plate width across tube — X (mm)
plate_tangential = 50;     // [24:1:80]
// Plate radial thickness — Y (mm)
plate_thickness  = 5;      // [1.5:1:8]

/* [Boss orientation] */
// Tunnel direction relative to tube
slot_orientation = 1;      // [0:Along tube, 1:Across tube]

/* [Quality] */
$fn = 128;

/* [Hidden] */

// ─── Derived constants ───────────────────────────────────────────

// Tolerances & clearances
tube_tolerance = 0.4;
eps  = 0.2;
thin = 0.01;

// Percentages & ratios
edge_margin_pct   = 0.05;
cable_gap_pct     = 0.50;
pad_pct           = 0.05;
boss_taper_ratio  = 0.60;
min_height_ratio  = 1.2;
min_height_abs    = 6;
overhang_angle    = 55;
tunnel_width_ratio = 0.55;
slot_height_ratio  = 0.55;
fillet_ratio       = 0.15;
pin_radius_ratio   = 0.35;
pin_inset_ratio    = 0.30;
pin_offset_ratio   = 0.03;

// ─── Geometry helpers ────────────────────────────────────────────

clamp_radius = tube_diameter / 2;
inner_radius = clamp_radius + tube_tolerance;
snap_half_angle = asin(min((snap_opening / 2) / inner_radius, 1));
plate_top_y     = inner_radius + plate_thickness;

// Reference plate dimension based on orientation
plate_dim = (slot_orientation == 0) ? plate_tangential : plate_axial;

// Boss footprint in placement direction
boss_margin_edge = edge_margin_pct * plate_dim;
internal_gap     = cable_gap_pct   * plate_dim;
boss_base_x      = (plate_dim - 2 * boss_margin_edge - internal_gap) / 2;

// Boss footprint along the other plate axis (5 % padding on each side)
plate_dim_other = (slot_orientation == 0) ? plate_axial : plate_tangential;
boss_base_z     = plate_dim_other * (1 - 2 * pad_pct);

// Boss top face (tapered)
boss_top_x = boss_base_x * boss_taper_ratio;
boss_top_z = boss_base_z * boss_taper_ratio;

// Boss height: steepest face ≤ overhang_angle (support-free printing)
max_overhang = max(boss_base_x - boss_top_x, boss_base_z - boss_top_z);
boss_height  = max(max_overhang / (2 * tan(overhang_angle)),
                   plate_thickness * min_height_ratio,
                   min_height_abs);

// Cable-tie tunnel
slot_height = boss_height * slot_height_ratio;

// Retention pins
pin_r      = clamp_thickness * pin_radius_ratio;
pin_inset  = pin_r          * pin_inset_ratio;
pin_offset = pin_offset_ratio;

// Edge fillet
fillet_r = min(plate_thickness, clamp_thickness) * fillet_ratio;

// Boss X-centre positions (two bosses, near plate edges)
function boss_center_x(i) =
    i == 0
        ? -plate_dim / 2 + boss_margin_edge + boss_base_x / 2
        :  plate_dim / 2 - boss_margin_edge - boss_base_x / 2;

// ─── Modules ─────────────────────────────────────────────────────

module ClampRing() {
    gap_angle = 2 * snap_half_angle;
    wrap      = 360 - gap_angle;

    rotate([0, 0, snap_half_angle - 90]) {
        rotate_extrude(angle = wrap)
            translate([inner_radius, -clamp_height / 2])
                offset(r = fillet_r)
                    offset(delta = -fillet_r)
                        square([clamp_thickness, clamp_height]);

        for (side = [0, 1]) {
            pin_angle = side == 0 ? pin_offset * wrap
                                  : (1 - pin_offset) * wrap;
            rotate([0, 0, pin_angle])
                translate([inner_radius + pin_inset, 0, 0])
                    sphere(r = pin_r, $fn = 32);
        }
    }
}

module Boss(x) {
    hull() {
        // Base sunk by eps into the plate for a clean solid union
        translate([x, plate_top_y - eps, 0])
            rotate([90, 0, 0])
                linear_extrude(height = thin, center = true)
                    offset(r = fillet_r)
                        offset(delta = -fillet_r)
                            square([boss_base_x, boss_base_z], center = true);
        translate([x, plate_top_y + boss_height, 0])
            rotate([90, 0, 0])
                linear_extrude(height = thin, center = true)
                    offset(r = fillet_r)
                        offset(delta = -fillet_r)
                            square([boss_top_x, boss_top_z], center = true);
    }
}

// Trapezoidal tunnel cut — sides parallel to boss faces,
// starts at plate surface (Y = plate_top_y).
module BossSlot(x) {
    cut_x  = boss_base_x + eps;
    cut_zb = boss_base_z * tunnel_width_ratio;
    cut_zt = boss_top_z  * tunnel_width_ratio;

    hull() {
        translate([x, plate_top_y, 0])
            cube([cut_x, thin, cut_zb], center = true);
        translate([x, plate_top_y + slot_height, 0])
            cube([cut_x, thin, cut_zt], center = true);
    }
}

module BossPair() {
    for (i = [0, 1]) {
        difference() {
            Boss(boss_center_x(i));
            BossSlot(boss_center_x(i));
        }
    }
}

module CablePlate() {
    // Filleted plate (bottom kept flat at Y = inner_radius)
    difference() {
        minkowski() {
            translate([-plate_tangential / 2 + fillet_r,
                        inner_radius + fillet_r,
                       -plate_axial / 2 + fillet_r])
                cube([plate_tangential - 2 * fillet_r,
                      plate_thickness  - 2 * fillet_r,
                      plate_axial      - 2 * fillet_r]);
            sphere(r = fillet_r, $fn = 16);
        }
        translate([-plate_tangential / 2 - fillet_r, 0,
                   -plate_axial / 2 - fillet_r])
            cube([plate_tangential + 2 * fillet_r,
                  inner_radius,
                  plate_axial + 2 * fillet_r]);
    }

    if (slot_orientation == 1) {
        rotate([0, 90, 0]) BossPair();
    } else {
        BossPair();
    }
}

// ─── Assembly ────────────────────────────────────────────────────

// color("DimGray")    ClampRing()
// color("SteelBlue")  CablePlate()

module assembly(explode = 0, explode_distance = 10) {
    ClampRing();
    translate([0, explode * explode_distance, 0])
        CablePlate();
}

// ─── Export ──────────────────────────────────────────────────────

/* [View] */
// Render mode
mode = "print"; // [assembly:Assembly, exploded:Exploded, print:Print layout]

if (mode == "assembly") {
    assembly(explode = 0);
} else if (mode == "exploded") {
    assembly(explode = 1);
} else if (mode == "print") {
    union() { ClampRing(); CablePlate(); }
}
