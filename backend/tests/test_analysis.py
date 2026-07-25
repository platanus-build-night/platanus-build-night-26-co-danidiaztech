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
from app.analysis.context import (  # noqa: E402
    build_context,
    code_evolution,
    compress_transcript,
    outcome_timeline,
)
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


# ------------------------------------------------- code-evolution forensics --

def _silent_events():
    """A transcript-less solve: build, discard, rebuild, fail, fix."""
    attempt = "def solve():\n    x = 1\n    y = 2\n    z = 3\n    print(x + y + z)\n"
    return [
        {"t_ms": 5_000, "kind": "code_snap", "payload": {"code": "def solve():\n"}},
        {"t_ms": 60_000, "kind": "code_snap", "payload": {"code": attempt}},
        {"t_ms": 70_000, "kind": "code_snap", "payload": {"code": "def solve():\n    pass\n"}},
        {"t_ms": 90_000, "kind": "code_snap", "payload": {"code": "def solve():\n    print(2)\n"}},
        {"t_ms": 95_000, "kind": "run", "payload": {"verdicts": ["WA", "AC"]}},
        {"t_ms": 120_000, "kind": "code_snap", "payload": {"code": "def solve():\n    print(3)\n"}},
        {"t_ms": 125_000, "kind": "submit", "payload": {"verdict": "AC", "submission_id": 7}},
        {"t_ms": 126_000, "kind": "submit", "payload": {"verdict": "AC"}},
    ]


def test_a_discarded_attempt_is_flagged_and_its_code_kept_in_a_diff():
    evo = code_evolution(_silent_events())
    discarded = [r for r in evo["rewrites"] if r["discarded"]]
    assert [(r["from_sec"], r["to_sec"]) for r in discarded] == [(60, 70)]
    assert evo["discard_count"] == 1
    # The abandoned lines must survive into a diff — they are the only evidence
    # of what was tried on a session with no transcript.
    assert any("-    print(x + y + z)" in d["diff"] for d in evo["key_diffs"])
    assert all("added" in d and "deleted" in d for d in evo["key_diffs"])


def test_outcome_timeline_reads_per_test_verdict_lists_and_collapses_double_submits():
    outcomes = outcome_timeline(_silent_events())
    assert outcomes[0] == {"sec": 95, "kind": "run", "verdict": "WA", "detail": "1/2 tests passed"}
    # Two AC submits a second apart are one click logged twice.
    assert [o["kind"] for o in outcomes] == ["run", "submit"]
    assert outcomes[1]["since_prev_sec"] == 30


def test_rhythm_measures_the_pacing_a_coach_would_check():
    ctx = build_context(None, _silent_events(), None, {}, {})
    rhythm = ctx["rhythm"]
    assert rhythm["first_keystroke_sec"] == 5
    assert rhythm["implementation_time_before_first_test_sec"] == 90
    # Quiet stretches ship as "planning time" next to the code they produced,
    # never as a standalone idle count the model can moralise about.
    assert rhythm["longest_quiet_span"] == {"from_sec": 5, "to_sec": 60, "seconds": 55}
    assert rhythm["first_failure_sec"] == 95
    assert rhythm["discard_count"] == 1 and rhythm["failed_attempts"] == 1
    assert ctx["session"]["has_transcript"] is False


def test_transcriptless_prompt_leans_on_code_and_never_apologises():
    text = build_user_prompt(build_context(None, _silent_events(), None, {}, {}))
    assert "do not apologise for the missing audio" in text
    assert "ABANDONED code" in text  # the discard is called out by name
    assert "1/2 tests passed" in text
    assert "RUN (samples)" in text and "SUBMIT (real attempt)" in text


def test_prompt_gives_every_key_timestamp_in_mm_ss_so_the_model_never_divides():
    text = build_user_prompt(build_context(None, _silent_events(), None, {}, {}))
    assert "95s (1:35)" in text  # run/submit timeline
    assert "5s (0:05)" in text  # rhythm + first snapshot


def test_features_render_compactly_and_drop_dead_signal():
    features = {
        "idle_gaps": [{"start_sec": 6, "end_sec": 146, "seconds": 140}],
        "typing_bursts": [
            {"start_sec": 4, "char_count": 0},  # a burst that changed nothing
            {"start_sec": 146, "char_count": 22},
        ],
        "churn_per_min": [{"minute": 0, "added": 0, "deleted": 0}, {"minute": 2, "added": 98, "deleted": 5}],
        "wpm": 0,
        "novel_extractor_signal": [1, 2],
    }
    ctx = build_context(None, _silent_events(), None, features, {})
    text = build_user_prompt(ctx)
    # Silent stretches must never reach the model labelled "idle"/"no activity":
    # that framing is what produced "you spent 140s idle with zero output".
    assert "unobserved spans" in text and "0:06-2:26 (140s)" in text
    assert "judge them only by the code that follows" in text
    assert "idle gaps (no events at all)" not in text
    assert "typing bursts (start:chars typed): 2:26:22c" in text
    assert "0:04" not in text and "min0" not in text  # zero-signal rows dropped
    assert "speaking rate" not in text  # no transcript, so wpm is noise
    assert "novel_extractor_signal" in text  # unknown extractor keys still reach the model


def test_profile_masteries_reach_the_model_as_whole_percents():
    profile = {
        "tags": {
            "dp": {"mastery": 0.1955, "attempts": 8, "solved": 2},
            "greedy": {"mastery": 0.9946, "attempts": 16, "solved": 11},
        },
        "est_rating": 1200,
        "recent_topics": ["dp", "greedy"],
    }
    text = build_user_prompt(build_context(None, [], None, {}, profile))
    assert "greedy 99% (16 att), dp 20% (8 att)" in text  # strongest first, no raw floats
    assert "0.1955" not in text and "0.9946" not in text
