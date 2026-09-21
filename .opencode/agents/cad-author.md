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
   Thingiverse uploads: see §Thingiverse Customizer Compatibility (fork + guard gate).

4. **Geometry helpers** — Section `// ─── Geometry helpers` with derived dimensions, tolerances, and constants. All tolerances are named variables, never magic numbers.

5. **Modules** — One `module` per physical piece. Name them with PascalCase. Place them after geometry helpers. Each module should be independently exportable.

6. **Assembly module** — MUST exist and MUST accept `explode = 0` and `explode_distance = 25` as parameters. The `explode` parameter is a 0–1 interpolation factor: at 0 all parts are in their assembled position, at 1 each part is offset by `explode_distance` along its natural separation axis. Use `translate()` with `explode * explode_distance` for explosion.

7. **`$fn`** — Global `$fn = 128` unless the model explicitly needs lower (fast preview) or higher (fine curves).

8. **Colors** — Use `// color("Name")` comments before each part in the assembly module to guide the `render` color scheme. Standard palette: `DimGray` (structural), `SteelBlue` (secondary), `SandyBrown` (transparent/desk), `DarkOliveGreen` (accessories).

9. **Export section** — Last section `// ─── Export`. Commented-out calls to individual modules and assembly. The build script uses `openscad -o` on the whole file, so individual exports are for manual use.

10. **No external dependencies** — The `.scad` file must be self-contained. No `use <>`, no `include <>` with absolute paths. Relative includes within `_cad/<slug>/` are allowed for shared libraries.

11. **Parameters in Italian** — Customizer labels and comments are in Italian (matching the blog). Variable names are in English (programming convention).

12. **No README.md** — The single source of truth for asset metadata is the post frontmatter (`3d_model` block). Do NOT create a `README.md` in `_cad/<slug>/`. All metadata (material, print settings, dimensions, Thingiverse/Printables links, license) lives in the frontmatter and is consumed by the `_layouts/asset-3d.html` download card and the Thingiverse broadcast pipeline.

## Thingiverse Customizer Compatibility

Thingiverse runs TWO independent server-side passes on an uploaded `.scad` file. Upload-ready forks must satisfy both.

**Pass A — render engine (≈ OpenSCAD 2015.03).** Evidence (source-confirmed): the error format `ERROR: Parser error in line N:` / `Can't parse file` is the 2015.03 grammar; `Could not initialize localization.` is benign startup noise. Constructs from 2019.05+/2021 that hard-fail this parser:

- `if/else` inside vector/list comprehensions → use ternaries `(cond) ? a : b`
- standalone `let(...)` expression form → inline the bindings
- `assert()` statements → use `if (!(cond)) echo("ASSERT-FAILED: msg");`
- `each`, `^` exponent, function literals `function (x)`, `$preview`, `ord()`
- hex colors `color("#rrggbb")` → use `color([r,g,b])` floats

Old-safe: `[for ...]`, `concat`, `len`, ternaries, named args, default params, `echo()`. Unused modules are still PARSED — an inlined legacy lib's banned construct breaks upload even if never called.

**Pass B — parameter extraction (separate legacy MakerBot TEXTUAL pass; NOT OpenSCAD's CommentParser, which first shipped in 2019.05).** The preview can render fine while extraction yields zero parameters. Rules:

- Defaults must be literal-only (number or `"quoted string"`) — no expressions or variable refs.
- `// [min:step:max]` sliders; `[value:Label, ...]` dropdowns.
- Labels restricted to `[A-Za-z0-9 ]` — NO parens, slashes, hyphens, accents; keep default VALUE tokens ASCII-safe and never translated.
- Booleans/checkboxes unsupported → use `"yes"/"no"` string dropdowns, and rewrite ALL usage sites to `== "yes"` / `!= "yes"` (string truthiness makes a half-migration silently wrong).
- `$`-prefixed vars are risky in the form → alias pattern: `quality_fn = 32; // [6:2:128]` plus `$fn = quality_fn;` under `/* [Hidden] */` (the computed assignment is excluded from the form; Thingiverse rewrites source lines so the alias receives the user value).

**ASCII purity** (community-confirmed): zero non-ASCII bytes anywhere — a single smart-quote/accent/box-drawing byte can abort the whole pipeline with "No Parameters Found", no diagnostics. This FORKS the Italian-label rule (Rule 11): see dual-file convention below.

**Dual-file convention (repo policy).** The master `.scad` stays Italian per Rule 11 for blog/cutplanner. For Thingiverse, create a `<name>-thingiverse.scad` fork — English, ASCII-only, customizer-safe per the rules above. Re-apply changes manually (no sync mechanism). Gate BEFORE upload — it must exit 0:

```
bash _scripts/cad/customizer_compat_check.sh _cad/<slug>/<name>-thingiverse.scad
```

Also verify post-conversion geometry with the openscad CLI: facet-normalized identity across key `-D` combos (defaults + one per conditional branch).

**No raw `{`/`}` (and no stray `[`/`]`) in comments BEFORE the parameter block.** The textual extractor plausibly stops collecting at the first raw brace even inside `//` comments (top suspect for "preview OK but 0 parameters"; inference from a closed-source pass, but cheap to obey). Rewrite JSON/bracket examples in headers. The only bracket forms allowed pre-parameters: single-line `/* [Group] */` headers and `// [...]` on assignment lines.

**Upload checklist:**

- Attach exactly ONE `.scad` (delete older versions); tag `customizer`; attach a pre-generated STL (Thingiverse can't render `.scad`).
- Service status in 2026 is degraded/works-most-of-the-time (dated evidence: forum thread #47, changelog fixes v2.95.0 + v2.100.0, community tracker) → retry at different times before suspecting your file.
- Decisive control test when in doubt: upload the canonical docs minimal example.
