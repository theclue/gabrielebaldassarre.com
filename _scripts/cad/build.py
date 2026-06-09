#!/usr/bin/env python3
"""OpenSCAD build orchestrator — validate, export STL/3MF (print mode),
render preview PNGs, compose ortho sheet, produce overlay.

Output layout::

    assets/3d/<slug>/<slug>.stl         print file
    assets/3d/<slug>/<slug>.3mf         print file
    assets/images/3d/<slug>-isometric.png   blueprint lineart (master:)
    assets/images/3d/<slug>-ortho.png       composed ortho sheet (master:)
    assets/overlays/<slug>.png              solid transparent, cropped tight

Usage:
    python3 _scripts/cad/build.py [--slug <slug>] [--skip-png]
"""

import os
import re
import sys
import tempfile
import argparse
import subprocess
from pathlib import Path

import yaml

try:
    from .preview import render_png, render_solid
except ImportError:
    from preview import render_png, render_solid

WORKSPACE = Path(os.environ.get("WORKSPACE", Path(__file__).resolve().parent.parent.parent))
CAD_DIR = WORKSPACE / "_cad"
ASSETS_3D = WORKSPACE / "assets" / "3d"
ASSETS_IMAGES_3D = WORKSPACE / "assets" / "images" / "3d"
ASSETS_OVERLAYS = WORKSPACE / "assets" / "overlays"
POSTS_DIR = WORKSPACE / "_posts"
DRAFTS_DIR = WORKSPACE / "_drafts"

ORTHO_BG = "#002082"   # Tech Dark Blue — fallback if blueprint.jpg missing
BLUEPRINT_BG = WORKSPACE / "assets" / "backgrounds" / "blueprint.jpg"


def _blueprint_canvas(width: int, height: int, out: Path) -> None:
    """Create a width×height canvas from the blueprint background texture."""
    if BLUEPRINT_BG.exists():
        _run_im(_magick() + [
            str(BLUEPRINT_BG), "-resize", f"{width}x{height}^",
            "-gravity", "center", "-extent", f"{width}x{height}",
            str(out),
        ])
    else:
        _run_im(_magick() + [
            "-size", f"{width}x{height}", f"xc:{ORTHO_BG}", str(out),
        ])


def _composite_over_bg(lineart: Path, bg: Path, out: Path) -> None:
    """Composite a lineart PNG over a background with HardLight blend.

    The lineart has a solid dark-blue background (#002082 area) plus
    lighter edges.  HardLight blend lets the blueprint.jpg texture
    show through the solid areas while keeping edges crisp.
    """
    _run_im(_magick() + [
        str(bg),
        str(lineart),
        "-compose", "HardLight", "-composite",
        str(out),
    ])


def find_post_frontmatter(slug: str) -> dict | None:
    for base in (POSTS_DIR, DRAFTS_DIR):
        for root, _, files in os.walk(base):
            for fn in files:
                if fn.endswith(".md") and slug in fn:
                    fm = _parse_frontmatter(Path(root) / fn)
                    if fm:
                        return fm
    return None


def _parse_frontmatter(path: Path) -> dict | None:
    content = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not m:
        return None
    return yaml.safe_load(m.group(1)) or {}


def discover_slugs(select: str | None = None) -> list[str]:
    if not CAD_DIR.exists():
        return []
    slugs = set()
    for scad in CAD_DIR.rglob("*.scad"):
        slug = scad.parent.name
        if select and slug != select:
            continue
        slugs.add(slug)
    return sorted(slugs)


# ─── ImageMagick helpers ──────────────────────────────────────────────

def _magick() -> list[str]:
    r = subprocess.run(["which", "magick"], capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        return ["magick"]
    return ["convert"]


def _run_im(args: list[str]) -> None:
    subprocess.run(args, check=True, capture_output=True, text=True)


def _crop_to_content(in_path: Path, out_path: Path) -> None:
    """Trim transparent borders to content bounds, leave 2% margin."""
    _run_im(_magick() + [
        str(in_path), "-trim", "+repage",
        "-bordercolor", "none", "-border", "2%x2%",
        str(out_path),
    ])


def _compose_ortho_sheet(front: Path, top: Path, side: Path, isometric: Path, out: Path) -> None:
    """Compose orthographic + isometric views into a 2×2 quadrant blueprint sheet.

    Layout::

        ┌──────────┬──────────┐
        │   TOP    │   SIDE   │
        ├──────────┼──────────┤
        │  FRONT   │ISOMETRIC │
        └──────────┴──────────┘

    Canvas: 1920×1080, blueprint.jpg texture background.
    Each quadrant: 960×540, centred with aspect preserved.
    All lineart PNGs must have transparent backgrounds.
    """
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        quad_w, quad_h = 960, 540

        for src, label in [(top, "top"), (side, "side"), (front, "front"), (isometric, "iso")]:
            dst = tmp / f"quad-{label}.png"
            _run_im(_magick() + [
                str(src), "-resize", f"{quad_w}x{quad_h}",
                "-background", "none", "-gravity", "center", "-extent", f"{quad_w}x{quad_h}",
                str(dst),
            ])

        bg = tmp / "bg.jpg"
        _blueprint_canvas(1920, 1080, bg)

        _run_im(_magick() + [
            str(bg),
            str(tmp / "quad-top.png"),       "-gravity", "NorthWest",
            "-compose", "HardLight", "-composite",
            str(tmp / "quad-side.png"),      "-gravity", "NorthEast",
            "-compose", "HardLight", "-composite",
            str(tmp / "quad-front.png"),     "-gravity", "SouthWest",
            "-compose", "HardLight", "-composite",
            str(tmp / "quad-iso.png"),       "-gravity", "SouthEast",
            "-compose", "HardLight", "-composite",
            str(out),
        ])


# ─── Build ─────────────────────────────────────────────────────────────

def build_one(slug: str, skip_png: bool = False, png_only: bool = False) -> dict:
    cad_project = CAD_DIR / slug
    scad_file = cad_project / f"{slug}.scad"

    if not scad_file.exists():
        print(f"   ⚠️  {slug}: no {slug}.scad found in _cad/{slug}/ — skipping")
        return {"slug": slug, "error": "scad_not_found"}

    fm = find_post_frontmatter(slug) or {}
    model_cfg = fm.get("3d_model", {}) or {}

    color_scheme = model_cfg.get("color_scheme", "blueprint")
    explode_dist = model_cfg.get("explode_distance", 25)

    out_3d = ASSETS_3D / slug
    out_img = ASSETS_IMAGES_3D
    out_overlay = ASSETS_OVERLAYS

    for d in (out_3d, out_img, out_overlay):
        d.mkdir(parents=True, exist_ok=True)

    result = {"slug": slug, "scad": str(scad_file), "errors": []}

    # ── STL + 3MF (skip when called from Makefile pattern rules) ──
    if not png_only:
        stl_path = out_3d / f"{slug}.stl"
        print(f"   📦 STL (print) → {stl_path}")
        r = subprocess.run(
            ["openscad", "-o", str(stl_path), "-D", "mode=\"print\"", str(scad_file)],
            capture_output=True, text=True, timeout=300,
        )
        if r.returncode != 0:
            print(f"   ❌ STL failed: {r.stderr[-300:]}")
            result["errors"].append("stl_failed")
        else:
            result["stl"] = str(stl_path)

        mf3_path = out_3d / f"{slug}.3mf"
        print(f"   📦 3MF (print) → {mf3_path}")
        r = subprocess.run(
            ["openscad", "-o", str(mf3_path), "--export-format", "3mf",
             "-D", "mode=\"print\"", str(scad_file)],
            capture_output=True, text=True, timeout=300,
        )
        if r.returncode != 0:
            print(f"   ⚠️  3MF failed (non-critical): {r.stderr[-200:]}")
        else:
            result["3mf"] = str(mf3_path)

    if skip_png:
        return result

    # ── Isometric blueprint → assets/images/3d/ (for master:) ────
    iso_img = out_img / f"{slug}-isometric.png"
    print(f"   🖼️  Isometric blueprint → {iso_img}")
    iso_raw: Path | None = None
    bg_canvas: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            iso_raw = Path(tmp.name)
        render_png(scad_file, iso_raw,
                   view="isometric", color_scheme=color_scheme,
                   explode_distance=explode_dist, scad_mode="exploded")
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            bg_canvas = Path(tmp.name)
        _blueprint_canvas(1920, 1080, bg_canvas)
        _composite_over_bg(iso_raw, bg_canvas, iso_img)
        result["png_isometric"] = str(iso_img)
    except Exception as e:
        print(f"   ⚠️  Isometric failed: {e}")
        result["errors"].append("png_isometric_failed")
    finally:
        if iso_raw is not None:
            iso_raw.unlink(missing_ok=True)
        if bg_canvas is not None:
            bg_canvas.unlink(missing_ok=True)

    # ── Orthographic views → render individually, then compose with isometric ──
    print(f"   🖼️  Ortho+Isometric blueprint sheet → {out_img}/{slug}-ortho.png")
    try:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            views = {
                "front": tmp / "front.png",
                "top":   tmp / "top.png",
                "side":  tmp / "side.png",
            }
            for label, path in views.items():
                render_png(scad_file, path,
                           view=f"ortho-{label}", color_scheme=color_scheme,
                           explode_distance=explode_dist, scad_mode="exploded")

            ortho_out = out_img / f"{slug}-ortho.png"
            _compose_ortho_sheet(views["front"], views["top"], views["side"],
                                 iso_img, ortho_out)
            result["png_ortho"] = str(ortho_out)
            print(f"      → {ortho_out.name}")
    except Exception as e:
        print(f"   ⚠️  Ortho sheet compose failed: {e}")
        result["errors"].append("png_ortho_failed")

    # ── Solid transparent → assets/overlays/ (cropped tight) ─────
    overlay_out = out_overlay / f"{slug}.png"
    print(f"   🖼️  Solid overlay → {overlay_out}")
    tmp_solid: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_solid = Path(tmp.name)
        render_solid(scad_file, tmp_solid,
                     view="isometric",
                     explode_distance=explode_dist, scad_mode="exploded")
        _crop_to_content(tmp_solid, overlay_out)
        result["png_overlay"] = str(overlay_out)
    except Exception as e:
        print(f"   ⚠️  Solid overlay failed: {e}")
        result["errors"].append("png_overlay_failed")
    finally:
        if tmp_solid is not None:
            tmp_solid.unlink(missing_ok=True)

    result["status"] = "ok" if not result["errors"] else "partial"
    return result


def main():
    parser = argparse.ArgumentParser(description="OpenSCAD build tool")
    parser.add_argument("--slug", help="Build a single slug")
    parser.add_argument("--skip-png", action="store_true", help="Skip preview renders")
    parser.add_argument("--png-only", action="store_true", help="Only render PNGs (skip STL/3MF — those are handled by Makefile pattern rules)")
    args = parser.parse_args()

    slugs = discover_slugs(args.slug)
    if not slugs:
        print("No .scad projects found under _cad/")
        return

    print(f"🔧 CAD Build — {len(slugs)} project(s)")
    print("=" * 50)

    ok = errors = 0
    for slug in slugs:
        print(f"\n📐 {slug}")
        res = build_one(slug, skip_png=args.skip_png, png_only=args.png_only)
        if res.get("errors"):
            errors += 1
        else:
            ok += 1

    print(f"\n{'=' * 50}")
    print(f"✅ {ok} built  •  ❌ {errors} failed\n")

    sys.exit(1 if errors > 0 else 0)


if __name__ == "__main__":
    main()
