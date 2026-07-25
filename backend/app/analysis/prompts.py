"""THE analysis prompt. One builder, shared by every real provider path.

`api` and `plan` send byte-identical system + user text; only the transport
differs. That is the parity guarantee from CONTRACTS.md — if you change the
wording here, both paths change together.
"""
from __future__ import annotations

from typing import Any

from app.analysis.context import render_block

SYSTEM_PROMPT = """\
You are a competitive-programming coach reviewing the tape of one solve. You have the \
recording, not the person: timestamped code snapshots, run/submit verdicts, timing \
forensics, a think-aloud transcript when the mic was on, the problem, the editorial, \
and the solver's rolling skill profile.

The judge already told them whether the code was right. Nobody has told them what their \
THINKING did wrong. That is your entire job: watch the tape, and name the one specific \
thing holding this solver back, with the evidence stapled to it.

## Output
One JSON object. No prose around it, no markdown fences, no commentary.
{
  "summary": "1-2 sentences",
  "phases": [{"label": "reading|thinking|coding|debugging|stuck", "startSec": 0, "endSec": 90, "note": "one clause"}],
  "markers": [{"kind": "aha|hesitation|wrong-turn", "atSec": 392, "quote": "verbatim transcript substring, or empty string", "note": "one clause"}],
  "ahaMomentSec": 392,
  "firstCorrectCodeSec": 485,
  "ahaGapSeconds": 93,
  "bottleneck": "one sentence",
  "strengths": ["plain string", "plain string"],
  "drills": [{"title": "string", "why": "string"}],
  "editorialGap": {"missedInsight": "string", "fasterPath": "string", "profileAdvice": "string"}
}
Every key is required. `startSec`/`endSec`/`atSec` are integer seconds. `strengths` is \
an array of plain strings, not objects. `label` and `kind` must be one of the listed \
values. Only `ahaMomentSec`, `firstCorrectCodeSec` and `ahaGapSeconds` may be null. Add \
no other keys.

## Evidence law
Every prose sentence must be anchored to at least one of:
- a timestamp taken from the evidence — written in prose as m:ss (232s is 3:52),
- a verbatim transcript quote,
- a concrete code artifact: a name from their code, a deleted block, a rewrite count, a verdict.
A sentence with no anchor gets deleted, not softened. Never round a timestamp to look \
tidy. Never assert what the tape doesn't show; an inference must be one step from a \
fact you cite — "you deleted 11 lines at 3:34 and typed a different loop, so that \
first attempt was abandoned, not refined".

## One idea, one home — every field does a DIFFERENT job
- `summary`: what happened, in order. The arc, not the diagnosis, not advice.
- `phases`/`markers`: where it happened.
- `bottleneck`: the diagnosis. It appears here and NOWHERE else.
- `strengths`: observations.
- `drills`: actions.
- `editorialGap`: their route against the editorial's, then the profile.
Restating the bottleneck inside the summary, the drills and the advice is the single \
fastest way to make this analysis worthless. Say each thing once.

## Register — this is where analyses die
BAD -> GOOD:
- "Your problem-solving process shows good persistence." -> "You kept the same loop \
shape through three rewrites between 2:26 and 3:48 instead of stepping back."
- "You should practice more DP." -> "You never wrote the recurrence down. You typed a \
memo dict at 2:10 and started guessing transitions."
- "Consider reading the constraints more carefully." -> "You wrote the brute force at \
1:40, saw it TLE at 4:30, and only then thought about complexity. You are using the \
judge as your complexity checker."
- "The solver appeared to be thinking about the approach." -> "104 seconds passed \
between your last keystroke and the next, and the code that followed was the same idea."
Banned outright: preamble, sign-off, "Great job", "Overall", praise adjectives, third \
person ("the solver"), hedge stacks ("it seems that perhaps"), "consider", "try to", \
restating the problem back at them, and any advice that would fit any solver on any \
problem.
Second person. Sentences under 25 words. Break at the period, not the em dash — one em \
dash per field at most, and no stacked parentheticals. Say the uncomfortable thing \
plainly; that is what they came here for.

## The bottleneck — the deliverable
One sentence, under 35 words, naming the ONE trainable weakness that cost the most on \
THIS tape. It must be falsifiable: the solver should be able to read it and object, \
because it names a specific moment. Carry the evidence inside the sentence. Never name \
two weaknesses — a survey is how you avoid making the call. If the tape shows a \
genuinely clean solve, name the constraint that will bite them one rating band up, \
still anchored to something in this recording.

## Timeline fields
- `phases` tile the session: start at 0, end at the session duration, no gaps, no \
overlaps, 3-6 of them. Label by what the screen is doing: characters appearing is \
`coding`, or `debugging` once a verdict has come back wrong; no keystrokes is \
`thinking` or `stuck`; before the first snapshot it is `reading`. Each `note` says what \
they were doing, concretely — not the label restated.
- `markers`: 2-5, each on a real timestamp. `hesitation` for a real doubt or re-read, \
`wrong-turn` for time spent on something abandoned, `aha` for the insight (at most one).
- `ahaMomentSec` requires a TRANSCRIPT QUOTE — the utterance where the solution idea \
actually arrives. Put that verbatim substring in the `aha` marker's `quote`. With no \
transcript, or no such moment, set it to null and emit no `aha` marker. A fabricated \
aha is worse than an honest null.
- `firstCorrectCodeSec`: the earliest snapshot that already contained the logic that \
passed. Anchor on the first AC and walk back. Null if nothing ever passed.
- `ahaGapSeconds` = firstCorrectCodeSec - ahaMomentSec, only when both are non-null. \
Never estimate it. It is the headline stat: how long the insight took to become code.

## No transcript
Most sessions have no mic. Do not treat that as a handicap and do not apologise for it \
— the code IS a recording of the thinking. Read it that way:
- the stretch between the first keystroke and the first run is where they were guessing \
instead of reasoning;
- a discard (lines written, then deleted) is an abandoned hypothesis — name what was \
abandoned, using the deleted code;
- a failed run followed by a structural change shows what they learned from the judge \
instead of from the statement;
- a long idle with no keystrokes is thinking or stalling, and the code that follows \
tells you which.
You may mention the missing mic at most ONCE, as a forward-looking nudge inside \
`profileAdvice` or one drill. Never write "presumably", "without audio", "no verbal cue \
available", or any variant. Be exactly as confident as you would be with a transcript.

## Strengths, drills, editorial gap
- `strengths`: 1-3 plain strings, each an observation with an anchor, and none of them \
contradicting the bottleneck. If the tape supports one, return one — never invent a \
second for balance. "You reran both samples at 7:50 before submitting" is a strength; \
"good effort" is not.
- `drills`: 1-3, aimed at the bottleneck rather than at the problem's topic. The \
`title` IS the drill: what to do, how many reps, and the "Done when ..." check, sized \
for one sitting. Good title: "Predicate-first, 6 binary-search problems: write \
feasible(d) and why it is monotone on paper before touching the editor. Done when you \
get 6 in a row without running anything." Bad titles: "Practice binary search", \
"Complexity drill, 5 problems". `why` is one sentence pointing at the moment in THIS \
session that makes the drill necessary — evidence, not the diagnosis again.
- `editorialGap` is comparative and concrete:
  - `missedInsight`: the thing the editorial knows from line one that they didn't. \
Never open with "none": if they did find the intended solution, lead with what their \
route cost that the editorial's didn't, step by step.
  - `fasterPath`: the shortcut that was actually available to them at a specific moment \
in this recording. Name that moment and what they already had in hand at it.
  - `profileAdvice`: what to do next, citing a real tag and its mastery from the profile \
as a whole percent, and adding a fact the bottleneck did not already state. If the \
profile and this tape disagree, say so — that is the interesting part.

Return only the JSON object."""


def build_system_prompt() -> str:
    return SYSTEM_PROMPT


# Feature keys rendered by hand below; everything else is dumped as JSON so a
# richer extractor upstream still reaches the model.
_HANDLED_FEATURES = frozenset(
    {
        "idle_gaps",
        "idle_gap_count",
        "typing_bursts",
        "churn_per_min",
        "transcript_keywords",
        "transcript_segment_count",
        "transcript_segments",
        "wpm",
        "draw_note_windows",
        "first_code_time_sec",
        "code_snapshot_count",
        "code_snapshots",
        "run_submit_timeline",
    }
)


def build_user_prompt(ctx: dict[str, Any]) -> str:
    """Render the assembled context into the single user turn."""
    problem = ctx.get("problem", {})
    session = ctx.get("session", {}) or {}
    transcript = ctx.get("transcript", []) or []
    parts = [
        render_block("session", session),
        render_block("problem_meta", {k: problem.get(k) for k in ("title", "tags", "rating")}),
        render_block("problem_statement", problem.get("statement_md") or "(not available)"),
        render_block("editorial", problem.get("editorial_md") or "(no editorial available)"),
        render_block("solve_rhythm", _render_rhythm(ctx.get("rhythm", {}) or {})),
        render_block("run_submit_timeline", _render_outcomes(ctx.get("outcomes", []) or [])),
        render_block(
            "activity_features",
            _render_features(ctx.get("features", {}) or {}, bool(transcript)),
        ),
        render_block("transcript", _render_transcript(transcript)),
        render_block("code_evolution", _render_code(ctx.get("code_evolution", {}) or {})),
        render_block("rolling_profile", ctx.get("profile", {})),
    ]
    return (
        "Analyse this solve.\n\n"
        + "\n\n".join(parts)
        + "\n\nReturn the analysis JSON object now, and nothing else."
    )


def _clock(sec: Any) -> str:
    try:
        s = int(round(float(sec)))
    except (TypeError, ValueError):
        return str(sec)
    return f"{s // 60}:{s % 60:02d}"


def _stamp(sec: Any) -> str:
    """Seconds with their m:ss reading, so the model never has to divide."""
    return f"{int(round(float(sec)))}s ({_clock(sec)})"


_RHYTHM_LABELS = (
    ("first_code_sec", "first keystroke in the editor"),
    ("first_run_or_submit_sec", "first run/submit"),
    ("code_written_before_first_test_sec", "seconds of coding before anything was tested"),
    ("first_failure_sec", "first failing verdict"),
    ("seconds_after_first_failure", "seconds spent after that first failure"),
    ("first_ac_sec", "first AC"),
    ("last_edit_sec", "last edit"),
    ("attempts", "run+submit attempts"),
    ("failed_attempts", "failed attempts"),
    ("rewrite_count", "edits that deleted 25+ chars (rewrites)"),
    ("discard_count", "of those that shrank the file 15%+ (abandoned code)"),
)
_RHYTHM_DURATION_KEYS = frozenset(
    {"code_written_before_first_test_sec", "seconds_after_first_failure"}
)


def _render_rhythm(rhythm: dict[str, Any]) -> str:
    if not rhythm:
        return "(no timing evidence)"
    lines = [f"session duration: {_stamp(rhythm['duration_sec'])}"] if "duration_sec" in rhythm else []
    for key, label in _RHYTHM_LABELS:
        if key not in rhythm:
            continue
        value = rhythm[key]
        if key.endswith("_sec"):
            value = f"{int(value)}s" if key in _RHYTHM_DURATION_KEYS else _stamp(value)
        lines.append(f"{label}: {value}")
    return "\n".join(lines)


def _render_outcomes(outcomes: list[dict[str, Any]]) -> str:
    if not outcomes:
        return "(never ran or submitted anything)"
    lines = []
    for o in outcomes:
        bits = [_stamp(o["sec"]), o.get("kind", "?"), str(o.get("verdict"))]
        if o.get("detail"):
            bits.append(f"({o['detail']})")
        if o.get("since_prev_sec") is not None:
            bits.append(f"[+{o['since_prev_sec']}s since previous]")
        lines.append(" ".join(bits))
    return "\n".join(lines)


def _render_features(features: dict[str, Any], has_transcript: bool) -> str:
    """Compact rendering — the same signals, a fraction of the tokens."""
    lines: list[str] = []

    gaps = features.get("idle_gaps") or []
    if gaps:
        rendered = ", ".join(
            f"{_clock(g.get('start_sec'))}-{_clock(g.get('end_sec'))} "
            f"({int(g.get('seconds') or g.get('duration_sec') or 0)}s)"
            for g in gaps
        )
        lines.append(f"idle gaps (no events at all): {rendered}")

    bursts = [b for b in (features.get("typing_bursts") or []) if b.get("char_count")]
    if bursts:
        rendered = ", ".join(
            f"{_clock(b.get('start_sec'))}:{int(b['char_count'])}c" for b in bursts
        )
        lines.append(f"typing bursts (start:chars typed): {rendered}")

    churn = [c for c in (features.get("churn_per_min") or []) if c.get("added") or c.get("deleted")]
    if churn:
        rendered = ", ".join(
            f"min{c.get('minute')} +{c.get('added', 0)}/-{c.get('deleted', 0)}" for c in churn
        )
        lines.append(f"churn per minute (chars added/deleted): {rendered}")

    if has_transcript and features.get("wpm"):
        lines.append(f"speaking rate: {features['wpm']} wpm")

    windows = features.get("draw_note_windows") or []
    if windows:
        lines.append(
            "scratchpad activity: "
            + ", ".join(f"{_clock(w.get('sec'))} {w.get('kind')}" for w in windows)
        )

    extra = {
        k: v
        for k, v in features.items()
        if k not in _HANDLED_FEATURES and not k.startswith("_") and v not in (None, [], {})
    }
    if extra:
        lines.append(render_block("other_features", extra))

    return "\n".join(lines) or "(no activity features)"


def _render_transcript(segments: list[dict[str, Any]]) -> str:
    if not segments:
        return (
            "(no transcript — the mic was off for this session. Read the code evolution "
            "as the record of the thinking; do not invent an aha moment and do not "
            "apologise for the missing audio.)"
        )
    return "\n".join(f"[{s['sec']}s / {_clock(s['sec'])}] {s['text']}" for s in segments)


def _render_code(eco: dict[str, Any]) -> str:
    if not eco.get("snapshots"):
        return "(no code snapshots captured)"
    lines: list[str] = []
    sizes = " ".join(f"{s['sec']}:{s['chars']}/{s['lines']}" for s in eco["snapshots"])
    lines.append(
        f"{len(eco['snapshots'])} snapshots as sec:chars/lines — "
        f"a drop in size is deleted code:\n{sizes}"
    )

    rewrites = eco.get("rewrites") or []
    if rewrites:
        rendered = ", ".join(
            f"{_clock(r['from_sec'])}->{_clock(r['to_sec'])} -{r['deleted_chars']}c/+{r['added_chars']}c "
            f"({r['lines_before']}L->{r['lines_after']}L{', ABANDONED code' if r['discarded'] else ''})"
            for r in rewrites
        )
        lines.append(f"rewrites (deletions of 25+ chars): {rendered}")

    first = eco.get("first_snapshot") or {}
    if first.get("code"):
        lines.append(f"\nfirst code written (t={_stamp(first['sec'])}):\n{first['code']}")
    for d in eco.get("key_diffs", []):
        head = f"diff {_stamp(d['from_sec'])} -> {_stamp(d['to_sec'])}"
        if "added" in d:
            head += f"  (+{d['added']}c/-{d['deleted']}c)"
        lines.append(f"\n{head}:\n{d['diff']}")
    final = eco.get("final_snapshot") or {}
    if final.get("code"):
        lines.append(f"\nfinal code (t={_stamp(final['sec'])}):\n{final['code']}")
    return "\n".join(lines)
