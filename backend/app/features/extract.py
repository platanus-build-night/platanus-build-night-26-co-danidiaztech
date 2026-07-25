"""Deterministic feature extractor — owned by Agent E. Pure function:
events[] -> features dict. No DB, no AI — this is the "deterministic
feature extraction FIRST" step CONTRACTS.md requires before any Claude
call in the analysis pipeline (see app/analysis/analyze.py, Agent F).

Event kinds consumed (per CONTRACTS.md): code_snap{code}, transcript{text},
draw_snap{scene}, note_snap{text}, run{verdict...}, submit{submission_id}.
Every kind is optional in the input — a mic-off session (no `transcript`
events) or a code-only session (no `draw_snap`/`note_snap`) must still
produce a valid, stable-keyed dict with empty lists / None in the relevant
slots, never a KeyError.

Output keys (stable across calls, JSON-serializable):
  idle_gaps            [{start_sec, end_sec, duration_sec}]  gaps >20s between
                        any two consecutive events, in timeline order.
  typing_bursts         [{start_sec, end_sec, char_count}]   runs of code_snap
                        events with <5s between them; char_count is total
                        added+deleted chars across the burst.
  churn_per_min         [{minute, added, deleted}]            char-level
                        diff between consecutive code_snap payloads,
                        bucketed by t_ms // 60000.
  first_code_time_sec   float | None                          t of the first
                        code_snap with non-empty code.
  run_submit_timeline    [{t_sec, kind, verdict}]              run/submit
                        events in order.
  transcript_keywords    [{keyword, t_sec, quote}]             matches of a
                        fixed watch-list against transcript text.
  wpm                    float | None                          words/minute
                        across all transcript events.
  draw_note_windows      [{start_sec, end_sec, kinds}]          contiguous
                        (<20s gaps) windows of draw_snap/note_snap activity.
"""
from __future__ import annotations

from typing import Any, Optional

IDLE_GAP_THRESHOLD_MS = 20_000
BURST_GAP_MS = 5_000
DRAW_NOTE_GAP_MS = 20_000

# CONTRACTS.md names "wait", "actually", "what if", "binary search" as
# examples ("..."); rounded out with a few more phrases that mark the same
# reasoning moments (hesitation / insight / re-planning) for richer review
# highlighting.
TRANSCRIPT_KEYWORDS = [
    "wait",
    "actually",
    "what if",
    "binary search",
    "hmm",
    "oh wait",
    "let me think",
    "i think",
    "maybe",
    "hold on",
]


def _sec(t_ms: int) -> float:
    return round(t_ms / 1000.0, 2)


def _idle_gaps(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    gaps = []
    for prev, nxt in zip(events, events[1:]):
        gap = nxt.get("t_ms", 0) - prev.get("t_ms", 0)
        if gap > IDLE_GAP_THRESHOLD_MS:
            gaps.append(
                {
                    "start_sec": _sec(prev.get("t_ms", 0)),
                    "end_sec": _sec(nxt.get("t_ms", 0)),
                    "duration_sec": _sec(gap),
                }
            )
    return gaps


def _typing_bursts_and_churn(
    events: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    code_events = [e for e in events if e.get("kind") == "code_snap"]

    bursts: list[dict[str, Any]] = []
    churn_by_min: dict[int, dict[str, int]] = {}

    prev_code: Optional[str] = None
    prev_t: Optional[int] = None
    burst_start: Optional[int] = None
    burst_end: Optional[int] = None
    burst_chars = 0

    for e in code_events:
        t = e.get("t_ms", 0)
        code = (e.get("payload") or {}).get("code", "") or ""

        if prev_t is not None and (t - prev_t) > BURST_GAP_MS:
            bursts.append({"start_sec": _sec(burst_start), "end_sec": _sec(burst_end), "char_count": burst_chars})
            burst_start, burst_chars = None, 0

        if burst_start is None:
            burst_start = t
        burst_end = t

        if prev_code is not None:
            delta = len(code) - len(prev_code)
            added, deleted = max(0, delta), max(0, -delta)
            burst_chars += added + deleted
            bucket = churn_by_min.setdefault(t // 60_000, {"added": 0, "deleted": 0})
            bucket["added"] += added
            bucket["deleted"] += deleted

        prev_code, prev_t = code, t

    if burst_start is not None:
        bursts.append({"start_sec": _sec(burst_start), "end_sec": _sec(burst_end), "char_count": burst_chars})

    churn_per_min = [
        {"minute": minute, "added": v["added"], "deleted": v["deleted"]}
        for minute, v in sorted(churn_by_min.items())
    ]
    return bursts, churn_per_min


def _first_code_time(events: list[dict[str, Any]]) -> Optional[float]:
    for e in events:
        if e.get("kind") == "code_snap":
            code = (e.get("payload") or {}).get("code", "") or ""
            if code.strip():
                return _sec(e.get("t_ms", 0))
    return None


def _run_submit_timeline(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    timeline = []
    for e in events:
        kind = e.get("kind")
        if kind in ("run", "submit"):
            payload = e.get("payload") or {}
            timeline.append({"t_sec": _sec(e.get("t_ms", 0)), "kind": kind, "verdict": payload.get("verdict")})
    return timeline


def _transcript_keywords(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    hits = []
    for e in events:
        if e.get("kind") != "transcript":
            continue
        text = (e.get("payload") or {}).get("text") or ""
        lower = text.lower()
        for kw in TRANSCRIPT_KEYWORDS:
            if kw in lower:
                hits.append({"keyword": kw, "t_sec": _sec(e.get("t_ms", 0)), "quote": text.strip()})
    return hits


def _wpm(events: list[dict[str, Any]]) -> Optional[float]:
    transcript_events = [e for e in events if e.get("kind") == "transcript"]
    if not transcript_events:
        return None
    total_words = sum(len(((e.get("payload") or {}).get("text") or "").split()) for e in transcript_events)
    if total_words == 0:
        return None
    t_start = transcript_events[0].get("t_ms", 0)
    t_end = transcript_events[-1].get("t_ms", 0)
    duration_min = max((t_end - t_start) / 60_000.0, 1 / 60.0)  # floor at 1s to avoid /0
    return round(total_words / duration_min, 1)


def _draw_note_windows(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    dn_events = [e for e in events if e.get("kind") in ("draw_snap", "note_snap")]
    windows: list[dict[str, Any]] = []

    start: Optional[int] = None
    end: Optional[int] = None
    kinds_seen: set[str] = set()
    prev_t: Optional[int] = None

    for e in dn_events:
        t = e.get("t_ms", 0)
        if prev_t is not None and (t - prev_t) > DRAW_NOTE_GAP_MS:
            windows.append({"start_sec": _sec(start), "end_sec": _sec(end), "kinds": sorted(kinds_seen)})
            start, kinds_seen = None, set()
        if start is None:
            start = t
        end = t
        kinds_seen.add(e.get("kind"))
        prev_t = t

    if start is not None:
        windows.append({"start_sec": _sec(start), "end_sec": _sec(end), "kinds": sorted(kinds_seen)})
    return windows


def extract_features(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute deterministic features from a session's event log."""
    events = sorted(events, key=lambda e: e.get("t_ms", 0))
    typing_bursts, churn_per_min = _typing_bursts_and_churn(events)

    return {
        "idle_gaps": _idle_gaps(events),
        "typing_bursts": typing_bursts,
        "churn_per_min": churn_per_min,
        "first_code_time_sec": _first_code_time(events),
        "run_submit_timeline": _run_submit_timeline(events),
        "transcript_keywords": _transcript_keywords(events),
        "wpm": _wpm(events),
        "draw_note_windows": _draw_note_windows(events),
    }
