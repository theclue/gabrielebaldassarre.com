"""Monthly Markdown report generator."""

import os
from datetime import datetime, timezone, timedelta

from . import d1

REPORT_MD = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "seo-monthly-report.md"
)


def _avg(rows: list[dict], metric_col: str = "metric_value") -> float:
    vals = [r[metric_col] for r in rows if r.get(metric_col) is not None]
    return round(sum(vals) / len(vals), 1) if vals else 0


def _top(rows: list[dict], key: str, descending: bool = True, n: int = 5) -> list[dict]:
    return sorted(rows, key=lambda r: r.get(key, 0) or 0, reverse=descending)[:n]


def generate() -> str:
    """Query D1, produce Markdown report, return the path."""
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    # Latest per-URL averages
    ps = d1.execute(
        """SELECT url, category, metric_name,
                  AVG(metric_value) as avg_value, COUNT(*) as samples
           FROM seo_snapshots
           WHERE source = 'pagespeed' AND checked_at > ?
           GROUP BY url, category, metric_name""",
        [month_ago.isoformat()]
    )

    # Alerts this month
    alert_rows = d1.execute(
        """SELECT url, metric, current_value, threshold_value, comparison, fired_at
           FROM alerts WHERE fired_at > ? ORDER BY fired_at DESC""",
        [month_ago.isoformat()]
    )

    # Build report
    lines = [
        f"# SEO Monthly Report — {now.strftime('%B %Y')}",
        f"",
        f"Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}",
        f"",
        f"## Site Health Overview",
        f"",
        f"| Category | Avg Score | Samples |",
        f"|----------|----------|---------|",
    ]

    for cat in ("performance", "accessibility", "seo", "best-practices"):
        cat_rows = [r for r in ps if r["category"] == cat and r["metric_name"] == "score"]
        avg_s = _avg(cat_rows)
        samples = sum(r["samples"] for r in cat_rows)
        lines.append(f"| {cat} | {avg_s}% | {samples} |")

    lines += [
        f"",
        f"## Core Web Vitals (avg across all URLs)",
        f"",
        f"| Metric | Avg Value |",
        f"|--------|----------|",
    ]
    for vit in ("lcp", "tbt", "cls", "fcp"):
        vit_rows = [r for r in ps if r["metric_name"] == vit]
        avg_v = _avg(vit_rows)
        lines.append(f"| {vit.upper()} | {avg_v} |")

    lines += [
        f"",
        f"## Alerts ({len(alert_rows)} this month)",
        f"",
    ]
    if alert_rows:
        lines.append(f"| URL | Metric | Value | Threshold | Fired |")
        lines.append(f"|-----|--------|-------|-----------|-------|")
        for a in alert_rows[:20]:
            lines.append(
                f"| {a['url']} | {a['metric']} | {a['current_value']} "
                f"| {a['comparison']} {a['threshold_value']} "
                f"| {a['fired_at'][:19]} |"
            )
    else:
        lines.append("No alerts this month ✅")

    lines += [
        f"",
        f"## Search Console (top queries — from D1)",
        f"",
    ]
    gsc_rows = d1.execute(
        """SELECT query, SUM(clicks) as total_clicks, AVG(ctr) as avg_ctr, AVG(position) as avg_pos
           FROM search_console_data WHERE fetched_at > ?
           GROUP BY query ORDER BY total_clicks DESC LIMIT 10""",
        [month_ago.isoformat()]
    )
    if gsc_rows:
        lines.append(f"| Query | Clicks | CTR | Position |")
        lines.append(f"|-------|--------|-----|----------|")
        for r in gsc_rows:
            lines.append(
                f"| {r['query']} | {r['total_clicks']} | {round(r['avg_ctr']*100, 1)}% "
                f"| {round(r['avg_pos'], 1)} |"
            )

    md = "\n".join(lines)
    with open(REPORT_MD, "w") as f:
        f.write(md)

    return REPORT_MD
