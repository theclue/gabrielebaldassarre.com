#!/usr/bin/env python3
"""Warm up Cloudinary fetch URLs for changed posts and images after deploy."""

from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

SITE_URL = "https://gabrielebaldassarre.com"
LOGO_PATH = "/assets/logos/the-16bit-robot.png"
BAR_PATH = "/assets/images/site/1x1-black.png"
REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]

MASTER_RE = re.compile(r"^master:\s*['\"]?(/assets/images/\S+?)['\"]?\s*$", re.MULTILINE)
BODY_IMG_RE = re.compile(r"\{%\s*cloudinary\s+([^%]+?)%\}")
ASSET_PATH_RE = re.compile(r"/assets/images/[^\s\"']+")


def git_diff_files(before: str, pathspec: str) -> list[str]:
    check = subprocess.run(
        ["git", "cat-file", "-e", before],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    ref = before if check.returncode == 0 else "HEAD~1"
    res = subprocess.run(
        ["git", "diff", "--name-only", ref, "HEAD", "--", pathspec],
        capture_output=True,
        text=True,
        check=False,
    )
    return [line.strip() for line in res.stdout.splitlines() if line.strip()]


def warm_url(url: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "gabrielebaldassarre-ci-warmup/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read(64)
    except (urllib.error.URLError, TimeoutError):
        pass


def main() -> int:
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip()
    if not cloud_name:
        print("⚠️ CLOUDINARY_CLOUD_NAME non impostato: salto warmup.")
        return 0

    before = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
    if before == "0" * 40:
        before = "HEAD~1"

    cld_base = f"https://res.cloudinary.com/{cloud_name}/image/fetch"
    posts: set[str] = set()

    for path in git_diff_files(before, "_posts/"):
        if path.endswith((".md", ".Rmd")) and (REPO_ROOT / path).is_file():
            posts.add(path)

    changed_imgs = git_diff_files(before, "assets/images/")
    if changed_imgs:
        for post_file in (REPO_ROOT / "_posts").rglob("*.md"):
            text = post_file.read_text(encoding="utf-8", errors="replace")
            for img in changed_imgs:
                if f"/{img}" in text:
                    posts.add(str(post_file.relative_to(REPO_ROOT)))

    for post in sorted(posts):
        text = (REPO_ROOT / post).read_text(encoding="utf-8", errors="replace")
        master_match = MASTER_RE.search(text)
        if master_match:
            master = master_match.group(1)
            print(f"🔥 {master}")
            h = "c_fill,g_auto,f_auto,q_auto"
            warm_url(f"{cld_base}/{h},w_1922,h_724/{SITE_URL}{master}")
            warm_url(f"{cld_base}/{h},w_1200,h_627/{SITE_URL}{master}")
            warm_url(f"{cld_base}/{h},w_1200,h_675/{SITE_URL}{master}")
            for bg in ("0f0f23", "0a0a1a"):
                pres = f"b_rgb:{bg}/e_distort:2p:2p:88p:15p:100p:100p:0p:95p/c_crop,g_north_west,x_0.02,y_0.18,w_0.85,h_0.48"
                warm_url(f"{cld_base}/{pres}/{h},w_1922,h_724/{SITE_URL}{master}")
                warm_url(f"{cld_base}/{pres}/{h},w_1200,h_627/{SITE_URL}{master}")

        for tag_body in BODY_IMG_RE.findall(text):
            img_match = ASSET_PATH_RE.search(tag_body)
            if img_match:
                warm_url(f"{cld_base}/q_auto,f_auto/{SITE_URL}{img_match.group(0)}")

    warm_url(f"{cld_base}/w_80,h_80,c_fit,f_auto,q_auto/{SITE_URL}{LOGO_PATH}")
    warm_url(f"{cld_base}/c_scale,w_1200,h_120,o_80/{SITE_URL}{BAR_PATH}")
    print(f"✅ {len(posts)} post riscaldati")
    return 0


if __name__ == "__main__":
    sys.exit(main())
