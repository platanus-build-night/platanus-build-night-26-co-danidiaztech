# CONTRACTS.md — Build Contract (all agents MUST conform)

Product: **CP + Interview AI trainer** — capture how a user solves (code edits + voice), judge locally, analyze cognition with Claude, recommend next problems heuristically.

## Stack & layout
- `backend/` — FastAPI (Python 3.12), SQLAlchemy 2 (create_all, no alembic), psycopg, `anthropic`. `requirements.txt` + venv at `backend/.venv`.
- `frontend/` — Vite + React 18 + TypeScript + Tailwind. React Router. `@monaco-editor/react`, `@excalidraw/excalidraw` (vite.config: `define: {"process.env.IS_PREACT": JSON.stringify("true")}`).
- `docker-compose.yml` — `postgres:16`, port 5433 (avoid clashes), db/user/pass = `trainer`.
- Env: `backend/.env` → `DATABASE_URL=postgresql+psycopg://trainer:trainer@localhost:5433/trainer`, `ANTHROPIC_API_KEY` (optional → **mock mode**), `ANTHROPIC_MODEL=claude-opus-4-8`.
- Dev: `make dev` runs both; backend :8000, frontend :5173 (proxy `/api` → :8000).
- English UI. Minimalist/clean/modern. Light + dark themes via CSS variables on `:root[data-theme]`; toggle in header; both themes must look intentional.

## Ownership (no cross-edits)
- Agent A: repo skeleton, docker-compose, backend app shell, frontend shell, `frontend/src/components/ui/*`, Makefile. Removes leftover Next.js files (`package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `lib/`, `.env.local.example` at root).
- Agent B: `backend/seed/*`, `backend/app/judge/core.py` (pure runner used by seed validation).
- Agent C: `frontend/src/pages/solve/*`, capture hooks.
- Agent D: `frontend/src/pages/review/*`.
- Agent E: `backend/app/judge/*` (except core.py: extend, don't rewrite), `backend/app/engine/*`, `backend/app/features/*`.
- Agent F: `backend/app/analysis/*`.
- Agent G: integration anywhere, minimal diffs.
- Nobody touches `platanus-buildnight-ideas/`, `README.md`, `build-night-project.json`, `project-logo.png`. No git commits — orchestrator commits.

## DB schema (SQLAlchemy models in `backend/app/models.py`)
- `problems(id pk, external_id unique, source, title, statement_md text, tags jsonb, rating int, time_limit_ms int, memory_limit_mb int, editorial_md text, samples jsonb)`  // samples: [{input, output}]
- `testcases(id pk, problem_id fk, input text, expected text, is_sample bool)`
- `sessions(id pk, problem_id fk, language, started_at, ended_at nullable, status: active|finished)`
- `events(id pk, session_id fk, t_ms int, kind, payload jsonb)`  // kind ∈ code_snap{code} | transcript{text} | draw_snap{scene} | note_snap{text} | run{verdict...} | submit{submission_id}
- `submissions(id pk, session_id nullable fk, problem_id fk, language, code text, verdict, time_ms, per_test jsonb, created_at)`
- `analyses(id pk, session_id fk unique, features jsonb, result jsonb, created_at)`
- `profile(id pk=1, data jsonb)`  // rolling skill profile
- `settings(id pk=1, data jsonb)`  // {provider: "api"|"plan"|"mock", api_key?, oauth_token?, model} — plaintext in local DB is acceptable (single-user, no-auth app); never returned in full by GET (mask credentials: show last 4 chars)

## API (FastAPI, all under /api)
- `GET /problems?tag=&min_rating=&max_rating=&q=` → list (id, title, tags, rating, solved:boolean)
- `GET /problems/{id}` → full incl. samples + editorial_md
- `GET /recommendations` → `[{problem, score, why: string[]}]` top 3, deterministic (see engine spec)
- `POST /sessions {problem_id, language}` → `{id}` · `POST /sessions/{id}/events {events:[...]}` batch · `POST /sessions/{id}/finish`
- `GET /sessions` list · `GET /sessions/{id}` incl. events
- `POST /run {problem_id, language, code}` → sample-test results `[{verdict, time_ms, stdout, expected}]`
- `POST /submit {problem_id, language, code, session_id?}` → `{verdict, per_test, time_ms}`
- `POST /sessions/{id}/analyze` → Analysis JSON (below); persists; recomputes profile
- `GET /profile` → mastery per tag + trends
- `GET /settings` → {provider, model, api_key_masked, oauth_token_masked, status} · `PUT /settings` {provider, api_key?, oauth_token?, model} · `POST /settings/test` → live connection check for the selected provider, returns {ok, provider, model, error?}

## Analysis JSON (Claude structured output; THE product)
```json
{
  "summary": "1-2 sentences",
  "phases": [{"label":"reading|thinking|coding|debugging|stuck","startSec":0,"endSec":90,"note":""}],
  "markers": [{"kind":"aha|hesitation|wrong-turn","atSec":392,"quote":"","note":""}],
  "ahaMomentSec": 392, "firstCorrectCodeSec": 485, "ahaGapSeconds": 93,
  "bottleneck": "the ONE trainable weakness, specific",
  "strengths": ["..."],
  "drills": [{"title":"","why":""}],
  "editorialGap": {"missedInsight":"","fasterPath":"","profileAdvice":""}
}
```
AI rules: deterministic feature extraction FIRST (features jsonb), ≤2 Claude calls per analysis (analysis + editorial gap; merge into 1 if clean), context = features + compressed transcript + editorial + rolling profile (never raw full history). Mock mode returns a realistic canned Analysis.

## Provider abstraction (`backend/app/analysis/provider.py`) — settings-driven, NOT env-driven
- Credentials/provider come from the `settings` DB row (set via the Settings UI), read at call time. `.env` may hold nothing AI-related.
- Providers, all producing IDENTICAL Analysis JSON:
  - `api` — `anthropic` SDK Messages API with structured outputs (json_schema) using settings.api_key.
  - `plan` — Python `claude-agent-sdk` `query()` authenticated with settings.oauth_token (set as CLAUDE_CODE_OAUTH_TOKEN for the call subprocess env ONLY, and ensure ANTHROPIC_API_KEY is absent in that env — it silently wins otherwise). Prompt demands JSON-only output.
  - `mock` — realistic canned Analysis (also the automatic fallback when settings are empty/invalid, surfaced to the UI as status).
- **Parity guarantee:** ONE shared prompt builder + ONE pydantic `Analysis` validator used by both real paths; `plan` path parses/validates and retries once on schema failure. Identical temperature/model parameters where the transport allows. A provider label is stored inside analyses.features for traceability, never in the result shape.
- Frontend: `/settings` page (route + nav entry): provider radio (API key / Claude Plan / Mock), masked credential inputs, model select (claude-opus-4-8 default), "Test connection" button hitting POST /settings/test, short helper text for each option (incl. one-liner: get a plan token via `claude setup-token`). Owned by Agent G.

## Judge spec (`backend/app/judge/`)
- Languages: **python** (`python3`), **cpp** (`g++ -O2 -std=c++17`, compile once per submission).
- Per test: `subprocess` w/ `timeout=time_limit_ms*mult` (py mult 3x), `resource.setrlimit` RLIMIT_AS = memory_limit_mb (+64MB slack), RLIMIT_CPU. Kill process group on timeout.
- Verdicts: AC | WA | TLE | RE | CE. Compare token-wise (whitespace-insensitive, trailing-newline-insensitive).
- **Fast**: run tests in parallel (ProcessPoolExecutor, min(4, cpu)); stop early on first non-AC for submit (still report per-test list so far).

## Rec engine spec (`backend/app/engine/`) — deterministic, ZERO AI
- Per-tag mastery in profile.data: EWMA over outcomes; solve weight scales w/ problem rating vs user est; attempts/time penalties.
- Score(problem) = 0.4*weakness(tag overlap) + 0.35*ratingFit(target = est+150±150) + 0.15*staleness(topic not seen recently) + 0.1*diversity(≠ last topics). Exclude solved.
- Output top-3 with human-readable `why` chips (e.g. "dp mastery 54%", "rating 1400 fits your 1250+150 target").

## Feature extractor spec (`backend/app/features/`) — deterministic
From events: typing bursts, idle gaps >20s (count+where), churn (chars added/deleted per min), first-code time, run/submit outcomes timeline, transcript keyword timestamps ("wait","actually","what if","binary search",...), WPM, draw/notes activity windows.

## Frontend contracts
- `frontend/src/lib/types.ts` mirrors API JSON; `frontend/src/lib/api.ts` typed fetch client. Pages: `/` dashboard · `/solve/:problemId` · `/review/:sessionId`.
- Solve (wireframe 1): left statement panel; right toggle **Code (Monaco) ⇄ Draw+Notes (Excalidraw + notes textarea)**; bottom bar: mic toggle w/ live transcript chip ("mic encouraged" nudge when off), Run (samples), Submit, Finish→review. Recorder: code_snap throttled (≥1.5s since last edit OR every 2s while typing), transcript segs w/ tMs, draw/note snaps throttled 3s, batch-POST events every 5s + on finish (also localStorage backup).
- Review (wireframe 2): left summary card (problem, verdict, duration, Aha-Gap headline stat, bottleneck card, strengths, drills, editorial + editorialGap sections — structured, NOT a chat blob). Right: **timeframe player** — code pane reconstructing snapshot ≤ t; transcript strip highlighting active line; bottom timeline bar = phase colors + markers; controls play/pause/±5s/speed 1-4x + **smart-skip mode** (jump event→event, elide dead air); scrubbable; keyboard space/←/→.
- Playwright self-check (C, D, G): with dev servers up, `npx playwright screenshot` your pages (both themes), look at the PNGs, fix glaring issues, iterate ≥1 round. Save shots to `frontend/.screenshots/` (gitignored).

## Quality bar
DRY, typed end-to-end, no dead code, no TODO litter. Empty/loading/error states on every screen. If a spec detail is ambiguous: choose the simplest option consistent with this file and note it in your report.
