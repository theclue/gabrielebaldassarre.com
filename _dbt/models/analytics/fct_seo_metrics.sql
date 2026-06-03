-- fct_seo_metrics — daily SEO performance per post
-- ====================================================

WITH snapshots AS (
    SELECT
        post_urn,
        url,
        DATE(checked_at) AS check_date,
        source,
        category,
        metric_name,
        metric_value,
        device
    FROM {{ ref('stg_seo_snapshots') }}
    WHERE post_urn IS NOT NULL
),

pivoted AS (
    SELECT
        post_urn,
        url,
        check_date,
        source,
        device,
        MAX(CASE WHEN category = 'performance' AND metric_name = 'score' THEN metric_value END) AS performance_score,
        MAX(CASE WHEN category = 'accessibility' AND metric_name = 'score' THEN metric_value END) AS accessibility_score,
        MAX(CASE WHEN category = 'seo' AND metric_name = 'score' THEN metric_value END) AS seo_score,
        MAX(CASE WHEN category = 'best-practices' AND metric_name = 'score' THEN metric_value END) AS best_practices_score,
        MAX(CASE WHEN metric_name = 'lcp' THEN metric_value END) AS lcp_ms,
        MAX(CASE WHEN metric_name = 'tbt' THEN metric_value END) AS tbt_ms,
        MAX(CASE WHEN metric_name = 'cls' THEN metric_value END) AS cls,
        MAX(CASE WHEN metric_name = 'fcp' THEN metric_value END) AS fcp_ms
    FROM snapshots
    GROUP BY post_urn, url, check_date, source, device
)

SELECT
    pv.post_urn,
    pv.url,
    pv.check_date,
    pv.source,
    pv.device,
    pv.performance_score,
    pv.accessibility_score,
    pv.seo_score,
    pv.best_practices_score,
    pv.lcp_ms,
    pv.tbt_ms,
    pv.cls,
    pv.fcp_ms,
    -- Alert flags
    pv.performance_score < 50 AS flag_perf_critical,
    pv.accessibility_score < 80 AS flag_a11y_warning,
    pv.lcp_ms > 4000 AS flag_lcp_slow
FROM pivoted pv
