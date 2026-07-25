"""/settings route tests — masking, partial update, and the test endpoint.

Mounts the router on a bare app with a fake DB session so the suite needs
neither Postgres nor network.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.analysis import provider as prov  # noqa: E402
from app.db import get_db  # noqa: E402
from app.routers.settings import router  # noqa: E402

SECRET = "sk-ant-api03-SUPERSECRET1234"


class FakeRow:
    def __init__(self, data):
        self.id = 1
        self.data = data


class FakeDB:
    def __init__(self, data):
        self.row = FakeRow(dict(data))

    def get(self, _model, _pk):
        return self.row

    def add(self, obj):  # pragma: no cover - row always pre-exists here
        self.row = obj

    def commit(self):
        pass

    def refresh(self, _obj):
        pass


@pytest.fixture
def client():
    db = FakeDB({"provider": "api", "model": "claude-opus-4-8", "api_key": SECRET})
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        c.fake_db = db
        yield c


def test_get_settings_masks_credentials_to_last_four(client):
    body = client.get("/api/settings").json()
    assert body["api_key_masked"] == "••••1234"
    assert SECRET not in str(body)
    assert body["provider"] == "api"
    assert body["oauth_token_masked"] is None
    assert "Ready" in body["status"]


def test_put_settings_is_a_partial_update(client):
    body = client.put("/api/settings", json={"provider": "plan"}).json()
    assert body["provider"] == "plan"
    assert body["api_key_masked"] == "••••1234"  # untouched
    assert client.fake_db.row.data["api_key"] == SECRET
    assert "Falling back to mock" in body["status"]  # plan selected, no token

    client.put("/api/settings", json={"oauth_token": "sk-ant-oat01-TOKEN9876"})
    assert client.get("/api/settings").json()["oauth_token_masked"] == "••••9876"


def test_put_settings_rejects_an_unknown_provider(client):
    assert client.put("/api/settings", json={"provider": "gpt"}).status_code == 400


def test_settings_test_endpoint_reports_errors_clearly(client, monkeypatch):
    client.put("/api/settings", json={"provider": "api"})

    def boom(*_a, **_k):
        raise prov.ProviderError("Invalid API key — Anthropic rejected the credentials.")

    monkeypatch.setattr(prov, "_api_client", boom)
    body = client.post("/api/settings/test").json()
    assert body == {
        "ok": False,
        "provider": "api",
        "model": "claude-opus-4-8",
        "error": "Invalid API key — Anthropic rejected the credentials.",
    }


def test_settings_test_endpoint_is_ok_in_mock_mode(client):
    client.put("/api/settings", json={"provider": "mock"})
    assert client.post("/api/settings/test").json() == {
        "ok": True,
        "provider": "mock",
        "model": None,
        "error": None,
    }
