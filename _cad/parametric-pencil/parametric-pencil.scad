// Parametric pencil assembly, dimensioned in millimetres.
// The origin is the exposed lead point; +Z runs toward the eraser rear.

/* [Overall dimensions] */
// Total length from exposed lead point to eraser rear (mm)
total_length = 180; // [160:1:200]
// Wooden barrel across flats (mm)
barrel_across_flats = 7; // [5:0.1:10]

/* [Lead and wooden tip] */
// Wooden tip length, excluding exposed lead (mm)
wooden_tip_length = 18; // [10:0.1:25]
// Lead length embedded in the wooden body (mm)
lead_embedded_length = 6; // [3:0.1:12]
// Lead diameter (mm)
lead_diameter = 2; // [1.5:0.1:2.2]
// Wooden lead-bore diameter (mm)
lead_bore_diameter = 2.2; // [2.2:0.1:3]

/* [Ferrule] */
// Ferrule axial length (mm)
ferrule_length = 10; // [6:0.1:16]
// Ferrule outer across flats (mm; provisional bounds)
ferrule_across_flats = 9.6; // [8:0.1:12]
// Ferrule overlap onto wood (mm)
ferrule_wood_overlap = 4; // [1:0.1:5.9]
// Ferrule hex-bore across-flats clearance (mm)
ferrule_hex_bore_af_clearance = 0.2; // [0.1:0.1:0.5]

/* [Eraser] */
// Exposed eraser length (mm)
eraser_exposed_length = 12; // [6:0.1:20]
// Eraser diameter (mm)
eraser_diameter = 5.5; // [4:0.1:8]
// Eraser insertion and blind recess depth (mm; nominal)
eraser_recess_depth = 4; // [1:0.1:5.9]
// Eraser cavity diametral clearance (mm; nominal visual default)
eraser_cavity_diametral_clearance = 0.2; // [0.1:0.1:0.5]

/* [Hidden] */
exposed_lead_length = (lead_diameter / 2) * wooden_tip_length
    / (barrel_across_flats / sqrt(3) - lead_diameter / 2);
straight_wooden_barrel_length = total_length
    - exposed_lead_length
    - wooden_tip_length
    - ferrule_length
    + ferrule_wood_overlap
    - eraser_exposed_length;

z1 = exposed_lead_length;
z2 = z1 + wooden_tip_length;
z3 = z2 + straight_wooden_barrel_length;
z4 = z3 - ferrule_wood_overlap;
z5 = z4 + ferrule_length;
// Derived dimensions; cavity clearance is nominal visual only, not a fit tolerance.
eraser_cavity_diameter = eraser_diameter + eraser_cavity_diametral_clearance;
eraser_total_length = eraser_recess_depth + eraser_exposed_length;
z_recess_bottom = z5 - eraser_recess_depth;
z6 = z5 + eraser_exposed_length;

// lead_component — separate exposed pointed cone and embedded cylindrical lead.
module lead_component() {
    $fn = 96;
    union() {
        cylinder(h=exposed_lead_length, r1=0, r2=lead_diameter / 2);
        translate([0, 0, z1])
            cylinder(h=lead_embedded_length, d=lead_diameter);
    }
}

// wooden_body_component — conical envelope intersected with continuous hex stock,
// then joined to straight hex stock; the intersection creates the sharpening contour.
module wooden_body_component() {
    $fn = 96;
    difference() {
        union() {
            intersection() {
                translate([0, 0, z1])
                    cylinder(
                        h=z3 - z1,
                        r=barrel_across_flats / sqrt(3),
                        $fn=6
                    );
                translate([0, 0, z1])
                    cylinder(
                        h=wooden_tip_length,
                        r1=lead_diameter / 2,
                        r2=barrel_across_flats / sqrt(3)
                    );
            }
            translate([0, 0, z2])
                cylinder(
                    h=straight_wooden_barrel_length,
                    r=barrel_across_flats / sqrt(3),
                    $fn=6
                );
        }
        // Routine axial epsilon avoids coincident faces at the bore ends.
        translate([0, 0, z1 - 0.01])
            cylinder(h=lead_embedded_length + 0.02, d=lead_bore_diameter);
    }
}

// ferrule_component — regular-hex exterior, front hex wood bore, and separate
// rear-opening cylindrical blind eraser socket with a planar bottom.
module ferrule_component() {
    $fn = 96;
    difference() {
        translate([0, 0, z4])
            cylinder(
                h=ferrule_length,
                r=ferrule_across_flats / sqrt(3),
                $fn=6
            );
        // Routine axial epsilon makes the front hexagonal bore a clean through-cut.
        translate([0, 0, z4 - 0.01])
            cylinder(
                h=ferrule_wood_overlap + 0.02,
                r=(barrel_across_flats + ferrule_hex_bore_af_clearance) / sqrt(3),
                $fn=6
            );
        // The cutter starts at the blind planar bottom and opens through the rear.
        translate([0, 0, z_recess_bottom])
            cylinder(
                h=eraser_recess_depth + 0.01,
                d=eraser_cavity_diameter
            );
    }
}

// eraser_component — separate cylinder seated against the socket bottom;
// its inserted length plus exposed length is the complete eraser length.
module eraser_component() {
    $fn = 96;
    translate([0, 0, z_recess_bottom])
        cylinder(h=eraser_total_length, d=eraser_diameter);
}

// pencil_assembly — emit four distinct solids; do not union component pieces.
module pencil_assembly() {
    lead_component();
    wooden_body_component();
    ferrule_component();
    eraser_component();
}

pencil_assembly();
