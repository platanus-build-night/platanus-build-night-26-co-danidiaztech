# Gemelo — Your Secure Digital Twin *(working name)*

> The self-owned second brain that **acts on your behalf** — and never lets the AI see your secrets.

## One-liner
A containerized, self-owned digital twin that knows you to perfection, holds your data in a vault only *you* can open, and does your boring paperwork for you — logging in and filling forms while the AI stays *blind* to your passwords, then pinging your phone for one-tap approval before anything is sent.

## The idea
Social-media companies already own a model of you and monetize it. **Gemelo flips that**: you run a private, containerized system that ingests *your* data — your Claude Code coding patterns, your ChatGPT/Claude conversation exports, your documents, a self-search of your public footprint — and builds a persistent, personal profile that genuinely knows how you write, decide, and work. That's the "second brain" half.

The other half is that it **acts**. Gemelo is an agent (Claude Agent SDK) that does the tedious life-admin nobody wants: filling tax and expense forms, triaging and drafting email replies in *your* voice, managing recurring paperwork. It logs into the sites it needs using a credential broker so **the LLM never sees a plaintext password** — this is real, off-the-shelf now (1Password for Claude, July 2026: Claude literally stops reading the page while credentials are typed). Every sensitive action passes a **human-approval gate**: when the agent is ready to submit, it messages you on Telegram with *Approve / Edit / Reject* buttons. That gate is **"flightable"** — per capability you choose **always-ask**, **use-best-judgement** (auto-approve low-risk, escalate anything touching money/email/credentials), or **always-send**.

It's for anyone drowning in life-admin — but the deeper pitch is **data sovereignty + safe agency**. The two hardest things about a personal acting-agent are (1) trusting it with your secrets and (2) trusting it to act — and Gemelo's answer to both is architectural: secrets by handle, sandbox with locked-down egress, immutable audit log, and you in the loop by default.

Why now: three things that didn't exist 12 months ago now do — the Agent SDK runs on your **Claude subscription** (no metered API bill), **zero-exposure agentic login** is shipping, and **Playwright MCP** makes deterministic form-filling reliable. The pieces for a *safe* acting twin finally exist; nobody has assembled them into one private box.

## Why this could win
- **Bullseye on the Anthropic agent-security theme.** Agent security is the hottest funded category in 2026 (Arcade $60M, Straiker $64M, "the secure action layer every agent needs"). A project whose *whole thesis* is "let an agent act on your behalf, safely" is exactly what an Anthropic-affiliated jury wants to see — and it showcases the Agent SDK, MCP, hooks, and permission modes as first-class citizens.
- **Genuine whitespace.** Second Me learns you but doesn't act; Khoj retrieves but doesn't act; Open Interpreter acts but doesn't know you or hold credentials. **Nobody ships the private, acting, approval-gated twin as one box.** Limitless just exited to Meta, vacating the "own your own memory" high ground.
- **Demos like a fundable company** — clear wedge (individual life-admin) → expansion (team/enterprise "AI employees" with an audit plane), with real market numbers to cite ($5.3B→$24.5B enterprise agentic by 2030).
- **A multi-beat, hard-to-fake wow** — a form fills itself with your real data, Claude goes *blind* to type your password, your phone buzzes for approval on stage. Visceral and memorable after 20 chatbots.
- **The security angle IS the differentiation** — and it's defensible for a careful solo builder in a way cloud incumbents can't authentically copy.

## Impact — 9/10
Universal pain (everyone hates paperwork), a real willingness to pay, and it rides the single hottest funded AI category. The self-owned-data thesis is a genuine, timely wedge. Only not a 10 because "personal agent" trust/adoption is a real go-to-market slog.

## Complexity — 8/10 (10 = hardest)
The highest-scope idea in the set — vault + secret broker + agent loop + form-filling + Telegram approval + data ingestion is a lot of surface for solo/10h. **Riskiest component: scope itself.** The mitigation is aggressive cutting (see build steps): lean on *off-the-shelf* security (1Password for Claude / secret references) instead of hand-rolling crypto, use **Playwright MCP (deterministic)** not computer-use for the form-fill, and demo the vault at "minimum viable secure." Do that and it's very buildable; try to build everything and it collapses.

## Fun — 9/10
It's *your* idea and it's personal — you'll be motivated at hour 9. Building a thing that does your own paperwork is intrinsically satisfying, and the security puzzle is genuinely interesting engineering.

## Presentability — 9/10
Excellent and multi-beat: watch the twin fill a real form with your data → Claude goes blind for the login → your phone buzzes → you tap Approve → done. Visual, fast, hard to fake. Slightly higher variance than the pure code-exec ideas because a live browser is involved — de-risked by using Playwright + a rehearsed golden path + a recorded fallback.

## Composite score
**7.1 / 10.** `0.30×9 + 0.28×9 + 0.32×(11−8) + 0.10×9 = 7.08`.

Read this honestly: the risk-averse composite ranks it just **below** Analyst-in-a-Box (7.5) and Debt Autopilot (7.4) *purely because its scope/complexity is higher*. But the **win-fit overlay** (theme fit, fundability, novelty, and — critically — that it's the idea you actually want to build) is the strongest in the set. See `../99-final-recommendation.md` for how these reconcile. **Short version: this is the highest-ceiling idea here; whether it's the right pick depends entirely on ruthless scoping.**

## 10-hour build plan (summary — full detail in `BUILD-STEPS.md`)
- **H0–1 — Setup + auth.** Agent SDK on your Claude subscription (`claude setup-token`), repo, container skeleton.
- **H1–2.5 — Vault (minimum viable secure).** SQLCipher + Argon2id personal-data store; secret broker returning by handle. *Or* skip hand-rolled crypto and wire 1Password secret references — faster, more impressive.
- **H2.5–4 — Ingestion.** Parse Claude Code JSONL (`~/.claude/projects/…`) + a ChatGPT/Claude export into a normalized profile the agent can retrieve. Enough to demonstrably "know you."
- **H4–6 — The acting loop.** Agent + **Playwright MCP** fills a real form using vault data; wire the **blind login** (1Password for Claude or secret-broker typing).
- **H6–7.5 — Approval gate + flightable modes.** `canUseTool`/`PreToolUse` hook → Telegram bot with Approve/Edit/Reject; per-capability always-ask / best-judgement / always-send.
- **H7.5–9 — Audit log + UI polish + Spanish copy.** Show the action ledger; make the twin *look* like it knows you.
- **H9–10 — Rehearse golden path, record fallback, prep pitch.**
- **Cut line if behind:** drop data ingestion to a pre-seeded profile; drop hand-rolled vault for 1Password; keep **form-fill → blind login → Telegram approval** — that trio is the demo.

## Tech stack
- **Brain:** `claude-opus-4-8` via **Claude Agent SDK** on your **Pro/Max subscription** (`CLAUDE_CODE_OAUTH_TOKEN`, no metered API bill; unset `ANTHROPIC_API_KEY`). *Licensed for individual use — perfect for a solo demo.*
- **Acting:** **Playwright MCP** (deterministic form-fill; preferred) with Anthropic **computer use** as an optional "wow" for one UI Playwright can't drive.
- **Secrets:** **1Password for Claude** / `op://` secret references (zero-exposure login) **or** a hand-rolled **SQLCipher + Argon2id** vault + secret broker. Bitwarden `bws` machine accounts as the OSS alternative.
- **Approval:** **Telegram Bot API** inline keyboards, gated via Agent SDK `canUseTool` + `PreToolUse` hooks.
- **Data:** Gmail / Google Drive MCP (connectors present in this environment), Filesystem MCP, local Claude Code JSONL, ChatGPT/Claude export ZIPs.
- **Shell:** Node/TS, Docker container with default-deny egress; thin Next.js UI on **Vercel** for the dashboard.
- *All accessible today; the only account you need is your own Claude subscription (+ a free 1Password/Bitwarden and a Telegram bot token).* Full detail and the security design in `SECURITY.md`.

## Demo script (85–95s)
1. (10s) "Companies own a model of *you*. This is you owning it instead. Meet my digital twin — it runs in a box only I can open." Show the dashboard: it *knows* you (a fact it learned from your Claude Code / chat history).
2. (10s) "I hate expense reports. Watch it do one." Give it a one-line instruction in Spanish.
3. (25s) A real browser opens (Playwright); the form fills itself with *your* real data pulled from the vault — visibly, field by field.
4. (15s) It reaches the login wall. **Claude goes blind** — the screen shows "Claude is not reading this page" while the password + MFA are typed by the broker. "The AI never saw my password. It can't leak what it can't see."
5. (15s) Ready to submit — **your phone buzzes.** A Telegram message: *"Submit expense report for $340? [Approve] [Edit] [Reject]."* You tap **Approve** on stage.
6. (10s) Submitted. The **audit log** shows exactly what happened. "Every action, logged and reversible."
7. (10s) The flightable dial: "Set it to *always ask*, *use best judgement*, or *always send* — per task. And this scales: your twin today, your company's AI employees tomorrow. Agent-security is a category VCs are funding at $60M rounds."

## Biggest risk
**Scope explosion** — trying to build the vault, ingestion, acting loop, approval, and audit all to full depth in 10h, and shipping none of them cleanly. **Mitigation:** the demo is *three* things — form-fill, blind login, Telegram approval. Build those first and rock-solid; everything else (hand-rolled crypto, deep ingestion, audit polish) is a garnish you add only if ahead. Secondary risk: a live browser stalling — mitigated by Playwright's determinism, a rehearsed golden path on a form you host/control, and a recorded backup run. Tertiary: subscription-auth is individual-use-licensed — fine for a solo demo, but say "self-hosted, single-user" in the pitch, not "SaaS."
