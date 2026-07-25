#!/usr/bin/env python3
"""
Pass 2 — curate. Score candidates.json for educational value, normalize
metadata, and select a final balanced set of 40-80 problems.

Selection strategy: assign each candidate a single canonical "primary tag"
(the concept it best teaches), bucket rating into 5 CF-style bands, and
round-robin allocate across (primary_tag x band) cells -- classical
technique tags first, then top up with a reserved ~25% quota of
constructive/ad-hoc problems -- picking the highest-scoring candidate per
cell. This gives broad tag x rating coverage instead of clumping on
whichever tag happens to be most frequent in the raw pool.

Usage:
    backend/seed/.venv/bin/python backend/seed/curate.py
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
IN_PATH = DATA_DIR / "candidates.json"
OUT_PATH = DATA_DIR / "curated.json"

TARGET_TOTAL = 56
NON_CLASSICAL_QUOTA_FRACTION = 0.25

# Canonical tag set (dedupe raw cf_tags synonyms/variants into this).
TAG_CANON = {
    "implementation": "implementation",
    "greedy": "greedy",
    "math": "math",
    "binary search": "binary search",
    "two pointers": "two pointers",
    "sortings": "sortings",
    "dp": "dp",
    "dynamic programming": "dp",
    "graphs": "graphs",
    "dfs and similar": "dfs/bfs",
    "trees": "trees",
    "strings": "strings",
    "number theory": "number theory",
    "data structures": "data structures",
    "constructive algorithms": "constructive",
    "brute force": "brute force",
    "bitmasks": "bitmasks",
    "dsu": "dsu",
    "combinatorics": "combinatorics",
    "geometry": "geometry",
    "divide and conquer": "divide and conquer",
    "hashing": "hashing",
    "fft": "fft",
    "shortest paths": "shortest paths",
    "probabilities": "probabilities",
    "graph matchings": "graph matchings",
    "games": "games",
    "ternary search": "ternary search",
    "flows": "flows",
    "matrices": "matrices",
    "string suffix structures": "strings",
    "meet-in-the-middle": "brute force",
}

# Priority order for picking a single "primary" (core-idea) tag out of a
# problem's canonical tag set -- earlier = more likely to be the defining
# technique a student should walk away having practiced.
PRIMARY_PRIORITY = [
    # unambiguous specific-algorithm tags: whichever of these appears, it's
    # almost always THE technique being taught.
    "dp", "graphs", "trees", "dsu", "shortest paths", "flows", "graph matchings",
    "binary search", "two pointers", "ternary search", "divide and conquer",
    "data structures", "hashing", "strings", "number theory", "fft",
    "geometry", "matrices", "bitmasks", "dfs/bfs", "sortings",
    # ad-hoc / no-fixed-algorithm flavor -- outranks the generic catch-alls
    # below so a [constructive, math] problem reads as "constructive", not
    # "math". This is what feeds the non-classical quota.
    "constructive", "games",
    # generic catch-alls: only chosen as primary if nothing more specific
    # is tagged.
    "combinatorics", "probabilities", "greedy", "math",
    "brute force", "implementation",
]

NON_CLASSICAL_TAGS = {"constructive", "games"}

RATING_BANDS = [(800, 1000), (1100, 1300), (1400, 1600), (1700, 1900), (2000, 2200)]


def band_of(rating: int):
    for lo, hi in RATING_BANDS:
        if lo <= rating <= hi:
            return (lo, hi)
    return RATING_BANDS[-1]


def canonical_tags(raw_tags):
    out = []
    for t in raw_tags:
        c = TAG_CANON.get(t.lower())
        if c and c not in out:
            out.append(c)
    return out


def primary_tag(canon_tags):
    for p in PRIMARY_PRIORITY:
        if p in canon_tags:
            return p
    return canon_tags[0] if canon_tags else "misc"


def title_case(name: str) -> str:
    """CF names look like '1575_A. Another Sorting Problem'. Strip the
    contest/index prefix, keep clean human title-case."""
    name = re.sub(r"^\d+_?[A-Z][0-9]?\.\s*", "", name).strip()
    name = re.sub(r"^[A-Z][0-9]?\.\s*", "", name).strip()
    small = {"a", "an", "the", "of", "in", "on", "and", "or", "to", "for", "vs", "with", "at", "by"}
    words = name.split(" ")
    out = []
    for i, w in enumerate(words):
        if not w:
            continue
        core = w
        lower = core.lower()
        if i != 0 and lower in small:
            out.append(lower)
        elif re.sub(r"[^A-Za-z]", "", core).isupper() and len(re.sub(r"[^A-Za-z]", "", core)) > 1:
            out.append(core)  # acronym, e.g. "XOR" or "(XOR)"
        else:
            # capitalize the first *letter*, preserving any leading
            # punctuation like "(easy" -> "(Easy"
            m = re.search(r"[A-Za-z]", core)
            if m:
                idx = m.start()
                core = core[:idx] + core[idx].upper() + core[idx + 1:]
            out.append(core)
    return " ".join(out).strip()


def score(cand) -> float:
    s = 0.0
    desc = cand["statement_raw"]
    n = len(desc)
    # Prefer a focused, readable statement: sweet spot ~400-1800 chars.
    if 400 <= n <= 1800:
        s += 3
    elif 200 <= n <= 2600:
        s += 1.5
    else:
        s -= 1.5

    canon = canonical_tags(cand["tags"])
    # Single clear core idea: fewer canonical tags is better.
    if len(canon) == 1:
        s += 3
    elif len(canon) == 2:
        s += 1.5
    elif len(canon) >= 4:
        s -= 2

    # Exact-match judge friendliness: penalize "print any valid answer"
    # style statements (soft signal, not a hard filter -- flagged for
    # awareness in the report, not banned outright since it correlates
    # heavily with the constructive-algorithms tag we deliberately want).
    if cand["multi_answer_language"]:
        s -= 1.5

    # More official (statement-explained) samples = friendlier intro.
    s += min(cand["n_official_samples"], 2) * 0.5

    # A python3 reference (used for validation later) is nicer than cpp-only.
    if cand["solutions_python3"]:
        s += 1
    if len(cand["solutions_python3"]) >= 2:
        s += 0.5  # more than one correct solution -> likely non-degenerate

    # Mild bonus for having a healthy hidden-test count (real coverage).
    n_hidden = sum(1 for t in cand["tests"] if not t["is_sample"])
    if n_hidden >= 5:
        s += 0.5

    return s


def normalize(cand, canon_tags):
    return {
        "external_id": cand["external_id"],
        "source": "codeforces",
        "title": title_case(cand["name"]),
        "statement_md": cand["statement_raw"].strip(),
        "tags": canon_tags,
        "primary_tag": primary_tag(canon_tags),
        "rating": cand["rating"],
        "time_limit_ms": cand["time_limit_ms"] or 2000,
        "memory_limit_mb": cand["memory_limit_mb"] or 256,
        "samples": [{"input": s["input"], "output": s["output"]} for s in cand["samples"]],
        "tests": cand["tests"],
        "solutions_python3": cand["solutions_python3"],
        "solutions_cpp": cand["solutions_cpp"],
        "multi_answer_language": cand["multi_answer_language"],
        "score": round(score(cand), 2),
    }


def main():
    raw = json.loads(IN_PATH.read_text())
    candidates = raw["candidates"]

    normalized = []
    seen_ids = set()
    for c in candidates:
        if c["external_id"] in seen_ids:
            continue
        seen_ids.add(c["external_id"])
        canon = canonical_tags(c["tags"])
        if not canon:
            continue
        normalized.append(normalize(c, canon))

    # Bucket by (primary_tag, band)
    cells = defaultdict(list)
    for p in normalized:
        cells[(p["primary_tag"], band_of(p["rating"]))].append(p)
    for k in cells:
        cells[k].sort(key=lambda x: -x["score"])

    classical_tags = sorted({t for t in PRIMARY_PRIORITY if t not in NON_CLASSICAL_TAGS})
    non_classical_tags = sorted(NON_CLASSICAL_TAGS)

    selected = []
    selected_ids = set()

    def try_take_from(tag_list, limit):
        nonlocal selected
        # True round-robin: each pass gives EVERY tag at most one pick
        # (cycling which rating band it draws from, so repeat passes
        # spread across bands too) before moving on. This is what keeps
        # e.g. alphabetically-late tags (sortings, strings, two pointers)
        # from being starved by an early-return that fills the quota out
        # of the first few tags alone.
        band_ptr = {tag: 0 for tag in tag_list}
        progress = True
        while len(selected) < limit and progress:
            progress = False
            for tag in tag_list:
                picked = False
                for offset in range(len(RATING_BANDS)):
                    bi = (band_ptr[tag] + offset) % len(RATING_BANDS)
                    band = RATING_BANDS[bi]
                    lst = cells.get((tag, band), [])
                    for cand in lst:
                        if cand["external_id"] in selected_ids:
                            continue
                        selected.append(cand)
                        selected_ids.add(cand["external_id"])
                        band_ptr[tag] = (bi + 1) % len(RATING_BANDS)
                        picked = True
                        progress = True
                        break
                    if picked:
                        break
                if len(selected) >= limit:
                    return

    non_classical_target = round(TARGET_TOTAL * NON_CLASSICAL_QUOTA_FRACTION)
    try_take_from(non_classical_tags, non_classical_target)
    try_take_from(classical_tags, TARGET_TOTAL)
    # If still short (sparse cells), allow a second lap taking 2nd-best per
    # cell across all tags by score until target or pool exhausted.
    if len(selected) < TARGET_TOTAL:
        remaining = sorted(
            [p for p in normalized if p["external_id"] not in selected_ids],
            key=lambda x: -x["score"],
        )
        for p in remaining:
            if len(selected) >= TARGET_TOTAL:
                break
            selected.append(p)
            selected_ids.add(p["external_id"])

    selected.sort(key=lambda x: (x["rating"], x["primary_tag"]))

    coverage = defaultdict(lambda: defaultdict(int))
    for p in selected:
        coverage[p["primary_tag"]][band_of(p["rating"])] += 1

    OUT_PATH.write_text(json.dumps(selected, indent=1))

    print(f"selected {len(selected)} problems")
    n_noncl = sum(1 for p in selected if p["primary_tag"] in NON_CLASSICAL_TAGS)
    print(f"non-classical fraction: {n_noncl}/{len(selected)} = {n_noncl/len(selected):.2f}")
    print("coverage by primary_tag:")
    for tag in sorted(coverage):
        bands = coverage[tag]
        print(f"  {tag:16s} " + " ".join(f"{lo}-{hi}:{bands.get((lo,hi),0)}" for lo, hi in RATING_BANDS))
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
