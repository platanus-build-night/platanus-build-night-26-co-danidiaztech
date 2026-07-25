"""/sessions route tests.

Covers:
  - PATCH /sessions/{id}: lets the solve page correct `sessions.language`
    after a mid-session language switch (bug: the session row was created
    once on mount and never updated).
  - POST /sessions: the pre-flight gate's contract — the full problem
    statement is only ever handed back from this call, and `record_voice`
    (the user's pre-flight recording choice) is persisted on the row.

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

from app.db import get_db  # noqa: E402
from app.models import Problem, SessionModel  # noqa: E402
from app.routers.sessions import router  # noqa: E402


class FakeSession:
    def __init__(self, id, problem_id, language, status="active", record_voice=False):
        self.id = id
        self.problem_id = problem_id
        self.language = language
        self.started_at = dt.datetime.now(dt.timezone.utc)
        self.ended_at = None
        self.status = status
        self.record_voice = record_voice


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
    """Dispatches `.get(Model, pk)` by model class so both the sessions
    router (SessionModel) and its Problem lookup work against one fake."""

    def __init__(self, sessions=(), problems=()):
        self._sessions = {row.id: row for row in sessions}
        self._problems = {row.id: row for row in problems}
        self.committed = False
        self.added = []

    def get(self, model, pk):
        if model is SessionModel:
            return self._sessions.get(pk)
        if model is Problem:
            return self._problems.get(pk)
        raise AssertionError(f"unexpected model {model}")

    def add(self, obj):
        obj.id = obj.id or (len(self._sessions) + 100)
        self._sessions[obj.id] = obj
        self.added.append(obj)

    def commit(self):
        self.committed = True

    def refresh(self, _obj):
        pass


@pytest.fixture
def client():
    row = FakeSession(id=22, problem_id=1, language="python")
    problem = FakeProblem(id=1)
    db = FakeDB(sessions=[row], problems=[problem])
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        c.fake_db = db
        yield c


def test_patch_session_updates_language(client):
    res = client.patch("/api/sessions/22", json={"language": "cpp"})
    assert res.status_code == 200
    body = res.json()
    assert body["language"] == "cpp"
    assert client.fake_db._sessions[22].language == "cpp"
    assert client.fake_db.committed is True


def test_patch_session_without_language_is_a_noop(client):
    res = client.patch("/api/sessions/22", json={})
    assert res.status_code == 200
    assert res.json()["language"] == "python"


def test_patch_session_404_for_unknown_session(client):
    res = client.patch("/api/sessions/999", json={"language": "cpp"})
    assert res.status_code == 404


def test_patch_session_rejects_unrelated_fields_silently(client):
    # Only `language` is a settable field on SessionPatch; extra keys are
    # ignored by pydantic rather than erroring (keeps the client resilient).
    res = client.patch("/api/sessions/22", json={"language": "cpp", "status": "finished"})
    assert res.status_code == 200
    assert res.json()["language"] == "cpp"
    assert res.json()["status"] == "active"


def test_create_session_returns_the_full_problem_statement(client):
    """This is the one gate in the pre-flight flow: POST /sessions is the
    only call that may hand back statement_md/samples/editorial_md."""
    res = client.post("/api/sessions", json={"problem_id": 1, "language": "python"})
    assert res.status_code == 200
    body = res.json()
    assert body["problem"]["statement_md"] == "SECRET: full statement text"
    assert body["problem"]["samples"][0]["output"] == "3"
    assert body["problem"]["editorial_md"] == "SECRET: editorial"


def test_create_session_persists_record_voice_choice(client):
    res = client.post(
        "/api/sessions", json={"problem_id": 1, "language": "python", "record_voice": True}
    )
    assert res.status_code == 200
    new_id = res.json()["id"]
    assert client.fake_db._sessions[new_id].record_voice is True


def test_create_session_defaults_record_voice_to_false(client):
    res = client.post("/api/sessions", json={"problem_id": 1, "language": "python"})
    assert res.status_code == 200
    new_id = res.json()["id"]
    assert client.fake_db._sessions[new_id].record_voice is False


def test_create_session_404_for_unknown_problem(client):
    res = client.post("/api/sessions", json={"problem_id": 999, "language": "python"})
    assert res.status_code == 404
