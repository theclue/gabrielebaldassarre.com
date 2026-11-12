#!/usr/bin/env python3
"""Validate that all local asset paths referenced in posts, pages, and config exist on disk."""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

from changed_posts import git_changed_posts

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ASSET_REF_RE = re.compile(
    r"""(?:/assets/(?:images|figures|3d|overlays|logos)/[^\s"'<>)\]}]+)"""
)


def extract_asset_paths(text: str) -> list[str]:
    paths: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        for match in ASSET_REF_RE.findall(line):
            clean = match.split("?", 1)[0].split("#", 1)[0].rstrip(".,;:!?)")
            if "{{" in clean or "{%" in clean or "<" in clean:
                continue
            paths.append(clean)
    return sorted(set(paths))


def check_file(rel_path: str) -> list[str]:
    full_path = (REPO_ROOT / rel_path).resolve()
    if not str(full_path).startswith(str(REPO_ROOT)):
        return [f"{rel_path}: path outside repository"]
    if not full_path.is_file():
        return []
    text = full_path.read_text(encoding="utf-8", errors="replace")
    missing: list[str] = []
    for asset in extract_asset_paths(text):
        local_target = (REPO_ROOT / asset.lstrip("/")).resolve()
        if not str(local_target).startswith(str(REPO_ROOT)) or not local_target.is_file():
            missing.append(asset)
    return missing


def collect_all_targets() -> list[str]:
    targets = ["_config.yml", "index.html"]
    for folder in ("_posts", "_drafts", "_pages", "_includes", "_layouts"):
        base = REPO_ROOT / folder
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in {".md", ".Rmd", ".html", ".liquid"}:
                targets.append(str(path.relative_to(REPO_ROOT)))
    return targets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="Validate all posts, drafts, pages, includes, layouts, and _config.yml.",
    )
    parser.add_argument(
        "--base",
        default="HEAD~1",
        help="Git base ref when checking only changed posts (default: HEAD~1).",
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Explicit repository-relative files to validate.",
    )
    args = parser.parse_args()

    if args.files:
        targets = args.files
    elif args.all:
        targets = collect_all_targets()
    else:
        targets = git_changed_posts(args.base) or collect_all_targets()

    has_errors = False
    checked = 0
    for rel in targets:
        checked += 1
        missing = check_file(rel)
        if missing:
            has_errors = True
            print(f"❌ {rel}:")
            for asset in missing:
                print(f"   - MANCANTE: {asset}")

    if has_errors:
        print(f"\n❌ Validazione asset fallita ({checked} file controllati).", file=sys.stderr)
        return 1

    print(f"✅ Validazione asset superata ({checked} file controllati).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
