"""Unit tests for the deterministic feature extractor
(app.features.extract.extract_features) against a synthetic, hand-timed
event stream. Pure function, no DB.
"""
from __future__ import annotations

from app.features.extract import extract_features


def _events():
    # t_ms, kind, payload — designed so every feature has at least one
    # exercised, hand-computable case (idle gaps, a two-part typing burst
    # split by a >20s gap, churn, keyword hits, wpm, and a draw/note
    # window split).
    return [
        {"t_ms": 0, "kind": "code_snap", "payload": {"code": ""}},
        {"t_ms": 2000, "kind": "code_snap", "payload": {"code": "a"}},
        {"t_ms": 4000, "kind": "code_snap", "payload": {"code": "abc"}},
        {"t_ms": 35000, "kind": "transcript", "payload": {"text": "Wait, actually let me think binary search"}},
        {"t_ms": 36000, "kind": "code_snap", "payload": {"code": "ab"}},
        {"t_ms": 40000, "kind": "run", "payload": {"verdict": "WA"}},
        {"t_ms": 41000, "kind": "code_snap", "payload": {"code": "abcz"}},
        {"t_ms": 70000, "kind": "submit", "payload": {"verdict": "AC"}},
        {"t_ms": 71000, "kind": "draw_snap", "payload": {"scene": {}}},
        {"t_ms": 72500, "kind": "note_snap", "payload": {"text": "remember edge cases"}},
        {"t_ms": 95000, "kind": "draw_snap", "payload": {"scene": {}}},
    ]


def test_idle_gaps_flagged_over_20s_between_any_consecutive_events():
    features = extract_features(_events())
    gaps = features["idle_gaps"]
    assert [(g["start_sec"], g["end_sec"]) for g in gaps] == [
        (4.0, 35.0),
        (41.0, 70.0),
        (72.5, 95.0),
    ]
    assert gaps[0]["duration_sec"] == 31.0
    assert gaps[1]["duration_sec"] == 29.0
    assert gaps[2]["duration_sec"] == 22.5


def test_typing_bursts_split_on_gaps_over_5s_and_track_char_churn():
    features = extract_features(_events())
    bursts = features["typing_bursts"]
    # burst 1: t=0,2000,4000 (each <=5s apart); burst 2 starts fresh after
    # the 32s gap to t=36000, continues through t=41000 (exactly 5s, not >5s).
    assert bursts == [
        {"start_sec": 0.0, "end_sec": 4.0, "char_count": 3},
        {"start_sec": 36.0, "end_sec": 41.0, "char_count": 3},
    ]


def test_churn_per_min_diffs_consecutive_code_snap_lengths():
    features = extract_features(_events())
    # "" -> "a" (+1) -> "abc" (+2) -> "ab" (-1 => 1 deleted) -> "abcz" (+2);
    # every one of those diffs lands in minute 0 (all t < 60_000ms).
    assert features["churn_per_min"] == [{"minute": 0, "added": 5, "deleted": 1}]


def test_first_code_time_skips_the_initial_empty_snapshot():
    features = extract_features(_events())
    assert features["first_code_time_sec"] == 2.0


def test_run_submit_timeline_in_order():
    features = extract_features(_events())
    assert features["run_submit_timeline"] == [
        {"t_sec": 40.0, "kind": "run", "verdict": "WA"},
        {"t_sec": 70.0, "kind": "submit", "verdict": "AC"},
    ]


def test_transcript_keywords_matches_watchlist():
    features = extract_features(_events())
    keywords = {h["keyword"] for h in features["transcript_keywords"]}
    assert keywords == {"wait", "actually", "binary search", "let me think"}
    assert all(h["t_sec"] == 35.0 for h in features["transcript_keywords"])


def test_wpm_uses_word_count_over_transcript_span():
    features = extract_features(_events())
    # single transcript event -> duration floors to 1s (1/60 min); 7 words
    # over that floor => 420 wpm. Exercises the divide-by-zero guard.
    assert features["wpm"] == 420.0


def test_draw_note_windows_split_on_gaps_over_20s():
    features = extract_features(_events())
    windows = features["draw_note_windows"]
    assert windows == [
        {"start_sec": 71.0, "end_sec": 72.5, "kinds": ["draw_snap", "note_snap"]},
        {"start_sec": 95.0, "end_sec": 95.0, "kinds": ["draw_snap"]},
    ]


def test_robust_to_missing_kinds_mic_off_and_no_drawing():
    events = [
        {"t_ms": 0, "kind": "code_snap", "payload": {"code": "print(1)"}},
        {"t_ms": 5000, "kind": "run", "payload": {"verdict": "AC"}},
    ]
    features = extract_features(events)
    assert features["transcript_keywords"] == []
    assert features["wpm"] is None
    assert features["draw_note_windows"] == []
    assert features["idle_gaps"] == []
    assert features["first_code_time_sec"] == 0.0


def test_empty_event_list_returns_stable_shape():
    features = extract_features([])
    assert features == {
        "idle_gaps": [],
        "typing_bursts": [],
        "churn_per_min": [],
        "first_code_time_sec": None,
        "run_submit_timeline": [],
        "transcript_keywords": [],
        "wpm": None,
        "draw_note_windows": [],
    }
