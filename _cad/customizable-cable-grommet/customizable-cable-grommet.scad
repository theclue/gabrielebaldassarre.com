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

/* [Optional Connector Mounts] */

// Number of optional cap mounts
fruit_count = 0; // [0:1:2]

// Select a shared profile for mount 1
fruit_1_type = "USB-A"; // [USB-A:USB-A, USB-C:USB-C, RJ45:RJ45]

// Select a shared profile for mount 2
fruit_2_type = "USB-C"; // [USB-A:USB-A, USB-C:USB-C, RJ45:RJ45]

/* [Mount Layout] */

// Single mount center offset from cap center toward -Y (mm)
fruit_single_offset = 14;

// Pair midpoint offset from cap center toward -Y (mm)
fruit_pair_offset = 18;

// Pair center-to-center spacing (mm)
fruit_pair_spacing = 42;

// Difference in inclination of the two flange/screw lines (degrees)
fruit_v_angle = 30; // [0:1:180]

// Minimum margin from the cap edge (mm)
fruit_edge_margin = 1;

// Minimum margin from the existing parabolic cutout (mm)
fruit_cutout_margin = 1;

// Minimum margin between pair envelopes (mm)
fruit_between_margin = 1;

// Opening clearance per side beyond the nominal body width and height (mm; not a manufacturing tolerance)
fruit_body_clearance = 0.2;

// Diametral clearance added to nominal screw diameter; pitch is unchanged (mm; not a manufacturing tolerance)
fruit_screw_clearance = 0.2;

/* [USB-A best-effort] */

// User-authorized editable estimate; not measured, datasheet, standard, or universal.
usb_a_body_width = 15; // USB-A profile body width (mm)
usb_a_body_height = 13; // USB-A profile body height (mm)
usb_a_flange_width = 32; // USB-A profile flange envelope width (mm)
usb_a_flange_height = 20; // USB-A profile flange envelope height (mm)
usb_a_screw_pitch = 24; // USB-A profile screw center pitch (mm)
usb_a_screw_nominal_diameter = 3; // USB-A profile nominal screw diameter (mm)
usb_a_depth = 30; // USB-A profile flange-front-to-body-rear depth (mm)
usb_a_opening_corner_radius = 0; // USB-A profile final opening corner radius (mm)

/* [USB-C best-effort] */

// User-authorized editable estimate; not measured, datasheet, standard, or universal.
usb_c_body_width = 13; // USB-C profile body width (mm)
usb_c_body_height = 11; // USB-C profile body height (mm)
usb_c_flange_width = 30; // USB-C profile flange envelope width (mm)
usb_c_flange_height = 18; // USB-C profile flange envelope height (mm)
usb_c_screw_pitch = 22; // USB-C profile screw center pitch (mm)
usb_c_screw_nominal_diameter = 3; // USB-C profile nominal screw diameter (mm)
usb_c_depth = 25; // USB-C profile flange-front-to-body-rear depth (mm)
usb_c_opening_corner_radius = 0; // USB-C profile final opening corner radius (mm)

/* [RJ45 user measured] */

// Body, flange, tangent gap, and depth are user measurements; pitch is derived
// from the measured tangent gap and assumed nominal M3 diameter. Actual hole was not measured.
rj45_body_width = 15.70; // RJ45 profile body width, user measured (mm)
rj45_body_height = 13.25; // RJ45 profile body height, user measured (mm)
rj45_flange_width = 35.50; // RJ45 profile flange envelope width including ears, user measured (mm)
rj45_flange_height = 22.50; // RJ45 profile flange envelope height, user measured (mm)
rj45_screw_pitch = 26.70; // Derived from 15.70 mm body width + 2*(4 mm tangent gap + 3 mm nominal diameter/2)
rj45_screw_nominal_diameter = 3; // Assumed nominal M3; actual hole not measured (mm)
rj45_depth = 30.50; // RJ45 profile flange-front-to-body-rear depth, user measured (mm)
rj45_opening_corner_radius = 0; // RJ45 profile final opening corner radius (mm)

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
/* [Hidden] */
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

// Conservative boundaries derived from the existing cap and assembled passage.
fruit_cap_surface_top_z = cap_disc_h - 0.01 + 0.8;
fruit_cap_flat_top_r = (cap_disc_od - 1.8)/2;
fruit_cap_placement_z = sleeve_h + top_lip_h;
fruit_collar_reach_depth = fruit_cap_placement_z - collar_h;
fruit_base_passage_r = min(cap_bore_d/2, sleeve_id/2);
fruit_collar_passage_r = min(cap_bore_d/2, sleeve_id/2, collar_id/2);

// Named internal epsilon crosses the cap faces; it is not a clearance or feature size.
fruit_face_epsilon = 0.01;

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

// Resolvers and validation for the shared editable connector profiles.
// Feature traceability: REQ-MOUNT-TYPES, REQ-DATA-AND-FIT.
function fruit_slot_type(slot) = slot == 1 ? fruit_1_type : fruit_2_type;
function fruit_type_is_supported(type) = type == "USB-A" || type == "USB-C" || type == "RJ45";
function fruit_profile_for_type(type) = type == "USB-A"
    ? [usb_a_body_width, usb_a_body_height, usb_a_flange_width, usb_a_flange_height,
       usb_a_screw_pitch, usb_a_screw_nominal_diameter, usb_a_depth, usb_a_opening_corner_radius]
    : type == "USB-C"
        ? [usb_c_body_width, usb_c_body_height, usb_c_flange_width, usb_c_flange_height,
           usb_c_screw_pitch, usb_c_screw_nominal_diameter, usb_c_depth, usb_c_opening_corner_radius]
        : type == "RJ45"
            ? [rj45_body_width, rj45_body_height, rj45_flange_width, rj45_flange_height,
               rj45_screw_pitch, rj45_screw_nominal_diameter, rj45_depth, rj45_opening_corner_radius]
            : [];
function fruit_is_finite(value) = is_num(value) && (value - value == 0);
function fruit_all_finite(values, i = 0) = i >= len(values)
    ? true
    : fruit_is_finite(values[i]) && fruit_all_finite(values, i + 1);
function fruit_profile_positive(profile) =
    profile[0] > 0 && profile[1] > 0 && profile[2] > 0 && profile[3] > 0
    && profile[4] > 0 && profile[5] > 0 && profile[6] > 0;

// Feature traceability: REQ-DATA-AND-FIT, REQ-FLANGE, REQ-CAP-ONLY.
// Profile vector order: body W/H, flange W/H, screw pitch/nominal diameter,
// front-plane-to-rear depth, and final opening corner radius.
function fruit_resolved_slot(profile) = [
    profile,
    profile[0] + 2*fruit_body_clearance,
    profile[1] + 2*fruit_body_clearance,
    profile[5] + fruit_screw_clearance,
    max(0, profile[6] - fruit_cap_surface_top_z),
    max(max(profile[2], profile[0] + 2*fruit_body_clearance),
        profile[4] + profile[5] + fruit_screw_clearance),
    max(max(profile[3], profile[1] + 2*fruit_body_clearance),
        profile[5] + fruit_screw_clearance)
];
function fruit_data_profile(data) = data[0];
function fruit_data_opening_width(data) = data[1];
function fruit_data_opening_height(data) = data[2];
function fruit_data_hole_diameter(data) = data[3];
function fruit_data_body_below_cap(data) = data[4];
function fruit_data_keepout_width(data) = data[5];
function fruit_data_keepout_height(data) = data[6];

function fruit_rect_corners(w, h) = [
    [-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]
];
function fruit_transform_point(point, cx, cy, angle) = [
    cx + point[0]*cos(angle) - point[1]*sin(angle),
    cy + point[0]*sin(angle) + point[1]*cos(angle)
];
function fruit_transform_rect(w, h, cx, cy, angle) = [
    for (point = fruit_rect_corners(w, h)) fruit_transform_point(point, cx, cy, angle)
];
function fruit_radial_norm(x, y) =
    let(scale = max(abs(x), abs(y)))
        scale == 0 ? 0 : scale*sqrt((x/scale)*(x/scale) + (y/scale)*(y/scale));
function fruit_points_fit_radius(points, radius, margin = 0, i = 0) = i >= len(points)
    ? true
    : fruit_radial_norm(points[i][0], points[i][1]) + margin < radius
      && fruit_points_fit_radius(points, radius, margin, i + 1);
function fruit_flange_points_fit_cap(points, i = 0) = i >= len(points)
    ? true
    : 2*(fruit_radial_norm(points[i][0], points[i][1]) + fruit_edge_margin)
      + clearance + 1.8 < hole_dia + 2*cap_disc_extra
      && fruit_flange_points_fit_cap(points, i + 1);
function fruit_points_max_y(points, i = 0) = i >= len(points)
    ? points[0][1]
    : max(points[i][1], fruit_points_max_y(points, i + 1));
function fruit_body_corner_fits(point, opening_w, opening_h, radius) =
    let(dx = max(abs(point[0]) - (opening_w/2 - radius), 0),
        dy = max(abs(point[1]) - (opening_h/2 - radius), 0))
        dx*dx + dy*dy <= radius*radius;
function fruit_body_fits_opening(profile, data, corners, i = 0) = i >= len(corners)
    ? true
    : fruit_body_corner_fits(corners[i], fruit_data_opening_width(data),
                             fruit_data_opening_height(data), profile[7])
      && fruit_body_fits_opening(profile, data, corners, i + 1);
function fruit_screw_pattern_fits(profile, data) =
    let(pitch = profile[4], hole_d = fruit_data_hole_diameter(data),
        flange_w = profile[2], flange_h = profile[3],
        opening_w = fruit_data_opening_width(data))
        pitch/2 + hole_d/2 < flange_w/2
        && hole_d/2 < flange_h/2
        && pitch > hole_d
        && pitch > opening_w + hole_d;
function fruit_hole_centers(profile, cx, cy, angle) = [
    for (x = [-profile[4]/2, profile[4]/2])
        fruit_transform_point([x, 0], cx, cy, angle)
];

// Count-two overlap uses SAT on the edge-normal axes of both expanded keepout rectangles.
function fruit_local_axis(angle, index) = index == 0
    ? [cos(angle), sin(angle)] : [-sin(angle), cos(angle)];
function fruit_projection_radius(w, h, angle, axis) =
    w/2*abs(axis[0]*cos(angle) + axis[1]*sin(angle))
    + h/2*abs(-axis[0]*sin(angle) + axis[1]*cos(angle));
function fruit_sat_separated(axis, c1, c2, w1, h1, a1, w2, h2, a2) =
    abs((c2[0]-c1[0])*axis[0] + (c2[1]-c1[1])*axis[1])
    > fruit_projection_radius(w1, h1, a1, axis)
      + fruit_projection_radius(w2, h2, a2, axis);
function fruit_pair_has_sat(axes, i, c1, c2, w1, h1, a1, w2, h2, a2) = i >= len(axes)
    ? false
    : fruit_sat_separated(axes[i], c1, c2, w1, h1, a1, w2, h2, a2)
      || fruit_pair_has_sat(axes, i + 1, c1, c2, w1, h1, a1, w2, h2, a2);
function fruit_pair_separated(c1, a1, data1, c2, a2, data2, margin) =
    let(w1 = fruit_data_keepout_width(data1) + margin,
        h1 = fruit_data_keepout_height(data1) + margin,
        w2 = fruit_data_keepout_width(data2) + margin,
        h2 = fruit_data_keepout_height(data2) + margin,
        axes = [fruit_local_axis(a1, 0), fruit_local_axis(a1, 1),
                fruit_local_axis(a2, 0), fruit_local_axis(a2, 1)])
        fruit_pair_has_sat(axes, 0, c1, c2, w1, h1, a1, w2, h2, a2);

// Diagnostic bound for the existing pair layout: both centers share the same Y.
// Separation is strict; this value is reported only and never changes the layout.
function fruit_pair_min_spacing(a1, data1, a2, data2, margin) =
    let(w1 = fruit_data_keepout_width(data1) + margin,
        h1 = fruit_data_keepout_height(data1) + margin,
        w2 = fruit_data_keepout_width(data2) + margin,
        h2 = fruit_data_keepout_height(data2) + margin,
        axes = [fruit_local_axis(a1, 0), fruit_local_axis(a1, 1),
                fruit_local_axis(a2, 0), fruit_local_axis(a2, 1)])
        min([
            for (axis = axes)
                if (abs(axis[0]) > 0)
                    (fruit_projection_radius(w1, h1, a1, axis)
                     + fruit_projection_radius(w2, h2, a2, axis)) / abs(axis[0])
        ]);

// Diagnostic helpers only: report the current layout and the limiting constraint.
// Bounds are approximate, strict, and local to one check; nothing is repositioned.
function fruit_layout_context(slot, cy, angle) =
    str("Mount ", slot, " (", fruit_slot_type(slot), "): ",
        fruit_count == 2
            ? str("fruit_v_angle=", fruit_v_angle, " deg (this mount ", angle,
                  " deg), fruit_pair_spacing=", fruit_pair_spacing,
                  " mm, fruit_pair_offset=", -cy, " mm. ")
            : str("fruit_single_offset=", -cy, " mm. "));
function fruit_points_required_radius(points, padding = 0) =
    max([for (point = points) fruit_radial_norm(point[0], point[1])]) + padding;
function fruit_pair_max_spacing(points, cx, radius, padding = 0) =
    let(available = radius - padding, side = cx < 0 ? -1 : 1)
        min([
            for (point = points)
                available > abs(point[1])
                    ? 2*(available*sqrt(max(0, 1 - (point[1]/available)*(point[1]/available)))
                         - side*(point[0] - cx))
                    : 0
        ]);
function fruit_radial_fit_message(code, component, slot, cx, cy, angle,
                                  points, radius, padding = 0) =
    let(required = fruit_points_required_radius(points, padding),
        minimum_hole = hole_dia + 2*(required - radius),
        spacing_limit = fruit_count == 2
            ? fruit_pair_max_spacing(points, cx, radius, padding) : 0)
        str(code, ": ", fruit_layout_context(slot, cy, angle),
            component, " requires radius > approximately ", required,
            " mm; available radius=", radius, " mm. ",
            "For this radial check with the other parameters unchanged: hole_dia > approximately ",
            minimum_hole, " mm (current ", hole_dia, " mm). ",
            fruit_count == 2
                ? (spacing_limit > 0
                    ? str("At this angle/offset, fruit_pair_spacing must also be < approximately ",
                          spacing_limit, " mm for this mount. ")
                    : "No positive pair spacing can satisfy this radial check at the current angle/offset. ")
                : "",
            "Adjust the angle/spacing/offset or increase hole_dia, then recheck all constraints. ",
            "These limits concern only this component; no automatic adjustment.");
function fruit_cutout_fit_message(slot, cy, angle, data) =
    let(minimum_offset = fruit_points_max_y(fruit_transform_rect(
            fruit_data_keepout_width(data), fruit_data_keepout_height(data), 0, 0, angle))
            + max(0, parab_corner_radius) + fruit_cutout_margin,
        offset_name = fruit_count == 2 ? "fruit_pair_offset" : "fruit_single_offset")
        str("E_FRUIT_CUTOUT_KEEP_OUT: ", fruit_layout_context(slot, cy, angle),
            "The flange/body footprint reaches the conservative cutout keepout. ",
            "With the current angle and profiles, ", offset_name,
            " must be > approximately ", minimum_offset, " mm; requested ", -cy, " mm. ",
            "Adjust ", offset_name,
            fruit_count == 2 ? " or fruit_v_angle" : "",
            ", keeping fruit_cutout_margin=", fruit_cutout_margin,
            " mm, then recheck the cap/bore and pair separation. No automatic adjustment.");

// Feature traceability: REQ-MOUNT-TYPES, REQ-DATA-AND-FIT.
module fruit_rounded_opening_2d(w, h, r) {
    if (r == 0)
        square([w, h], center = true);
    else
        hull() {
            for (x = [-1, 1], y = [-1, 1])
                translate([x*(w/2-r), y*(h/2-r)])
                    circle(r = r);
        }
}

// Feature traceability: REQ-FLANGE, REQ-DATA-AND-FIT.
module fruit_screw_pattern_2d(pitch, hole_d) {
    for (x = [-pitch/2, pitch/2])
        translate([x, 0])
            circle(d = hole_d);
}

// Feature traceability: REQ-FLANGE, REQ-CAP-ONLY.
module fruit_cap_cutters(data) {
    translate([0, 0, -fruit_face_epsilon])
        linear_extrude(height = fruit_cap_surface_top_z + 2*fruit_face_epsilon)
            union() {
                fruit_rounded_opening_2d(
                    fruit_data_opening_width(data), fruit_data_opening_height(data),
                    fruit_data_profile(data)[7]
                );
                fruit_screw_pattern_2d(
                    fruit_data_profile(data)[4], fruit_data_hole_diameter(data)
                );
            }
}

// Feature traceability: REQ-MOUNT-V. fruit_v_angle is the difference in
// local-X line inclinations; its visual included angle is 180-a.
module fruit_slot_transform(slot, cx, cy, angle) {
    data = fruit_resolved_slot(fruit_profile_for_type(fruit_slot_type(slot)));
    translate([cx, cy, 0])
        rotate([0, 0, angle])
            fruit_cap_cutters(data);
}

// Feature traceability: REQ-DATA-AND-FIT. Resolve a type only after its active
// enum and all selected profile fields have passed primitive-value checks.
module fruit_validate_slot(slot, cx, cy, angle) {
    type = fruit_slot_type(slot);
    assert(fruit_type_is_supported(type), "E_FRUIT_TYPE_ENUM") {
        let(profile = fruit_profile_for_type(type)) {
            assert(fruit_all_finite(profile), "E_FRUIT_PROFILE_NONFINITE") {
                assert(fruit_profile_positive(profile), "E_FRUIT_PROFILE_NONPOSITIVE") {
                    let(data = fruit_resolved_slot(profile)) {
                        assert(profile[7] >= 0
                               && profile[7] <= min(fruit_data_opening_width(data),
                                                   fruit_data_opening_height(data))/2,
                               "E_FRUIT_OPENING_RADIUS") {
                            assert(fruit_body_fits_opening(
                                       profile, data, fruit_rect_corners(profile[0], profile[1])),
                                   "E_FRUIT_BODY_CORNER_OUTSIDE_OPENING") {
                                assert(fruit_screw_pattern_fits(profile, data),
                                       "E_FRUIT_SCREW_PATTERN") {
                                     assert(fruit_flange_points_fit_cap(
                                                fruit_transform_rect(profile[2], profile[3], cx, cy, angle)),
                                            fruit_radial_fit_message(
                                                "E_FRUIT_FLANGE_OUTSIDE_FLAT_TOP", "Flange seating",
                                                slot, cx, cy, angle,
                                                fruit_transform_rect(profile[2], profile[3], cx, cy, angle),
                                                fruit_cap_flat_top_r, fruit_edge_margin)) {
                                        assert(fruit_points_fit_radius(
                                                   fruit_transform_rect(
                                                       fruit_data_opening_width(data),
                                                       fruit_data_opening_height(data), cx, cy, angle),
                                                   cap_bore_d/2),
                                                fruit_radial_fit_message(
                                                    "E_FRUIT_OPENING_OUTSIDE_BORE", "Opening footprint",
                                                    slot, cx, cy, angle,
                                                    fruit_transform_rect(
                                                        fruit_data_opening_width(data),
                                                        fruit_data_opening_height(data), cx, cy, angle),
                                                    cap_bore_d/2)) {
                                            assert(fruit_points_fit_radius(
                                                       fruit_hole_centers(profile, cx, cy, angle),
                                                       cap_bore_d/2,
                                                       fruit_data_hole_diameter(data)/2),
                                                    fruit_radial_fit_message(
                                                        "E_FRUIT_HOLE_OUTSIDE_BORE", "Screw-hole envelope",
                                                        slot, cx, cy, angle,
                                                        fruit_hole_centers(profile, cx, cy, angle),
                                                        cap_bore_d/2, fruit_data_hole_diameter(data)/2)) {
                                                let(body_below_cap = fruit_data_body_below_cap(data),
                                                    body_passage_r = body_below_cap < fruit_collar_reach_depth
                                                        ? fruit_base_passage_r : fruit_collar_passage_r) {
                                                    assert(fruit_points_fit_radius(
                                                               fruit_transform_rect(
                                                                   profile[0], profile[1], cx, cy, angle),
                                                               body_passage_r),
                                                            fruit_radial_fit_message(
                                                                body_below_cap < fruit_collar_reach_depth
                                                                    ? "E_FRUIT_BODY_CAP_COLLISION"
                                                                    : "E_FRUIT_BODY_COLLAR_COLLISION",
                                                                "Rear body envelope", slot, cx, cy, angle,
                                                                fruit_transform_rect(
                                                                    profile[0], profile[1], cx, cy, angle),
                                                                body_passage_r)) {
                                                        assert(-fruit_points_max_y(
                                                                   fruit_transform_rect(
                                                                       fruit_data_keepout_width(data),
                                                                       fruit_data_keepout_height(data),
                                                                       cx, cy, angle))
                                                               > max(0, parab_corner_radius)
                                                                 + fruit_cutout_margin,
                                                                fruit_cutout_fit_message(slot, cy, angle, data))
                                                            children();
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// Feature traceability: REQ-CAP-COUNT, REQ-MOUNT-V, REQ-DATA-AND-FIT.
module fruit_validation() {
    assert(fruit_is_finite(fruit_count)
           && floor(fruit_count) == fruit_count && fruit_count >= 0 && fruit_count <= 2,
           "E_FRUIT_COUNT") {
        if (fruit_count > 0) {
            assert(is_bool(parab_open_to_edge)
                   && fruit_is_finite(parab_arc_deg)
                   && parab_arc_deg > 0 && parab_arc_deg < 180
                   && fruit_is_finite(parab_segments)
                   && floor(parab_segments) == parab_segments && parab_segments > 0
                   && fruit_is_finite(parab_corner_radius)
                   && parab_corner_radius >= 0
                   && (parab_open_to_edge || fruit_is_finite(parab_edge_inset)),
                   "E_FRUIT_INVALID_PARABOLA_DOMAIN") {
                let(parab_open_r = parab_open_to_edge
                                   ? cap_disc_od/2 + 1 : cap_disc_od/2 - parab_edge_inset) {
                    assert(parab_open_r > 0, "E_FRUIT_INVALID_PARABOLA_DOMAIN") {
                        assert(fruit_is_finite(fruit_body_clearance)
                               && fruit_is_finite(fruit_screw_clearance),
                               "E_FRUIT_CLEARANCE") {
                            assert(fruit_body_clearance >= 0 && fruit_screw_clearance >= 0,
                                   "E_FRUIT_CLEARANCE") {
                                 assert(fruit_is_finite(fruit_edge_margin)
                                        && fruit_is_finite(fruit_cutout_margin)
                                        && fruit_edge_margin >= 0 && fruit_cutout_margin >= 0,
                                        str("E_FRUIT_LAYOUT: fruit_edge_margin and fruit_cutout_margin ",
                                            "must be finite numbers >= 0 mm; received fruit_edge_margin=",
                                            fruit_edge_margin, ", fruit_cutout_margin=", fruit_cutout_margin,
                                            ". Restore 1 mm defaults or enter nonnegative numeric values.")) {
                                    if (fruit_count == 1) {
                                         assert(fruit_is_finite(fruit_single_offset)
                                                && fruit_single_offset > 0,
                                                str("E_FRUIT_LAYOUT: fruit_single_offset must be a finite number > 0 mm; ",
                                                    "received ", fruit_single_offset, ". Default: 14 mm. ",
                                                    "The selected profile must still fit the cap and cutout.")) {
                                            fruit_validate_slot(1, 0, -fruit_single_offset, 0)
                                                children();
                                        }
                                    } else {
                                        assert(fruit_is_finite(fruit_pair_offset)
                                               && fruit_is_finite(fruit_pair_spacing)
                                               && fruit_is_finite(fruit_between_margin)
                                                && fruit_pair_offset > 0 && fruit_pair_spacing > 0
                                                && fruit_between_margin >= 0,
                                                str("E_FRUIT_LAYOUT: fruit_pair_spacing and fruit_pair_offset ",
                                                    "must be finite numbers > 0 mm; fruit_between_margin must be >= 0 mm. ",
                                                    "Received spacing=", fruit_pair_spacing,
                                                    " mm, offset=", fruit_pair_offset,
                                                    " mm, margin=", fruit_between_margin,
                                                    " mm. Defaults: spacing 42 mm, offset 18 mm, margin 1 mm. ",
                                                    "A positive spacing must also satisfy the profile-dependent fit limits.")) {
                                             assert(fruit_is_finite(fruit_v_angle)
                                                    && fruit_v_angle > 0 && fruit_v_angle < 180,
                                                    str("E_FRUIT_V_ANGLE: fruit_v_angle must be a finite number ",
                                                        "strictly between 0 and 180 deg; received ", fruit_v_angle,
                                                        ". It is the difference between the two mount inclinations ",
                                                        "(each rotates by half, with opposite signs). Default: 30 deg (+/-15 deg). ",
                                                        "The chosen angle must also satisfy the cap, cutout, and pair-spacing limits.")) {
                                                fruit_validate_slot(1, -fruit_pair_spacing/2,
                                                                    -fruit_pair_offset, -fruit_v_angle/2)
                                                    fruit_validate_slot(2, fruit_pair_spacing/2,
                                                                        -fruit_pair_offset, fruit_v_angle/2)
                                                         let(profile1 = fruit_profile_for_type(fruit_1_type),
                                                             profile2 = fruit_profile_for_type(fruit_2_type),
                                                             data1 = fruit_resolved_slot(profile1),
                                                             data2 = fruit_resolved_slot(profile2),
                                                             minimum_spacing = fruit_pair_min_spacing(
                                                                 -fruit_v_angle/2, data1,
                                                                 fruit_v_angle/2, data2,
                                                                 fruit_between_margin)) {
                                                            assert(fruit_pair_separated(
                                                                       [-fruit_pair_spacing/2, -fruit_pair_offset],
                                                                       -fruit_v_angle/2, data1,
                                                                       [fruit_pair_spacing/2, -fruit_pair_offset],
                                                                       fruit_v_angle/2, data2,
                                                                       fruit_between_margin),
                                                                     str("E_FRUIT_PAIR_OVERLAP: ",
                                                                         fruit_1_type, " / ", fruit_2_type,
                                                                         " at fruit_v_angle=", fruit_v_angle,
                                                                         " deg (+/-", fruit_v_angle/2,
                                                                         " deg), fruit_pair_offset=", fruit_pair_offset, " mm",
                                                                         " require fruit_pair_spacing > approximately ",
                                                                        minimum_spacing, " mm with the current parameters; requested ",
                                                                        fruit_pair_spacing, " mm. Suggested spacing: ",
                                                                        (floor(minimum_spacing*10) + 1)/10,
                                                                        " mm (next 0.1 mm step above the limit). ",
                                                                        "This includes flange/body envelopes and fruit_between_margin=",
                                                                        fruit_between_margin, " mm. No automatic adjustment."))
                                                                children();
                                                        }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// Feature traceability: REQ-CAP-COUNT, REQ-CAP-ONLY.
module fruit_features() {
    fruit_validation() {
        if (fruit_count == 1)
            fruit_slot_transform(1, 0, -fruit_single_offset, 0);
        else if (fruit_count == 2) {
            fruit_slot_transform(1, -fruit_pair_spacing/2, -fruit_pair_offset,
                                 -fruit_v_angle/2);
            fruit_slot_transform(2, fruit_pair_spacing/2, -fruit_pair_offset,
                                 fruit_v_angle/2);
        }
    }
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

        // Optional connector openings are subtracted from the cap only.
        if (is_num(fruit_count) && fruit_count > 0)
            fruit_features();
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

// Validate active mount data even when the selected view does not include the cap.
fruit_validation();

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
