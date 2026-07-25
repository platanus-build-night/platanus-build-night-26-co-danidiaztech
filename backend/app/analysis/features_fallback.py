"""Minimal deterministic features, used only to fill gaps.

app.features owns the real extractor (Agent E). This computes the handful of
signals the analysis prompt leans on hardest, so an analysis is never sent to
Claude ungrounded if the extractor is unavailable or returns a partial dict.
"""
from __future__ import annotations

from typing import Any

IDLE_GAP_SEC = 20
KEYWORDS = (
    "wait",
    "actually",
    "what if",
    "oh",
    "hmm",
    "binary search",
    "dp",
    "greedy",
    "sort",
    "two pointer",
    "prefix sum",
    "graph",
    "stuck",
    "why",
)


def fallback_features(events: list[dict[str, Any]]) -> dict[str, Any]:
    events = sorted(events, key=lambda e: e.get("t_ms", 0))
    secs = [round(e.get("t_ms", 0) / 1000) for e in events]

    idle_gaps = []
    for (a, ea), (b, _eb) in zip(zip(secs, events), zip(secs[1:], events[1:])):
        if b - a > IDLE_GAP_SEC:
            idle_gaps.append({"start_sec": a, "end_sec": b, "seconds": b - a, "after": ea.get("kind")})

    code_secs = [s for s, e in zip(secs, events) if e.get("kind") == "code_snap"]
    transcripts = [
        {"sec": s, "text": ((e.get("payload") or {}).get("text") or "")}
        for s, e in zip(secs, events)
        if e.get("kind") == "transcript"
    ]

    keywords = []
    for seg in transcripts:
        low = seg["text"].lower()
        for kw in KEYWORDS:
            if kw in low:
                keywords.append({"sec": seg["sec"], "keyword": kw})

    words = sum(len(seg["text"].split()) for seg in transcripts)
    span_min = (max(secs) - min(secs)) / 60 if len(secs) > 1 else 0
    wpm = round(words / span_min) if span_min > 0.5 else None

    return {
        "idle_gaps": idle_gaps,
        "idle_gap_count": len(idle_gaps),
        "first_code_time_sec": code_secs[0] if code_secs else None,
        "code_snapshot_count": len(code_secs),
        "run_submit_timeline": [
            {
                "sec": s,
                "kind": e.get("kind"),
                "verdict": (e.get("payload") or {}).get("verdict"),
            }
            for s, e in zip(secs, events)
            if e.get("kind") in ("run", "submit")
        ],
        "transcript_keywords": keywords,
        "transcript_segment_count": len(transcripts),
        "wpm": wpm,
        "draw_note_windows": [
            {"sec": s, "kind": e.get("kind")}
            for s, e in zip(secs, events)
            if e.get("kind") in ("draw_snap", "note_snap")
        ],
    }


def merge_features(primary: dict[str, Any] | None, fallback: dict[str, Any]) -> dict[str, Any]:
    """Extractor output wins; empty/missing keys are filled from the fallback."""
    merged = dict(fallback)
    for key, value in (primary or {}).items():
        if value is None or value == [] or value == {}:
            continue
        merged[key] = value

    # Derived counts must agree with whichever list actually survived.
    for count_key, list_key in (
        ("idle_gap_count", "idle_gaps"),
        ("code_snapshot_count", "code_snapshots"),
        ("transcript_segment_count", "transcript_segments"),
    ):
        if isinstance(merged.get(list_key), list):
            merged[count_key] = len(merged[list_key])
    return merged
