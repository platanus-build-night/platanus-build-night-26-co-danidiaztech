"""GET /sessions/{id}/analysis — rehydration route tests.

Mounts the router on a bare app with a fake DB session so the suite needs
neither Postgres nor network, matching the style of test_settings_routes.py.
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.analysis.mock import mock_analysis  # noqa: E402
from app.db import get_db  # noqa: E402
from app.routers.analysis import router  # noqa: E402


class FakeAnalysisRow:
    def __init__(self, result, created_at):
        self.result = result
        self.created_at = created_at


class FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *_a, **_k):
        return self

    def one_or_none(self):
        return self._result


class FakeDB:
    """Just enough of a Session for the rehydration endpoint's
    `db.query(Analysis).filter(...).one_or_none()` chain."""

    def __init__(self, row=None):
        self._row = row

    def query(self, _model):
        return FakeQuery(self._row)


def _client(row):
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: FakeDB(row)
    return TestClient(app)


def test_returns_404_when_no_analysis_persisted():
    client = _client(None)
    res = client.get("/api/sessions/42/analysis")
    assert res.status_code == 404


def test_returns_persisted_result_and_created_at():
    created_at = dt.datetime(2026, 7, 24, 12, 0, 0, tzinfo=dt.timezone.utc)
    row = FakeAnalysisRow(result=mock_analysis(583), created_at=created_at)
    client = _client(row)

    res = client.get("/api/sessions/1/analysis")
    assert res.status_code == 200
    body = res.json()
    assert body["result"]["bottleneck"] == mock_analysis(583)["bottleneck"]
    assert body["created_at"].startswith("2026-07-24T12:00:00")
