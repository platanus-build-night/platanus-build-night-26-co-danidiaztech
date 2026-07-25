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
        "You spent the first four minutes building the brute force you already knew "
        "wouldn't fit the limits, then found the monotonicity at 6:16 and had it "
        "working 93 seconds later. The insight was fast; committing to it was slow."
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
        "You read the constraints but don't convert them into a target complexity before "
        "coding — n<=2e5 was on screen at 0:38 and you still committed 200 seconds to an "
        "O(n^2) implementation that the first run killed."
    ),
    "strengths": [
        "Once the right idea arrives you implement it fast and cleanly — 93 seconds from insight to working code.",
        "You narrate your reasoning out loud, which is why the wrong turn was recoverable instead of silent.",
        "You ran on the large sample before submitting rather than submitting hopefully.",
    ],
    "drills": [
        {
            "title": "Constraint-first, 10 problems: write the target complexity before reading the statement body.",
            "why": "Forces the 0:38 constraint line to become a decision instead of a fact you noted and ignored.",
        },
        {
            "title": "Binary-search-on-answer set, 5 problems: state the monotone predicate in one line before coding.",
            "why": "You found the predicate here only after a TLE; the drill moves it to the front of the solve.",
        },
        {
            "title": "Bounds katas: implement lo/hi binary search 5 times from scratch, no template.",
            "why": "The single WA was an inclusive/exclusive bound — cheap to eliminate permanently.",
        },
    ],
    "editorialGap": {
        "missedInsight": (
            "The editorial starts from the observation you reached at 6:16: the feasibility "
            "check is monotone in the answer, so the whole problem is a binary search over it. "
            "You reached the same place, four minutes later and via a timeout."
        ),
        "fasterPath": (
            "At 2:01 you'd already said the check was 'slow'. Testing that check for monotonicity "
            "right there — does success at k imply success at k+1? — would have skipped the entire "
            "brute-force implementation."
        ),
        "profileAdvice": (
            "Your binary-search mastery is the weakest tag in your profile at 35% against 58% on "
            "graphs, and this session is why. Spend the next block on binary-search-tagged problems "
            "near your rating target rather than the graph problems you already convert."
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
