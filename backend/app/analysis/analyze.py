"""Claude-backed session analysis — STUB, owned by Agent F.

Agent F implements: deterministic feature extraction first (via
app.features.extract_features), then <=2 Claude calls (analysis + editorial
gap; merge into one if clean) using ANTHROPIC_API_KEY / ANTHROPIC_MODEL from
env. Context passed to Claude = features + compressed transcript + editorial
+ rolling profile (never the raw full event history). If ANTHROPIC_API_KEY is
unset, mock mode returns a realistic canned Analysis (this stub's behavior).

Current behavior: always returns CANNED_ANALYSIS, matching the Analysis JSON
shape in CONTRACTS.md exactly, so /sessions/{id}/analyze works end-to-end
without an API key.
"""
from __future__ import annotations

from typing import Any

CANNED_ANALYSIS: dict[str, Any] = {
    "summary": "Solved via brute force after an early misread of the constraints; recovered once the O(n log n) approach clicked.",
    "phases": [
        {"label": "reading", "startSec": 0, "endSec": 60, "note": "Reading statement and samples."},
        {"label": "thinking", "startSec": 60, "endSec": 180, "note": "Explored brute force, then a binary-search idea."},
        {"label": "coding", "startSec": 180, "endSec": 420, "note": "Implemented the main solution."},
        {"label": "debugging", "startSec": 420, "endSec": 485, "note": "Fixed an off-by-one on the boundary case."},
    ],
    "markers": [
        {"kind": "wrong-turn", "atSec": 95, "quote": "", "note": "Briefly pursued an O(n^2) approach."},
        {"kind": "hesitation", "atSec": 140, "quote": "wait, is this sorted already?", "note": "Missed a stated invariant."},
        {"kind": "aha", "atSec": 392, "quote": "oh, binary search on the answer", "note": "Key insight landed here."},
    ],
    "ahaMomentSec": 392,
    "firstCorrectCodeSec": 485,
    "ahaGapSeconds": 93,
    "bottleneck": "Slow to recognize monotonicity that enables binary-search-on-answer; defaults to brute force first.",
    "strengths": [
        "Clean implementation once the approach is fixed",
        "Uses samples to sanity-check edge cases before submitting",
    ],
    "drills": [
        {"title": "Binary search on the answer (5 problems)", "why": "Directly targets the observed bottleneck."},
        {"title": "Monotonic predicate spotting drills", "why": "Speeds up recognizing when binary search applies."},
    ],
    "editorialGap": {
        "missedInsight": "The editorial jumps straight to binary search on the answer using a monotonic feasibility check.",
        "fasterPath": "Spot monotonicity in the feasibility check before attempting brute force.",
        "profileAdvice": "Prioritize binary-search and greedy-feasibility tagged problems near current rating.",
    },
}


def analyze_session(
    session: Any,
    events: list[dict[str, Any]],
    problem: Any,
    features: dict[str, Any],
    profile_data: dict[str, Any],
) -> dict[str, Any]:
    """Produce an Analysis JSON for a finished session. STUB: canned result."""
    return CANNED_ANALYSIS
