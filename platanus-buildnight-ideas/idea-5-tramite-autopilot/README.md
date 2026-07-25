# Trámite Autopilot — "Claude hace tu papeleo"

## One-liner
Tell it a bureaucratic task in plain Spanish and a computer-use agent opens a real government/service website and does the whole trámite for you, clicking and filling forms while you watch.

## The idea
LatAm bureaucracy (trámites) is a universal misery: multi-step government portals, service providers, appointment systems that only work through a maddening web UI. This is a **computer-use agent** that literally drives the browser: you say "renueva mi cita en el portal X" or "descarga mi certificado," and Claude (Anthropic's `computer_20251124` tool) looks at the screen, moves the mouse, types, navigates the flow, and completes it — narrating what it's doing.

It's for everyone who's lost an afternoon to a government website — and it's the *literal* embodiment of the "abuelita" test: you're helping the person least able to navigate these portals. The agency is maximally visible: judges watch an AI operate a real UI a human normally operates. It's the FaceTimeOS lesson taken to its limit — a known capability (computer use) pointed at an unexpectedly relatable, painful surface.

Why now: Opus 4.8 is Anthropic's strongest computer-use model yet (84% Online-Mind2Web, 1:1 pixel mapping), so driving a real site is finally demo-plausible — while still being beta enough that pulling it off *live* signals serious technical chops.

## Why this could win
- **Highest wow ceiling + deepest relatability** — an AI doing your hated paperwork on a real site is unforgettable and instantly understood by anyone.
- **Showcases the sponsor's flagship agentic capability** (computer use) — maximal Anthropic affinity.
- **"Abuelita" test, literally** — it helps the least technical person do the hardest digital task.
- **Fundable** — govtech/trámite automation is a real LatAm market.

## Impact — 9/10
Massive, universal, painful problem; clear value. A real business (though regulatory/ToS friction on automating gov sites is a genuine hurdle).

## Complexity — 9/10 (10 = hardest)
The hardest, riskiest build here. **Riskiest component:** computer use is beta and flaky — captchas, logins, unexpected page states, and latency can all break a live run. Real gov sites are hostile to automation.

## Fun — 8/10
Very fun and impressive to build; watching the agent click is a thrill. Debugging flaky runs is the tax.

## Presentability — 9/10 *if it completes* — but the highest variance of any idea. A flawless run is the best demo of the night; a stall mid-form is the worst.

## Composite score
**6.7 / 10.** `0.30×9 + 0.28×9 + 0.32×(11−9) + 0.10×8 = 6.66` — elite ceiling, punished hard for fragility.

## 10-hour build plan
- **H0–2 — Computer-use spike + TARGET SELECTION.** Get the `computer_20251124` loop driving a browser. **Critically: pick a SIMPLE, stable, login-free, captcha-free target site** (a demo/staging portal or a benign public form you control). Real gov sites with auth are a trap.
- **H2–4 — Task loop.** Claude: screenshot → plan → act → verify, until the task completes on your chosen site. Add step narration.
- **H4–6 — Robustness.** Retry on misclick, detect "did the page change," handle the 2–3 states your demo path hits. Constrain scope to ONE golden-path trámite.
- **H6–7.5 — UI wrapper.** Spanish command box + a live view of the browser + the agent's narrated steps.
- **H7.5–9 — Rehearse the golden path relentlessly;** cache/mock any slow or flaky external step. Consider a controlled local clone of the target form to remove network variance.
- **H9–10 — Demo prep + recorded fallback.** **Cut line:** if computer use is too flaky by H4, pivot the wrapper to drive a form *you host* (still a real computer-use demo, fully controlled).

## Tech stack
- **Model:** `claude-opus-4-8` + **computer use** (`computer_20251124`, beta `computer-use-2025-11-24`) — self-serve, header opt-in, no approval gate.
- **Runtime:** a browser the agent controls (Playwright-driven Chromium in a container) + screenshot loop.
- **App:** Next.js on **Vercel** for the shell; the agent runtime on a small always-on box (needs a live browser).
- Flag: **no paid gating**, but computer use is **beta = expect retries**; a stable always-on host matters more than the model.

## Demo script (80s)
1. (10s) "Everyone hates this website. Watch Claude do it instead." Type the trámite in Spanish.
2. (50s) The browser view moves on its own: the agent narrates "abriendo el portal… llenando el formulario… seleccionando la fecha…" and completes the flow.
3. (10s) Success state on the real site (confirmation/download).
4. (10s) "El trámite que te toma una tarde, hecho por un agente. Esto es para tu abuelita."

## Biggest risk
Computer use stalls or misclicks live (beta flakiness, captcha, unexpected page). This is the highest-variance demo here. **Mitigation:** (1) choose a controlled, login/captcha-free target — ideally a form you host that mimics a real trámite; (2) rehearse the exact golden path dozens of times; (3) keep a screen-recording of a perfect run to play if the live run stumbles; (4) hard pivot-gate at H4 — if the spike is unreliable, fall back to a self-hosted target.
