-- Staging: enrich post_history with change classification
-- =========================================================

WITH source AS (
    SELECT * FROM {{ source('raw', 'post_history') }}
)

SELECT
    id,
    post_urn,
    commit_hash,
    CAST(commit_date AS TEXT) AS commit_date,
    commit_message,
    change_type,
    COALESCE(lines_added, 0) AS lines_added,
    COALESCE(lines_removed, 0) AS lines_removed,
    COALESCE(diff_size, 0) AS diff_size,
    -- Activity score: weighted change magnitude
    (COALESCE(lines_added, 0) + COALESCE(lines_removed, 0)) AS change_magnitude,
    CAST(changed_at AS TEXT) AS changed_at
FROM source
