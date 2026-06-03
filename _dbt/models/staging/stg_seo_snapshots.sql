-- Staging: deduplicate + cast SEO snapshots
-- =========================================

WITH source AS (
    SELECT * FROM {{ source('raw', 'seo_snapshots') }}
),

ranked AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY url, source, category, metric_name, device, checked_at
            ORDER BY id DESC
        ) AS rn
    FROM source
)

SELECT
    id, post_urn, url, checked_at, source, category, metric_name,
    CAST(metric_value AS REAL) AS metric_value,
    device
FROM ranked
WHERE rn = 1
