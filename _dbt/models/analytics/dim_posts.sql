-- dim_posts — Posts dimension snapshot enriched with change timeline from post_history
-- ========================================================================
-- Each change detected via post_history creates a new row.
-- is_current = TRUE for the latest version.
-- valid_from / valid_to define the time range.

WITH post_changes AS (
    SELECT
        post_urn,
        commit_date AS changed_at,
        change_type,
        LAG(commit_date) OVER (PARTITION BY post_urn ORDER BY commit_date) AS prev_change
    FROM {{ ref('stg_post_history') }}
    WHERE change_type != 'deleted'
),

post_versions AS (
    SELECT
        p.urn,
        p.title,
        p.category,
        p.slug,
        p.tags,
        p.file_path,
        p.first_seen_at,
        p.last_modified_at,
        COALESCE(pc.changed_at, p.first_seen_at) AS valid_from,
        LEAD(COALESCE(pc.changed_at, p.first_seen_at))
            OVER (PARTITION BY p.urn ORDER BY COALESCE(pc.changed_at, p.first_seen_at))
            AS valid_to,
        ROW_NUMBER() OVER (PARTITION BY p.urn ORDER BY COALESCE(pc.changed_at, p.first_seen_at) DESC) = 1
            AS is_current
    FROM {{ source('raw', 'posts') }} p
    LEFT JOIN post_changes pc ON p.urn = pc.post_urn
)

SELECT
    urn,
    title,
    category,
    slug,
    tags,
    file_path,
    first_seen_at,
    last_modified_at,
    valid_from,
    valid_to,
    is_current
FROM post_versions
