#!/usr/bin/env python3
"""
Pass 1 — ingest candidates from deepmind/code_contests (HF, CC BY 4.0).

Streams the small, high-quality `test` and `valid` splits (both are pure
Codeforces problems, curated by the dataset authors) and applies hard
structural filters. Writes backend/seed/data/candidates.json.

Usage:
    backend/seed/.venv/bin/python backend/seed/ingest.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
DATA_DIR.mkdir(exist_ok=True)
OUT_PATH = DATA_DIR / "candidates.json"

# ClassLabel indices from the dataset schema (checked against `ds.features`).
SOURCE_CODEFORCES = 2
LANG_PYTHON = 1
LANG_CPP = 2
LANG_PYTHON3 = 3
LANG_JAVA = 4
LANG_NAMES = {LANG_PYTHON: "PYTHON", LANG_CPP: "CPP", LANG_PYTHON3: "PYTHON3", LANG_JAVA: "JAVA"}

SPLITS = ["test", "valid"]  # small + high-quality, per mission notes

MIN_RATING = 800
MAX_RATING = 2200
# NOTE: reality check on the dataset -- 194/282 CF problems in test+valid
# have exactly ONE official public (statement) example. Requiring >=2
# *official* samples would drop ~70% of the pool. Instead we hard-require
# >=1 official sample, and top up to >=2 displayed samples by borrowing the
# smallest hidden test when only one official sample exists (flagged via
# `sample_source` per-item below, so curate.py / editorial writing knows
# which ones are "explained in the statement" vs "supplementary").
MIN_PUBLIC_TESTS = 1
MIN_DISPLAY_SAMPLES = 2
MIN_PRIVATE_OR_GENERATED = 5
MAX_TOTAL_TEST_BYTES = 2 * 1024 * 1024  # 2MB payload cap per problem
MAX_TESTS_KEPT = 20

# Statement-quality hard blockers: raw unrendered LaTeX / image artifacts.
DIRTY_MARKERS = [
    "\\begin{", "\\end{", "$$$", "\\includegraphics", "<img", "predownloaded_images",
]

# Real-valued tolerance / special-judge language: our judge is exact
# token-match only, so these are essentially unjudgeable and are hard-dropped.
FLOAT_SPECIAL_JUDGE_MARKERS = [
    "absolute or relative error", "relative or absolute error",
    "differs from the jury", "your answer is accepted if",
]


def is_interactive(ex) -> bool:
    tags = [t.lower() for t in ex["cf_tags"]]
    if any("interactive" in t for t in tags):
        return True
    desc = ex["description"].lower()
    if "flush" in desc and ("standard output" in desc or "cout" in desc or "stdout" in desc):
        return True
    return False


def is_dirty_statement(desc: str) -> bool:
    return any(m in desc for m in DIRTY_MARKERS)


def is_float_special_judge(desc: str) -> bool:
    low = desc.lower()
    return any(m in low for m in FLOAT_SPECIAL_JUDGE_MARKERS)


def has_multi_answer_language(desc: str) -> bool:
    """Soft signal (not a hard filter) surfaced to curate.py for scoring."""
    low = desc.lower()
    phrases = [
        "if there are multiple", "if there are several", "print any", "output any",
        "any of them", "any valid answer",
    ]
    return any(p in low for p in phrases)


def collect_tests(ex):
    """Merge public/private/generated tests, cap count + bytes.

    Strategy: keep ALL public (samples) + as many of the smallest
    private/generated tests as fit, plus up to 2 of the largest (for TLE
    checking), staying under MAX_TESTS_KEPT and MAX_TOTAL_TEST_BYTES.
    """
    public = list(zip(ex["public_tests"]["input"], ex["public_tests"]["output"]))
    hidden = list(zip(ex["private_tests"]["input"], ex["private_tests"]["output"]))
    hidden += list(zip(ex["generated_tests"]["input"], ex["generated_tests"]["output"]))

    # de-dupe identical inputs (generated_tests sometimes overlaps private_tests)
    seen = set()
    uniq_hidden = []
    for i, o in hidden:
        if i in seen:
            continue
        seen.add(i)
        uniq_hidden.append((i, o))

    def sz(pair):
        return len(pair[0]) + len(pair[1])

    uniq_hidden.sort(key=sz)

    # Top up displayed samples to MIN_DISPLAY_SAMPLES by borrowing the
    # smallest hidden tests when the statement only ships one official
    # example. These are tagged sample_source="supplementary".
    borrowed = []
    while len(public) + len(borrowed) < MIN_DISPLAY_SAMPLES and uniq_hidden:
        borrowed.append(uniq_hidden.pop(0))

    budget_count = MAX_TESTS_KEPT - len(public) - len(borrowed)
    if budget_count < 0:
        budget_count = 0

    largest = uniq_hidden[-2:] if len(uniq_hidden) > 2 else []
    smallest_budget = max(budget_count - len(largest), 0)
    smallest = uniq_hidden[:smallest_budget]

    chosen_hidden = smallest
    for pair in largest:
        if pair not in chosen_hidden:
            chosen_hidden.append(pair)

    total_bytes = (
        sum(sz(p) for p in public) + sum(sz(p) for p in borrowed) + sum(sz(p) for p in chosen_hidden)
    )
    # Trim largest-first if over budget (keep the cheap small tests, which
    # matter more for correctness coverage than the TLE-probe big ones).
    while total_bytes > MAX_TOTAL_TEST_BYTES and chosen_hidden:
        chosen_hidden.sort(key=sz)
        dropped = chosen_hidden.pop()
        total_bytes -= sz(dropped)

    samples = [{"input": i, "output": o, "sample_source": "official"} for i, o in public]
    samples += [{"input": i, "output": o, "sample_source": "supplementary"} for i, o in borrowed]
    tests = [{"input": i, "output": o, "is_sample": True} for i, o in public]
    tests += [{"input": i, "output": o, "is_sample": True} for i, o in borrowed]
    tests += [{"input": i, "output": o, "is_sample": False} for i, o in chosen_hidden]
    return samples, tests, total_bytes


def collect_solutions(ex):
    langs = ex["solutions"]["language"]
    codes = ex["solutions"]["solution"]
    py3, cpp, py2 = [], [], []
    for lang, code in zip(langs, codes):
        if lang == LANG_PYTHON3:
            py3.append(code)
        elif lang == LANG_CPP:
            cpp.append(code)
        elif lang == LANG_PYTHON:
            py2.append(code)
    return py3, cpp, py2


def main():
    from datasets import load_dataset

    candidates = []
    stats = {"seen": 0, "cf": 0, "dropped": {}}

    def drop(reason):
        stats["dropped"][reason] = stats["dropped"].get(reason, 0) + 1

    for split in SPLITS:
        ds = load_dataset("deepmind/code_contests", split=split, streaming=True)
        for ex in ds:
            stats["seen"] += 1
            if ex["source"] != SOURCE_CODEFORCES:
                continue
            stats["cf"] += 1

            rating = ex["cf_rating"]
            if not rating or rating < MIN_RATING or rating > MAX_RATING:
                drop("rating_out_of_range")
                continue

            tags = ex["cf_tags"]
            if not tags:
                drop("no_tags")
                continue

            if is_interactive(ex):
                drop("interactive")
                continue

            desc = ex["description"]
            if not desc or len(desc.strip()) < 50:
                drop("empty_statement")
                continue
            if is_dirty_statement(desc):
                drop("dirty_statement_markup")
                continue
            if is_float_special_judge(desc):
                drop("float_special_judge")
                continue

            if len(ex["public_tests"]["input"]) < MIN_PUBLIC_TESTS:
                drop("too_few_public_tests")
                continue
            n_hidden = len(ex["private_tests"]["input"]) + len(ex["generated_tests"]["input"])
            if n_hidden < MIN_PRIVATE_OR_GENERATED:
                drop("too_few_hidden_tests")
                continue

            py3, cpp, py2 = collect_solutions(ex)
            if not py3 and not cpp:
                drop("no_python3_or_cpp_solution")
                continue

            samples, tests, total_bytes = collect_tests(ex)
            if len(samples) < MIN_PUBLIC_TESTS:
                drop("sample_collection_shrank")
                continue
            n_official_samples = sum(1 for s in samples if s["sample_source"] == "official")

            tl = ex["time_limit"]["seconds"] * 1000 + ex["time_limit"]["nanos"] // 1_000_000
            if tl <= 0:
                tl = 2000
            mem_mb = int(ex["memory_limit_bytes"] / (1024 * 1024)) if ex["memory_limit_bytes"] else 256

            candidates.append({
                "external_id": f"{ex['cf_contest_id']}{ex['cf_index']}",
                "cf_contest_id": ex["cf_contest_id"],
                "cf_index": ex["cf_index"],
                "name": ex["name"],
                "statement_raw": desc,
                "tags": sorted(set(tags)),
                "rating": rating,
                "time_limit_ms": tl,
                "memory_limit_mb": mem_mb,
                "samples": samples,
                "tests": tests,
                "test_bytes": total_bytes,
                "solutions_python3": py3[:3],
                "solutions_cpp": cpp[:3],
                "multi_answer_language": has_multi_answer_language(desc),
                "n_official_samples": n_official_samples,
                "split": split,
            })

    OUT_PATH.write_text(json.dumps({"stats": stats, "candidates": candidates}, indent=1))
    print(f"seen={stats['seen']} cf={stats['cf']} kept={len(candidates)}")
    print("dropped:", json.dumps(stats["dropped"], indent=1))
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
