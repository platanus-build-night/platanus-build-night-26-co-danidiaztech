"""Context assembly for the analysis prompt — deterministic, no AI.

Turns a raw session (events + problem + features + profile) into a compact,
information-dense context bundle. The raw event log is never sent to Claude:
transcripts are compressed, code snapshots are reduced to size/churn stats
plus a handful of key diffs, and long text is truncated with explicit markers.
"""
from __future__ import annotations

import difflib
import json
from typing import Any

# Budgets (characters) — keep one analysis call comfortably inside a few
# thousand input tokens so the prompt stays cheap and focused.
STATEMENT_CHARS = 1500
EDITORIAL_CHARS = 2500
TRANSCRIPT_CHARS = 6000
SHORT_UTTERANCE_CHARS = 200
DIFF_LINES = 40
MAX_DIFFS = 5


def _truncate(text: str | None, limit: int) -> str:
    if not text:
        return ""
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + f"\n… [truncated, {len(text) - limit} chars omitted]"


def _squeeze_utterance(text: str, limit: int) -> str:
    """Keep short utterances verbatim; cut the middle out of long ones."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    head = int(limit * 0.6)
    tail = limit - head
    return f"{text[:head]} … [middle cut] … {text[-tail:]}"


def compress_transcript(
    events: list[dict[str, Any]],
    char_budget: int = TRANSCRIPT_CHARS,
) -> list[dict[str, Any]]:
    """Timestamped transcript segments, compressed to fit a char budget.

    Every short utterance survives verbatim (they carry the aha/hesitation
    signal); long ones lose their middle first, and only if the budget is
    still blown do we thin out the longest remaining segments.
    """
    segs: list[dict[str, Any]] = []
    for e in events:
        if e.get("kind") != "transcript":
            continue
        text = (e.get("payload") or {}).get("text") or ""
        text = " ".join(text.split())
        if not text:
            continue
        segs.append({"sec": round(e.get("t_ms", 0) / 1000), "text": text})

    if not segs:
        return []

    limit = SHORT_UTTERANCE_CHARS
    out = [{"sec": s["sec"], "text": _squeeze_utterance(s["text"], limit)} for s in segs]
    while sum(len(s["text"]) for s in out) > char_budget and limit > 60:
        limit = int(limit * 0.7)
        out = [{"sec": s["sec"], "text": _squeeze_utterance(s["text"], limit)} for s in segs]
    return out


def _code_snapshots(events: list[dict[str, Any]]) -> list[tuple[int, str]]:
    snaps: list[tuple[int, str]] = []
    for e in events:
        if e.get("kind") != "code_snap":
            continue
        code = (e.get("payload") or {}).get("code")
        if code is None:
            continue
        sec = round(e.get("t_ms", 0) / 1000)
        if snaps and snaps[-1][1] == code:
            continue  # drop no-op snapshots
        snaps.append((sec, code))
    return snaps


def _line_delta(a: str, b: str) -> tuple[int, int]:
    """(chars added, chars deleted) between two code snapshots, line-wise."""
    al, bl = a.splitlines(), b.splitlines()
    added = deleted = 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, al, bl).get_opcodes():
        if tag in ("replace", "delete"):
            deleted += sum(len(x) + 1 for x in al[i1:i2])
        if tag in ("replace", "insert"):
            added += sum(len(x) + 1 for x in bl[j1:j2])
    return added, deleted


def _unified(a: str, b: str, a_sec: int, b_sec: int) -> str:
    diff = difflib.unified_diff(
        a.splitlines(),
        b.splitlines(),
        fromfile=f"t={a_sec}s",
        tofile=f"t={b_sec}s",
        lineterm="",
        n=1,
    )
    lines = list(diff)
    if len(lines) > DIFF_LINES:
        lines = lines[:DIFF_LINES] + [f"… [{len(lines) - DIFF_LINES} more diff lines]"]
    return "\n".join(lines)


def code_evolution(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Compact picture of how the code grew: sizes, per-minute churn, key diffs."""
    snaps = _code_snapshots(events)
    if not snaps:
        return {"snapshots": [], "churn_per_min": [], "key_diffs": [], "note": "no code snapshots"}

    sizes = [
        {"sec": sec, "chars": len(code), "lines": len(code.splitlines())} for sec, code in snaps
    ]

    churn: dict[int, dict[str, int]] = {}
    deltas: list[tuple[int, int, int]] = []  # (magnitude, index of b, sec)
    for i in range(1, len(snaps)):
        (a_sec, a), (b_sec, b) = snaps[i - 1], snaps[i]
        added, deleted = _line_delta(a, b)
        bucket = churn.setdefault(b_sec // 60, {"minute": b_sec // 60, "added": 0, "deleted": 0})
        bucket["added"] += added
        bucket["deleted"] += deleted
        deltas.append((added + deleted, i, b_sec))

    # Key transitions: the first write, the last state, whatever happened right
    # before each run/submit, and otherwise the biggest rewrites.
    marks = {0, len(snaps) - 1}
    for e in events:
        if e.get("kind") not in ("run", "submit"):
            continue
        sec = round(e.get("t_ms", 0) / 1000)
        before = [i for i, (s, _) in enumerate(snaps) if s <= sec]
        if before:
            marks.add(before[-1])
    for _mag, i, _sec in sorted(deltas, reverse=True):
        if len(marks) >= MAX_DIFFS:
            break
        marks.add(i)

    ordered = sorted(marks)
    key_diffs = []
    for prev, cur in zip(ordered, ordered[1:]):
        a_sec, a = snaps[prev]
        b_sec, b = snaps[cur]
        key_diffs.append(
            {"from_sec": a_sec, "to_sec": b_sec, "diff": _unified(a, b, a_sec, b_sec)}
        )

    return {
        "snapshots": sizes,
        "churn_per_min": [churn[k] for k in sorted(churn)],
        "key_diffs": key_diffs,
        "first_snapshot": {"sec": snaps[0][0], "code": _truncate(snaps[0][1], 1200)},
        "final_snapshot": {"sec": snaps[-1][0], "code": _truncate(snaps[-1][1], 2000)},
    }


def outcome_timeline(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run/submit outcomes in order — the ground truth for correctness times."""
    out = []
    for e in events:
        if e.get("kind") not in ("run", "submit"):
            continue
        payload = e.get("payload") or {}
        out.append(
            {
                "sec": round(e.get("t_ms", 0) / 1000),
                "kind": e.get("kind"),
                "verdict": payload.get("verdict") or payload.get("status") or "unknown",
            }
        )
    return out


def duration_sec(session: Any, events: list[dict[str, Any]]) -> int:
    started = getattr(session, "started_at", None)
    ended = getattr(session, "ended_at", None)
    if started and ended:
        return max(0, int((ended - started).total_seconds()))
    if events:
        return round(max(e.get("t_ms", 0) for e in events) / 1000)
    return 0


def build_context(
    session: Any,
    events: list[dict[str, Any]],
    problem: Any,
    features: dict[str, Any],
    profile_data: dict[str, Any],
) -> dict[str, Any]:
    """Assemble everything the model is allowed to see for one analysis."""
    events = sorted(events, key=lambda e: e.get("t_ms", 0))
    return {
        "session": {
            "duration_sec": duration_sec(session, events),
            "language": getattr(session, "language", None),
            "status": getattr(session, "status", None),
        },
        "problem": {
            "title": getattr(problem, "title", None),
            "tags": getattr(problem, "tags", None) or [],
            "rating": getattr(problem, "rating", None),
            "statement_md": _truncate(getattr(problem, "statement_md", ""), STATEMENT_CHARS),
            "editorial_md": _truncate(getattr(problem, "editorial_md", ""), EDITORIAL_CHARS),
        },
        "features": features or {},
        "transcript": compress_transcript(events),
        "code_evolution": code_evolution(events),
        "outcomes": outcome_timeline(events),
        "profile": profile_data or {},
    }


def render_block(name: str, value: Any) -> str:
    body = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=1)
    return f"<{name}>\n{body}\n</{name}>"
