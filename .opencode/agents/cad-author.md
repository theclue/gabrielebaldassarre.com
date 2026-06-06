# OpenSCAD Authoring Conventions — gabrielebaldassarre.com
# =========================================================
# Archetype: _cad/passacavi-baionetta/passacavi-baionetta.scad
# Every .scad file in _cad/<slug>/ MUST follow these rules.

## File Structure

A compliant `.scad` file is laid out in this order:

```
// ─── Title — Short description ────────────────────────────────────
// Additional context line (optional)

// License : MIT License
// Author: Gabriele Baldassarre
// Created: YYYY-MM-DD

/* [Category Name — human-readable group] */
parameter_name = default;   // [min:max]  Short description

/* [Another Category] */
other_param = default;       // description

$fn = 128;                   // global quality

// ─── Geometry helpers ────────────────────────────────────────────
// Derived dimensions, tolerances as named variables
pin_clearance    = 0.3;
twist_tolerance  = 0.2;

// ─── Modules ─────────────────────────────────────────────────────
// One module per physical piece. Descriptive CamelCase names.
module UpperPiece() { ... }
module LowerPiece() { ... }

// ─── Assembly (for preview only) ──────────────────────────────────
// MUST accept explode=0 parameter and explode_distance for exploded views.
// explode: 0–1 interpolation factor
// explode_distance: mm of maximum separation
module assembly(explode = 0, explode_distance = 25) {
    translate([0, 0, explode * explode_distance]) UpperPiece();
    translate([0, 0, -explode * explode_distance]) LowerPiece();
}

// ─── Export ──────────────────────────────────────────────────────
// Comment/uncomment to export individual pieces for printing:
// UpperPiece();
// LowerPiece();

// Preview assembly (comment out for STL export):
// assembly(explode = 0);
```

## Rules

1. **Header block** — First section with `// ─── Title — Description ────`, then license, author, date as separate `//` lines.

2. **License** — Always `// License : MIT License`. Matches the blog content license. Do NOT override.

3. **Customizer parameters** — Use `/* [Group] */` sections. Each parameter has `// [min:max]` range hint and a short Italian description (the blog audience is primarily Italian). Parameters go BEFORE geometry helpers.

4. **Geometry helpers** — Section `// ─── Geometry helpers` with derived dimensions, tolerances, and constants. All tolerances are named variables, never magic numbers.

5. **Modules** — One `module` per physical piece. Name them with PascalCase. Place them after geometry helpers. Each module should be independently exportable.

6. **Assembly module** — MUST exist and MUST accept `explode = 0` and `explode_distance = 25` as parameters. The `explode` parameter is a 0–1 interpolation factor: at 0 all parts are in their assembled position, at 1 each part is offset by `explode_distance` along its natural separation axis. Use `translate()` with `explode * explode_distance` for explosion.

7. **`$fn`** — Global `$fn = 128` unless the model explicitly needs lower (fast preview) or higher (fine curves).

8. **Colors** — Use `// color("Name")` comments before each part in the assembly module to guide the `render` color scheme. Standard palette: `DimGray` (structural), `SteelBlue` (secondary), `SandyBrown` (transparent/desk), `DarkOliveGreen` (accessories).

9. **Export section** — Last section `// ─── Export`. Commented-out calls to individual modules and assembly. The build script uses `openscad -o` on the whole file, so individual exports are for manual use.

10. **No external dependencies** — The `.scad` file must be self-contained. No `use <>`, no `include <>` with absolute paths. Relative includes within `_cad/<slug>/` are allowed for shared libraries.

11. **Parameters in Italian** — Customizer labels and comments are in Italian (matching the blog). Variable names are in English (programming convention).

12. **No README.md** — The single source of truth for asset metadata is the post frontmatter (`3d_model` block). Do NOT create a `README.md` in `_cad/<slug>/`. All metadata (material, print settings, dimensions, Thingiverse/Printables links, license) lives in the frontmatter and is consumed by the `_layouts/asset-3d.html` download card and the Thingiverse broadcast pipeline.
