"""Cloudflare R2 client (S3-compatible API via boto3)."""

import os
import json
from datetime import datetime, timezone

import boto3


def _client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("CLOUDFLARE_R2_ENDPOINT") or os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID") or os.environ["R2_KEY"],
        aws_secret_access_key=os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or os.environ["R2_SECRET"],
    )


BUCKET = os.environ.get("CLOUDFLARE_R2_SEO_BUCKET") or os.environ.get("R2_BUCKET") or "gabrielebaldassarre-seo"


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


def upload_files(prefix: str, file_paths: list[str]) -> list[str]:
    """Upload one or more local JSON files to R2 under a shared timestamped prefix."""
    s3 = _client()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    uploaded = []
    for path in file_paths:
        if not os.path.isfile(path):
            continue
        key = f"{prefix}/{ts}/{os.path.basename(path)}"
        with open(path, "rb") as fd:
            s3.upload_fileobj(fd, BUCKET, key)
        print(f"  -> r2://{key}")
        uploaded.append(key)
    return uploaded


if __name__ == "__main__":
    import glob
    import sys

    if len(sys.argv) < 3:
        print("Usage: python3 -m _scripts.seo.r2 <prefix> <glob_or_file...>", file=sys.stderr)
        sys.exit(1)
    target_prefix = sys.argv[1].strip("/")
    files = []
    for pattern in sys.argv[2:]:
        matched = sorted(glob.glob(pattern))
        files.extend(matched if matched else ([pattern] if os.path.isfile(pattern) else []))
    upload_files(target_prefix, files)
    print(f"{len(files)} file caricati su R2 ({target_prefix})")
