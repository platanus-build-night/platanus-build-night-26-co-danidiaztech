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
DIFF_LINES = 34
MAX_DIFFS = 7
# A transition counts as a rewrite when this much text is thrown away; as a
# discard when the file also shrinks materially. These are the two signals the
# analysis leans on when there is no transcript to explain what happened.
REWRITE_DELETED_CHARS = 25
DISCARD_SHRINK_RATIO = 0.15


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
    """Forensic picture of how the code grew.

    Sizes and churn say *how much* moved; `rewrites` and the key diffs say
    *what* moved and when it was thrown away. On a transcript-less session this
    block is the only narrative evidence there is, so the diff anchors are
    chosen for story value: the first write, every state the solver actually
    ran, both sides of every discard, and the final state.
    """
    snaps = _code_snapshots(events)
    if not snaps:
        return {"snapshots": [], "churn_per_min": [], "key_diffs": [], "note": "no code snapshots"}

    sizes = [
        {"sec": sec, "chars": len(code), "lines": len(code.splitlines())} for sec, code in snaps
    ]

    churn: dict[int, dict[str, int]] = {}
    deltas: list[tuple[int, int]] = []  # (magnitude, index of b)
    rewrites: list[dict[str, Any]] = []
    discards: list[int] = []
    for i in range(1, len(snaps)):
        (a_sec, a), (b_sec, b) = snaps[i - 1], snaps[i]
        added, deleted = _line_delta(a, b)
        bucket = churn.setdefault(b_sec // 60, {"minute": b_sec // 60, "added": 0, "deleted": 0})
        bucket["added"] += added
        bucket["deleted"] += deleted
        deltas.append((added + deleted, i))
        if deleted < REWRITE_DELETED_CHARS:
            continue
        shrink = (len(a) - len(b)) / max(1, len(a))
        entry = {
            "from_sec": a_sec,
            "to_sec": b_sec,
            "deleted_chars": deleted,
            "added_chars": added,
            "lines_before": len(a.splitlines()),
            "lines_after": len(b.splitlines()),
            "discarded": shrink >= DISCARD_SHRINK_RATIO,
        }
        rewrites.append(entry)
        if entry["discarded"]:
            discards.append(i)

    # Diff anchors, most informative first; consecutive anchors become diffs.
    ranked: list[int] = [0, len(snaps) - 1]
    for e in sorted(events, key=lambda x: x.get("t_ms", 0)):
        if e.get("kind") not in ("run", "submit"):
            continue
        sec = round(e.get("t_ms", 0) / 1000)
        before = [i for i, (s, _) in enumerate(snaps) if s <= sec]
        if before:
            ranked.append(before[-1])
    for i in discards:  # both sides of a discard: what was abandoned, and what replaced it
        ranked += [i - 1, i]
    ranked += [i for _mag, i in sorted(deltas, reverse=True)]

    marks: list[int] = []
    for i in ranked:
        if 0 <= i < len(snaps) and i not in marks:
            marks.append(i)
        if len(marks) >= MAX_DIFFS + 1:
            break

    ordered = sorted(marks)
    key_diffs = []
    for prev, cur in zip(ordered, ordered[1:]):
        a_sec, a = snaps[prev]
        b_sec, b = snaps[cur]
        added, deleted = _line_delta(a, b)
        key_diffs.append(
            {
                "from_sec": a_sec,
                "to_sec": b_sec,
                "added": added,
                "deleted": deleted,
                "diff": _unified(a, b, a_sec, b_sec),
            }
        )

    return {
        "snapshots": sizes,
        "churn_per_min": [churn[k] for k in sorted(churn)],
        "key_diffs": key_diffs,
        "rewrites": rewrites,
        "rewrite_count": len(rewrites),
        "discard_count": len(discards),
        "first_code_sec": snaps[0][0],
        "last_edit_sec": snaps[-1][0],
        "first_snapshot": {"sec": snaps[0][0], "code": _truncate(snaps[0][1], 1200)},
        "final_snapshot": {"sec": snaps[-1][0], "code": _truncate(snaps[-1][1], 2000)},
    }


def _verdict_of(payload: dict[str, Any]) -> tuple[str, str | None]:
    """(verdict, detail). Handles both single-verdict and per-test payloads."""
    verdict = payload.get("verdict") or payload.get("status")
    per_test = payload.get("verdicts") or payload.get("per_test") or []
    detail = None
    if isinstance(per_test, list) and per_test:
        names = [v if isinstance(v, str) else (v or {}).get("verdict") for v in per_test]
        names = [n for n in names if n]
        if names:
            passed = sum(1 for n in names if n == "AC")
            detail = f"{passed}/{len(names)} tests passed"
            if not verdict:
                verdict = "AC" if passed == len(names) else next(n for n in names if n != "AC")
    return (verdict or "unknown", detail)


def outcome_timeline(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Run/submit outcomes in order — the ground truth for correctness times.

    Duplicate submits of the same verdict within a couple of seconds are one
    action logged twice; collapsing them stops the analysis from reading a
    double-click as two attempts.
    """
    out: list[dict[str, Any]] = []
    for e in events:
        if e.get("kind") not in ("run", "submit"):
            continue
        verdict, detail = _verdict_of(e.get("payload") or {})
        sec = round(e.get("t_ms", 0) / 1000)
        if out and out[-1]["kind"] == e.get("kind") and out[-1]["verdict"] == verdict:
            if sec - out[-1]["sec"] <= 3:
                continue
        entry: dict[str, Any] = {"sec": sec, "kind": e.get("kind"), "verdict": verdict}
        if detail:
            entry["detail"] = detail
        if out:
            entry["since_prev_sec"] = sec - out[-1]["sec"]
        out.append(entry)
    return out


def solve_rhythm(
    events: list[dict[str, Any]],
    outcomes: list[dict[str, Any]],
    evo: dict[str, Any],
    duration: int,
) -> dict[str, Any]:
    """The pacing numbers a coach would check first, precomputed.

    Deliberately includes the *payoff* of the thinking time, not just its
    length: how much of the first implementation survived to the first test.
    Time before the first keystroke is planning, and the only honest way to
    judge planning is by the code it produced — so both numbers travel
    together and the model never gets one without the other.
    """
    first_code = evo.get("first_code_sec")
    first_try = outcomes[0]["sec"] if outcomes else None
    failures = [o for o in outcomes if o["verdict"] not in ("AC", "unknown")]
    first_ac = next((o["sec"] for o in outcomes if o["verdict"] == "AC"), None)
    rewrites = evo.get("rewrites") or []
    before_first_test = [r for r in rewrites if first_try is None or r["to_sec"] <= first_try]

    # The longest stretch with nothing recorded. This is planning time, and the
    # only honest way to price it is the code that came out the other side —
    # which is why it ships next to the rewrite counts, never on its own.
    quiet: dict[str, Any] | None = None
    secs = [round(e.get("t_ms", 0) / 1000) for e in sorted(events, key=lambda e: e.get("t_ms", 0))]
    for a, b in zip(secs, secs[1:]):
        if b - a > 20 and (quiet is None or b - a > quiet["seconds"]):
            quiet = {"from_sec": a, "to_sec": b, "seconds": b - a}

    out: dict[str, Any] = {
        "duration_sec": duration,
        "first_keystroke_sec": first_code,
        "longest_quiet_span": quiet,
        "first_run_or_submit_sec": first_try,
        "implementation_time_before_first_test_sec": (
            None if first_code is None or first_try is None else first_try - first_code
        ),
        "rewrites_before_first_test": len(before_first_test),
        "discards_before_first_test": len([r for r in before_first_test if r["discarded"]]),
        "first_failure_sec": failures[0]["sec"] if failures else None,
        "seconds_after_first_failure": (
            None if not failures else duration - failures[0]["sec"]
        ),
        "first_ac_sec": first_ac,
        "attempts": len(outcomes),
        "failed_attempts": len(failures),
        "rewrite_count": evo.get("rewrite_count", 0),
        "discard_count": evo.get("discard_count", 0),
        "last_edit_sec": evo.get("last_edit_sec"),
    }
    return {k: v for k, v in out.items() if v is not None}


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
    duration = duration_sec(session, events)
    evo = code_evolution(events)
    outcomes = outcome_timeline(events)
    transcript = compress_transcript(events)
    return {
        "session": {
            "duration_sec": duration,
            "language": getattr(session, "language", None),
            "status": getattr(session, "status", None),
            "has_transcript": bool(transcript),
        },
        "problem": {
            "title": getattr(problem, "title", None),
            "tags": getattr(problem, "tags", None) or [],
            "rating": getattr(problem, "rating", None),
            "statement_md": _truncate(getattr(problem, "statement_md", ""), STATEMENT_CHARS),
            "editorial_md": _truncate(getattr(problem, "editorial_md", ""), EDITORIAL_CHARS),
        },
        "features": features or {},
        "transcript": transcript,
        "code_evolution": evo,
        "outcomes": outcomes,
        "rhythm": solve_rhythm(events, outcomes, evo, duration),
        "profile": profile_data or {},
    }


def render_block(name: str, value: Any) -> str:
    body = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=1)
    return f"<{name}>\n{body}\n</{name}>"
