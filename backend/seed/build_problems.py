#!/usr/bin/env python3
"""
Pass 4 (assembly) — merge validated.json + hand-written data/editorials.json
into the final backend/seed/data/problems.json that seed.py upserts from.

Also does final text cleanup: strips stray "<image>" / image-placeholder
table artifacts left over from the source statements (the dataset has no
actual image assets, and ~10 of the 51 statements reference a now-missing
illustration -- in every case the note/statement text is fully
self-contained without it, see REPORT.md).

Usage:
    backend/seed/.venv/bin/python backend/seed/build_problems.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
VALIDATED_PATH = DATA_DIR / "validated.json"
EDITORIALS_PATH = DATA_DIR / "editorials.json"
OUT_PATH = DATA_DIR / "problems.json"

# Matches a lone "<image>" placeholder, optionally paired as a little
# markdown table ("<image>| <image>\n---|---\n<caption>") the dataset
# sometimes emits for what used to be a side-by-side image comparison.
IMAGE_TABLE_RE = re.compile(r"<image>\s*\|\s*<image>\s*\n-+\|-+\s*\n[^\n]*\n?")
IMAGE_TOKEN_RE = re.compile(r"[ \t]*<image>[ \t]*\n?")


def clean_statement(md: str) -> str:
    md = IMAGE_TABLE_RE.sub("", md)
    md = IMAGE_TOKEN_RE.sub("", md)
    # collapse resulting multi-blank-lines
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def main():
    validated = json.loads(VALIDATED_PATH.read_text())
    editorials = json.loads(EDITORIALS_PATH.read_text())

    missing = [p["external_id"] for p in validated if p["external_id"] not in editorials]
    if missing:
        raise SystemExit(f"missing editorials for: {missing}")

    problems = []
    for p in validated:
        tests = [
            {"input": t["input"], "expected": t["output"], "is_sample": t["is_sample"]}
            for t in p["tests"]
        ]
        problems.append({
            "external_id": p["external_id"],
            "source": p["source"],
            "title": p["title"],
            "statement_md": clean_statement(p["statement_md"]),
            "tags": p["tags"],
            "rating": p["rating"],
            "time_limit_ms": p["time_limit_ms"],
            "memory_limit_mb": p["memory_limit_mb"],
            "editorial_md": editorials[p["external_id"]],
            "samples": [{"input": s["input"], "output": s["output"]} for s in p["samples"]],
            "tests": tests,
        })

    problems.sort(key=lambda p: (p["rating"], p["external_id"]))
    OUT_PATH.write_text(json.dumps(problems, indent=1))
    print(f"wrote {len(problems)} problems -> {OUT_PATH}")


if __name__ == "__main__":
    main()
