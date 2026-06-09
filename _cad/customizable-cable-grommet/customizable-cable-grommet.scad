// =============================================================================
// Customizable Desk Cable Grommet
// =============================================================================
// Author  : Gabriele Baldassarre
// Website : https://gabrielebaldassarre.com
// Source  : https://github.com/theclue/gabrielebaldassarre.com/_cad/customizable-cable-grommet/customizable-cable-grommet.scad
//
// License : MIT License
// Copyright (c) 2026 Gabriele Baldassarre
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this design and associated documentation files, to deal in the design
// without restriction, including without limitation the rights to use, copy,
// modify, merge, publish, distribute, sublicense, and/or sell copies of the
// design, and to permit persons to whom the design is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the design.
// =============================================================================
//
// Components:
//   * top    : upper sleeve with resting lip + tubular body with internal
//              bayonet slots (for the bottom ring) and internal snap groove
//              near the top (for the cap)
//   * bottom : lower ring with collar that slides into the sleeve + bayonet
//              pins on the outer wall of the collar
//   * cap    : snap-in cover (no bayonet) with a parametric PARABOLIC
//              opening (vertex at center, opens toward the rim)
//
// Assembly sequence:
//   1. Top:    insert from above into the desk hole (lip rests on surface)
//   2. Bottom: insert from below, align pins with slots, twist to lock
//   3. Cap:    push in from above until it snaps into the internal groove
// =============================================================================

// =============================================================================
//                            PARAMETER PANEL
//    `/* [Section] */` comments group parameters in the Customizer sidebar.
//    Inline comments provide labels and [min:step:max] range hints.
// =============================================================================

/* [Hole & Desk] */

// Diameter of the hole in the desk panel (mm)
hole_dia = 60; // [40:1:120]

// Thickness of the desk panel (mm)
desk_thickness = 25; // [10:1:60]

/* [General Tolerances] */

// Radial clearance between sleeve outer diameter and hole — increase for looser fit (mm)
clearance = 0.4; // [0.1:0.05:1.0]

// Sleeve wall thickness — must be large enough to house the bayonet slots (mm)
wall = 3.0; // [2.0:0.1:5.0]

/* [Top Ring] */

// Radial overhang of the top lip beyond the hole edge (mm)
top_lip_extra = 8; // [2:1:20]

// Height of the top resting lip (mm)
top_lip_h = 3; // [1:0.5:8]

/* [Bottom Ring] */

// Radial overhang of the bottom lip beyond the hole edge (mm)
bot_lip_extra = 6; // [2:1:20]

// Height of the bottom lip (mm)
bot_lip_h = 3; // [1:0.5:8]

// Height of the inner collar — must accommodate the full bayonet travel (mm)
collar_h = 12; // [8:1:30]

// Wall thickness of the inner collar (mm)
collar_wall = 2.4; // [1.5:0.1:4]

/* [Bayonet Lock] */

// Number of bayonet pins — 3 pins provide automatic self-centering
bayo_pins = 3; // [2:1:6]

// Angular width of each pin (degrees)
bayo_pin_w_deg = 14; // [8:1:30]

// Axial height of each pin (mm)
bayo_pin_h = 2.4; // [1:0.2:5]

// Radial protrusion of each pin (mm)
bayo_pin_t = 1.4; // [0.8:0.1:3]

// Twist angle to lock the bottom ring — rotate by this amount after insertion (degrees)
bayo_twist_deg = 30; // [15:5:60]

// Radial and axial clearance inside the bayonet slots — increase for easier assembly (mm)
bayo_slot_play = 0.4; // [0.1:0.05:1.0]

// Extra axial drop at the end of bayonet travel for retention snap (mm)
bayo_drop_extra = 0.5; // [0.2:0.1:1.5]

/* [Cap Snap-In] */

// Thickness of the cap top disc — this is also the roof thickness above the
// hollow internal cavity (set equal to `wall` to keep a uniform shell) (mm)
cap_disc_h = 3.0; // [1.5:0.5:6]

// Radial overhang of the disc beyond the sleeve outer diameter (mm)
cap_disc_extra = 6; // [3:1:15]

// Radial clearance between cap skirt and sleeve inner wall (mm)
cap_skirt_clearance = 0.3; // [0.1:0.05:0.8]

// Distance from the sleeve top edge down to the snap groove (mm)
cap_snap_depth_from_top = 4; // [2:0.5:10]

// Axial height of the snap lip (mm)
cap_snap_h = 1.0; // [0.5:0.1:2]

// Radial protrusion of the snap lip (mm)
cap_snap_t = 0.5; // [0.3:0.1:1.5]

// Height of the entry chamfer ramp below the snap lip (mm)
cap_snap_chamfer = 0.6; // [0.3:0.1:1.5]

/* [Parabolic Opening] */

// Angular span of the parabolic cut at the cap rim (degrees)
parab_arc_deg = 50; // [10:1:160]

// Extend the cut flush to the outer rim of the cap (overrides edge inset)
parab_open_to_edge = true;

// Inset from the cap rim when open-to-edge is disabled (mm)
parab_edge_inset = 4; // [1:0.5:15]

// Fillet radius applied at the parabola vertex and at the arc junction (mm)
parab_corner_radius = 1.2; // [0:0.2:4]

// Number of line segments used to approximate the parabola curve
parab_segments = 48; // [16:1:128]

/* [View] */

// Which part(s) to display
mode = "exploded"; // [assembly:Assembly, exploded:Exploded, top:Top part, bottom:Bottom part, cap:Cap only, print:Print layout]

// Distance between parts in exploded view — also consumed by the build pipeline via post frontmatter `3d_model.explode_distance` (mm)
explode_distance = 25; // [5:5:80]

/* [Render] */
$fa = 2;
$fs = 0.4;

// =============================================================================
//                           DERIVED GEOMETRY
// =============================================================================
sleeve_od  = hole_dia - clearance;   // Sleeve OD (fits into hole)
sleeve_id  = sleeve_od - 2*wall;     // Sleeve ID (cable passage)
sleeve_h   = desk_thickness + 2;     // Spans panel thickness + margin

top_lip_od = hole_dia + 2*top_lip_extra;
bot_lip_od = hole_dia + 2*bot_lip_extra;

// --- Collar / sleeve fit (bayonet) ---
collar_od = sleeve_id - 0.4;             // Sliding clearance
collar_id = collar_od - 2*collar_wall;   // Cable passage through bottom ring

// --- Bayonet slots ---
slot_depth_r    = bayo_pin_t + bayo_slot_play;
slot_pin_h      = bayo_pin_h + 2*bayo_slot_play;
slot_pin_w      = bayo_pin_w_deg + 2;
slot_axial      = collar_h - bayo_drop_extra;
pin_z_on_collar = collar_h - bayo_pin_h - bayo_drop_extra;

// --- Cap (snap-in) ---
cap_disc_od  = sleeve_od + 2*cap_disc_extra;             // overhang beyond sleeve
cap_skirt_od = sleeve_id - 2*cap_skirt_clearance;        // inserts into sleeve
// Skirt length is measured from the disc bottom face, which rests on top of
// the upper lip (z = sleeve_h + top_lip_h in top-part frame). To reach the
// snap groove (at z = sleeve_h - cap_snap_depth_from_top) the skirt must
// span: top_lip_h + cap_snap_depth_from_top, plus snap lip + chamfer ramp.
cap_skirt_h  = top_lip_h + cap_snap_depth_from_top
               + cap_snap_h + cap_snap_chamfer + 0.5;     // 0.5 mm clearance below snap lip
cap_snap_od  = sleeve_id + 2*cap_snap_t;                 // snap lip outer diameter
// Circumferential groove on the sleeve inner wall, near the top edge
groove_id    = sleeve_id;
groove_od    = sleeve_id + 2*cap_snap_t + 0.2;           // slightly wider than snap lip
groove_h     = cap_snap_h + 0.4;                         // axial clearance for snap
groove_z     = sleeve_h - cap_snap_depth_from_top;       // groove base elevation
// Cap internal cavity (open at the bottom): skirt becomes a tube of wall
// thickness `wall`; the top disc stays solid as a roof of thickness cap_disc_h.
cap_bore_d   = cap_skirt_od - 2*wall;

echo("sleeve_od=", sleeve_od, "sleeve_id=", sleeve_id, "sleeve_h=", sleeve_h);
echo("collar_od=", collar_od, "collar_id=", collar_id);
echo("cap roof=", cap_disc_h, "  cap skirt wall=", wall, "  cap_bore_d=", cap_bore_d);
echo("wall remaining below bayonet slot=", wall - slot_depth_r);
echo("wall remaining below snap groove=", wall - cap_snap_t - 0.1);

// =============================================================================
//                                HELPERS
// =============================================================================

// Hollow cylindrical sector (angular ring).
//   r1 = inner radius, r2 = outer radius, h = height, a = angular span (degrees)
module ring_sector(r1, r2, h, a) {
    rotate_extrude(angle = a, $fn = 160)
        translate([r1, 0, 0])
            square([r2 - r1, h]);
}

// Bayonet pin: radial tooth pointing OUTWARD on the bottom collar.
module bayonet_pin(r_inner, h, w_deg, t) {
    rotate([0, 0, -w_deg/2])
        ring_sector(r_inner, r_inner + t, h, w_deg);
}

// Inverted-L bayonet slot, carved into the INNER WALL of the sleeve.
// The three sectors overlap by `eps` to prevent CGAL orphan faces.
//
// All sectors are centred on theta=0 to match the pin centring done by
// `bayonet_pin()`: the entry slot spans [-w/2, +w/2], the retention notch is
// at [twist_deg - w/2, twist_deg + w/2].  The bottom part is then rotated by
// +twist_deg in the locked view to bring the pin into the retention notch.
module bayonet_slot_L(r_inner_wall, axial_in, h_pin, w_pin_deg, twist_deg, drop_extra) {
    eps = 0.05;
    r1 = r_inner_wall - eps;
    r2 = r_inner_wall + slot_depth_r + eps;

    rotate([0, 0, -w_pin_deg/2]) {
        // 1) Vertical entry slot (open at the bottom edge)
        translate([0, 0, -eps])
            ring_sector(r1, r2, axial_in + eps, w_pin_deg);

        // 2) Horizontal travel (angular span: w_pin_deg + twist_deg)
        translate([0, 0, axial_in - h_pin - eps])
            ring_sector(r1, r2, h_pin + 2*eps, w_pin_deg + twist_deg);

        // 3) Retention notch at end of travel
        rotate([0, 0, twist_deg])
            translate([0, 0, axial_in - h_pin - eps])
                ring_sector(r1, r2, h_pin + drop_extra + 2*eps, w_pin_deg);
    }
}

// =============================================================================
// 2-D PROFILE OF THE PARABOLIC CUT (vertex at cap center)
// -----------------------------------------------------------------------------
// Builds a "parabolic spike" region:
//   * vertex (cusp) at the cap center (0,0)
//   * two symmetric parabolic branches opening toward the rim
//   * the opening at the rim spans `arc_deg` degrees along the circular edge
//
// Parabola equation (axis along +y, vertex at origin):
//      y(x) = (x/x_edge)^2 * y_edge
// where (+/-x_edge, y_edge) are the two points on the circle of radius r_open
// at angles +/-arc_deg/2 measured from +y.
//
// Corner smoothing via offset(r) offset(-r) rounds the cusp and the junction
// with the outer arc.
//
// If `open_to_edge = true`, r_open is extended 1 mm beyond `outer_r` so that
// the cut is naturally clipped at the cap disc boundary.
// =============================================================================
module parabolic_cut_2d(outer_r, arc_deg, open_to_edge, edge_inset, corner_r, n_seg) {
    r_open = open_to_edge ? outer_r + 1.0 : outer_r - edge_inset;
    x_edge = r_open * sin(arc_deg/2);
    y_edge = r_open * cos(arc_deg/2);

    // Parabolic branches: t goes from 0 (vertex) to 1 (point on rim)
    par_right = [
        for (i = [0 : n_seg])
            let(t = i / n_seg, x = x_edge * t)
                [x, (x*x / (x_edge*x_edge)) * y_edge]
    ];
    par_left = [
        for (i = [n_seg : -1 : 0])
            let(t = i / n_seg, x = -x_edge * t)
                [x, (x*x / (x_edge*x_edge)) * y_edge]
    ];

    // Outer arc (follows the circle of radius r_open) from right to left
    n_arc = max(8, floor(n_seg/2));
    arc_pts = [
        for (i = [0 : n_arc])
            let(theta = arc_deg/2 - arc_deg * i / n_arc)
                [r_open * sin(theta), r_open * cos(theta)]
    ];

    pts = concat(par_right, arc_pts, par_left);

    offset(r =  corner_r)
        offset(r = -corner_r)
            polygon(pts);
}

// =============================================================================
// TOP PART: resting lip + sleeve + internal bayonet slots + snap groove
// -----------------------------------------------------------------------------
// Reference frame: sleeve base at z=0, lip at top.
// =============================================================================
module top_part() {
    difference() {
        union() {
            // Tubular sleeve
            cylinder(h = sleeve_h, d = sleeve_od);
            // Top lip (rests on the desk surface)
            translate([0, 0, sleeve_h])
                cylinder(h = top_lip_h, d = top_lip_od);
            // Aesthetic chamfer on top of lip
            translate([0, 0, sleeve_h + top_lip_h - 0.01])
                cylinder(h = 1.2, d1 = top_lip_od, d2 = top_lip_od - 2.4);
        }

        // Through-hole for cables
        translate([0, 0, -1])
            cylinder(h = sleeve_h + top_lip_h + 4, d = sleeve_id);

        // Bayonet slots in the INNER WALL of the sleeve (open at the bottom)
        for (i = [0 : bayo_pins-1]) {
            rotate([0, 0, i * 360/bayo_pins])
                bayonet_slot_L(
                    r_inner_wall = sleeve_id/2,
                    axial_in     = slot_axial,
                    h_pin        = slot_pin_h,
                    w_pin_deg    = slot_pin_w,
                    twist_deg    = bayo_twist_deg,
                    drop_extra   = bayo_drop_extra
                );
        }

        // Circumferential internal snap groove for the cap (full ring).
        // Positioned near the top of the sleeve, well above the bayonet slots.
        translate([0, 0, groove_z])
            ring_sector(groove_id/2 - 0.05, groove_od/2, groove_h, 360);

        // Internal top chamfer (eases cap and cable insertion)
        translate([0, 0, sleeve_h + top_lip_h - 1.5])
            cylinder(h = 1.7, d1 = sleeve_id, d2 = sleeve_id + 2);

        // Internal bottom chamfer (eases collar entry)
        translate([0, 0, -0.01])
            cylinder(h = 1.2, d1 = sleeve_id + 1.6, d2 = sleeve_id);
    }
}

// =============================================================================
// BOTTOM PART: lip + collar + external bayonet pins
// -----------------------------------------------------------------------------
// Reference frame: lip/collar interface at z=0.
//   * lip    : z in [-bot_lip_h, 0]
//   * collar : z in [0, collar_h]
//   * pins   : at z = collar_h - bayo_pin_h - bayo_drop_extra
// =============================================================================
module bottom_part() {
    union() {
        difference() {
            union() {
                // Bottom lip
                translate([0, 0, -bot_lip_h])
                    cylinder(h = bot_lip_h, d = bot_lip_od);
                // Aesthetic chamfer below the lip
                translate([0, 0, -bot_lip_h - 1.2 + 0.01])
                    cylinder(h = 1.2, d1 = bot_lip_od - 2.4, d2 = bot_lip_od);
                // Inner collar
                cylinder(h = collar_h, d = collar_od);
            }
            // Through-hole for cables
            translate([0, 0, -bot_lip_h - 2])
                cylinder(h = bot_lip_h + collar_h + 4, d = collar_id);
            // Top entry chamfer on collar (outer edge bevel, ~1 mm × 1 mm).
            // Built as a thin ring with triangular cross-section: an outer
            // cylinder slightly larger than the collar (so its lateral wall
            // does NOT coincide with the collar wall — coincident faces would
            // cause CGAL to produce zero-thickness facets and a non-manifold
            // result) MINUS an inverted truncated cone that carves the slope.
            translate([0, 0, collar_h - 1.2])
                difference() {
                    cylinder(h = 1.4, d = collar_od + 0.2);
                    translate([0, 0, -0.1])
                        cylinder(h = 1.6, d1 = collar_od, d2 = collar_od - 2.0);
                }
        }

        // Bayonet pins on the outer wall of the collar
        for (i = [0 : bayo_pins-1]) {
            rotate([0, 0, i * 360/bayo_pins])
                translate([0, 0, pin_z_on_collar])
                    bayonet_pin(
                        r_inner = collar_od/2,
                        h       = bayo_pin_h,
                        w_deg   = bayo_pin_w_deg,
                        t       = bayo_pin_t
                    );
        }
    }
}

// =============================================================================
// CAP — SNAP-IN with parabolic opening
// -----------------------------------------------------------------------------
// Reference frame: bottom face of the top disc at z=0.
// Disc occupies z [0, cap_disc_h]; skirt hangs down (z [-cap_skirt_h, 0]).
// The snap lip is at the bottom end of the skirt.
//
// Cross-section: the cap is a BOTTOM-OPEN SHELL. External shape is unchanged;
// internally a cylinder of diameter cap_bore_d is subtracted from below,
// stopping at z=0 (bottom face of the disc). Result: the disc stays solid as
// a roof of thickness cap_disc_h, the skirt becomes a tube of wall thickness
// `wall`. The exposed flat annular surface on the underside of the roof is
// the natural mounting area for panel-mount accessories (USB-A panel-mount
// female, switches, LED holders, etc.).
//
// Placement in assembly: disc bottom face rests on the top edge of the sleeve
// (z = sleeve_h + top_lip_h in the top part reference frame).
// =============================================================================
module cap_part() {
    // Snap lip Z is anchored to the groove: in the assembled view the lip
    // bottom face must sit at z = groove_z (top-part frame). In the cap-local
    // frame the disc bottom face is at z=0 and the cap is placed at
    // z = sleeve_h + top_lip_h, so:
    //     snap_lip_z = groove_z - (sleeve_h + top_lip_h)
    //                = -(top_lip_h + cap_snap_depth_from_top)
    snap_lip_z = -(top_lip_h + cap_snap_depth_from_top);

    difference() {
        union() {
            // Top disc — stays SOLID, acts as roof over the internal cavity
            cylinder(h = cap_disc_h, d = cap_disc_od);
            // Aesthetic chamfer on top disc edge
            translate([0, 0, cap_disc_h - 0.01])
                cylinder(h = 0.8, d1 = cap_disc_od, d2 = cap_disc_od - 1.8);
            // Skirt that inserts into the sleeve
            translate([0, 0, -cap_skirt_h])
                cylinder(h = cap_skirt_h, d = cap_skirt_od);

            // Circumferential snap lip (outer ring)
            translate([0, 0, snap_lip_z])
                ring_sector(cap_skirt_od/2 - 0.01, cap_snap_od/2, cap_snap_h, 360);

            // Entry ramp below snap lip (cone that widens upward):
            // bottom diameter = cap_skirt_od, top diameter = cap_snap_od.
            translate([0, 0, snap_lip_z - cap_snap_chamfer])
                cylinder(h = cap_snap_chamfer + 0.01,
                         d1 = cap_skirt_od, d2 = cap_snap_od);
        }

        // Internal cavity, open at the BOTTOM: cylinder subtracted from below.
        // Starts 1 mm below the skirt bottom face and stops at z=0 (disc
        // lower face), leaving the disc intact as a roof of thickness
        // cap_disc_h. Skirt remaining wall = (cap_skirt_od - cap_bore_d)/2 = wall.
        translate([0, 0, -cap_skirt_h - 1])
            cylinder(h = cap_skirt_h + 1, d = cap_bore_d);

        // Parabolic opening (extruded through the full cap height)
        translate([0, 0, -cap_skirt_h - 1])
            linear_extrude(height = cap_disc_h + cap_skirt_h + 2)
                parabolic_cut_2d(
                    outer_r      = cap_disc_od/2,
                    arc_deg      = parab_arc_deg,
                    open_to_edge = parab_open_to_edge,
                    edge_inset   = parab_edge_inset,
                    corner_r     = parab_corner_radius,
                    n_seg        = parab_segments
                );
    }
}

// =============================================================================
// PLACEMENT HELPERS FOR ASSEMBLY / EXPLODED VIEW
// =============================================================================

// Bottom: lip/collar interface aligns with sleeve base (z=0 of top part).
// Pre-rotated by +bayo_twist_deg to bring each pin (defined centred at
// theta = i*360/bayo_pins) into its retention notch (located at
// theta = i*360/bayo_pins + bayo_twist_deg). This is the locked position.
module bottom_part_placed(extra_drop = 0) {
    translate([0, 0, -extra_drop])
        rotate([0, 0, bayo_twist_deg])
            bottom_part();
}

// Cap: disc bottom face rests on the top edge of the sleeve.
module cap_part_placed(extra_lift = 0) {
    translate([0, 0, sleeve_h + top_lip_h + extra_lift])
        cap_part();
}

// =============================================================================
// ASSEMBLY — standard entry point for the CAD build pipeline
// -----------------------------------------------------------------------------
// gap = 0 → fully assembled (parts touching).
// gap > 0 → exploded view, parts offset along +Z by `gap` mm.
// =============================================================================
module assembly(gap = 0) {
    color("DimGray")   top_part();
    color("SteelBlue") bottom_part_placed(extra_drop = gap);
    color("Khaki")     cap_part_placed(extra_lift = gap);
}

// =============================================================================
// LAYOUT
// =============================================================================
if (mode == "assembly") {
    assembly(gap = 0);
}
else if (mode == "exploded") {
    assembly(gap = explode_distance);
}
else if (mode == "top") {
    top_part();
}
else if (mode == "bottom") {
    bottom_part();
}
else if (mode == "cap") {
    cap_part();
}
else if (mode == "print") {
    // Print-ready layout: all parts flat on the build plate (z=0).
    //   top    : flipped — top lip face-down on plate; this way, no supports are needed
    //   bottom : bottom lip face-down (chamfered outer edge on plate)
    //   cap    : flipped — flat disc face-down on plate, skirt pointing up
    //            (avoids the ~9 mm disc overhang that would require supports)

    // Top — lip face-down
    translate([-(top_lip_od/2 + 5), 0, 0])
        rotate([180, 0, 0])
            translate([0, 0, -(sleeve_h + top_lip_h)])
                top_part();

    // Bottom — lip face-down
    translate([(bot_lip_od/2 + 5), 0, bot_lip_h + 1.2])
        bottom_part();

    // Cap — disc face-down (flat surface on plate, skirt + snap ring pointing up)
    translate([0, top_lip_od/2 + cap_disc_od/2 + 10, cap_disc_h])
        rotate([180, 0, 0])
            cap_part();
}
