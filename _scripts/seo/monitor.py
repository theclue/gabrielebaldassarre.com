#!/usr/bin/env python3
"""SEO Monitor — Phase 2 orchestrator.

Runs weekly (Monday 8:00 UTC) via GitHub Actions.
1. Extract seed keywords from blog posts
2. Fetch Google Trends data via serpapi
3. Fetch Google Search Console metrics
4. ETL: R2 raw JSON → D1 timeseries
5. Check thresholds → alerts
6. Generate monthly Markdown report (if first Monday of month)

Usage:
    python3 _scripts/seo/monitor.py [--dry-run] [--force-report]
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone

import yaml

# Ensure the repo root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from _scripts.seo import r2, d1, keywords, posts, trends, search_console, etl, alerts, report

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _load_gsc_config() -> dict:
    """Read GSC tuning (lookback_days, query_limit) from _seo-monitor.yml."""
    path = os.path.join(REPO_ROOT, "_seo-monitor.yml")
    try:
        with open(path) as f:
            cfg = yaml.safe_load(f) or {}
        return cfg.get("search_console", {}) or {}
    except FileNotFoundError:
        return {}


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS posts (
    urn TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    slug TEXT NOT NULL,
    tags TEXT,
    file_path TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_modified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seo_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_urn TEXT REFERENCES posts(urn),
    url TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL,
    device TEXT
);

CREATE TABLE IF NOT EXISTS post_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_urn TEXT REFERENCES posts(urn),
    commit_hash TEXT NOT NULL,
    commit_date TEXT NOT NULL,
    commit_message TEXT NOT NULL,
    change_type TEXT NOT NULL DEFAULT 'modified',
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    diff_size INTEGER,
    raw_diff TEXT,
    changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    interest_over_time TEXT,
    interest_by_region TEXT,
    related_rising TEXT,
    related_top TEXT
);

CREATE TABLE IF NOT EXISTS search_console_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT,
    page TEXT,
    data_date TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    position REAL,
    device TEXT DEFAULT 'desktop',
    country TEXT DEFAULT 'ita'
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    metric TEXT NOT NULL,
    current_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    comparison TEXT NOT NULL DEFAULT 'lt',
    fired_at TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS etl_processed_keys (
    source TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    PRIMARY KEY (source, r2_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_trends_keyword_fetched
    ON keyword_trends (keyword, fetched_at);

-- GSC: natural key is (query, page, data_date, device, country). COALESCE
-- handles NULLs in `query` (page-only fetches) and `page` (query-only fetches)
-- because SQLite treats NULLs as distinct in UNIQUE indexes by default.
DROP INDEX IF EXISTS idx_search_console_query_fetched;
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_console_natural_key
    ON search_console_data (
        COALESCE(query, ''),
        COALESCE(page, ''),
        data_date,
        device,
        country
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_history_urn_commit
    ON post_history (post_urn, commit_hash);
"""


def main():
    parser = argparse.ArgumentParser(description="SEO Monitor — Phase 2")
    parser.add_argument("--dry-run", action="store_true", help="Skip R2/D1 write operations")
    parser.add_argument("--force-report", action="store_true", help="Generate monthly report regardless of date")
    args = parser.parse_args()

    print("🔍 SEO Monitor — Phase 2")
    print("=" * 50)

    # ── Schema ──────────────────────────────────────────────────────
    print("\n📦 Ensuring D1 schema...")
    d1.ensure_schema(SCHEMA_SQL)
    print("   ✅ Schema ready")

    # ── Posts dimension ─────────────────────────────────────────────
    print("\n📚 Syncing posts dimension...")
    post_urns = posts.sync_posts(dry_run=args.dry_run)
    print(f"   ✅ {len(post_urns)} posts synced")

    # ── Keywords ────────────────────────────────────────────────────
    print("\n🔑 Extracting seed keywords...")
    seed = keywords.get_seed_keywords()
    print(f"   {len(seed)} keywords: {', '.join(seed[:8])}...")

    # ── Google Trends ───────────────────────────────────────────────
    print("\n📈 Google Trends (serpapi)...")
    trend_results = []
    for kw in seed:
        try:
            data = trends.fetch_keyword(kw)
            trend_results.append(data)
            rising_count = len(data.get("related_rising", []))
            print(f"   ✅ {kw}: {len(data.get('interest_over_time', []))} data points, {rising_count} rising")
        except Exception as e:
            print(f"   ⚠️  {kw}: {e}")

    if trend_results and not args.dry_run:
        # Weekly aggregate: ISO year-week is the natural key. Re-running
        # within the same week overwrites the snapshot (no R2 duplicates).
        now = datetime.now(timezone.utc)
        iso_year, iso_week, _ = now.isocalendar()
        r2.put_json(f"seo/trends/{iso_year}-W{iso_week:02d}.json", trend_results)
        for t in trend_results:
            d1.execute(
                """INSERT OR IGNORE INTO keyword_trends
                   (keyword, fetched_at, interest_over_time, related_rising, related_top)
                   VALUES (?, ?, ?, ?, ?)""",
                [
                    t["keyword"],
                    t["fetched_at"],
                    json.dumps(t.get("interest_over_time", [])),
                    json.dumps(t.get("related_rising", [])),
                    json.dumps(t.get("related_top", [])),
                ]
            )
        print(f"   ✅ {len(trend_results)} trends uploaded to R2 + D1")

    # ── Search Console ──────────────────────────────────────────────
    print("\n🔎 Google Search Console...")
    gsc_disabled = not os.environ.get("GSC_SERVICE_ACCOUNT_JSON") and not os.environ.get("GSC_SERVICE_ACCOUNT_B64")
    if gsc_disabled:
        print("   ⚠️  GSC credentials not configured — skipping")
    else:
        try:
            gsc_cfg = _load_gsc_config()
            lookback = int(gsc_cfg.get("lookback_days", 14))
            limit = int(gsc_cfg.get("query_limit", 500))
            query_metrics = search_console.fetch_query_metrics(days=lookback, limit=limit)
            print(f"   {len(query_metrics)} query rows (lookback={lookback}d, limit={limit})")

            if query_metrics and not args.dry_run:
                # R2: una chiave per giorno → re-run/backfill sovrascrivono
                # SOLO i giorni rifetchati, niente accumulo né file orfani.
                # È la fonte di idempotenza lato data lake.
                by_day: dict[str, list[dict]] = {}
                for qm in query_metrics:
                    by_day.setdefault(qm["data_date"], []).append(qm)
                for day, rows in by_day.items():
                    r2.put_json(f"seo/search-console/{day}.json", rows)
                print(f"   ☁️  R2: {len(by_day)} daily files written/overwritten")

                # D1: UNIQUE (query, page, data_date, device, country) +
                # INSERT OR IGNORE → re-run idempotenti a livello riga.
                for qm in query_metrics:
                    d1.execute(
                        """INSERT OR IGNORE INTO search_console_data
                           (query, page, data_date, fetched_at, clicks, impressions,
                            ctr, position, device, country)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        [
                            qm.get("query"),
                            qm.get("page"),
                            qm["data_date"],
                            qm["fetched_at"],
                            qm["clicks"],
                            qm["impressions"],
                            qm["ctr"],
                            qm["position"],
                            qm.get("device", "desktop"),
                            qm.get("country", "ita"),
                        ],
                    )
                print("   ✅ D1: rows upserted (duplicates ignored)")
        except Exception as e:
            print(f"   ⚠️  GSC error: {e}")

    # ── ETL ─────────────────────────────────────────────────────────
    print("\n🔄 ETL: R2 → D1...")
    if args.dry_run:
        print("   (skipped in dry-run mode)")
    else:
        stats = etl.run_etl()
        print(f"   ✅ pagespeed: {stats['pagespeed_rows']} rows, lighthouse: {stats['lighthouse_rows']} rows")

    # ── dbt Transform ──────────────────────────────────────────────
    print("\n📐 dbt: compile → D1...")
    if args.dry_run:
        print("   (skipped in dry-run mode)")
    else:
        try:
            from _scripts.seo.dbt_runner import dbt_compile, apply_to_d1
            sql_files = dbt_compile()
            if sql_files:
                stats_dbt = apply_to_d1(sql_files)
                print(f"   ✅ {stats_dbt['applied']} statements applied, {stats_dbt['errors']} errors")
            else:
                print("   ⚠️  No dbt models compiled")
        except ImportError:
            print("   ⚠️  dbt not installed — skipping transformations")
        except Exception as e:
            print(f"   ⚠️  dbt runner failed: {e}")

    # ── Alerts ──────────────────────────────────────────────────────
    print("\n🚨 Checking alert thresholds...")
    if args.dry_run:
        print("   (skipped in dry-run mode)")
    else:
        fired = alerts.check_and_alert()
        if fired:
            print(f"   ⚠️  {len(fired)} alerts fired:")
            for a in fired:
                print(f"      {a['url']} → {a['metric']} = {a['value']} (threshold: {a['comparison']} {a['threshold']})")
        else:
            print("   ✅ No new alerts")

    # ── Monthly Report ──────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    is_first_monday = now.weekday() == 0 and now.day <= 7

    if args.force_report or is_first_monday:
        print("\n📊 Generating monthly report...")
        if args.dry_run:
            print("   (skipped in dry-run mode)")
        else:
            path = report.generate()
            print(f"   ✅ Report: {path}")
    else:
        print("\n📊 Monthly report: skipped (not first Monday)")

    print("\n" + "=" * 50)
    print("✅ SEO Monitor complete\n")


if __name__ == "__main__":
    main()
