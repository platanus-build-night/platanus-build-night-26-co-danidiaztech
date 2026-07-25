# Debt Autopilot — "Tu agente que le pelea a la deuda"

## One-liner
Forward your bank/credit-card statement and an autonomous agent finds the abusive rotating interest and hidden fees, then drafts and simulates the exact actions to fix it — dispute letters, refinance messages, a payoff plan — ready to send.

## The idea
LatAm consumer credit is a mess of rotating interest ("interés rotativo"), opaque fees, and statements engineered to be unreadable. The Platanus fintech-track winner **Kairos** built in this exact lane and won by quantifying it ("$500B annual rotating interest"). This is the **agentic** version: not a chatbot that explains your statement, but an agent that **ingests it, reasons about what's wrong, and produces concrete, sendable actions** — a WhatsApp-ready payoff plan, a pre-filled dispute message to the bank, a refinance-request draft, and a simulation of how much money each action saves.

It's for anyone with a credit card in Colombia/LatAm — i.e. everyone. The wedge is that it **acts on your behalf** and speaks money: the headline is always a number — "puedes ahorrar $340.000 en intereses si haces esto."

Why now: statement parsing + multi-step financial reasoning + drafting real documents is exactly the agentic loop LLMs just got good at, and the "acts, not answers" framing is precisely what 2026 hackathon judges reward over chatbots. It rides a *proven* Platanus-winning theme without copying the product.

## Why this could win
- **Documented Platanus precedent** — fintech in this lane already won a track (Kairos). Judges are operators who reward market relevance + execution discipline.
- **Visceral, quantified wow** — a big "ahorras $X" number is the strongest possible before/after for a VC audience.
- **LatAm-authentic** — rotating interest and WhatsApp delivery are regional-specific, reads as founder insight not a US clone.
- **Agentic, not RAG-Q&A** — it drafts and simulates actions, dodging the saturated bucket.
- **Fundable on sight** — obvious business, obvious user, obvious monetization.

## Impact — 9/10
Enormous, universal, real financial pain with a clear willingness to pay. About as fundable as a hackathon project gets.

## Complexity — 5/10 (10 = hardest)
Mid. Statement ingestion (PDF/image → structured) + financial reasoning + document generation, no exotic infra. **Riskiest component:** reliably parsing wildly different bank statement layouts. Mitigate by supporting 1–2 specific Colombian banks' formats well for the demo rather than "any statement."

## Fun — 6/10
Interesting reasoning problem; the drafting/simulation part is satisfying. Not as playful as voice/games, hence mid.

## Presentability — 8/10
Strong: statement in → findings + savings number + ready-to-send WhatsApp message out. Docked from 9 because the artifacts are documents (less kinetic than a live call or a running game).

## Composite score
**7.4 / 10.** `0.30×8 + 0.28×9 + 0.32×(11−5) + 0.10×6 = 7.44`.

## 10-hour build plan
- **H0–1 — Setup.** Next.js + Vercel + Supabase; Anthropic key. Collect 2–3 real (redacted) Colombian statements.
- **H1–3 — Ingestion.** Statement (PDF/image) → structured transactions + fees + interest via Claude with **structured outputs** (json_schema). Nail it on your 2 target banks.
- **H3–5 — Reasoning engine.** Agent detects rotating interest, ranks problems, computes savings per action (code execution for the math so numbers are real, not hallucinated).
- **H5–7 — Action generation.** Draft: WhatsApp payoff plan, dispute message, refinance request. Spanish, sendable, personalized.
- **H7–8 — UI + polish.** Upload → findings dashboard with the big savings number → generated actions with copy/send buttons. Spanish-first, branded.
- **H8–9.5 — Harden.** Test both bank formats; guard the math; fallback copy if a field is missing.
- **H9.5–10 — Demo prep.** Rehearse; pre-load the best statement. **Cut line:** drop refinance draft + dispute letter, keep payoff plan + savings number + one action.

## Tech stack
- **Model:** `claude-opus-4-8` (reasoning + drafting), `claude-haiku-4-5` for cheap extraction subtasks.
- **Anthropic:** Messages API + **structured outputs** + **code execution** (for verifiable savings math). All self-serve, no gate.
- **App:** Next.js / **Vercel**, **Supabase** (store parsed statements). WhatsApp delivery = deep-link (`wa.me`) for the demo; real Cloud API optional.
- Confirmed accessible today.

## Demo script (80s)
1. (10s) "This is a real Colombian card statement. Nobody can read it. Watch." Upload it.
2. (20s) Agent extracts + flags: "interés rotativo de 28% E.A., 3 fees ocultos." Visible reasoning.
3. (20s) The big number lands: **"Ahorras $340.000 en 6 meses si haces esto."** (math computed, not guessed).
4. (20s) Three ready-to-send actions appear; click → a pre-filled WhatsApp payoff plan opens.
5. (10s) "Interés rotativo en LatAm = mercado de miles de millones. Esto actúa por ti."

## Biggest risk
Statement-parsing brittleness across bank formats live. **Mitigation:** scope hard to 1–2 specific banks you've tested; demo on a vetted statement; structured-output schema + a "confidence/needs-review" fallback so a partial parse degrades gracefully instead of crashing.
