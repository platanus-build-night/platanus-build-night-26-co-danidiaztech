# Analyst-in-a-Box — "Sube tu Excel, recibe un CFO"

## One-liner
Drop in a messy real-world spreadsheet and an autonomous Claude analyst cleans it, finds the story in the numbers, and hands you a CFO-grade action memo + charts — live, in under a minute.

## The idea
Every LatAm SME (and every founder) has a `ventas.xlsx` that's a disaster: merged cells, mixed date formats, "Enero"/"01-2026"/"ene" in the same column, totals in the wrong row. Getting an actual insight out of it means an afternoon of manual cleanup nobody does. This is an **agent that acts on the file**: it reasons about what the columns *mean*, writes and runs its own Python (Anthropic's server-side **code execution** tool) to clean and analyze, decides which cuts matter, generates charts, and writes a plain-Spanish memo — "tus 3 clientes top son el 61% de ingresos pero pagan 40 días tarde; aquí está el riesgo."

It's for small-business owners, solo founders, and operators who have data but no analyst. The point is not a chat window over the file (that's the saturated RAG bucket) — it's an **agent that produces a finished artifact you'd actually act on**, with the analysis steps visible so it's clearly reasoning, not templating.

Why now: the **code execution tool is GA with 1,550 free hours/month**, fully server-side (no fragile client sandbox), and pairs with Agent Skills to emit real `.xlsx`/`.pptx`/`.pdf`. That combination — LLM reasoning *plus* real deterministic computation — is exactly the "what's possible now" story, and it's the single most reliable "wow" per unit of risk available today.

## Why this could win
- **The most reliable live demo of any idea here.** Code execution is server-side and deterministic-ish; charts *will* render. Judges see a real artifact appear, not a promise.
- **Passes the "abuelita" test hard** — a shop owner uploads their file and gets Spanish insights. Universally graspable.
- **Reads like a company** — "Pilot for LatAm SMEs / accountants" has an obvious market and a number (millions of SMEs, no analyst).
- **Claude as engine is visible** — the agent's clean→analyze→decide loop is shown, not hidden.
- Avoids every saturated category (no chatbot, no RAG-Q&A, no notetaker).

## Impact — 8/10
Genuinely useful to a massive, underserved segment; a real recurring product. Docked from 9 only because "data analysis" is a crowded *product* space generally — the SME/Spanish-first wedge is what makes it fundable rather than generic.

## Complexity — 4/10 (10 = hardest)
The lowest-risk build here. Code execution does the heavy lifting server-side; you own an upload UI, a prompt/agent loop, and a results view. **Riskiest component:** getting the agent to reliably interpret genuinely ugly spreadsheets — mitigated by pre-testing on 3–4 real messy files and hardening the cleanup prompt.

## Fun — 6/10
Satisfying and you'll ship it, but it's more "solid engineering" than "gleeful hacking." The wow is in the output, not the process.

## Presentability — 8/10
Very strong: upload → visible reasoning → charts + memo materialize in ~60s. Docked from 9 because charts-appearing is slightly less viscerally novel than a live phone call or a robot doing your paperwork.

## Composite score
**7.5 / 10** — highest composite. `0.30×8 + 0.28×8 + 0.32×(11−4) + 0.10×6 = 7.48`.

## 10-hour build plan
- **H0–1 — Setup.** Next.js + Vercel, Anthropic key, file upload (drop `.xlsx`/`.csv`), Supabase optional for saved runs.
- **H1–3 — Core loop.** Wire Messages API with the code execution tool; agent receives the file, writes+runs Python to profile and clean it. Get *one* real messy file → clean dataframe end-to-end.
- **H3–5 — Analysis + artifacts.** Prompt the agent to pick 3–4 meaningful cuts, generate matplotlib charts, and write the Spanish memo. Return chart images + memo to UI.
- **H5–7 — "Show the reasoning" UI.** Stream the agent's steps (profiling → hypotheses → charts) so agency is visible. Polish layout, Spanish copy, brand.
- **H7–9 — Harden + polish.** Test on 3–4 real ugly files; fix the cleanup prompt for each failure. Add a "download .pptx" button (python-pptx) as a kicker.
- **H9–10 — Demo prep.** Pre-load one perfect demo file, rehearse the 90s. **Cut line if behind:** drop the .pptx export and Supabase; keep upload → charts → memo.

## Tech stack
- **Model:** `claude-opus-4-8` (analyst brain) — confirmed available, $5/$25 per 1M.
- **Anthropic:** Messages API + **code execution tool** (`code_execution_20260521`, GA, 1,550 free hrs/mo) + optionally Agent Skills for `.pptx`. Confirmed self-serve, no approval gate.
- **App:** Next.js on **Vercel** (sponsor), optional **Supabase** (sponsor) for run history.
- All confirmed accessible today on a free-credit key.

## Demo script (75s)
1. (5s) "Every negocio has a spreadsheet like this." Drop a genuinely ugly `ventas.xlsx` on screen.
2. (25s) The agent narrates its steps live: "detecté fechas en 3 formatos… limpiando… tus columnas son cliente, monto, fecha." Python runs server-side.
3. (25s) Charts render: top clients, cash-flow-at-risk, monthly trend.
4. (15s) The Spanish memo appears: 3 findings + 1 recommended action with a number. "Este cliente es el 61% de tus ingresos y paga 40 días tarde."
5. (5s) One line on the market: "millones de PyMEs, cero analistas."

## Biggest risk
The agent misreads a truly pathological spreadsheet live. **Mitigation:** demo on a pre-vetted file you've run 10×; keep a second known-good file as backup; the deterministic server-side execution means a rehearsed run reproduces reliably.
