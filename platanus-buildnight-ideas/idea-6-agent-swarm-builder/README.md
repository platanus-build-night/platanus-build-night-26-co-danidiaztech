# Agent Swarm Builder — "Describe una app, mira cómo un equipo de agentes la construye y la despliega"

## One-liner
Describe a micro-app in one sentence and watch a visible swarm of Claude subagents — PM, engineer, reviewer — plan it, build it, and deploy it to a live URL on stage.

## The idea
The event's whole premise is "discover what's possible with LLMs." This is the most on-the-nose answer: a **multi-agent system that ships software live**. Using the **Claude Agent SDK's subagents** (parallel, isolated-context workers with their own tools), you orchestrate a little "startup": a planner decomposes the request, one or more builder subagents write the code, a reviewer subagent checks it, and it auto-deploys to Vercel — all while a UI streams each agent's thinking so the audience *watches the org work*.

It's for anyone who wants software without engineers, but honestly the real audience is the **judges themselves** — it's a meta-demonstration of agentic capability that an Anthropic-affiliated jury will find irresistible. The wow is the choreography: multiple agents visibly reasoning in parallel and converging on a deployed artifact.

Why now: the Agent SDK just made multi-agent orchestration with subagents a first-class, low-code primitive, and Opus 4.8 is a strong enough coder that a *scoped* micro-app builds reliably. Doing it as a visible swarm (not a hidden loop) is the differentiator.

## Why this could win
- **Perfectly on-theme** for an Anthropic event — it's a live advertisement for the Agent SDK + subagents.
- **The choreography is the wow** — parallel agents thinking on screen, converging on a real deployed URL, is visually distinctive.
- **Deep sponsor-tech showcase** — Agent SDK, subagents, streaming thinking, auto-deploy.
- **"What's possible now" incarnate** — hard for a judge to forget.

## Impact — 7/10
Real (no-code app builders are a market), but crowded and the "would a business pay *this* one" story is weaker than fintech. Its value is more demonstration-of-capability than defensible product.

## Complexity — 8/10 (10 = hardest)
High. Orchestrating multiple subagents reliably, keeping the built app scoped enough to actually work, and auto-deploying live are all failure-prone. **Riskiest component:** the built app failing to run/deploy live, or agents looping/contradicting each other.

## Fun — 9/10
Deeply fun — you're building a little AI company. Very engaging.

## Presentability — 9/10 *if it converges* — the parallel-agents view is gorgeous, but variance is high; a swarm that stalls is a confusing demo.

## Composite score
**6.5 / 10.** `0.30×9 + 0.28×7 + 0.32×(11−8) + 0.10×9 = 6.52` — great theme fit, dragged down by orchestration risk.

## 10-hour build plan
- **H0–1.5 — Agent SDK spike.** Get `query()` running with 2 subagents in parallel; stream their output to a console.
- **H1.5–3.5 — Scope the buildable surface HARD.** Constrain output to ONE app archetype (e.g. a single-page CRUD/landing/tool from a template) so builds reliably succeed. Do not attempt "any app."
- **H3.5–5.5 — Orchestration.** Planner → builder(s) → reviewer roles; converge on a working single-file/Next app. Add an auto-deploy step (Vercel deploy hook / API).
- **H5.5–7.5 — The money shot UI.** A live board showing each agent, its role, and its streaming thinking, plus the final URL going live. This *is* the demo — invest here.
- **H7.5–9 — Harden.** Timeouts, loop guards, a fixed happy-path prompt you know converges. Pre-warm deploy.
- **H9–10 — Demo prep + fallback.** **Cut line:** if live deploy is flaky, "deploy" to a local preview instead of Vercel; if orchestration is flaky, reduce to planner+builder (drop reviewer). Keep a recorded successful run.

## Tech stack
- **Model:** `claude-opus-4-8` for builders/planner; `claude-haiku-4-5` for cheap reviewer/routing.
- **Anthropic:** **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) with **subagents** — self-serve via API key (subscription plans include Agent SDK credit). Confirmed no approval gate.
- **App:** Next.js on **Vercel** (also the deploy target — use Vercel deploy hooks); streaming UI via SSE/websocket.
- Confirmed accessible today.

## Demo script (80s)
1. (10s) "I'll describe an app in one sentence. A team of AI agents will build and deploy it. Now." Type the request.
2. (45s) The board lights up: Planner posts a plan → two Builders write code in parallel (thinking streams) → Reviewer flags one issue → fix applied.
3. (15s) A "Deploying…" bar → a **live URL** appears; open it — the app works.
4. (10s) "Un equipo completo de agentes, de idea a producto desplegado, en un minuto. Esto es lo que ahora es posible."

## Biggest risk
The swarm fails to converge or the built app doesn't deploy/run live (orchestration loops, code errors, deploy hiccup). **Mitigation:** scope to one reliable app archetype from a template; fixed rehearsed prompt; loop/timeout guards; deploy to a pre-warmed target or local preview; keep a recorded perfect run as backup. Treat "reliably converges on the demo prompt" as the H9 go/no-go.
