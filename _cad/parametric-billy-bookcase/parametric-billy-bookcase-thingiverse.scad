// --- Parametric Billy-style Bookcase - open shelving, toe-kick & top cap ---
// Parametric generator of "Billy"-style bookcases: open shelving, with a
// toe-kick and crown, optional back panel (nailed or slide-in into a groove),
// variable number of inner shelves.  The h/l/w dims are of the finished unit.
//
// Axes (woodworkers-lib):  dim = [ l (X, width) , w (Y, depth) , h (Z, height) ]
//   l -> width   (X)
//   w -> depth   (Y)
//   h -> height  (Z)
//
// The cutlist is extracted from the OpenSCAD ECHO log:
//   - woodworkers-lib:   "plane (left):  18 x 280 x 1900"  (readable on screen)
//   - BOM cutplanner:    {"name":..,"length":..,"width":..,"thickness":..}
//     compatible with github.com/uberbruns/cutplanner (serve/write-bom).
//
// Author  : Gabriele Baldassarre
// Created : 2026-09-20
// License : GPL-3.0 - code portions from "woodworkers-lib" by fxdave
//           (https://github.com/fxdave/woodworkers-lib), license GPL-3.0;
//           full text in woodworkers/LICENSE.  The combined file is
//           distributed under the GPL-3.0 terms.

/* [Final dimensions (unit)] */
// Final width - l, X axis (mm)
width_l  = 800;   // [300:10:1200]
// Final depth - w, Y axis (mm)
depth_w  = 280;   // [150:10:600]
// Final height - h, Z axis (mm)
height_h = 1900;  // [600:10:2400]

/* [Material] */
// Frame wood thickness (mm)
wood_thickness = 18;  // [10:1:30]
// Back panel thickness (mm)
back_thickness = 6;   // [3:1:18]

/* [Toe kick] */
// Toe-kick height (mm)
toekick_height = 70;  // [0:5:200]
// Toe-kick front rail recess (mm)
toekick_recess_front = 30;  // [0:5:120]
// Toe-kick back rail recess (mm)
toekick_recess_back  = 0;   // [0:5:120]

/* [Crown] */
// Crown thickness (mm)
crown_thickness = 18; // [10:1:40]
// Height of the anti-racking rail under the crown (mm).
// Inserted automatically only without a back or with a nailed back;
// the original Billy (inset back) does not have it.
top_rail_height = 60;  // [0:5:200]

/* [Shelves] */
// Number of inner shelves (excluding carcass bottom and crown)
shelf_count = 4;      // [0:1:12]
// Shelf recess from the front face (mm)
shelf_recess_front = 3;  // [0:1:30]
// Force a fixed shelf exactly at the opening center (in addition to shelf_count)
center_shelf = "no";  // [yes:Additional centered shelf, no:No]

/* [Back panel] */
// Back panel presence
has_back = "yes";      // [yes:With back panel, no:Without back]
// Back panel fixing type
back_style = "nailed";  // [nailed:Nailed on back, slot:Slide-in groove]
// Groove depth per side (slide-in only) (mm)
groove_depth = 8;     // [4:1:15]
// Back panel setback from the rear (slide-in only) (mm)
back_offset  = 12;    // [0:1:40]
// Groove width clearance vs back thickness (slide-in only) (mm)
groove_slop = 0.4;    // [0:0.1:2]
// Back panel undersizing per side: it must not touch the groove bottom (mm)
back_fit_clearance = 1.0;  // [0:0.5:5]

/* [Shelf pin holes] */
// Shelf-pin hole battery on the sides (shown in preview; excluded from the STL/3MF)
shelf_holes = "yes";   // [yes:Show holes, no:No]
// Shelf pin hole diameter (mm)
shelf_hole_dia = 5;   // [3:0.5:10]
// Vertical pitch of the shelf-pin hole battery (mm)
shelf_hole_pitch = 32;  // [16:1:64]
// Hole columns distance from the front/back edges (mm)
shelf_hole_inset = 37;  // [20:1:100]

/* [View] */
// Render mode
mode = "assembly";  // [assembly:Assembled, exploded:Exploded, print:Solid (STL/3MF)]

/* [Quality] */
$fn = 32; // [6:2:128]

/* [Hidden] */

// --- Embedded woodworkers library to make this project compatible with the Thingiverse Customizer  --
// Copy of woodworkers-lib std.scad (fxdave, GPL-3.0):
// https://github.com/fxdave/woodworkers-lib
thick=18;
rounding=2;

module planeFront(
    dim,
    l=0,r=0,t=0,b=0,
    ll=0,rr=0,tt=0,bb=0,
    al=0,ar=0,at=0,ab=0,
    thick=thick
) {
    coords = __planeFront(dim, l,r,t,b, ll-al,rr-ar,tt-ar,bb-ab, thick);
    echo(str("plane (front):\t", __size_with_abs_text(coords[0], al,ar,at,ab,0,0)));
    translate(coords[1]) {
        __abs(coords[0], al,ar,at,ab,0,0);
        cube(coords[0]);
    };
}
module planeBack(
    dim,
    l=0,r=0,t=0,b=0,
    ll=0,rr=0,tt=0,bb=0,
    al=0,ar=0,at=0,ab=0,
    thick=thick
) {
    coords = __planeFront(dim, l,r,t,b, ll-al,rr-ar,tt-at,bb-ab, thick);
    echo(str("plane (back):\t", __size_with_abs_text(coords[0], al,ar,at,ab,0,0)));
    translate([0, dim[1]-thick, 0]) translate(coords[1]) {
        __abs(coords[0], al,ar,at,ab,0,0);
        cube(coords[0]);
    };
}
module planeLeft(
    dim,
    f=0,B=0,t=0,b=0,
    ff=0,BB=0,tt=0,bb=0,
    af=0,aB=0,at=0,ab=0,
    thick=thick
) {
    coords = __planeLeft(dim, f,B,t,b, ff-af,BB-aB,tt-at,bb-ab, thick);
    echo(str("plane (left):\t", __size_with_abs_text(coords[0], 0,0,at,ab,af,aB)));
    translate(coords[1]) {
        __abs(coords[0], 0,0,at,ab,af,aB);
        cube(coords[0]);
    };
}
module planeRight(
    dim,
    f=0,B=0,t=0,b=0,
    ff=0,BB=0,tt=0,bb=0,
    af=0,aB=0,at=0,ab=0,
    thick=thick
) {
    coords = __planeLeft(dim, f,B,t,b, ff-af,BB-aB,tt-at,bb-ab, thick);
    echo(str("plane (right):\t", __size_with_abs_text(coords[0], 0,0,at,ab,af,aB)));
    translate([dim[0]-thick, 0, 0]) translate(coords[1]) {
        __abs(coords[0], 0,0,at,ab,af,aB);
        cube(coords[0]);
    };
}
module planeBottom(
    dim,
    l=0,r=0,f=0,B=0,
    ll=0,rr=0,ff=0,BB=0,
    al=0,ar=0,af=0,aB=0,
    thick=thick
) {
    coords = __planeBottom(dim, l,r,f,B, ll-al,rr-ar,ff-af,BB-aB, thick);
    echo(str("plane (bottom):\t", __size_with_abs_text(coords[0], al,ar,0,0,af,aB)));
    translate(coords[1]) {
        __abs(coords[0], al,ar,0,0,af,aB);
        cube(coords[0]);
    };
}
module planeTop(
    dim,
    l=0,r=0,f=0,B=0,
    ll=0,rr=0,ff=0,BB=0,
    al=0,ar=0,af=0,aB=0,
    thick=thick
) {
    coords = __planeBottom(dim, l,r,f,B, ll-al,rr-ar,ff-af,BB-aB, thick);
    echo(str("plane (top):\t", __size_with_abs_text(coords[0], al,ar,0,0,af,aB)));
    translate([0, 0, dim[2]-thick]) translate(coords[1]) {
        __abs(coords[0], al,ar,0,0,af,aB);
        cube(coords[0]);
    };
}

/**
For exmaple 4 legs:
 leg(drawer, legHeight, l=2, f=3);
 leg(drawer, legHeight, r=2, f=3);
 leg(drawer, legHeight, l=2, B=2);
 leg(drawer, legHeight, r=2, B=2);
*/
module leg(dim, legHeight, l=0,r=0,f=0,B=0,ll=0,rr=0,ff=0,BB=0, thick=thick) {
    translate([
        (r!=0 || rr != 0) ? dim[0] : 0,
        (B!=0 || BB != 0) ? dim[1] : 0,
        0
    ])
    translate([
        l*thick-r*thick-rr,
        f*thick-B*thick-BB,
        0
    ])
    cylinder(legHeight, 9.5, 19.5);
}



module __abs(size,l,r,t,b,f,B) {
    translate([-l, 0, -b]) __rcube([l, size[1], size[2]+t+b]);
    translate([-l, -f, -b]) __rcube([size[0]+l+r, f, size[2]+t+b]);
    translate([0, 0, -b]) __rcube([size[0], size[1], b]);
    translate([size[0], 0, -b]) __rcube([r, size[1], size[2]+t+b]);
    translate([-l, size[1], -b]) __rcube([size[0]+l+r, B, size[2]+t+b]);
    translate([0, 0, size[2]]) __rcube([size[0], size[1], t]);
}

function __size_with_abs_text(size,l,r,t,b,f,B) = str(
    size[0],
    size[0] >= size[2] ? __abs_text(f,B) : "",
    size[0] >= size[1] ? __abs_text(t,b) : "",
    " ","x"," ",
    size[1],
    size[1] >= size[2] ? __abs_text(l,r) : "",
    size[1] >= size[0] ? __abs_text(t,b) : "",
    " ","x"," ",
    size[2],
    size[2] >= size[0] ? __abs_text(f,B) : "",
    size[2] >= size[1] ? __abs_text(l,r) : ""
);

function __abs_text(l,r) = l!=0 || r!=0 ? str(
        "(",
        l!=0 ? str(l, r!=0 ? "," : "") : "",
        r!=0 ? str(r) : "",
        ")"
    ) : "";

module __rcube(dim, rounding=rounding) {
    if(dim[0]*dim[1]*dim[2] != 0) {
        __nonCenteredRoundedCube(dim, min(rounding, min(dim)/3));
    }
}
module __nonCenteredRoundedCube(size, radius) {
    z1 = size[2] - radius;
    z2 = radius;
    x = size[0] / 2;
    y = size[1] / 2;
    hull() {
        translate([x, y, z1]) __rectangle(size[0], size[1], radius);
        translate([x, y, z2]) __rectangle(size[0], size[1], radius);
    }
}
module __rectangle(length, width, radius) {
    x = length - radius;
    y = width - radius;
    hull() {
        translate([(-x/2)+(radius/2), (-y/2)+(radius/2), 0]) sphere(radius);
        translate([(x/2)-(radius/2), (-y/2)+(radius/2), 0]) sphere(radius);
        translate([(-x/2)+(radius/2), (y/2)-(radius/2), 0]) sphere(radius);
        translate([(x/2)-(radius/2), (y/2)-(radius/2), 0]) sphere(radius);
    }
}

function __planeFront(dim, l,r,t,b, ll,rr,tt,bb, thick) = [
    [dim[0] + l*thick + r*thick + ll + rr, thick, dim[2] + b*thick + t*thick + bb + tt],
    [-l*thick - ll, 0, -b*thick - bb],
    str(dim[0] + l*thick + r*thick + ll + rr, "x", dim[2] + b*thick + t*thick + bb + tt, "x", thick)
];
function __planeLeft(dim, f,B,t,b, ff,BB,tt,bb, thick) = [
    [thick, dim[1] + f*thick + B*thick + ff + BB, dim[2] + b*thick + t*thick + bb + tt],
    [0, -f*thick - ff, -b*thick - bb],
    str(dim[1] + f*thick + B*thick + ff + BB, "x", dim[2] + b*thick + t*thick + bb + tt, "x", thick)
];
function __planeBottom(dim, l,r,f,B, ll,rr,ff,BB, thick) = [
    [dim[0] + l*thick + r*thick + ll + rr, dim[1] + f*thick + B*thick + ff + BB, thick],
    [-l*thick - ll, -f*thick - ff, 0],
    str(dim[0] + l*thick + r*thick + ll + rr, "x", dim[1] + f*thick + B*thick + ff + BB, "x", thick)
];


function __planeCoords(dim, x1, x2, y1, y2, xx1, xx2, yy1, yy2, thick) = [
    [
        dim[0] + x1*thick + x2*thick + xx1 + xx2,
        dim[1] + y1*thick + y2*thick + yy1 + yy2
    ],
    [
        -x1*thick - xx1,
        -y1*thick - yy1
    ],
    str(dim[0] + x1*thick + x2*thick + xx1 + xx2, "x",
        dim[1] + y1*thick + y2*thick + yy1 + yy2, "x", thick)
];
// --- End of woodworkers library ---

// --- Derived constants --------------------------------------------
TH  = wood_thickness;
eps = 0.05;
// Blind shelf pin hole depth (mm)
shelf_hole_depth = 12;
// Sides: one piece from floor to top (toe-kick + carcass, inset crown)
side_h    = height_h;
// Carcass height (sides minus toe-kick); the crown is inset at the top
carcass_h = side_h - toekick_height;
// Carcass depth: with a nailed back the carcass is shorter by back_thickness
// (the back occupies the last mm of the final depth and is nailed through it)
carcass_depth =
    ((has_back == "yes") && back_style == "nailed") ? depth_w - back_thickness : depth_w;
carcass   = [width_l, carcass_depth, carcass_h];
toekick_box = [width_l, carcass_depth, toekick_height];
rail_box    = [width_l, carcass_depth, top_rail_height];
// Bottom face of the inset crown = ceiling of the shelf opening
interior_top = carcass_h - crown_thickness;
// Anti-racking rail: only without a back or with a nailed back (Billy: absent)
has_top_rail = (has_back != "yes") || back_style == "nailed";
// Total shelves (with center_shelf one fixed shelf is added at the center)
total_shelves = (center_shelf == "yes") ? shelf_count + 1 : shelf_count;

if (!(interior_top > (total_shelves + 1) * TH))
    echo("ASSERT-FAILED: Insufficient height: reduce shelves/toe-kick/crown or increase h.");
if (!(width_l  > 2 * TH)) echo("ASSERT-FAILED: Insufficient width relative to the thickness.");
if (!(depth_w  > 2 * TH)) echo("ASSERT-FAILED: Insufficient depth relative to the thickness.");

// Slide-in: front face of the back (carcass-local Y), where the shelves stop
back_front_y = depth_w - back_offset - back_thickness;   // used for slide-in only

// Shelves: full depth to the carcass back (rear face of the sides); only the
// slide-in pulls them back to the groove start.  The nailed back
// is instead applied behind the carcass.
shelf_bb = ((has_back == "yes") && back_style == "slot") ? (back_front_y - carcass_depth) : 0;

// Shelf distribution in a cavity [lo, hi]: k equidistant pieces
// (lo = top face of the panel below, hi = bottom face of the panel above)
function even_positions(lo, hi, k) =
    k <= 0 ? [] :
    [ for (i = [1 : 1 : k]) lo + i * ((hi - lo - k * TH) / (k + 1)) + (i - 1) * TH ];

// Center of the inner opening (top face of carcass bottom <-> bottom face of crown)
center_z       = (TH + interior_top) / 2;
center_shelf_z = center_z - TH / 2;

// Shelf positions (bottom face).  With center_shelf: one fixed shelf at the
// center + shelf_count spread equidistantly in the two halves.
shelf_positions = (center_shelf == "yes")
    ? concat(even_positions(TH, center_shelf_z, floor(shelf_count / 2)),
             [center_shelf_z],
             even_positions(center_shelf_z + TH, interior_top, ceil(shelf_count / 2)))
    : even_positions(TH, interior_top, shelf_count);

// Average pitch, only for the on-screen summary
shelf_gap = (interior_top - (shelf_count + 1) * TH) / (shelf_count + 1);

// Z heights of the shelf pin holes (inside the opening, at constant pitch)
shelf_hole_zs = [ for (z = [TH + shelf_hole_pitch : shelf_hole_pitch
                            : interior_top - shelf_hole_pitch]) z ];

// Slide-in back extension into the grooves
back_left_x   = TH - groove_depth;
back_right_x  = width_l - TH + groove_depth;
back_bottom_z = TH - groove_depth;
back_top_z    = interior_top + groove_depth;
// Actual back engagement (< groove_depth) and actual groove width
back_seat = groove_depth - back_fit_clearance;
groove_w  = back_thickness + groove_slop;
groove_y0 = back_front_y - groove_slop / 2;

// --- Carcass structure modules (carcass-local coords, z from 0) -----

module Sides() {
    // One piece: the sides go all the way down to the floor, no side recess
    planeLeft(carcass,  bb = toekick_height, thick = TH);
    planeRight(carcass, bb = toekick_height, thick = TH);
}

module BottomPanel() {
    planeBottom(carcass, l = -1, r = -1, thick = TH);
}

module Shelves() {
    for (z = shelf_positions)
        translate([0, 0, z])
            planeBottom(carcass, l = -1, r = -1,
                        ff = -shelf_recess_front, BB = shelf_bb, thick = TH);
}

// Grooves for the slide-in back (sides + carcass bottom)
module BodyGrooves() {
    // left side
    translate([back_left_x, groove_y0 - eps, back_bottom_z])
        cube([groove_depth + eps, groove_w + 2 * eps, back_top_z - back_bottom_z]);
    // right side
    translate([width_l - TH - eps, groove_y0 - eps, back_bottom_z])
        cube([groove_depth + eps, groove_w + 2 * eps, back_top_z - back_bottom_z]);
    // carcass bottom (groove on the top side, toward the back)
    translate([TH - eps, groove_y0 - eps, back_bottom_z])
        cube([width_l - 2 * TH + 2 * eps, groove_w + 2 * eps, groove_depth + eps]);
}

module CarcassHoles() {
    if ((has_back == "yes") && back_style == "slot") BodyGrooves();
    // The hole battery is heavy for CGAL: excluded from the STL/3MF export (print)
    if (shelf_holes == "yes" && mode != "print") ShelfPinHoles();
}

module CarcassBody() {
    difference() {
        union() { Sides(); BottomPanel(); Shelves(); }
        CarcassHoles();
    }
}

module TopPanel() {
    // Inset crown between the sides, flush at the top: keeps the carcass square
    difference() {
        planeTop(carcass, l = -1, r = -1, thick = crown_thickness);
        if ((has_back == "yes") && back_style == "slot")
            // groove on the bottom side of the crown, toward the back
            translate([back_left_x, groove_y0 - eps, interior_top - eps])
                cube([back_right_x - back_left_x,
                      groove_w + 2 * eps,
                      groove_depth + eps]);
    }
}

module TopRail() {
    // Anti-racking back rail under the crown (absent with an inset back);
    // with a nailed back it acts as the nailing batten for the back
    if (has_top_rail && top_rail_height > 0)
        translate([0, 0, interior_top - top_rail_height])
            planeBack(rail_box, l = -1, r = -1, thick = TH);
}

module Back() {
    if ((has_back == "yes") && back_style == "slot") {
        translate([0, -back_offset, 0])
            planeBack(carcass,
                      ll = back_seat - TH, rr = back_seat - TH,
                      bb = back_seat - TH, tt = back_seat - crown_thickness,
                      thick = back_thickness);
    } else if (has_back == "yes") {                // nailed, applied behind the carcass
        translate([0, back_thickness, 0])
            planeBack(carcass, thick = back_thickness);
    }
}

// --- Toe-kick: only front and back rails, recessed -----

module ToeKick() {
    // The sides are already one piece; only front and back are recessed
    translate([0, toekick_recess_front, -toekick_height])
        planeFront(toekick_box, l = -1, r = -1, thick = TH);
    translate([0, -toekick_recess_back, -toekick_height])
        planeBack(toekick_box, l = -1, r = -1, thick = TH);
}

// --- Shelf pin holes (battery on the sides) -----------------------

// Horizontal blind hole in the side (X axis, toward the panel interior)
module side_hole_L(y, z, dia, depth) {
    translate([TH + eps, y, z]) rotate([0, -90, 0])
        cylinder(h = depth + eps, d = dia, $fn = 24);
}
module side_hole_R(y, z, dia, depth) {
    translate([width_l - TH - eps, y, z]) rotate([0, 90, 0])
        cylinder(h = depth + eps, d = dia, $fn = 24);
}

module ShelfPinHoles() {
    for (y = [shelf_hole_inset, carcass_depth - shelf_hole_inset])
        for (z = shelf_hole_zs) {
            side_hole_L(y, z, shelf_hole_dia, shelf_hole_depth);
            side_hole_R(y, z, shelf_hole_dia, shelf_hole_depth);
        }
}

// --- Assembly -------------------------------------------------

module Bookcase(explode = 0) {
    exp = explode * max(120, height_h * 0.12);

    translate([0, 0, toekick_height]) {
        // Sides (one piece down to the floor) + carcass bottom + shelves
        color([0.776, 0.612, 0.427]) CarcassBody();
        color([0.710, 0.565, 0.361]) TopRail();
        translate([0, 0, -explode * exp * 0.6])
            color([0.659, 0.475, 0.310]) ToeKick();
        translate([0, explode * exp * 0.8, 0])
            color([0.478, 0.322, 0.188]) Back();
        translate([0, 0, explode * exp])
            color([0.725, 0.549, 0.353]) TopPanel();
    }
}

// --- Export -------------------------------------------------------

echo(str("Billy - finished lxwxh: ", width_l, " x ", depth_w, " x ", height_h, " mm"));
echo(str("Carcass: ", width_l, " x ", carcass_depth, " x ", carcass_h,
         " mm | shelf spacing ~= ", round(shelf_gap), " mm | shelves: ", total_shelves));

// --- BOM for cutplanner (one JSON record per physical part) ---------
// Each entry: [name, face A, face B, thickness].  length/width are max/min
// of the two faces.  cutplanner ignores non-JSON echoes (e.g. "plane (...)").
bom = concat(
    [ ["Side left",   carcass_depth,    side_h,        TH],
      ["Side right",   carcass_depth,    side_h,        TH],
      ["Carcass bottom", width_l - 2 * TH, carcass_depth, TH],
      ["Crown",      width_l - 2 * TH, carcass_depth, crown_thickness] ],
    [ for (i = [0 : 1 : len(shelf_positions) - 1])
        [str("Shelf ", i + 1), width_l - 2 * TH,
         carcass_depth - shelf_recess_front + shelf_bb, TH] ],
    (has_top_rail && top_rail_height > 0)
        ? [ ["Back rail", width_l - 2 * TH, top_rail_height, TH] ] : [],
    (toekick_height > 0)
        ? [ ["Toe-kick front", width_l - 2 * TH, toekick_height, TH],
            ["Toe-kick back",  width_l - 2 * TH, toekick_height, TH] ] : [],
    (has_back == "yes")
        ? [ ["Back panel",
             (back_style == "slot") ? width_l - 2 * TH + 2 * back_seat : width_l,
             (back_style == "slot") ? carcass_h - TH - crown_thickness + 2 * back_seat
                                    : carcass_h,
             back_thickness] ] : []
);

for (p = bom)
    echo(str("{\"name\":\"", p[0],
             "\",\"length\":", max(p[1], p[2]),
             ",\"width\":",    min(p[1], p[2]),
             ",\"thickness\":", p[3], "}"));

// --- Hardware (BOM count) - WIP -------------------------
_pins  = 4 * len(shelf_positions);
_nails = ((has_back == "yes") && back_style == "nailed") ? ceil(2 * (width_l + carcass_h) / 100) : 0;
hardware = [
    [str("Shelf pins dia", shelf_hole_dia, "mm"), _pins],
    ["Nails/staples for back", _nails],
    ["Anti-tip bracket", 1],
];
echo("-- Hardware (BOM) --");
for (h = hardware) if (h[1] > 0) echo(str("HW | ", h[0], ": ", h[1]));

// --- Usable distance between shelves + drilling guide -------------
_tops = concat([TH], [ for (z = shelf_positions) z + TH ]);
_bots = concat(shelf_positions, [interior_top]);
echo(str("Usable compartment distance (mm): ",
         [ for (i = [0 : 1 : len(_bots) - 1]) round(_bots[i] - _tops[i]) ]));
echo(str("Shelf pin drilling: dia", shelf_hole_dia, " pitch ", shelf_hole_pitch,
         "mm | columns at ", shelf_hole_inset, "mm from edges | ",
         len(shelf_hole_zs), " holes/column x 2 columns x 2 sides"));

if (mode == "assembly") {
    Bookcase(explode = 0);
} else if (mode == "exploded") {
    Bookcase(explode = 1);
} else if (mode == "print") {
    Bookcase(explode = 0);
}
