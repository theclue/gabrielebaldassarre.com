-- fct_post_activity — change activity timeline per post
-- =======================================================

SELECT
    post_urn,
    commit_hash,
    commit_date,
    commit_message,
    change_type,
    lines_added,
    lines_removed,
    change_magnitude,
    -- Activity velocity: changes in last 7 days (via julianday range)
    COUNT(*) OVER (
        PARTITION BY post_urn
        ORDER BY julianday(commit_date)
        RANGE BETWEEN 7.0 PRECEDING AND CURRENT ROW
    ) AS changes_last_7d,
    -- Cumulative change size
    SUM(change_magnitude) OVER (
        PARTITION BY post_urn
        ORDER BY commit_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_magnitude,
    changed_at
FROM {{ ref('stg_post_history') }}
ORDER BY post_urn, commit_date DESC
