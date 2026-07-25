"""Judge orchestration — STUB, owned by Agent E (core.py is Agent B's; extend
this file, don't rewrite the split).

Agent E implements: verdict comparison (token-wise, whitespace- and
trailing-newline-insensitive; AC|WA|TLE|RE|CE), parallel test execution
(ProcessPoolExecutor, min(4, cpu)), and early-stop-on-first-non-AC for
`submit()` (still reporting the per-test list gathered so far).

Current behavior: calls app.judge.core.execute (itself a stub) and always
returns AC using the sample's expected output as stdout, so /run and /submit
have realistic, contract-shaped fixture responses end-to-end.
"""
from __future__ import annotations

from typing import Any

from app.judge import core


def run_samples(problem: Any, language: str, code: str) -> list[dict[str, Any]]:
    """Run `code` against `problem.samples`. Returns list of RunResult dicts."""
    samples = problem.samples or []
    results: list[dict[str, Any]] = []
    for sample in samples:
        core.execute(language, code, sample.get("input", ""), problem.time_limit_ms, problem.memory_limit_mb)
        expected = sample.get("output", "")
        results.append({"verdict": "AC", "time_ms": 12, "stdout": expected, "expected": expected})
    return results


def submit(problem: Any, language: str, code: str) -> dict[str, Any]:
    """Full-submission judge run. Returns a SubmitResult dict."""
    samples = problem.samples or []
    per_test = [
        {"verdict": "AC", "time_ms": 12, "stdout": s.get("output", ""), "expected": s.get("output", "")}
        for s in samples
    ] or [{"verdict": "AC", "time_ms": 12, "stdout": "", "expected": ""}]
    return {"verdict": "AC", "per_test": per_test, "time_ms": 12}
