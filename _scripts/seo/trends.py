"""Google Trends data via serpapi."""

import os
from datetime import datetime, timezone

from serpapi.google_search import GoogleSearch


def _search(params: dict) -> dict:
    params.setdefault("api_key", os.environ["SERPAPI_API_KEY"])
    params.setdefault("engine", "google_trends")
    search = GoogleSearch(params)
    return search.get_dict()


def fetch_keyword(keyword: str, geo: str = "IT", date: str = "today 3-m") -> dict:
    """Fetch Google Trends data for a single keyword.

    Returns:
        {
            "keyword": str,
            "interest_over_time": list,
            "related_rising": list,
            "related_top": list,
        }
    """
    # Timeseries
    ts_result = _search({"q": keyword, "geo": geo, "date": date, "data_type": "TIMESERIES"})
    iot = ts_result.get("interest_over_time", {})

    # Related queries — single call returns both 'rising' and 'top'
    rq_result = _search({"q": keyword, "geo": geo, "date": date, "data_type": "RELATED_QUERIES"})
    related = rq_result.get("related_queries", {}) or {}
    rising = related.get("rising", []) or []
    top = related.get("top", []) or []

    return {
        "keyword": keyword,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "geo": geo,
        "date_range": date,
        "interest_over_time": iot.get("timeline_data", []) if iot else [],
        "related_rising": [r["query"] for r in rising if "query" in r][:5],
        "related_top": [t["query"] for t in top if "query" in t][:5],
    }
