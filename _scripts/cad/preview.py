"""OpenSCAD preview renderer — blueprint lineart, isometric, orthographic.

Blueprint palette (user-specified):
  Luminous       #3057E1
  Original Blue  #4A6DE5
  Blue Cream     #CED8F7
  Tech Dark Blue #002082

Blueprint style = lineart on dark background (surfaces unfilled).
Achieved via ``--preview`` (OpenCSG edges) + ImageMagick colour remap.

ImageMagick v7 compatibility: uses ``magick`` if available,
falls back to ``convert`` with stderr suppressed (v7 deprecation warnings
cause false-negative exit codes).
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

# Camera presets: 7-tuple `tx,ty,tz,rx,ry,rz,dist`.
# NOTE: the distance value is overridden at render time by `--viewall`, which
# auto-fits the model in the frame. It is kept here only as a hint of the
# rough scale the preset was originally designed for.
VIEW_CAMERAS = {
    "isometric":   "0,0,0,55,0,25,450",
    "ortho-top":   "0,0,0,0,0,0,280",
    "ortho-front": "0,0,0,90,0,0,280",
    "ortho-side":  "0,0,0,90,0,90,280",
}

IMAGESIZE = "1920,1080"
OPENSCAD_TIMEOUT = 300

# ─── ImageMagick binary ────────────────────────────────────────────────

_IM_PREFIX: list[str] | None = None


def im_prefix() -> list[str]:
    """Return the ImageMagick command prefix (cached), preferring v7 ``magick``."""
    global _IM_PREFIX
    if _IM_PREFIX is None:
        r = subprocess.run(["which", "magick"], capture_output=True, text=True)
        _IM_PREFIX = ["magick"] if (r.returncode == 0 and r.stdout.strip()) else ["convert"]
    return _IM_PREFIX


def im_run(args: list[str]) -> None:
    """Run ImageMagick with the cached prefix prepended if missing."""
    if args[:1] not in (["magick"], ["convert"]):
        args = im_prefix() + args
    subprocess.run(args, check=True, capture_output=True, text=True)


# ─── Internal: OpenSCAD --preview invocation ───────────────────────────

def _run_openscad_preview(scad_path: Path, out_raw: Path, *,
                          camera: str, colorscheme: str,
                          explode_distance: float, scad_mode: str) -> None:
    """Invoke `openscad --preview` and write a raw PNG to ``out_raw``.

    Both `mode` and `explode_distance` are forwarded as `-D` SCAD
    parameters; the model is expected to read them from the layout block.
    """
    cmd = [
        "openscad",
        "--preview",
        "--colorscheme", colorscheme,
        "--imgsize", IMAGESIZE,
        "--camera", camera,
        "--autocenter", "--viewall",
        "-D", f"explode_distance={explode_distance}",
        "-D", f'mode="{scad_mode}"',
        "-o", str(out_raw),
        str(scad_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True,
                   timeout=OPENSCAD_TIMEOUT)


# ─── Public API ─────────────────────────────────────────────────────────

def render_png(scad_path: Path, out_path: Path, *,
               view: str = "isometric",
               color_scheme: str = "blueprint",
               explode_distance: float = 25.0,
               scad_mode: str = "exploded") -> Path:
    """Render a PNG preview of an OpenSCAD model with the blueprint pipeline."""
    camera = VIEW_CAMERAS.get(view, VIEW_CAMERAS["isometric"])

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_raw = Path(tmp.name)

    try:
        _run_openscad_preview(
            scad_path, tmp_raw,
            camera=camera, colorscheme="DeepOcean",
            explode_distance=explode_distance, scad_mode=scad_mode,
        )
        _post_process(tmp_raw, out_path, color_scheme)
        return out_path
    finally:
        tmp_raw.unlink(missing_ok=True)


def render_solid(scad_path: Path, out_path: Path, *,
                 view: str = "isometric",
                 explode_distance: float = 25.0,
                 scad_mode: str = "exploded") -> Path:
    """Render a solid-shaded PNG with original SCAD colours and transparent background.

    Uses ``--preview`` with ``--colorscheme=Solarized`` (cream bg, far from
    all SCAD colours: Khaki #F1E78D, DimGray #696969, SteelBlue #4683B5).
    """
    camera = VIEW_CAMERAS.get(view, VIEW_CAMERAS["isometric"])

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_raw = Path(tmp.name)

    try:
        _run_openscad_preview(
            scad_path, tmp_raw,
            camera=camera, colorscheme="Solarized",
            explode_distance=explode_distance, scad_mode=scad_mode,
        )
        _post_process_solid(tmp_raw, out_path)
        return out_path
    finally:
        tmp_raw.unlink(missing_ok=True)


def _post_process_solid(raw: Path, out: Path) -> None:
    """Remove Solarized cream background (#FDF6E3 area), keep SCAD colours."""
    im_run([
        str(raw),
        "-fuzz", "6%", "-transparent", "#FDF6E3",
        "-fuzz", "4%", "-transparent", "#FCF5E2",
        "-brightness-contrast", "0x15",
        str(out),
    ])


# ─── Post-processing ────────────────────────────────────────────────────

def _post_process(raw: Path, out: Path, scheme: str) -> None:
    """Apply colour scheme via ImageMagick."""
    if scheme == "blueprint":
        # Edge detect + dilate + negate + blueprint palette
        # Output: solid image (no transparency). The background will be
        # composited over blueprint.jpg in build.py using a blend mode.
        im_run([
            str(raw),
            "-morphology", "EdgeIn", "Diamond",
            "-morphology", "Dilate", "Disk:2.5",
            "-negate",
            "+level-colors", "#CED8F7,#002082",
            "-fill", "#3057E1", "-colorize", "25",
            str(out),
        ])
    elif scheme == "monochrome":
        im_run([
            str(raw),
            "-colorspace", "Gray",
            "-level", "10%,90%",
            str(out),
        ])
    elif scheme == "render":
        shutil.copy2(raw, out)
    else:
        shutil.copy2(raw, out)

