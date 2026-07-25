"""Mock provider — the zero-config demo path.

Returns a rich, realistic Analysis with the same voice and specificity the real
providers are prompted for, rescaled onto the actual session duration so the
review timeline player still lines up with the recording.
"""
from __future__ import annotations

import copy
from typing import Any

# Written against a ~10 minute solve arc: brute force, aha, refactor, WA, fix, AC.
CANNED_ANALYSIS: dict[str, Any] = {
    "summary": (
        "You called the inner loop slow at 5:18 and kept typing it anyway until the run "
        "at 6:16 timed out. The binary search that replaced it was working 93 seconds "
        "later, and the second submit passed."
    ),
    "phases": [
        {
            "label": "reading",
            "startSec": 0,
            "endSec": 72,
            "note": "Read the statement top to bottom, sample first, constraints last.",
        },
        {
            "label": "thinking",
            "startSec": 72,
            "endSec": 168,
            "note": "Sketched the O(n^2) check out loud and convinced yourself it was 'probably fine'.",
        },
        {
            "label": "coding",
            "startSec": 168,
            "endSec": 376,
            "note": "Wrote the brute force in full, including edge cases you later threw away.",
        },
        {
            "label": "stuck",
            "startSec": 376,
            "endSec": 402,
            "note": "26s of silence after the first run timed out on the large sample.",
        },
        {
            "label": "coding",
            "startSec": 402,
            "endSec": 511,
            "note": "Rewrote around a binary search on the answer; the feasibility check came out clean.",
        },
        {
            "label": "debugging",
            "startSec": 511,
            "endSec": 583,
            "note": "One WA from an inclusive/exclusive bound, fixed on the second read of the loop.",
        },
    ],
    "markers": [
        {
            "kind": "wrong-turn",
            "atSec": 121,
            "quote": "n is like two hundred thousand, that's fine right",
            "note": "The constraint that killed the approach was read and dismissed here.",
        },
        {
            "kind": "hesitation",
            "atSec": 318,
            "quote": "this inner loop is going to be slow",
            "note": "You saw the problem mid-implementation and kept typing anyway.",
        },
        {
            "kind": "aha",
            "atSec": 376,
            "quote": "wait — if k works then k+1 works, I can binary search this",
            "note": "Monotonicity of the feasibility predicate lands, right after the TLE.",
        },
        {
            "kind": "wrong-turn",
            "atSec": 511,
            "quote": "",
            "note": "First submit failed on an off-by-one in the binary search bound (lo=mid vs lo=mid+1).",
        },
    ],
    "ahaMomentSec": 376,
    "firstCorrectCodeSec": 469,
    "ahaGapSeconds": 93,
    "bottleneck": (
        "You said \"n is like two hundred thousand, that's fine right\" at 2:01 and never "
        "turned that number into a target complexity, so the run at 6:16 is what told "
        "you the O(n^2) loop was wrong."
    ),
    "strengths": [
        "You ran the large sample at 6:16 instead of submitting on the small one.",
        "Once the predicate landed at 6:16 you had it coded in 93 seconds without rewriting the check.",
    ],
    "drills": [
        {
            "title": (
                "Constraint-to-complexity gate, 10 problems: write n and the target big-O "
                "as your first comment, before any code. Done when 10 in a row have the "
                "comment and no line contradicts it."
            ),
            "why": (
                "At 2:01 the 2e5 was a number you read out loud, not a budget you "
                "designed against."
            ),
        },
        {
            "title": (
                "Monotone-predicate warmup, 5 binary-search problems: write feasible(k) "
                "and one sentence on why it flips once, on paper, before opening the "
                "editor. Done when all 5 predicates are right before you type."
            ),
            "why": "Here the predicate only appeared at 6:16, after the timeout, not before the code.",
        },
        {
            "title": (
                "Bounds kata: write lo/hi binary search from scratch 5 times, no template, "
                "and state what lo means at exit. Done when all 5 pass their first run."
            ),
            "why": "The WA at 8:31 was an inclusive/exclusive bound, not a logic error.",
        },
    ],
    "editorialGap": {
        "missedInsight": (
            "The editorial proves monotonicity before writing anything: if k cows fit at "
            "distance d, they fit at any smaller d. You never made that argument. You "
            "found the same fact at 6:16 by watching a run time out."
        ),
        "fasterPath": (
            "At 5:18 the feasibility check was already written and correct. Asking there "
            "whether success at k implies success at k+1 would have skipped the whole "
            "brute-force loop around it."
        ),
        "profileAdvice": (
            "Binary search is your weakest tag at 35%, against 58% on graphs. Your last "
            "four sessions were all graph problems. Spend the next block on binary-search "
            "tags near your rating target instead."
        ),
    },
}


def _rescale(value: int, factor: float, cap: int) -> int:
    return max(0, min(cap, round(value * factor)))


def mock_analysis(duration_sec: int | None = None) -> dict[str, Any]:
    """Canned analysis, time-warped onto the real session length."""
    data = copy.deepcopy(CANNED_ANALYSIS)
    base = 583
    if not duration_sec or duration_sec <= 0 or abs(duration_sec - base) / base < 0.2:
        return data

    factor = duration_sec / base
    for phase in data["phases"]:
        phase["startSec"] = _rescale(phase["startSec"], factor, duration_sec)
        phase["endSec"] = _rescale(phase["endSec"], factor, duration_sec)
    data["phases"][-1]["endSec"] = duration_sec
    for marker in data["markers"]:
        marker["atSec"] = _rescale(marker["atSec"], factor, duration_sec)
    data["ahaMomentSec"] = _rescale(data["ahaMomentSec"], factor, duration_sec)
    data["firstCorrectCodeSec"] = _rescale(data["firstCorrectCodeSec"], factor, duration_sec)
    data["ahaGapSeconds"] = data["firstCorrectCodeSec"] - data["ahaMomentSec"]
    return data
