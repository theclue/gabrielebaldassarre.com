-- Staging: clean Search Console data
-- ====================================
-- Surfaces `data_date` (the GSC day the row refers to) alongside
-- `fetched_at` (the pipeline run timestamp). Downstream analytics
-- should aggregate on data_date, not fetched_at.

SELECT
    id,
    query,
    page,
    CAST(data_date AS TEXT) AS data_date,
    CAST(fetched_at AS TEXT) AS fetched_at,
    COALESCE(clicks, 0) AS clicks,
    COALESCE(impressions, 0) AS impressions,
    CAST(COALESCE(ctr, 0) AS REAL) AS ctr,
    CAST(position AS REAL) AS position,
    LOWER(COALESCE(device, 'desktop')) AS device,
    LOWER(COALESCE(country, 'ita')) AS country
FROM {{ source('raw', 'search_console_data') }}
WHERE query IS NOT NULL OR page IS NOT NULL
