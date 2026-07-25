#!/usr/bin/env python3
"""
seed.py — idempotent upsert of backend/seed/data/problems.json into Postgres.

Deliberately dependency-light: raw SQL via psycopg (no SQLAlchemy, no
`app.*` imports) so this never breaks if backend/app/models.py changes
shape mid-build. Matches the `problems` / `testcases` schema in
CONTRACTS.md exactly:

  problems(id pk, external_id unique, source, title, statement_md, tags
           jsonb, rating, time_limit_ms, memory_limit_mb, editorial_md,
           samples jsonb)
  testcases(id pk, problem_id fk, input, expected, is_sample)

Idempotent: re-running upserts problems by `external_id` (update in
place) and fully replaces that problem's testcases (delete + reinsert),
so `make seed` is safe to run repeatedly during development.

Usage:
    backend/seed/.venv/bin/python backend/seed/seed.py
    DATABASE_URL=postgresql://... backend/seed/.venv/bin/python backend/seed/seed.py

Env:
    DATABASE_URL (default: postgresql://trainer:trainer@localhost:5433/trainer)
                 -- the +psycopg SQLAlchemy dialect suffix is stripped if present.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROBLEMS_PATH = HERE / "data" / "problems.json"

DEFAULT_DATABASE_URL = "postgresql://trainer:trainer@localhost:5433/trainer"


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    # Accept SQLAlchemy-style "postgresql+psycopg://..." too; psycopg wants
    # the plain "postgresql://" scheme.
    return url.replace("postgresql+psycopg://", "postgresql://")


UPSERT_PROBLEM_SQL = """
INSERT INTO problems
    (external_id, source, title, statement_md, tags, rating,
     time_limit_ms, memory_limit_mb, editorial_md, samples)
VALUES
    (%(external_id)s, %(source)s, %(title)s, %(statement_md)s, %(tags)s, %(rating)s,
     %(time_limit_ms)s, %(memory_limit_mb)s, %(editorial_md)s, %(samples)s)
ON CONFLICT (external_id) DO UPDATE SET
    source = EXCLUDED.source,
    title = EXCLUDED.title,
    statement_md = EXCLUDED.statement_md,
    tags = EXCLUDED.tags,
    rating = EXCLUDED.rating,
    time_limit_ms = EXCLUDED.time_limit_ms,
    memory_limit_mb = EXCLUDED.memory_limit_mb,
    editorial_md = EXCLUDED.editorial_md,
    samples = EXCLUDED.samples
RETURNING id;
"""

DELETE_TESTCASES_SQL = "DELETE FROM testcases WHERE problem_id = %(problem_id)s;"

INSERT_TESTCASE_SQL = """
INSERT INTO testcases (problem_id, input, expected, is_sample)
VALUES (%(problem_id)s, %(input)s, %(expected)s, %(is_sample)s);
"""


def main():
    import psycopg
    from psycopg.types.json import Json

    problems = json.loads(PROBLEMS_PATH.read_text())
    if not problems:
        raise SystemExit(f"no problems found in {PROBLEMS_PATH} -- run the pipeline first")

    database_url = get_database_url()
    print(f"connecting to {database_url.split('@')[-1]}")

    upserted = 0
    testcases_written = 0
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for p in problems:
                cur.execute(UPSERT_PROBLEM_SQL, {
                    "external_id": p["external_id"],
                    "source": p["source"],
                    "title": p["title"],
                    "statement_md": p["statement_md"],
                    "tags": Json(p["tags"]),
                    "rating": p["rating"],
                    "time_limit_ms": p["time_limit_ms"],
                    "memory_limit_mb": p["memory_limit_mb"],
                    "editorial_md": p["editorial_md"],
                    "samples": Json(p["samples"]),
                })
                problem_id = cur.fetchone()[0]
                upserted += 1

                cur.execute(DELETE_TESTCASES_SQL, {"problem_id": problem_id})
                for t in p["tests"]:
                    cur.execute(INSERT_TESTCASE_SQL, {
                        "problem_id": problem_id,
                        "input": t["input"],
                        "expected": t["expected"],
                        "is_sample": t["is_sample"],
                    })
                    testcases_written += 1
        conn.commit()

    print(f"upserted {upserted} problems, {testcases_written} testcases")


if __name__ == "__main__":
    main()
