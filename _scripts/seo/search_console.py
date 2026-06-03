"""Google Search Console API client.

The fetcher returns per-day, per-device, per-country rows. This produces a
natural primary key (query, data_date, device, country, page) so that runs
overlapping in time do not create duplicates in the warehouse.
"""

import os
import json
import base64
from datetime import datetime, timezone, timedelta

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SITE_URL = "https://gabrielebaldassarre.com"


def _service():
    creds_json = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")
    if not creds_json:
        # Try base64-encoded version (GitHub Actions secret)
        creds_b64 = os.environ.get("GSC_SERVICE_ACCOUNT_B64", "")
        if creds_b64:
            creds_json = base64.b64decode(creds_b64).decode()
        else:
            raise RuntimeError("GSC_SERVICE_ACCOUNT_JSON or GSC_SERVICE_ACCOUNT_B64 must be set")

    creds_dict = json.loads(creds_json)
    credentials = Credentials.from_service_account_info(
        creds_dict, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    return build("webmasters", "v3", credentials=credentials)


def fetch_query_metrics(days: int = 14, limit: int = 500) -> list[dict]:
    """Fetch search query metrics split by date / device / country.

    Each row carries `data_date` (the GSC day) plus `fetched_at` (the
    pipeline run timestamp). The natural key for dedup downstream is
    (query, data_date, device, country, page).
    """
    svc = _service()
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    fetched_at = datetime.now(timezone.utc).isoformat()
    date_range = f"{start.isoformat()}:{end.isoformat()}"

    request = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["query", "date", "device", "country"],
        "rowLimit": limit,
    }

    response = svc.searchanalytics().query(siteUrl=SITE_URL, body=request).execute()

    results = []
    for row in response.get("rows", []):
        keys = row.get("keys", [])
        if len(keys) < 4:
            continue
        query, data_date, device, country = keys[0], keys[1], keys[2], keys[3]
        results.append(
            {
                "query": query,
                "page": None,
                "data_date": data_date,
                "device": (device or "desktop").lower(),
                "country": (country or "ITA").lower(),
                "clicks": int(row.get("clicks", 0) or 0),
                "impressions": int(row.get("impressions", 0) or 0),
                "ctr": round(float(row.get("ctr", 0) or 0), 4),
                "position": round(float(row.get("position", 0) or 0), 2),
                "date_range": date_range,
                "fetched_at": fetched_at,
            }
        )
    return results


def fetch_page_metrics(paths: list[str], days: int = 14) -> list[dict]:
    """Fetch per-page metrics for given URL paths, split by date/device/country."""
    svc = _service()
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    fetched_at = datetime.now(timezone.utc).isoformat()
    date_range = f"{start.isoformat()}:{end.isoformat()}"

    results = []
    for path in paths:
        try:
            request = {
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "dimensions": ["page", "date", "device", "country"],
                "dimensionFilterGroups": [
                    {"filters": [{"dimension": "page", "operator": "equals", "expression": path}]}
                ],
                "rowLimit": 1000,
            }
            response = svc.searchanalytics().query(siteUrl=SITE_URL, body=request).execute()
            for row in response.get("rows", []):
                keys = row.get("keys", [])
                if len(keys) < 4:
                    continue
                page, data_date, device, country = keys[0], keys[1], keys[2], keys[3]
                results.append(
                    {
                        "query": None,
                        "page": page,
                        "data_date": data_date,
                        "device": (device or "desktop").lower(),
                        "country": (country or "ITA").lower(),
                        "clicks": int(row.get("clicks", 0) or 0),
                        "impressions": int(row.get("impressions", 0) or 0),
                        "ctr": round(float(row.get("ctr", 0) or 0), 4),
                        "position": round(float(row.get("position", 0) or 0), 2),
                        "date_range": date_range,
                        "fetched_at": fetched_at,
                    }
                )
        except Exception as e:
            print(f"  ⚠️  GSC page error for {path}: {e}")

    return results
