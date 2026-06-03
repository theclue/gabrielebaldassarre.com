-- D1 schema migration — gabrielebaldassarre.com SEO data lake
-- Run once via: wrangler d1 execute gabrielebaldassarre-seo --file=seo-schema.sql
-- Or: the monitor.py script auto-creates these tables on first run.

-- ── Dimensions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
    urn TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    slug TEXT NOT NULL,
    tags TEXT,                       -- JSON array
    file_path TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_modified_at TEXT NOT NULL
);

-- ── Facts ─────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_snapshots_url ON seo_snapshots(url);
CREATE INDEX IF NOT EXISTS idx_snapshots_checked ON seo_snapshots(checked_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON seo_snapshots(category, metric_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_urn ON seo_snapshots(post_urn);

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

CREATE INDEX IF NOT EXISTS idx_history_urn ON post_history(post_urn);
CREATE INDEX IF NOT EXISTS idx_history_date ON post_history(changed_at);

CREATE TABLE IF NOT EXISTS keyword_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    interest_over_time TEXT,
    interest_by_region TEXT,
    related_rising TEXT,
    related_top TEXT
);

CREATE INDEX IF NOT EXISTS idx_trends_keyword ON keyword_trends(keyword);
CREATE INDEX IF NOT EXISTS idx_trends_fetched ON keyword_trends(fetched_at);

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

CREATE INDEX IF NOT EXISTS idx_gsc_query ON search_console_data(query);
CREATE INDEX IF NOT EXISTS idx_gsc_fetched ON search_console_data(fetched_at);

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

CREATE INDEX IF NOT EXISTS idx_alerts_fired ON alerts(fired_at);

-- ── ETL bookkeeping ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS etl_processed_keys (
    source TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    PRIMARY KEY (source, r2_key)
);

-- ── Unique constraints (idempotency) ──────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_trends_keyword_fetched
    ON keyword_trends (keyword, fetched_at);

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
