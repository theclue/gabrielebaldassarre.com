"""Alert engine: check D1 metrics against thresholds."""

import os
import json
from datetime import datetime, timezone, timedelta

import yaml

from . import d1

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ALERTS_JSON = os.path.join(REPO_ROOT, "alerts.json")


def _load_thresholds() -> dict:
    config_path = os.path.join(REPO_ROOT, "_seo-monitor.yml")
    with open(config_path) as f:
        config = yaml.safe_load(f) or {}
    return {k: tuple(v) for k, v in config.get("thresholds", {}).items()}


def check_and_alert() -> list[dict]:
    """Query D1 for latest metrics, compare against thresholds, return fired alerts."""
    thresholds = _load_thresholds()
    fired = []
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    week_ago_iso = (now - timedelta(days=7)).isoformat()

    for category, (metric, threshold, comparison) in thresholds.items():
        rows = d1.execute(
            """SELECT url, metric_value, checked_at
               FROM seo_snapshots
               WHERE category = ? AND metric_name = ?
                 AND checked_at > ?
               ORDER BY checked_at DESC
               LIMIT 50""",
            [category, metric, week_ago_iso]
        )

        for row in rows:
            val = row["metric_value"]
            breached = (comparison == "lt" and val < threshold) or (comparison == "gt" and val > threshold)
            if not breached:
                continue

            # Skip if already alerted for this URL+metric in the last 7 days
            existing = d1.execute(
                """SELECT id FROM alerts
                   WHERE url = ? AND metric = ?
                     AND fired_at > ?
                   ORDER BY fired_at DESC LIMIT 1""",
                [row["url"], f"{category}.{metric}", week_ago_iso]
            )

            if not existing:
                d1.execute(
                    """INSERT INTO alerts (url, metric, current_value, threshold_value, comparison, fired_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    [row["url"], f"{category}.{metric}", val, threshold, comparison, now_iso]
                )
                fired.append({
                    "url": row["url"],
                    "metric": f"{category}.{metric}",
                    "value": val,
                    "threshold": threshold,
                    "comparison": comparison,
                })

    # Write fired alerts artifact
    all_alerts = d1.execute(
        """SELECT url, metric, current_value, threshold_value, comparison, fired_at
           FROM alerts ORDER BY fired_at DESC LIMIT 100"""
    )
    with open(ALERTS_JSON, "w") as f:
        json.dump(all_alerts, f, indent=2, default=str, ensure_ascii=False)

    return fired
