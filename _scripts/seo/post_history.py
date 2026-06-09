#!/usr/bin/env python3
"""Post change tracking: git diff on _posts/** -> R2 archive + D1 post_history.

Invoked from .github/workflows/seo-pipeline.yml after a successful deploy.
Idempotent on (post_urn, commit_hash): re-runs on the same commit are skipped.
"""

import os
import sys
import json
import subprocess
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from _scripts.seo import r2, d1
from _scripts.seo.posts import post_urn, sync_posts


def _changed_posts() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
            capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError:
        return []
    out = []
    for line in result.stdout.split("\n"):
        line = line.strip()
        if not line or not line.startswith("_posts/"):
            continue
        if line.endswith(".md") or line.endswith(".Rmd"):
            out.append(line)
    return out


def _post_meta(path: str) -> dict:
    """Derive (category, slug, urn) from a Jekyll post path."""
    parts = path.replace("_posts/", "", 1).split("/")
    category = parts[0]
    base = os.path.splitext(parts[-1])[0]
    # Strip leading YYYY-MM-DD-
    slug = base[11:] if len(base) > 11 and base[4] == "-" and base[7] == "-" else base
    return {"category": category, "slug": slug, "urn": post_urn(category, slug)}


def _diff_stats(diff_raw: str) -> tuple[int, int]:
    added = removed = 0
    for line in diff_raw.split("\n"):
        if line.startswith("+") and not line.startswith("+++"):
            added += 1
        elif line.startswith("-") and not line.startswith("---"):
            removed += 1
    return added, removed


def _classify(added: int, removed: int) -> str:
    if added > 0 and removed == 0:
        return "created"
    if removed > 0 and added == 0:
        return "deleted"
    return "modified"


def _already_processed(post_urn: str, commit_hash: str) -> bool:
    rows = d1.execute(
        "SELECT id FROM post_history WHERE post_urn = ? AND commit_hash = ? LIMIT 1",
        [post_urn, commit_hash],
    )
    return bool(rows)


def main() -> int:
    # Ensure all post URNs exist in the `posts` table before inserting
    # into `post_history` (foreign key constraint).
    sync_posts()

    posts = _changed_posts()
    print(f"Changed posts: {len(posts)}")
    if not posts:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")

    inserted = skipped = errors = 0
    for post in posts:
        try:
            meta = _post_meta(post)
            urn = meta["urn"]

            diff = subprocess.run(
                ["git", "diff", "HEAD~1", "HEAD", "--", post],
                capture_output=True, text=True, check=True,
            ).stdout

            commit = subprocess.run(
                ["git", "log", "-1", "--format=%H|%aI|%s", "HEAD", "--", post],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
            if not commit:
                print(f"  ⚠️  {post}: no commit found, skipping")
                continue
            commit_hash, commit_date, commit_msg = commit.split("|", 2)

            if _already_processed(urn, commit_hash):
                print(f"  ⏭  {urn} @ {commit_hash[:8]} already recorded")
                skipped += 1
                continue

            added, removed = _diff_stats(diff)
            change_type = _classify(added, removed)
            diff_size = len(diff)

            # R2 archive
            r2.upload_json(
                "seo/history",
                f"{urn.replace(':', '_').replace('/', '_')}-{commit_hash[:8]}.json",
                {
                    "urn": urn,
                    "post": post,
                    "commit": commit_hash,
                    "date": commit_date,
                    "message": commit_msg,
                    "change_type": change_type,
                    "lines_added": added,
                    "lines_removed": removed,
                    "diff_size": diff_size,
                    "diff": diff,
                },
            )

            # D1 structured row
            d1.execute(
                """INSERT INTO post_history
                   (post_urn, commit_hash, commit_date, commit_message, change_type,
                    lines_added, lines_removed, diff_size, raw_diff, changed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [urn, commit_hash, commit_date, commit_msg, change_type,
                 added, removed, diff_size, diff, now_iso],
            )
            inserted += 1
            print(f"  ✅ {urn} @ {commit_hash[:8]} ({change_type}, +{added}/-{removed})")
        except Exception as e:
            errors += 1
            print(f"  ❌ {post}: {e}")

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
