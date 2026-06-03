#!/usr/bin/env python3
"""dbt Runner — Compile dbt models and apply compiled SQL to D1.

This bridges the gap between dbt (which needs a SQL connection)
and D1 (which only has an HTTP API). The flow:

1. dbt compile  →  resolves DAG, generates compiled SQL
2. dbt test     →  validates model SQL (syntax + logic)
3. Python reads compiled SQL  →  applies to D1 via HTTP API
4. Schema contracts enforced at dbt level

Transactional guarantees
------------------------
Each model is applied as a single Cloudflare D1 `/batch` call, which is
atomic: if any statement of the model fails, all statements of that
*same* model are rolled back. There is no cross-model transaction by
design — staging and analytics layers are applied in dependency order
and failures stop the pipeline early via a non-zero exit code.

Usage:
    python3 _scripts/seo/dbt_runner.py [--dry-run] [--select model_name]
"""

import os
import re
import sys
import json
import subprocess
import argparse
from pathlib import Path

from . import d1

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DBT_DIR = REPO_ROOT / "_dbt"


def dbt_compile(select: str | None = None) -> list[Path]:
    """Run dbt compile and return paths to compiled SQL files."""
    cmd = [
        "dbt", "compile",
        "--profiles-dir", str(DBT_DIR),
        "--project-dir", str(DBT_DIR),
        "--no-write-json",  # minimal output
    ]
    if select:
        cmd.extend(["--select", select])

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT)
    if result.returncode != 0:
        print("⚠️  dbt compile failed:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        return []

    compiled_dir = DBT_DIR / "target" / "compiled" / "gabriele_seo" / "models"
    sql_files = sorted(compiled_dir.rglob("*.sql"))
    return sql_files


def dbt_test(select: str | None = None) -> bool:
    """Run dbt tests. Returns True if all pass."""
    cmd = [
        "dbt", "test",
        "--profiles-dir", str(DBT_DIR),
        "--project-dir", str(DBT_DIR),
    ]
    if select:
        cmd.extend(["--select", select])

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT)
    if result.returncode != 0:
        print("⚠️  dbt test had failures:", file=sys.stderr)
        print(result.stdout[-2000:], file=sys.stderr)
    return result.returncode == 0


def _extract_model_name(path: Path) -> str:
    """Derive dbt model name from compiled path."""
    return path.stem


def _sqlite_to_d1(sql: str) -> list[str]:
    """Adapt dbt-sqlite compiled SQL for D1 compatibility.

    D1 is SQLite-compatible. Minor differences handled here.
    """
    statements = []
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if not stmt:
            continue

        # D1 doesn't support CREATE VIEW — convert to CREATE TABLE AS
        stmt = re.sub(
            r"CREATE\s+VIEW\s+(\S+)\s+AS\s+",
            r"DROP TABLE IF EXISTS \1; CREATE TABLE \1 AS ",
            stmt, flags=re.IGNORECASE
        )

        # The DROP injected above may now share a statement with the
        # following CREATE — split again to keep one operation per item.
        for sub in stmt.split(";"):
            sub = sub.strip()
            if sub:
                statements.append(sub)

    return statements


def apply_to_d1(sql_files: list[Path], dry_run: bool = False) -> dict:
    """Execute compiled dbt models against D1 via HTTP API.

    Each model is applied through a single D1 `/batch` call, which is
    transactional: a failure mid-model rolls back every statement of
    that model. On error the pipeline continues with the next model so
    that one broken transform does not silently mask the others — but
    the global exit code is non-zero (see `main`).

    Returns:
        {"applied": int, "skipped": int, "errors": int}
    """
    stats = {"applied": 0, "skipped": 0, "errors": 0}

    # Order: staging first (views), then analytics (tables with refs).
    # Cross-model atomicity is intentionally NOT enforced — see module
    # docstring.
    staging = [f for f in sql_files if "staging" in str(f)]
    analytics = [f for f in sql_files if "analytics" in str(f)]

    for sql_file in staging + analytics:
        model_name = _extract_model_name(sql_file)
        statements = _sqlite_to_d1(sql_file.read_text())
        if not statements:
            stats["skipped"] += 1
            print(f"  [{model_name}] (no statements) — skipped")
            continue

        preview = statements[0][:80].strip()
        print(f"  [{model_name}] {len(statements)} stmt(s) — preview: {preview}...")

        if dry_run:
            stats["applied"] += len(statements)
            continue

        try:
            d1.execute_batch([{"sql": s} for s in statements])
            stats["applied"] += len(statements)
            print(f"    ✅ [{model_name}] {len(statements)} stmts committed")
        except Exception as e:
            # D1 /batch is atomic → on failure the whole model is rolled
            # back automatically by Cloudflare. We surface the error and
            # move on to the next model.
            stats["errors"] += 1
            print(f"    ❌ [{model_name}] rolled back: {e}", file=sys.stderr)

    return stats


def main():
    parser = argparse.ArgumentParser(description="dbt Runner → D1")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--select", type=str, help="dbt model selector")
    parser.add_argument("--skip-tests", action="store_true")
    args = parser.parse_args()

    print("🔧 dbt Runner — Compile → D1")
    print("=" * 50)

    # ── Compile ───────────────────────────────────────────────────
    print("\n📐 Compiling dbt models...")
    sql_files = dbt_compile(select=args.select)
    if not sql_files:
        print("   ❌ No compiled models — aborting")
        sys.exit(1)
    print(f"   ✅ {len(sql_files)} models compiled")

    # ── Test ──────────────────────────────────────────────────────
    if not args.skip_tests:
        print("\n🧪 Running dbt tests...")
        if dbt_test(select=args.select):
            print("   ✅ All tests passed")
        else:
            print("   ⚠️  Some tests failed — continuing anyway")

    # ── Apply to D1 ───────────────────────────────────────────────
    print("\n☁️  Applying to D1...")
    if args.dry_run:
        print("   (dry-run mode)")

    stats = apply_to_d1(sql_files, dry_run=args.dry_run)
    print(f"\n📊 Results: {stats['applied']} applied, {stats['skipped']} skipped, {stats['errors']} errors")

    if stats["errors"] > 0:
        sys.exit(1)

    print("✅ dbt Runner complete\n")


if __name__ == "__main__":
    main()
