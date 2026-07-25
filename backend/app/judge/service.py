"""Judge orchestration — owned by Agent E. Builds on `app.judge.core`
(Agent B's pure sandboxed runner) to implement the full spec from
CONTRACTS.md: verdict comparison, parallel per-test execution
(ProcessPoolExecutor, min(4, cpu)), early-stop-on-first-non-AC for
`submit()`, submission persistence, and `submit` event emission into the
owning session.

Two entry points, both consumed by `app.routers.judge`:
  - `run_samples(problem, language, code)` -> list[RunResult-shaped dict]
    Runs only `problem.samples`, no early stop (contract: /run always
    reports every sample).
  - `submit(db, problem, language, code, session_id=None)` -> SubmitResult
    dict. Runs every `testcases` row for the problem (falls back to
    samples if none are seeded yet), stops scheduling new tests after the
    first non-AC verdict, persists the Submission row, and — when
    `session_id` is given — appends a `submit` event to that session's
    timeline. Also nudges the rolling skill profile via
    `app.engine.profile.update_mastery_on_submit`.

cpp is compiled exactly once per submission (up front, in the calling
process) via `core.compile_cpp`: this both surfaces CE immediately
(without spending time running any test) and avoids every parallel worker
racing to compile the same binary — `core`'s compile cache is keyed by
source hash and already on disk by the time workers call `core.execute`.
"""
from __future__ import annotations

import datetime as dt
import os
import time
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, wait
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.judge import core

MAX_WORKERS = max(1, min(4, os.cpu_count() or 1))
STDERR_EXCERPT_CHARS = 2000

_POOL: Optional[ProcessPoolExecutor] = None


def _pool() -> ProcessPoolExecutor:
    global _POOL
    if _POOL is None:
        _POOL = ProcessPoolExecutor(max_workers=MAX_WORKERS)
    return _POOL


def _is_cpp(language: str) -> bool:
    return (language or "").strip().lower() in core.CPP_ALIASES


def _compile_if_needed(language: str, code: str) -> tuple[bool, str]:
    """cpp only: compile once up front. Returns (ok, stderr_excerpt)."""
    if not _is_cpp(language):
        return True, ""
    _binary_path, err = core.compile_cpp(code)
    if err:
        return False, err[:STDERR_EXCERPT_CHARS]
    return True, ""


def _judge_tests(
    language: str,
    code: str,
    tests: list[dict[str, str]],
    time_limit_ms: int,
    memory_limit_mb: int,
    stop_early: bool,
) -> tuple[list[dict[str, Any]], str]:
    """Run `tests` (each `{"input", "expected"}`) in parallel, up to
    MAX_WORKERS concurrently. When `stop_early`, no NEW test is scheduled
    once an already-evaluated test (in index order) is non-AC; tests
    already in flight at that point are still awaited, but the returned
    per-test list is truncated to end at the first failing test — matching
    a normal judge's "stops at first failure" UX.

    Returns (per_test list in original order, overall verdict).
    """
    n = len(tests)
    if n == 0:
        return [], "AC"

    pool = _pool()
    results: list[Optional[core.ExecResult]] = [None] * n
    in_flight: dict[Any, int] = {}
    next_i = 0
    stop_submitting = False

    def _launch(i: int) -> None:
        fut = pool.submit(
            core.execute, language, code, tests[i]["input"], time_limit_ms, memory_limit_mb
        )
        in_flight[fut] = i

    while next_i < n and len(in_flight) < MAX_WORKERS:
        _launch(next_i)
        next_i += 1

    while in_flight:
        done, _pending = wait(list(in_flight.keys()), return_when=FIRST_COMPLETED)
        for fut in done:
            i = in_flight.pop(fut)
            results[i] = fut.result()

        if stop_early and not stop_submitting:
            for i in range(next_i):
                r = results[i]
                if r is not None and core.verdict_for(r, tests[i]["expected"]) != "AC":
                    stop_submitting = True
                    break

        if not stop_submitting:
            while next_i < n and len(in_flight) < MAX_WORKERS:
                _launch(next_i)
                next_i += 1

    evaluated = next_i  # every index < evaluated was launched, and the loop
    # above only exits once all in-flight futures are resolved, so all of
    # them are populated in `results` by now.

    per_test: list[dict[str, Any]] = []
    overall = "AC"
    for i in range(evaluated):
        r = results[i]
        assert r is not None
        v = core.verdict_for(r, tests[i]["expected"])
        entry: dict[str, Any] = {
            "verdict": v,
            "time_ms": r["time_ms"],
            "stdout": r["stdout"],
            "expected": tests[i]["expected"],
        }
        if v == "RE" and r["stderr"]:
            entry["stderr"] = r["stderr"][:STDERR_EXCERPT_CHARS]
        per_test.append(entry)
        if v != "AC":
            overall = v
            if stop_early:
                break

    return per_test, overall


def run_samples(problem: Any, language: str, code: str) -> list[dict[str, Any]]:
    """Run `code` against `problem.samples`. Returns RunResult-shaped dicts,
    one per sample, in order — never stops early (a /run should always show
    every sample's outcome)."""
    samples = problem.samples or []
    tests = [{"input": s.get("input", ""), "expected": s.get("output", "")} for s in samples]

    ok, compile_err = _compile_if_needed(language, code)
    if not ok:
        # `compile_error` carries the compiler stderr excerpt explicitly;
        # `stdout` keeps the same excerpt for backwards compat with any
        # caller still reading it off `stdout` (CE has no meaningful stdout
        # otherwise).
        placeholder = tests or [{"input": "", "expected": ""}]
        return [
            {
                "verdict": "CE",
                "time_ms": 0,
                "stdout": compile_err,
                "expected": t["expected"],
                "compile_error": compile_err,
            }
            for t in placeholder
        ]

    per_test, _overall = _judge_tests(
        language, code, tests, problem.time_limit_ms, problem.memory_limit_mb, stop_early=False
    )
    return [
        {"verdict": t["verdict"], "time_ms": t["time_ms"], "stdout": t["stdout"], "expected": t["expected"]}
        for t in per_test
    ]


def run_custom(problem: Any, language: str, code: str, stdin: str, expected: str | None) -> dict[str, Any]:
    """Run `code` once against a hand-written `stdin`.

    This is the scratchpad path, not the judge path, so it reports what a
    person debugging actually needs and `/run` deliberately hides: **stderr**
    (the Python traceback / C++ runtime message that explains an RE), the exit
    code, and the wall time. `expected` is optional — with it you get a real
    AC/WA verdict, without it the run is graded only on whether it completed
    ("OK"), because "wrong answer" is meaningless when no answer was declared.
    """
    ok, compile_err = _compile_if_needed(language, code)
    if not ok:
        return {
            "verdict": "CE",
            "time_ms": 0,
            "stdout": "",
            "stderr": "",
            "expected": expected,
            "compile_error": compile_err,
            "exit_code": None,
        }

    result = core.execute(language, code, stdin, problem.time_limit_ms, problem.memory_limit_mb)

    if result["timed_out"]:
        verdict = "TLE"
    elif result["returncode"] != 0:
        verdict = "RE"
    elif expected is None or not expected.strip():
        verdict = "OK"  # ran clean; nothing to compare against
    else:
        verdict = "AC" if core.compare_output(result["stdout"], expected) else "WA"

    return {
        "verdict": verdict,
        "time_ms": result["time_ms"],
        "stdout": result["stdout"],
        # Surfaced on every non-clean outcome, not just RE: a program can exit 0
        # after printing a warning, and that warning is often the whole clue.
        "stderr": result["stderr"][:STDERR_EXCERPT_CHARS],
        "expected": expected,
        "compile_error": None,
        "exit_code": result["returncode"],
    }


def _load_tests(db: Session, problem: Any) -> list[dict[str, str]]:
    from app.models import TestCase  # local import: avoid a hard app.models
    # dependency for anyone importing this module outside the app (e.g. a
    # future standalone judge worker).

    rows = (
        db.query(TestCase)
        .filter(TestCase.problem_id == problem.id)
        .order_by(TestCase.id)
        .all()
    )
    if rows:
        return [{"input": r.input, "expected": r.expected} for r in rows]
    # Fall back to samples so /submit still works for problems whose
    # hidden testcases haven't been seeded yet.
    return [{"input": s.get("input", ""), "expected": s.get("output", "")} for s in (problem.samples or [])]


def _emit_submit_event(db: Session, session_id: int, submission_id: int, result: dict[str, Any]) -> None:
    from app.models import Event, SessionModel

    session = db.get(SessionModel, session_id)
    t_ms = 0
    if session is not None and session.started_at is not None:
        now = dt.datetime.now(dt.timezone.utc)
        started = session.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=dt.timezone.utc)
        t_ms = max(0, int((now - started).total_seconds() * 1000))
    db.add(
        Event(
            session_id=session_id,
            t_ms=t_ms,
            kind="submit",
            payload={
                "submission_id": submission_id,
                "verdict": result["verdict"],
                "time_ms": result["time_ms"],
            },
        )
    )
    db.commit()


def submit(
    db: Session,
    problem: Any,
    language: str,
    code: str,
    session_id: Optional[int] = None,
) -> dict[str, Any]:
    """Full-submission judge run against every seeded testcase (falls back
    to samples). Persists the Submission row, emits a `submit` session
    event when `session_id` is given, and nudges the rolling profile."""
    tests = _load_tests(db, problem)

    start = time.monotonic()
    ok, compile_err = _compile_if_needed(language, code)
    if not ok:
        result: dict[str, Any] = {
            "verdict": "CE",
            "per_test": [{"verdict": "CE", "time_ms": 0, "stderr": compile_err}],
            "time_ms": int(round((time.monotonic() - start) * 1000)),
        }
    else:
        per_test, overall = _judge_tests(
            language, code, tests, problem.time_limit_ms, problem.memory_limit_mb, stop_early=True
        )
        result = {
            "verdict": overall,
            "per_test": per_test,
            "time_ms": int(round((time.monotonic() - start) * 1000)),
        }

    from app.models import Submission

    submission = Submission(
        session_id=session_id,
        problem_id=problem.id,
        language=language,
        code=code,
        verdict=result["verdict"],
        time_ms=result["time_ms"],
        per_test=result["per_test"],
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    if session_id is not None:
        _emit_submit_event(db, session_id, submission.id, result)

    from app.engine.profile import update_mastery_on_submit

    update_mastery_on_submit(db, problem, result["verdict"], session_id=session_id)

    return result
