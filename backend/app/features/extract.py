"""Deterministic feature extractor — STUB, owned by Agent E.

Agent E implements the extraction spec from CONTRACTS.md: typing bursts, idle
gaps >20s (count + where), churn (chars added/deleted per min), first-code
time, run/submit outcome timeline, transcript keyword timestamps ("wait",
"actually", "what if", "binary search", ...), WPM, draw/notes activity
windows — all derived from a session's `events` rows.

Current behavior: returns an empty-but-correctly-shaped features dict so
app/analysis can be wired up without a real implementation yet.
"""
from __future__ import annotations

from typing import Any


def extract_features(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute deterministic features from a session's event log. STUB."""
    return {
        "idle_gaps": [],
        "typing_bursts": [],
        "churn_per_min": [],
        "first_code_time_sec": None,
        "run_submit_timeline": [],
        "transcript_keywords": [],
        "wpm": None,
        "draw_note_windows": [],
    }
