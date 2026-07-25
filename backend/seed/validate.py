#!/usr/bin/env python3
"""
Pass 3 — validate. For every curated problem, run a known-correct reference
solution (prefer python3, else compile the C++ one) against ALL kept tests
through backend/app/judge/core.py. Problems where the reference solution
doesn't get AC on every test are dropped (with reason logged); tests that
are individually pathological can be dropped instead of the whole problem
when that's enough to fix it.

Writes:
  - backend/seed/data/validated.json   (problems that passed, in final
    problems.json-ready shape minus editorial_md)
  - backend/seed/data/validation_report.json (per-problem pass/fail detail)

Usage:
    backend/seed/.venv/bin/python backend/seed/validate.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND_DIR = HERE.parent
DATA_DIR = HERE / "data"
IN_PATH = DATA_DIR / "curated.json"
OUT_PATH = DATA_DIR / "validated.json"
REPORT_PATH = DATA_DIR / "validation_report.json"

sys.path.insert(0, str(BACKEND_DIR))
from app.judge import core  # noqa: E402


def try_solution(sol_code: str, language: str, problem) -> tuple[bool, list[dict]]:
    per_test = []
    all_ac = True
    for t in problem["tests"]:
        result = core.execute(
            language, sol_code, t["input"], problem["time_limit_ms"], problem["memory_limit_mb"]
        )
        verdict = core.verdict_for(result, t["output"])
        per_test.append({
            "is_sample": t.get("is_sample", False),
            "verdict": verdict,
            "time_ms": result["time_ms"],
        })
        if verdict != "AC":
            all_ac = False
    return all_ac, per_test


def validate_problem(problem: dict) -> dict:
    attempts = []

    candidates = [("python3", s) for s in problem["solutions_python3"]]
    candidates += [("cpp", s) for s in problem["solutions_cpp"]]

    for language, sol_code in candidates:
        ok, per_test = try_solution(sol_code, language, problem)
        attempts.append({"language": language, "ok": ok, "per_test_summary": summarize(per_test)})
        if ok:
            return {
                "status": "pass",
                "external_id": problem["external_id"],
                "language_used": language,
                "attempts": attempts,
                "n_tests": len(problem["tests"]),
            }
        # Retry: drop tests where THIS solution failed if it's a small
        # minority (likely a bad/huge generated test, not a wrong solution)
        # and every other test passed.
        fails = [i for i, r in enumerate(per_test) if r["verdict"] != "AC"]
        n = len(problem["tests"])
        if 0 < len(fails) <= max(1, n // 5) and all(
            not problem["tests"][i]["is_sample"] for i in fails
        ):
            trimmed_tests = [t for i, t in enumerate(problem["tests"]) if i not in fails]
            trial_problem = dict(problem, tests=trimmed_tests)
            ok2, per_test2 = try_solution(sol_code, language, trial_problem)
            if ok2:
                return {
                    "status": "pass_trimmed",
                    "external_id": problem["external_id"],
                    "language_used": language,
                    "dropped_test_count": len(fails),
                    "attempts": attempts,
                    "n_tests": len(trimmed_tests),
                    "kept_tests": trimmed_tests,
                }

    return {
        "status": "fail",
        "external_id": problem["external_id"],
        "attempts": attempts,
    }


def summarize(per_test):
    from collections import Counter
    c = Counter(r["verdict"] for r in per_test)
    return dict(c)


def main():
    problems = json.loads(IN_PATH.read_text())
    validated = []
    report = []

    t0 = time.time()
    for idx, p in enumerate(problems):
        res = validate_problem(p)
        report.append(res)
        status = res["status"]
        print(f"[{idx+1}/{len(problems)}] {p['external_id']:>8s} {p['title'][:40]:40s} -> {status}")

        if status == "pass":
            validated.append(p)
        elif status == "pass_trimmed":
            p2 = dict(p)
            p2["tests"] = res["kept_tests"]
            validated.append(p2)
        # 'fail' -> dropped entirely

    elapsed = time.time() - t0
    OUT_PATH.write_text(json.dumps(validated, indent=1))
    REPORT_PATH.write_text(json.dumps({
        "elapsed_s": round(elapsed, 1),
        "total": len(problems),
        "passed": len(validated),
        "failed": len(problems) - len(validated),
        "details": report,
    }, indent=1))

    print(f"\nvalidated {len(validated)}/{len(problems)} in {elapsed:.1f}s")
    print(f"wrote {OUT_PATH}")
    print(f"wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
