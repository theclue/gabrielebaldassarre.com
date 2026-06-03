"""Cloudflare R2 client (S3-compatible API via boto3)."""

import os
import json
from datetime import datetime, timezone

import boto3


def _client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["CLOUDFLARE_R2_ENDPOINT"],
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
    )


BUCKET = "gabrielebaldassarre-seo"


def upload_json(prefix: str, name: str, data: dict | list) -> str:
    """Upload a JSON-serialisable object to R2 under a timestamped key.

    Use for write-once artifacts where each run is a separate snapshot
    (e.g. raw audit reports). For weekly aggregates use `put_json`.
    """
    s3 = _client()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    key = f"{prefix}/{ts}/{name}"
    body = json.dumps(data, indent=2, ensure_ascii=False, default=str)
    s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")
    return key


def put_json(key: str, data: dict | list) -> str:
    """Upload (overwriting) a JSON object at an explicit key.

    Use for periodic aggregates whose natural identifier is the time
    window itself (e.g. GSC weekly pulls, Trends weekly snapshots).
    Re-running the same window simply overwrites the previous payload.
    """
    s3 = _client()
    body = json.dumps(data, indent=2, ensure_ascii=False, default=str)
    s3.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json")
    return key


def list_keys(prefix: str) -> list[str]:
    s3 = _client()
    keys = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return sorted(keys)


def download_json(key: str) -> dict | list:
    s3 = _client()
    resp = s3.get_object(Bucket=BUCKET, Key=key)
    return json.loads(resp["Body"].read().decode("utf-8"))
