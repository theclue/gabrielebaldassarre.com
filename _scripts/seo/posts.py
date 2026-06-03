"""Posts dimension: extract metadata from _posts/**/*.md and sync to D1.

URN scheme: urn:post:<category>/<slug>
Example: urn:post:devops/una-shell-history-per-ogni-progetto
"""

import os
import re
import json
from datetime import datetime, timezone

import yaml

from . import d1

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def post_urn(category: str, slug: str) -> str:
    return f"urn:post:{category.lower().replace(' ', '-')}/{slug}"


def _parse_post(path: str) -> dict | None:
    """Parse a Jekyll post .md file and return structured metadata."""
    with open(path) as f:
        content = f.read()

    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return None

    fm = yaml.safe_load(match.group(1)) or {}
    if not fm.get("title"):
        return None

    # Derive category and slug from path
    rel = os.path.relpath(path, os.path.join(REPO_ROOT, "_posts"))
    parts = rel.split(os.sep)
    category = parts[0] if len(parts) > 0 else ""
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", os.path.splitext(parts[-1])[0])

    tags = fm.get("tags", [])
    if not isinstance(tags, list):
        tags = []

    return {
        "urn": post_urn(category, slug),
        "title": fm["title"],
        "category": category,
        "slug": slug,
        "tags": json.dumps(tags, ensure_ascii=False),
        "file_path": rel,
    }


def _scan_posts() -> list[dict]:
    posts_dir = os.path.join(REPO_ROOT, "_posts")
    results = []
    for root, _, files in os.walk(posts_dir):
        for fn in files:
            if fn.endswith(".md") or fn.endswith(".Rmd"):
                meta = _parse_post(os.path.join(root, fn))
                if meta:
                    results.append(meta)
    return results


def sync_posts(dry_run: bool = False) -> list[str]:
    """Scan _posts/ directory and upsert into D1 posts table.

    Returns list of URNs synced.
    """
    now = datetime.now(timezone.utc).isoformat()
    post_list = _scan_posts()
    urns = []

    for p in post_list:
        # Check if already exists
        existing = d1.execute(
            "SELECT urn, last_modified_at FROM posts WHERE urn = ?", [p["urn"]]
        )

        if existing:
            urns.append(p["urn"])
            # Only update if we're not doing dry run
            if dry_run:
                continue
            d1.execute(
                """UPDATE posts SET title = ?, tags = ?, last_modified_at = ?
                   WHERE urn = ?""",
                [p["title"], p["tags"], now, p["urn"]]
            )
        else:
            urns.append(p["urn"])
            if dry_run:
                continue
            d1.execute(
                """INSERT INTO posts (urn, title, category, slug, tags, file_path, first_seen_at, last_modified_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                [p["urn"], p["title"], p["category"], p["slug"], p["tags"],
                 p["file_path"], now, now]
            )

    return urns
