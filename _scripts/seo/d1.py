"""Cloudflare D1 client (HTTP REST API via httpx)."""

import os

import httpx


def _env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


def _base() -> str:
    account = _env("CLOUDFLARE_ACCOUNT_ID")
    database = _env("CLOUDFLARE_D1_DATABASE_ID")
    return f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_env('CLOUDFLARE_D1_API_TOKEN')}",
        "Content-Type": "application/json",
    }


def _check(data: dict, ctx: str) -> None:
    if not data.get("success"):
        raise RuntimeError(f"D1 {ctx} failed: {data.get('errors', data)}")


def execute(sql: str, params: list | None = None) -> list[dict]:
    """Run a single D1 SQL statement and return rows as list of dicts.

    For SELECT: returns rows. For DDL/DML: returns [].
    """
    body = {"sql": sql}
    if params:
        body["params"] = params

    r = httpx.post(f"{_base()}/query", headers=_headers(), json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    _check(data, "query")

    result = data.get("result", [])
    if not result:
        return []

    # D1 REST returns result[0].results as a list of row-dicts already keyed by column.
    rows = result[0].get("results", [])
    return rows if isinstance(rows, list) else []


def execute_batch(statements: list[dict]) -> list[dict]:
    """Run a batch of parameterized SQL statements.

    Each statement: {"sql": "...", "params": [...]}.
    """
    r = httpx.post(
        f"{_base()}/batch",
        headers=_headers(),
        json=statements,
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    _check(data, "batch")
    return data.get("result", [])


def ensure_schema(sql: str) -> None:
    """Execute DDL statements (CREATE TABLE IF NOT EXISTS etc.)."""
    for stmt in sql.strip().split(";"):
        stmt = stmt.strip()
        if not stmt:
            continue
        # Skip comment-only blocks — D1 API rejects empty/non-SQL payloads
        lines = [l for l in stmt.splitlines() if l.strip() and not l.strip().startswith("--")]
        if not lines:
            continue
        execute(stmt)
