# Seed data report — CP problem set

Source: [`deepmind/code_contests`](https://huggingface.co/datasets/deepmind/code_contests) (CC BY 4.0), `test` + `valid` splits (both are pure Codeforces, curated by the dataset authors — smaller and cleaner than `train`, per the mission notes, and turned out to be sufficient in volume: 282 CF-source rows total between the two).

Final result: **51 problems** seeded, ratings 800–2200, `backend/seed/data/problems.json`.

## Pipeline

1. `ingest.py` — streams `test`+`valid` (source==CODEFORCES only), hard-filters: rating 800–2200, non-interactive, no raw LaTeX/image markup, no float-tolerance "special judge" language, ≥1 official sample (+ auto-borrows a small hidden test as a 2nd displayed sample when the statement only ships one), ≥5 hidden tests, ≥1 Python3/C++ reference solution, tests capped at ≤20 (all samples + smallest hidden tests + 2 largest for TLE probing) and <2MB payload. 282 seen → **177 candidates**.
2. `curate.py` — scores candidates (statement length sweet spot, single clear core tag, sample count, solution availability) and picks a balanced **56** via round-robin allocation across (canonical primary-tag × rating-band) cells, reserving ~25% for the "constructive/ad-hoc" (non-classical) bucket. Also normalizes titles (title-case, strips the `1575_A.` CF prefix) and canonicalizes tags (e.g. `dfs and similar` → `dfs/bfs`).
3. `core.py` (`backend/app/judge/core.py`) — real sandboxed runner: `execute(language, code, stdin, time_limit_ms, memory_limit_mb)`, subprocess + `resource.setrlimit` (RLIMIT_AS = mem+64MB, RLIMIT_CPU), wall timeout `time_limit_ms × mult` (python 3x, cpp 1x), process-group kill on timeout, cpp compiled once and cached by source hash. Plus `compare_output` (token-wise) and `verdict_for` (AC/WA/TLE/RE/CE) pure helpers, and a `compile_cpp` wrapper Agent E added on top for their parallel submit path.
4. `validate.py` — runs a real reference solution (prefer python3, else cpp) from the dataset through `core.py` against every kept test. **56 → 51 passed** (5 dropped, see below). No problem needed test-trimming (0 `pass_trimmed`).
5. Editorials — hand-written by me for all 51 survivors, reading the actual reference solution for each (structure: **Key insight → Approach → Complexity → Common pitfalls**), stored in `data/editorials.json`.
6. `build_problems.py` — merges `validated.json` + `editorials.json` into `data/problems.json`, and strips ~10 leftover `<image>` placeholder artifacts from statements (the dataset's original illustrations aren't included; in every case the surrounding text is self-contained without them — verified by hand).
7. `seed.py` — idempotent raw-SQL (`psycopg`, no `app.*` import) upsert into `problems`/`testcases` by `external_id`; re-running replaces testcases and updates the problem row in place rather than duplicating. Verified: ran twice, count stayed at 51 problems / 995 testcases both times.
8. QA sweep — read 10 random problems end-to-end (statement ↔ editorial ↔ tags); all coherent, no fixes needed.

## Coverage: tag × rating band (51 problems; a problem can carry multiple tags, so columns sum to more than 51)

| tag | 800-1000 | 1100-1300 | 1400-1600 | 1700-1900 | 2000-2200 | total |
|---|---|---|---|---|---|---|
| math | 8 | 7 | 2 | 3 | 3 | 23 |
| greedy | 5 | 6 | 3 | 1 | 3 | 18 |
| constructive | 3 | 4 | 1 | 5 | 3 | 16 |
| implementation | 4 | 2 | 2 | 2 | 0 | 10 |
| brute force | 1 | 4 | 1 | 1 | 2 | 9 |
| sortings | 2 | 2 | 1 | 2 | 1 | 8 |
| data structures | 1 | 2 | 1 | 2 | 2 | 8 |
| combinatorics | 1 | 1 | 1 | 1 | 1 | 5 |
| binary search | 1 | 1 | 2 | 0 | 0 | 4 |
| strings | 1 | 3 | 0 | 0 | 0 | 4 |
| dsu | 1 | 0 | 1 | 1 | 0 | 3 |
| bitmasks | 1 | 1 | 1 | 0 | 0 | 3 |
| two pointers | 0 | 1 | 1 | 0 | 1 | 3 |
| number theory | 1 | 1 | 0 | 0 | 0 | 2 |
| geometry | 1 | 0 | 0 | 1 | 0 | 2 |
| dp | 1 | 1 | 0 | 0 | 0 | 2 |
| dfs/bfs | 0 | 1 | 1 | 0 | 0 | 2 |
| graphs | 0 | 1 | 1 | 0 | 0 | 2 |
| trees | 0 | 1 | 0 | 0 | 1 | 2 |
| probabilities | 0 | 0 | 0 | 0 | 1 | 1 |
| ternary search | 0 | 0 | 0 | 0 | 1 | 1 |
| divide and conquer | 0 | 0 | 0 | 0 | 1 | 1 |

Non-classical (constructive/games, "figure it out" flavor rather than a named technique): **10/51 ≈ 20%** by primary tag — close to the ~25% target; a couple of constructive candidates were lost specifically in the validation drop (below), pulling it down slightly from the pre-validation 23%.

By rating band: 800-1000: **14**, 1100-1300: **14**, 1400-1600: **7**, 1700-1900: **8**, 2000-2200: **8**. Skews toward the easier half of the range — the raw CF `test`+`valid` pool itself has more sub-1300 problems passing the "clean statement / exact-match-judge-friendly" filters than 2000+ ones (harder problems more often lean on special judges / multi-answer wording, see below).

## Validation

Reference-solution-through-`core.py` pass rate: **51/56 = 91%** of the curated shortlist (100% of what shipped, by construction — anything that failed was dropped, not fixed-and-kept). 5 dropped:

| id | title | rating | reason |
|---|---|---|---|
| 1574A | Regular Bracket Sequences | 800 | every reference solution (3 py3 + 3 cpp) got WA on hidden tests |
| 1557B | Moamen and K-subarrays | 1100 | same |
| 1553D | Backspace | 1500 | same |
| 1582D | Vupsen, Pupsen and 0 | 1600 | same |
| 1551D2 | Domino (Hard Version) | 2100 | same |

In all 5 cases *every* provided reference solution (not just one) failed our exact-match judge on the dataset's own hidden tests — the strong signal is these are "print any valid answer" / special-judge problems where the dataset's stored `output` field is just one arbitrary correct answer, and even the dataset's own correct solutions produce a different (also valid) answer. Two of the five were pre-flagged by an ingest-time heuristic (`multi_answer_language`); the other three weren't caught by the keyword filter but show the identical failure signature.

**Known limitation (not just for the dropped 5):** our judge (`core.py`/`verdict_for`) is exact token-match only, no per-problem checker. 45/177 ingested candidates matched multi-answer language ("print any", "if there are multiple", etc.) — `curate.py` soft-penalizes these in scoring but doesn't hard-exclude them (they're disproportionately the "constructive" problems the mission wants a deliberate minority of). The 51 that shipped all validated cleanly against their *own* reference solution's output, but a user submitting a differently-shaped-but-equally-correct solution to one of the ~16 constructive-tagged problems could in principle get an unfair WA from the live judge. Flagging this for Agent E: if there's appetite later, a per-problem "checker" concept would close this gap, but it's out of scope for this pass.

## Files

- Scripts: `backend/seed/ingest.py`, `backend/seed/curate.py`, `backend/seed/validate.py`, `backend/seed/build_problems.py`, `backend/seed/seed.py`
- Judge core: `backend/app/judge/core.py` (Agent E extended it with a `compile_cpp` wrapper on top — additive, not modified by me after)
- Data (all in `backend/seed/data/`): `candidates.json` (177), `curated.json` (56), `validated.json` (51), `editorials.json` (51 hand-written), `validation_report.json`, `problems.json` (final, 51 — this is what `seed.py` reads)
- Own venv: `backend/seed/.venv` (datasets, zstandard, huggingface_hub, pyarrow, psycopg[binary]) — kept separate from `backend/.venv` per instructions to avoid colliding with Agent A/E's work; `backend/.venv` already had `psycopg` too so `seed.py` runs fine from either.

## `seed.py` usage

```
backend/seed/.venv/bin/python backend/seed/seed.py
# or, with a custom DB:
DATABASE_URL=postgresql://user:pass@host:port/db backend/seed/.venv/bin/python backend/seed/seed.py
```

Idempotent — upserts `problems` by `external_id`, fully replaces that problem's `testcases` (delete+reinsert) each run. Verified by running twice: 51 problems / 995 testcases both times, no duplicates. Default `DATABASE_URL` matches CONTRACTS.md (`postgresql://trainer:trainer@localhost:5433/trainer`, `+psycopg` suffix stripped if present). `make seed` (Agent A's Makefile) should just invoke this.

## Rerunning the full pipeline

```
cd backend/seed
.venv/bin/python ingest.py
.venv/bin/python curate.py
.venv/bin/python validate.py
.venv/bin/python build_problems.py
.venv/bin/python seed.py
```

Each step is independently rerunnable; `ingest.py`/`curate.py`/`validate.py` are the slow ones (network + subprocess judging, ~1-2 min each), `build_problems.py`/`seed.py` are near-instant.

## Deviations / gotchas for other agents

- **`samples` can include one "supplementary" test.** ~69% of CF problems in this dataset ship only one official worked example (`public_tests` has length 1), not the >=2 the mission specced — requiring 2 official samples would have dropped ~70% of the pool. `ingest.py` tops up to 2 *displayed* samples by borrowing the smallest hidden test when needed; that borrowed one isn't narrated in the statement text ("in the first example...") the way the official one is, it's just a second valid input/output pair. Noted here in case the frontend ever wants to visually distinguish them (currently it can't — `samples` in the DB schema is just `[{input, output}]`, no source tag).
- **`core.py`'s `execute()` signature differs from what my task brief described** (`run_one(cmd, stdin, ...)`) — by the time I got to writing it, Agent A/E had already scaffolded `backend/app/judge/core.py` and `service.py` with a concrete stub interface (`execute(language, code, stdin, time_limit_ms, memory_limit_mb) -> ExecResult`) that `service.py` already calls. I implemented against *that* real interface instead of my brief's paraphrase, since it's what's actually wired up; extended `ExecResult` with `stderr`/`compile_ok`/`compile_error` (additive, `service.py`'s stub didn't destructure the old 4-field version so nothing broke) and added `compare_output`/`verdict_for` as pure helpers for AC/WA/TLE/RE/CE. Agent E has since added a `compile_cpp` wrapper on top, consistent with "extend, don't rewrite."
- **Judge validated on this machine's `g++`/`python3`** — same runner `core.py` will use in production, so no separate assumptions.
