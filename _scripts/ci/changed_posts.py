#!/usr/bin/env python3
"""Resolve changed blog posts or manual URL/path inputs for CI workflows."""

from __future__ import annotations

import argparse
import os
import pathlib
import re
import subprocess
import sys
import urllib.parse

SITE_URL = "https://gabrielebaldassarre.com"
SITE_HOST = "gabrielebaldassarre.com"
POST_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-")
POST_EXT_RE = re.compile(r"\.(?:md|Rmd|MD)$")


def normalize_item(raw: str, fmt: str) -> str | None:
    item = raw.strip()
    if not item:
        return None

    if fmt == "file":
        if item.startswith("_posts/"):
            return item
        return f"_posts/{item.lstrip('/')}"

    if item.startswith(("http://", "https://")):
        parsed = urllib.parse.urlsplit(item)
        if fmt == "url":
            return item if parsed.scheme in ("http", "https") and parsed.hostname else None
        if parsed.scheme != "https" or parsed.hostname != SITE_HOST:
            return None
        rel = parsed.path or "/"
    elif "_posts/" in item:
        cleaned = POST_EXT_RE.sub("", item)
        parts = pathlib.PurePosixPath(cleaned).parts
        idx = parts.index("_posts")
        if len(parts) <= idx + 2:
            return None
        category = parts[idx + 1]
        slug = POST_DATE_RE.sub("", parts[-1])
        rel = f"/{category}/{slug}/"
    else:
        cleaned = POST_EXT_RE.sub("", item)
        rel = cleaned if cleaned.startswith("/") else f"/{cleaned}"

    if fmt == "path":
        return rel
    return f"{SITE_URL}{rel}"


def git_changed_posts(base_ref: str) -> list[str]:
    check = subprocess.run(
        ["git", "cat-file", "-e", base_ref],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if check.returncode != 0:
        return []
    res = subprocess.run(
        ["git", "diff", "--name-only", base_ref, "HEAD", "--", "_posts/"],
        capture_output=True,
        text=True,
        check=False,
    )
    if res.returncode != 0:
        return []
    posts = []
    for line in res.stdout.splitlines():
        path = line.strip()
        if path and POST_EXT_RE.search(path) and os.path.isfile(path):
            posts.append(path)
    return sorted(set(posts))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--format",
        choices=("file", "path", "url"),
        default="url",
        help="Output format: repo file path, site-relative path, or full URL.",
    )
    parser.add_argument(
        "--inputs",
        default="",
        help="Space-separated manual inputs (paths or URLs). Falls back to git diff if empty.",
    )
    parser.add_argument(
        "--base",
        default="HEAD~1",
        help="Base git ref when discovering changed posts via git diff (default: HEAD~1).",
    )
    parser.add_argument(
        "--output-file",
        default="",
        help="Optional file path to write the resolved items (one per line).",
    )
    parser.add_argument(
        "--github-output-empty-key",
        default="",
        help="Key name (e.g. no_urls or no_posts) written to $GITHUB_OUTPUT as true/false.",
    )
    args = parser.parse_args()

    raw_items = args.inputs.split() if args.inputs.strip() else git_changed_posts(args.base)
    resolved: list[str] = []
    seen: set[str] = set()
    for raw in raw_items:
        norm = normalize_item(raw, args.format)
        if not norm or norm in seen:
            continue
        if args.format == "file" and not os.path.isfile(norm):
            continue
        seen.add(norm)
        resolved.append(norm)

    if args.output_file:
        pathlib.Path(args.output_file).write_text(
            "\n".join(resolved) + ("\n" if resolved else ""),
            encoding="utf-8",
        )

    for item in resolved:
        print(item)

    if args.github_output_empty_key and os.environ.get("GITHUB_OUTPUT"):
        is_empty = "true" if not resolved else "false"
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as gh_out:
            gh_out.write(f"{args.github_output_empty_key}={is_empty}\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
