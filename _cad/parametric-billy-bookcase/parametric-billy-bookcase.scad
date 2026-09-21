// ─── Parametric Billy-style Bookcase — open shelving, toe-kick & top cap ───
// Generatore parametrico di librerie stile "Billy": a giorno, con zoccolo a
// toe-kick e cappello, fondo opzionale (inchiodato o slide-in a scanalatura),
// ripiani interni a numero variabile.  Le quote h/l/w sono del manufatto finito.
//
// Assi (woodworkers-lib):  dim = [ l (X, larghezza) , w (Y, profondità) , h (Z, altezza) ]
//   l → larghezza  (X)
//   w → profondità (Y)
//   h → altezza    (Z)
//
// Il cutlist si estrae dal log ECHO di OpenSCAD:
//   - woodworkers-lib:   "plane (left):  18 × 280 × 1900"  (leggibile a schermo)
//   - BOM cutplanner:    {"name":..,"length":..,"width":..,"thickness":..}
//     compatibile con github.com/uberbruns/cutplanner (serve/write-bom).
//
// Author  : Gabriele Baldassarre
// Created : 2026-09-20

// NOTA licenza: woodworkers-lib è GPL-3.0;

use <woodworkers/std.scad>

/* [Dimensioni finite (manufatto)] */
// Larghezza finita — l, asse X (mm)
width_l  = 800;   // [300:10:1200]
// Profondità finita — w, asse Y (mm)
depth_w  = 280;   // [150:10:600]
// Altezza finita — h, asse Z (mm)
height_h = 1900;  // [600:10:2400]

/* [Materiale] */
// Spessore del legno della struttura (mm)
wood_thickness = 18;  // [10:1:30]
// Spessore del pannello di fondo (mm)
back_thickness = 6;   // [3:1:18]

/* [Zoccolo / Toe-kick] */
// Altezza dello zoccolo (mm)
toekick_height = 70;  // [0:5:200]
// Rientro della traversa anteriore del toe-kick (mm)
toekick_recess_front = 30;  // [0:5:120]
// Rientro della traversa posteriore del toe-kick (mm)
toekick_recess_back  = 0;   // [0:5:120]

/* [Cappello / Crown] */
// Spessore del cappello (mm)
crown_thickness = 18; // [10:1:40]
// Altezza della traversa anti-racking sotto il cappello (mm).
// Inserita in automatico solo senza fondo o con fondo inchiodato;
// nella Billy originale (fondo inset) non c'è.
top_rail_height = 60;  // [0:5:200]

/* [Ripiani] */
// Numero di ripiani interni (esclusi fondo cassa e cappello)
shelf_count = 4;      // [0:1:12]
// Recesso dei ripiani rispetto alla faccia frontale (mm)
shelf_recess_front = 3;  // [0:1:30]
// Forza un ripiano fisso esattamente al centro del vano (in più agli shelf_count)
center_shelf = false;  // [true:Sì, false:No]

/* [Fondo / Schienale] */
// Presenza del fondo
has_back = true;      // [true:Con fondo, false:Senza fondo]
// Tipo di fissaggio del fondo
back_style = "nailed";  // [nailed:Inchiodato sul retro, slot:Slide-in a scanalatura]
// Profondità della scanalatura per lato (solo slide-in) (mm)
groove_depth = 8;     // [4:1:15]
// Arretramento del fondo dal retro (solo slide-in) (mm)
back_offset  = 12;    // [0:1:40]
// Gioco in larghezza della scanalatura vs spessore fondo (solo slide-in) (mm)
groove_slop = 0.4;    // [0:0.1:2]
// Sottodimensionamento del fondo per lato: non tocca il fondo scanalatura (mm)
back_fit_clearance = 1.0;  // [0:0.5:5]

/* [Fori reggipiano] */
// Batteria fori reggipiano sui fianchi (mostrata in preview; esclusa dall'STL/3MF)
shelf_holes = true;   // [true:Sì, false:No]
// Diametro fori reggipiano (mm)
shelf_hole_dia = 5;   // [3:0.5:10]
// Passo verticale batteria fori reggipiano (mm)
shelf_hole_pitch = 32;  // [16:1:64]
// Distanza colonne fori dai bordi fronte/retro (mm)
shelf_hole_inset = 37;  // [20:1:100]

/* [Vista] */
// Modalità di render
mode = "assembly";  // [assembly:Assemblato, exploded:Esploso, print:Solido (STL/3MF)]

/* [Qualità] */
$fn = 32;

/* [Hidden] */

// ─── Costanti derivate ────────────────────────────────────────────
TH  = wood_thickness;
eps = 0.05;
// Profondità fori reggipiano ciechi (mm)
shelf_hole_depth = 12;
// Fianchi: corpo unico dal pavimento alla cima (toe-kick + cassa, cappello inset)
side_h    = height_h;
// Altezza cassa (fianchi meno toe-kick); il cappello è inset in cima
carcass_h = side_h - toekick_height;
// Profondità cassa: col fondo inchiodato la cassa è più corta di back_thickness
// (il fondo occupa gli ultimi mm della profondità finita e ci si inchioda sopra)
carcass_depth =
    (has_back && back_style == "nailed") ? depth_w - back_thickness : depth_w;
carcass   = [width_l, carcass_depth, carcass_h];
toekick_box = [width_l, carcass_depth, toekick_height];
rail_box    = [width_l, carcass_depth, top_rail_height];
// Faccia inferiore del cappello inset = tetto del vano ripiani
interior_top = carcass_h - crown_thickness;
// Traversa anti-racking: solo senza fondo o con fondo inchiodato (Billy: assente)
has_top_rail = !has_back || back_style == "nailed";
// Ripiani totali (col center_shelf se ne aggiunge uno fisso al centro)
total_shelves = center_shelf ? shelf_count + 1 : shelf_count;

assert(interior_top > (total_shelves + 1) * TH,
       "Altezza insufficiente: riduci ripiani/zoccolo/cappello o aumenta h.");
assert(width_l  > 2 * TH, "Larghezza insufficiente rispetto allo spessore.");
assert(depth_w  > 2 * TH, "Profondità insufficiente rispetto allo spessore.");

// Slide-in: faccia frontale del fondo (Y locale cassa), dove si fermano i ripiani
back_front_y = depth_w - back_offset - back_thickness;   // usato solo per slide-in
back_rear_y  = back_front_y + back_thickness;

// Ripiani: pieni fino al retro cassa (faccia posteriore dei fianchi); solo lo
// slide-in li arretra fino all'inizio della scanalatura.  Il fondo inchiodato
// va invece applicato dietro la cassa.
shelf_bb = (has_back && back_style == "slot") ? (back_front_y - carcass_depth) : 0;

// Distribuzione ripiani in una cavità [lo, hi]: k pezzi equidistanti
// (lo = faccia sup. del pannello sotto, hi = faccia inf. del pannello sopra)
function even_positions(lo, hi, k) =
    k <= 0 ? [] :
    let(gap = (hi - lo - k * TH) / (k + 1))
    [ for (i = [1 : 1 : k]) lo + i * gap + (i - 1) * TH ];

// Centro del vano interno (faccia sup. fondo cassa ↔ faccia inf. cappello)
center_z       = (TH + interior_top) / 2;
center_shelf_z = center_z - TH / 2;

// Posizioni (faccia inferiore) dei ripiani.  Con center_shelf: uno fisso al
// centro + shelf_count distribuiti equidistanti nelle due metà.
shelf_positions = center_shelf
    ? concat(even_positions(TH, center_shelf_z, floor(shelf_count / 2)),
             [center_shelf_z],
             even_positions(center_shelf_z + TH, interior_top, ceil(shelf_count / 2)))
    : even_positions(TH, interior_top, shelf_count);

// Passo medio, solo per il riepilogo a schermo
shelf_gap = (interior_top - (shelf_count + 1) * TH) / (shelf_count + 1);

// Quote Z dei fori reggipiano (dentro il vano, a passo costante)
shelf_hole_zs = [ for (z = [TH + shelf_hole_pitch : shelf_hole_pitch
                            : interior_top - shelf_hole_pitch]) z ];

// Estensione del fondo slide-in dentro le scanalature
back_left_x   = TH - groove_depth;
back_right_x  = width_l - TH + groove_depth;
back_bottom_z = TH - groove_depth;
back_top_z    = interior_top + groove_depth;
// Innesto reale del fondo (< groove_depth) e larghezza reale della scanalatura
back_seat = groove_depth - back_fit_clearance;
groove_w  = back_thickness + groove_slop;
groove_y0 = back_front_y - groove_slop / 2;

// ─── Moduli struttura cassa (coordinate locali cassa, z da 0) ─────

module Sides() {
    // Corpo unico: i fianchi scendono fino a terra, senza recesso laterale
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

// Scanalature per il fondo slide-in (fianchi + fondo cassa)
module BodyGrooves() {
    // fianco sinistro
    translate([back_left_x, groove_y0 - eps, back_bottom_z])
        cube([groove_depth + eps, groove_w + 2 * eps, back_top_z - back_bottom_z]);
    // fianco destro
    translate([width_l - TH - eps, groove_y0 - eps, back_bottom_z])
        cube([groove_depth + eps, groove_w + 2 * eps, back_top_z - back_bottom_z]);
    // fondo cassa (scanalatura sul lato superiore, verso il retro)
    translate([TH - eps, groove_y0 - eps, back_bottom_z])
        cube([width_l - 2 * TH + 2 * eps, groove_w + 2 * eps, groove_depth + eps]);
}

module CarcassHoles() {
    if (has_back && back_style == "slot") BodyGrooves();
    // La batteria fori è pesante per il CGAL: esclusa dall'export STL/3MF (print)
    if (shelf_holes && mode != "print") ShelfPinHoles();
}

module CarcassBody() {
    difference() {
        union() { Sides(); BottomPanel(); Shelves(); }
        CarcassHoles();
    }
}

module TopPanel() {
    // Cappello inset tra i fianchi, a filo in cima: tiene la cassa in squadro
    difference() {
        planeTop(carcass, l = -1, r = -1, thick = crown_thickness);
        if (has_back && back_style == "slot")
            // scanalatura sul lato inferiore del cappello, verso il retro
            translate([back_left_x, groove_y0 - eps, interior_top - eps])
                cube([back_right_x - back_left_x,
                      groove_w + 2 * eps,
                      groove_depth + eps]);
    }
}

module TopRail() {
    // Traversa posteriore anti-racking sotto il cappello (assente con fondo inset);
    // col fondo inchiodato fa da listello di inchiodatura del fondo
    if (has_top_rail && top_rail_height > 0)
        translate([0, 0, interior_top - top_rail_height])
            planeBack(rail_box, l = -1, r = -1, thick = TH);
}

module Back() {
    if (has_back && back_style == "slot") {
        translate([0, -back_offset, 0])
            planeBack(carcass,
                      ll = back_seat - TH, rr = back_seat - TH,
                      bb = back_seat - TH, tt = back_seat - crown_thickness,
                      thick = back_thickness);
    } else if (has_back) {                // nailed, applicato dietro la cassa
        translate([0, back_thickness, 0])
            planeBack(carcass, thick = back_thickness);
    }
}

// ─── Toe-kick: solo traverse anteriore e posteriore, rientrate ─────

module ToeKick() {
    // I fianchi sono già il corpo unico; rientrano solo fronte e retro
    translate([0, toekick_recess_front, -toekick_height])
        planeFront(toekick_box, l = -1, r = -1, thick = TH);
    translate([0, -toekick_recess_back, -toekick_height])
        planeBack(toekick_box, l = -1, r = -1, thick = TH);
}

// ─── Fori reggipiano (batteria sui fianchi) ───────────────────────

// Foro cieco orizzontale nel fianco (asse X, verso l'interno del pannello)
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

// ─── Assemblaggio ─────────────────────────────────────────────────

module Bookcase(explode = 0) {
    exp = explode * max(120, height_h * 0.12);

    translate([0, 0, toekick_height]) {
        // Fianchi (corpo unico fino a terra) + fondo cassa + ripiani
        color("#c69c6d") CarcassBody();
        color("#b5905c") TopRail();
        translate([0, 0, -explode * exp * 0.6])
            color("#a8794f") ToeKick();
        translate([0, explode * exp * 0.8, 0])
            color("#7a5230") Back();
        translate([0, 0, explode * exp])
            color("#b98c5a") TopPanel();
    }
}

// ─── Export ───────────────────────────────────────────────────────

echo(str("Billy — finito l×w×h: ", width_l, " × ", depth_w, " × ", height_h, " mm"));
echo(str("Cassa: ", width_l, " × ", depth_w, " × ", carcass_h,
         " mm | vano ripiano ≈ ", round(shelf_gap), " mm | ripiani: ", shelf_count));

// ─── BOM per cutplanner (un record JSON per pezzo fisico) ─────────
// Ogni voce: [nome, faccia A, faccia B, spessore].  length/width sono max/min
// delle due facce.  cutplanner ignora gli echo non-JSON (es. "plane (...)").
bom = concat(
    [ ["Fianco Sx",   carcass_depth,    side_h,        TH],
      ["Fianco Dx",   carcass_depth,    side_h,        TH],
      ["Fondo cassa", width_l - 2 * TH, carcass_depth, TH],
      ["Cappello",    width_l - 2 * TH, carcass_depth, crown_thickness] ],
    [ for (i = [0 : 1 : len(shelf_positions) - 1])
        [str("Ripiano ", i + 1), width_l - 2 * TH,
         carcass_depth - shelf_recess_front + shelf_bb, TH] ],
    (has_top_rail && top_rail_height > 0)
        ? [ ["Traversa retro", width_l - 2 * TH, top_rail_height, TH] ] : [],
    (toekick_height > 0)
        ? [ ["Zoccolo fronte", width_l - 2 * TH, toekick_height, TH],
            ["Zoccolo retro",  width_l - 2 * TH, toekick_height, TH] ] : [],
    has_back
        ? [ ["Schienale",
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

// ─── Ferramenta (conteggio BOM) ─────────────────────────
_pins  = 4 * len(shelf_positions);
_nails = (has_back && back_style == "nailed") ? ceil(2 * (width_l + carcass_h) / 100) : 0;
hardware = [
    [str("Spinotti reggipiano Ø", shelf_hole_dia, "mm"), _pins],
    ["Chiodi/graffette fondo", _nails],
    ["Staffa antiribaltamento", 1],
];
echo("── Ferramenta (BOM) ──");
for (h = hardware) if (h[1] > 0) echo(str("HW | ", h[0], ": ", h[1]));

// ─── Distanza utile tra i ripiani + guida foratura ─────────────
_tops = concat([TH], [ for (z = shelf_positions) z + TH ]);
_bots = concat(shelf_positions, [interior_top]);
echo(str("Distanza utile compartimenti (mm): ",
         [ for (i = [0 : 1 : len(_bots) - 1]) round(_bots[i] - _tops[i]) ]));
echo(str("Foratura reggipiano: Ø", shelf_hole_dia, " passo ", shelf_hole_pitch,
         "mm | colonne a ", shelf_hole_inset, "mm dai bordi | ",
         len(shelf_hole_zs), " fori/colonna × 2 colonne × 2 fianchi"));

if (mode == "assembly") {
    Bookcase(explode = 0);
} else if (mode == "exploded") {
    Bookcase(explode = 1);
} else if (mode == "print") {
    Bookcase(explode = 0);
}
