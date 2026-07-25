# WatchMeCode

**Codeforces grades your answer. WatchMeCode grades your thinking.**

<img src="./project-logo.png" alt="WatchMeCode" width="160" />

Every competitive programming site judges the same thing: whether your final code
passes. None of them look at *how you got there* — and that's where the improvement
actually lives.

WatchMeCode records a solve session (code, voice, sketches, verdicts — all timestamped),
replays it as a **cognitive timeline**, and has Claude read that tape to name the one
specific thing holding you back.

Built solo at **Platanus Build Night — Bogotá @ Buk** by
Daniel Libardo Diaz Gonzalez ([@danidiaztech](https://github.com/danidiaztech)).

---

## What it does

**1 · Commit before you look.** Choose a problem and decide whether to record your voice.
The statement, samples and **tags** stay on the server until you commit — deleting a DOM
overlay reveals nothing, because nothing has been sent. The clock starts at the reveal,
not at page load.

**2 · Solve out loud.** Monaco editor (Python / C++), an Excalidraw sketch pad, notes, and
a custom-test scratchpad that shows **stderr and the exit code** — the things the judge
path hides but you actually need while debugging. Everything is captured as a timestamped
event stream.

**3 · Watch the replay.** The session becomes a scrubbable player: code reconstructed at
every moment, your transcript scrolling alongside, and a phase-coloured timeline with
aha / hesitation / wrong-turn markers. **Smart-skip** collapses dead air — an 8-minute
session replays in ~35 seconds.

**4 · Read the diagnosis.** Claude produces a structured analysis: one falsifiable
bottleneck, evidence-cited strengths, targeted drills, and a comparison against the
editorial — never a chat blob, never "practice more".

### The Aha-Gap

The headline metric: seconds between **your insight landing** (quoted verbatim from your
own transcript) and **correct code existing**. Strong solvers think long and implement
fast, so a long silence followed by a clean first implementation is *the work*, not wasted
time — the analysis is explicitly built to read it that way, and to return an honest
`null` rather than invent an insight when there's no transcript to prove one.

---

## What's deterministic vs. AI

Deliberately, **Claude is used in exactly one place**: reading the session tape. Everything
else is plain, auditable code.

| Component | How it works |
|---|---|
| **Problem set** | 51 real Codeforces problems from DeepMind's [CodeContests](https://huggingface.co/datasets/deepmind/code_contests) (CC BY 4.0). A 5-pass pipeline filters → curates for balanced tag/rating coverage → **validates every problem by running a known-correct solution through our own judge** (5 dropped where even the dataset's own reference solutions disagreed) → writes structured editorials → QA sweep. |
| **Judge** | Local sandboxed runner. `python3` and `g++ -O2 -std=c++17`, per-problem time/memory limits via `resource.setrlimit`, process-group kill on timeout, tests run in parallel. An 8-test Python submit returns in ~110 ms. No external judge, no API key. |
| **Recommendations** | Deterministic scoring — `0.40 × topic weakness + 0.35 × rating fit + 0.15 × staleness + 0.10 × diversity` over a rolling per-topic mastery profile. Every pick shows its reasons ("dp mastery 54%", "rating 1400 fits your 1250+150 target"). **Zero AI.** |
| **Session features** | Idle spans, typing bursts, churn, rewrite/discard detection, run/submit timeline — all computed in code and handed to the model as evidence. |
| **Analysis** | The one Claude call (≤2 per session, ≈$0.05). |

---

## Quick start

**Requirements:** Docker, Python 3.12, Node 22, `g++`.

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# 3. Problems (idempotent — safe to re-run)
backend/seed/.venv/bin/python backend/seed/seed.py

# 4. Frontend
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**. `make dev` runs backend and frontend together.

### Connecting Claude

Open **Settings** in the app and pick one:

- **API key** — paste an Anthropic key. Billed per call.
- **Claude Plan** — run `claude setup-token` and paste the token; draws on your Pro/Max
  subscription's Agent SDK credit instead of per-token billing.
- **Mock** — no credentials, returns a realistic canned analysis. The app is fully usable
  without any AI configured.

Both real providers share one prompt builder and one validator, so their output is
identical in shape and quality. "Test connection" verifies before you rely on it.

### Recording your voice

Voice capture uses the browser's Web Speech API. **Use Chrome or Edge.** Brave ships the
API but [deliberately disables the backend behind it](https://github.com/brave/brave-browser/issues/2802),
so it always fails — the app detects Brave and says so before the clock starts rather than
recording silence. Sessions without voice still analyse fine; the coach falls back to
code-evolution forensics.

---

## Tech

React 18 · Vite · TypeScript · Tailwind v4 · Monaco · Excalidraw
FastAPI · SQLAlchemy 2 · Postgres 16 · Anthropic SDK + Claude Agent SDK

```
frontend/      React app — dashboard, solve, review player, settings, about
backend/       FastAPI — judge/, engine/ (recommendations), features/, analysis/
backend/seed/  the 5-pass problem ingestion + validation pipeline
CONTRACTS.md   the API/DB/UX contract the whole build was written against
```

**Tests:** `backend/.venv/bin/python -m pytest backend/tests` (55) and
`cd frontend && npm run test:normalize-math` (28).

---

## Known limitations

Stated plainly rather than hidden:

- **Multiple valid answers.** The judge compares tokens exactly. ~7 constructive problems
  accept several correct outputs; each carries a warning in its editorial so a correct
  alternative isn't silently marked WA.
- **Statement fidelity.** CodeContests ships statements as flattened plain text (LaTeX
  delimiters stripped upstream). A rule-based normalizer reconstructs the math for KaTeX;
  it's heuristic and occasionally over-merges an expression.
- **Single-user by design.** No auth. Claude-subscription auth is licensed for individual
  use, so this is a self-hosted personal tool, not multi-tenant SaaS.
- **Voice needs Chrome or Edge**, as above.

---

## Deploying (Vercel, Render, etc.)

Deploy platforms can only connect to repositories **you own** — they can't be granted
access to this organization repo. To deploy while keeping commits here, mirror to a
personal repo:

1. Create a **personal** repository on your own GitHub account.
2. Point `origin` at **both** repos so one `git push` updates each:

   ```bash
   git remote set-url --add --push origin https://github.com/platanus-build-night/platanus-build-night-26-co-danidiaztech.git
   git remote set-url --add --push origin https://github.com/<your-user>/<your-repo>.git
   ```

3. Connect your deploy service to your **personal** repo.

## License

MIT. Problem statements and tests come from DeepMind CodeContests (CC BY 4.0).
