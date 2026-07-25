"""Analysis pipeline tests: validator round-trip, provider fallback, masking.

No network and no DB engine required — the settings row is faked with a tiny
in-memory stand-in so the provider logic can be exercised directly.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.analysis import provider as prov  # noqa: E402
from app.analysis.context import build_context, code_evolution, compress_transcript  # noqa: E402
from app.analysis.mock import mock_analysis  # noqa: E402
from app.analysis.prompts import build_system_prompt, build_user_prompt  # noqa: E402
from app.analysis.validator import (  # noqa: E402
    AnalysisFormatError,
    analysis_json_schema,
    validate_analysis,
)


# ------------------------------------------------------------- validator ----

def test_validator_round_trips_the_mock_analysis():
    data = mock_analysis(583)
    assert validate_analysis(data) == validate_analysis(json.dumps(data))


def test_validator_accepts_a_fenced_json_reply():
    raw = "Here you go:\n```json\n" + json.dumps(mock_analysis()) + "\n```\n"
    assert validate_analysis(raw)["bottleneck"]


def test_validator_nulls_aha_gap_when_either_end_is_missing():
    data = mock_analysis()
    data["ahaMomentSec"] = None
    assert validate_analysis(data)["ahaGapSeconds"] is None


def test_validator_recomputes_a_wrong_aha_gap():
    data = mock_analysis()
    data["ahaMomentSec"], data["firstCorrectCodeSec"] = 100, 250
    data["ahaGapSeconds"] = 9999
    assert validate_analysis(data)["ahaGapSeconds"] == 150


def test_validator_rejects_non_json_and_bad_shapes():
    with pytest.raises(AnalysisFormatError):
        validate_analysis("I could not analyse this session.")
    with pytest.raises(AnalysisFormatError):
        validate_analysis({"summary": "x"})  # missing required fields


def test_json_schema_is_strict_and_keeps_property_names():
    schema = analysis_json_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == set(schema["properties"])
    # "title" is a Drill field name, not a schema annotation.
    assert set(schema["$defs"]["Drill"]["properties"]) == {"title", "why"}


# -------------------------------------------------------------- provider ----

class FakeSettings:
    def __init__(self, data):
        self.data = data


class FakeDB:
    """Just enough of a Session for load_config()."""

    def __init__(self, data):
        self.row = FakeSettings(data)

    def get(self, _model, _pk):
        return self.row


def _ctx():
    return {"session": {"duration_sec": 583}}


def test_unconfigured_api_provider_falls_back_to_mock():
    cfg = prov.ProviderConfig(provider="api", model="m", api_key=None, oauth_token=None)
    assert prov.resolve(cfg) == ("mock", "no API key set — using mock analysis")
    result, label = prov.generate_analysis(cfg, _ctx())
    assert label == {
        "requested": "api",
        "provider": "mock",
        "model": None,
        "fallback_reason": "no API key set — using mock analysis",
    }
    assert validate_analysis(result)["bottleneck"]


def test_unconfigured_plan_provider_falls_back_to_mock():
    cfg = prov.ProviderConfig(provider="plan", model="m", api_key=None, oauth_token=None)
    assert prov.resolve(cfg)[0] == "mock"
    _result, label = prov.generate_analysis(cfg, _ctx())
    assert label["provider"] == "mock" and label["requested"] == "plan"


def test_provider_failure_degrades_to_mock_with_a_reason(monkeypatch):
    cfg = prov.ProviderConfig(provider="api", model="m", api_key="sk-test", oauth_token=None)

    def boom(*_args, **_kwargs):
        raise prov.ProviderError("Invalid API key — Anthropic rejected the credentials.")

    monkeypatch.setattr(prov, "_call_api", boom)
    result, label = prov.generate_analysis(cfg, _ctx())
    assert label["provider"] == "mock"
    assert "Invalid API key" in label["fallback_reason"]
    assert validate_analysis(result)


def test_configured_providers_resolve_to_themselves():
    api = prov.ProviderConfig(provider="api", model="m", api_key="sk-x", oauth_token=None)
    plan = prov.ProviderConfig(provider="plan", model="m", api_key=None, oauth_token="oat-x")
    assert prov.resolve(api) == ("api", None)
    assert prov.resolve(plan) == ("plan", None)


def test_both_real_paths_send_the_identical_prompt(monkeypatch):
    """Parity: api and plan must build byte-identical system + user text."""
    seen: dict[str, tuple[str, str]] = {}

    monkeypatch.setattr(
        prov, "_call_api", lambda cfg, s, u: seen.__setitem__("api", (s, u)) or mock_analysis()
    )
    monkeypatch.setattr(
        prov, "_call_plan", lambda cfg, s, u: seen.__setitem__("plan", (s, u)) or mock_analysis()
    )

    ctx = build_context(None, [], None, {}, {})
    prov.generate_analysis(
        prov.ProviderConfig("api", "m", "sk-x", None), ctx
    )
    prov.generate_analysis(
        prov.ProviderConfig("plan", "m", None, "oat-x"), ctx
    )
    assert seen["api"] == seen["plan"]
    assert seen["api"] == (build_system_prompt(), build_user_prompt(ctx))


def test_load_config_defaults_to_mock_on_a_bogus_provider():
    cfg = prov.load_config(FakeDB({"provider": "gpt", "model": None}))
    assert cfg.provider == "mock" and cfg.model == prov.DEFAULT_MODEL


# --------------------------------------------------------------- masking ----

def test_mask_shows_only_the_last_four_characters():
    assert prov.mask("sk-ant-api03-SUPERSECRET1234") == "••••1234"
    assert prov.mask("abc") == "••••"
    assert prov.mask(None) is None
    assert prov.mask("") is None


def test_status_text_reports_the_mock_fallback():
    cfg = prov.ProviderConfig("api", "claude-opus-4-8", None, None)
    assert "Falling back to mock" in prov.status_text(cfg)
    assert "Ready" in prov.status_text(prov.ProviderConfig("api", "m", "sk-x", None))


# --------------------------------------------------------------- context ----

def _events():
    return [
        {"t_ms": 1000, "kind": "transcript", "payload": {"text": "short one"}},
        {"t_ms": 5000, "kind": "transcript", "payload": {"text": "x" * 900}},
        {"t_ms": 9000, "kind": "code_snap", "payload": {"code": "a = 1\n"}},
        {"t_ms": 20000, "kind": "code_snap", "payload": {"code": "a = 1\nb = 2\n"}},
        {"t_ms": 30000, "kind": "run", "payload": {"verdict": "WA"}},
    ]


def test_transcript_compression_keeps_short_utterances_and_cuts_long_middles():
    segs = compress_transcript(_events())
    assert segs[0] == {"sec": 1, "text": "short one"}
    assert "[middle cut]" in segs[1]["text"]
    assert len(segs[1]["text"]) < 900


def test_code_evolution_reports_sizes_and_diffs():
    evo = code_evolution(_events())
    assert [s["sec"] for s in evo["snapshots"]] == [9, 20]
    assert evo["key_diffs"] and "+b = 2" in evo["key_diffs"][0]["diff"]
    assert evo["churn_per_min"][0]["added"] > 0


def test_prompt_survives_an_empty_session():
    ctx = build_context(None, [], None, {}, {})
    text = build_user_prompt(ctx)
    assert "no transcript" in text and "no code snapshots" in text
