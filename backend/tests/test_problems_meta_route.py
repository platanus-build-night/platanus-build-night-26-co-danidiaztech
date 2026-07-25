"""GET /problems/{id}/meta — the pre-flight-safe subset of a problem.

Must NOT leak statement_md, samples, editorial_md, or tags (tags are a
technique spoiler in competitive programming) before a session exists.

Mounts the router on a bare app with a fake DB session, matching the style
of test_settings_routes.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_db  # noqa: E402
from app.routers.problems import router  # noqa: E402


class FakeProblem:
    def __init__(self, id):
        self.id = id
        self.external_id = f"ext-{id}"
        self.source = "test"
        self.title = "Aggressive Cows"
        self.statement_md = "SECRET: full statement text"
        self.tags = ["binary-search"]
        self.rating = 1500
        self.time_limit_ms = 2000
        self.memory_limit_mb = 256
        self.editorial_md = "SECRET: editorial"
        self.samples = [{"input": "5 3\n1 2 8 4 9", "output": "3"}]


class FakeDB:
    def __init__(self, rows):
        self._rows = {row.id: row for row in rows}

    def get(self, _model, pk):
        return self._rows.get(pk)


@pytest.fixture
def client():
    db = FakeDB([FakeProblem(id=1)])
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_meta_exposes_only_safe_fields(client):
    res = client.get("/api/problems/1/meta")
    assert res.status_code == 200
    body = res.json()
    assert body == {
        "id": 1,
        "title": "Aggressive Cows",
        "rating": 1500,
        "time_limit_ms": 2000,
        "memory_limit_mb": 256,
    }


def test_meta_never_contains_spoiler_fields(client):
    body = client.get("/api/problems/1/meta").json()
    text = str(body)
    assert "SECRET" not in text
    assert "binary-search" not in text
    for forbidden in ("statement_md", "samples", "editorial_md", "tags"):
        assert forbidden not in body


def test_meta_404_for_unknown_problem(client):
    res = client.get("/api/problems/999/meta")
    assert res.status_code == 404
