"""Keyword extraction from Jekyll posts.

Seed keywords for Google Trends are derived from post-level signals only
(categories + most-used tags). The site glossary is intentionally excluded:
glossary terms describe internal jargon and dilute the trend seed with
keywords that are not representative of editorial intent.
"""

import os
import re
from collections import Counter

import yaml

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _parse_frontmatter(path: str) -> dict:
    with open(path) as f:
        content = f.read()
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}
    return yaml.safe_load(match.group(1)) or {}


def _scan_posts() -> list[dict]:
    posts_dir = os.path.join(REPO_ROOT, "_posts")
    posts = []
    for root, _, files in os.walk(posts_dir):
        for fn in files:
            if fn.endswith(".md") or fn.endswith(".Rmd"):
                fm = _parse_frontmatter(os.path.join(root, fn))
                if fm.get("title"):
                    posts.append(fm)
    return posts


def extract_categories(posts: list[dict]) -> list[str]:
    cats = [p["category"] for p in posts if p.get("category")]
    return sorted(set(cats))


def extract_top_tags(posts: list[dict], n: int = 10) -> list[str]:
    counter = Counter()
    for p in posts:
        tags = p.get("tags", [])
        if isinstance(tags, list):
            counter.update(tags)
    return [tag for tag, _ in counter.most_common(n)]


def get_seed_keywords() -> list[str]:
    """Return the combined seed keyword list for Google Trends.

    Sources: post categories + top tags. Cap to ~35 to stay within the
    serpapi free tier.
    """
    posts = _scan_posts()
    cats = extract_categories(posts)
    tags = extract_top_tags(posts)

    combined = sorted(set(cats + tags))
    return combined[:35]


def get_post_urls() -> list[str]:
    """Return full URLs of all published posts for Search Console targeting."""
    base = "https://gabrielebaldassarre.com"
    posts_dir = os.path.join(REPO_ROOT, "_posts")
    urls = []
    for root, _, files in os.walk(posts_dir):
        for fn in files:
            if fn.endswith(".md"):
                # Derive URL from path: _posts/<cat>/YYYY-MM-DD-slug.md → /<cat>/slug/
                rel = os.path.relpath(os.path.join(root, fn), posts_dir)
                parts = rel.split(os.sep)
                if len(parts) >= 2:
                    category = parts[0]
                    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", parts[-1])
                    slug = re.sub(r"\.md$", "", slug)
                    urls.append(f"{base}/{category}/{slug}/")
    return urls
