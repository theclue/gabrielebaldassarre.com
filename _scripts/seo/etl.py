"""ETL: R2 raw JSON → D1 timeseries tables."""

import re
from datetime import datetime, timezone

from . import r2, d1


# In-memory cache populated from the posts dimension on first lookup.
_URL_TO_URN_CACHE: dict[str, str] | None = None


def _ensure_processed_table() -> None:
    d1.execute(
        """CREATE TABLE IF NOT EXISTS etl_processed_keys (
            source TEXT NOT NULL,
            r2_key TEXT NOT NULL,
            processed_at TEXT NOT NULL,
            PRIMARY KEY (source, r2_key)
        )"""
    )


def _is_processed(source: str, key: str) -> bool:
    rows = d1.execute(
        "SELECT 1 FROM etl_processed_keys WHERE source = ? AND r2_key = ? LIMIT 1",
        [source, key],
    )
    return bool(rows)


def _mark_processed(source: str, key: str) -> None:
    d1.execute(
        "INSERT OR IGNORE INTO etl_processed_keys (source, r2_key, processed_at) VALUES (?, ?, ?)",
        [source, key, datetime.now(timezone.utc).isoformat()],
    )


def _load_url_index() -> dict[str, str]:
    """Build a {public_url: post_urn} index from the posts dimension."""
    global _URL_TO_URN_CACHE
    if _URL_TO_URN_CACHE is not None:
        return _URL_TO_URN_CACHE
    rows = d1.execute("SELECT urn, category, slug FROM posts")
    base = "https://gabrielebaldassarre.com"
    _URL_TO_URN_CACHE = {
        f"{base}/{r['category']}/{r['slug']}/": r["urn"] for r in rows
    }
    return _URL_TO_URN_CACHE


def _resolve_urn(url: str) -> str | None:
    if not url:
        return None
    idx = _load_url_index()
    # Try exact match first, then normalised (strip query/fragment, ensure trailing slash)
    if url in idx:
        return idx[url]
    norm = re.sub(r"[?#].*$", "", url)
    if not norm.endswith("/"):
        norm += "/"
    return idx.get(norm)


def _flatten_pagespeed(raw: dict) -> list[dict]:
    """Extract numeric metrics from a PageSpeed Insights JSON response."""
    lh = raw.get("lighthouseResult", {})
    categories = lh.get("categories", {})
    audits = lh.get("audits", {})

    url = lh.get("finalUrl", lh.get("requestedUrl", ""))
    checked_at = lh.get("fetchTime", datetime.now(timezone.utc).isoformat())
    # PSI sets configSettings.formFactor to 'mobile' | 'desktop'
    form_factor = (lh.get("configSettings", {}) or {}).get("formFactor")
    device = form_factor if form_factor in ("mobile", "desktop") else (
        "desktop" if "desktop" in str(raw.get("id", "")).lower() else "mobile"
    )
    post_urn = _resolve_urn(url)

    rows = []

    def add(cat, name, val, dev=device):
        if val is not None:
            rows.append({"post_urn": post_urn, "url": url, "checked_at": checked_at,
                         "source": "pagespeed", "category": cat, "metric_name": name,
                         "metric_value": float(val), "device": dev})

    # Category scores (0-1 → 0-100)
    for cat_name in ("performance", "accessibility", "seo", "best-practices"):
        score = categories.get(cat_name, {}).get("score")
        if score is not None:
            add(cat_name, "score", score * 100)

    # Core Web Vitals
    metric_map = {
        "largest-contentful-paint": ("lcp", "lcp"),
        "total-blocking-time": ("tbt", "tbt"),
        "cumulative-layout-shift": ("cls", "cls"),
        "first-contentful-paint": ("fcp", "fcp"),
        "interactive": ("performance", "tti"),
        "speed-index": ("performance", "speed_index"),
    }

    for audit_id, (cat, name) in metric_map.items():
        a = audits.get(audit_id, {})
        val = a.get("numericValue")
        if val is not None:
            add(cat, name, val)

    return rows


def _flatten_lighthouse(raw: dict, url: str) -> list[dict]:
    """Extract assertion results from Lighthouse CI JSON."""
    if not isinstance(raw, list):
        return []

    rows = []
    checked_at = datetime.now(timezone.utc).isoformat()
    post_urn = _resolve_urn(url)

    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name", item.get("auditId", ""))
        actual = item.get("actual")
        if actual is not None and isinstance(actual, (int, float)):
            rows.append({
                "post_urn": post_urn, "url": url, "checked_at": checked_at,
                "source": "lighthouse",
                "category": name.split(":")[0], "metric_name": name,
                "metric_value": float(actual), "device": "mobile",
            })
    return rows


def _lighthouse_url(raw: dict) -> str:
    """Best-effort extraction of the audited URL from an LHCI payload."""
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and item.get("url"):
                return item["url"]
    if isinstance(raw, dict):
        return raw.get("finalUrl") or raw.get("requestedUrl") or raw.get("url") or ""
    return ""


def run_etl(batch_size: int = 200) -> dict:
    """Scan R2 for unprocessed keys, extract metrics, insert into D1.

    Skips keys already recorded in etl_processed_keys, so re-runs do not
    duplicate snapshot rows.

    Returns:
        {"pagespeed_rows": int, "lighthouse_rows": int, ...}
    """
    _ensure_processed_table()
    stats = {"pagespeed_rows": 0, "lighthouse_rows": 0}

    # ── PageSpeed snapshots ──
    for key in r2.list_keys("seo/pagespeed/")[-batch_size:]:
        if _is_processed("pagespeed", key):
            continue
        try:
            raw = r2.download_json(key)
            rows = _flatten_pagespeed(raw)
            for row in rows:
                d1.execute(
                    """INSERT INTO seo_snapshots
                       (post_urn, url, checked_at, source, category, metric_name, metric_value, device)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    [row["post_urn"], row["url"], row["checked_at"], row["source"],
                     row["category"], row["metric_name"], row["metric_value"], row["device"]]
                )
                stats["pagespeed_rows"] += 1
            _mark_processed("pagespeed", key)
        except Exception as e:
            print(f"  ⚠️  ETL pagespeed {key}: {e}")

    # ── Lighthouse snapshots ──
    for key in r2.list_keys("seo/lighthouse/")[-batch_size:]:
        if _is_processed("lighthouse", key):
            continue
        try:
            raw = r2.download_json(key)
            url = _lighthouse_url(raw)
            rows = _flatten_lighthouse(raw, url)
            for row in rows:
                d1.execute(
                    """INSERT INTO seo_snapshots
                       (post_urn, url, checked_at, source, category, metric_name, metric_value, device)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    [row["post_urn"], row["url"], row["checked_at"], row["source"],
                     row["category"], row["metric_name"], row["metric_value"], row["device"]]
                )
                stats["lighthouse_rows"] += 1
            _mark_processed("lighthouse", key)
        except Exception as e:
            print(f"  ⚠️  ETL lighthouse {key}: {e}")

    return stats
