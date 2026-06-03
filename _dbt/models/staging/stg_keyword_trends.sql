-- Staging: clean keyword trends data
-- ===================================

SELECT
    id,
    keyword,
    CAST(fetched_at AS TEXT) AS fetched_at,
    interest_over_time,
    interest_by_region,
    related_rising,
    related_top
FROM {{ source('raw', 'keyword_trends') }}
WHERE keyword IS NOT NULL
