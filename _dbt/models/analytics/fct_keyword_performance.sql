-- fct_keyword_performance — keyword trend KPIs
-- ==============================================

SELECT
    keyword,
    fetched_at,
    -- Count of timeseries data points (relies on SQLite/D1 JSON1 extension)
    CASE
        WHEN interest_over_time IS NULL OR interest_over_time = '[]' THEN 0
        ELSE json_array_length(interest_over_time)
    END AS data_points,
    (interest_over_time IS NOT NULL AND interest_over_time != '[]') AS has_trend_data,
    (related_rising IS NOT NULL AND related_rising != '[]') AS has_rising_queries,
    (related_top IS NOT NULL AND related_top != '[]') AS has_top_queries
FROM {{ ref('stg_keyword_trends') }}
