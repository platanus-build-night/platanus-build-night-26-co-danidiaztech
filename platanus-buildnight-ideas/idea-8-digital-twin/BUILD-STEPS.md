# Gemelo — Clear Build Steps

A concrete, ordered, solo-friendly plan. **Golden rule: the demo is three things — (1) form fills itself with your data, (2) Claude goes blind for the login, (3) your phone buzzes for approval. Build those three rock-solid first. Everything else is garnish.**

Two tracks are marked throughout:
- 🟢 **DEMO-CRITICAL** — must work live. Do these first.
- 🔵 **DEPTH** — makes it a real product / better pitch. Only after 🟢 is solid.

---

## Before the event (do NOT burn hackathon hours on these)

1. **Claude subscription auth for the Agent SDK** (so you get the monthly credit, no metered API bill):
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude setup-token                 # browser OAuth → ~1-year token
   export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
   unset ANTHROPIC_API_KEY            # CRITICAL: API key silently wins over OAuth
   # claim the Agent SDK credit once in your Claude account (Pro $20 / Max5x $100 / Max20x $200)
   ```
2. **Accounts + tokens:** a free/paid **1Password** account (for the blind-login demo) *or* **Bitwarden** `bws`; a **Telegram bot** token via @BotFather; your own Telegram chat id.
3. **Pick and host the demo form.** Use a form **you host or control** that looks like real paperwork (an expense report / a tax-ish form). This removes network flakiness and ToS risk from the live demo. Have real-looking data ready in the vault.
4. **Export your data now:** ChatGPT (Settings → export, ZIP with `conversations.json`), Claude (Settings → Privacy → Export, 24h link). Claude Code history is already local at `~/.claude/projects/<slug>/<session>.jsonl`.
5. **Smoke-test Playwright MCP** filling your hosted form once, end to end.

> Doing these five before the clock starts converts the riskiest integrations into known quantities.

---

## Hour 0–1 — Skeleton 🟢
1. Repo + Docker container (Node/TS). Default-deny egress, allowlist only the domains you need (your form host, Telegram API, Anthropic).
2. Boot the **Claude Agent SDK** (`query()`), confirm it runs on your OAuth token.
3. Register MCP servers in `mcpServers` config: **Playwright MCP**, **Filesystem MCP**. Confirm the agent can call one Playwright tool.
4. **Checkpoint:** agent runs, drives a browser one click. If not, fix before moving on.

## Hour 1–2.5 — Vault + broker 🟢 (choose ONE path)
**Path A (fast, recommended):** use **1Password `op://` secret references** as the broker. Store the demo-site credential in 1Password; the agent references it by handle. This *is* your blind-login demo, off-the-shelf.
**Path B (more "built-from-scratch" cred):** hand-roll a **SQLCipher + Argon2id** vault + a tiny **secret-broker** tool-server that resolves `SECRET:<handle>` → value at the action boundary and never returns plaintext to the model.
- Either path: the personal *profile* data (non-credential) goes in a local SQLCipher DB.
- **Checkpoint:** the agent can request a secret by handle and successfully authenticate, and you can prove (via the audit log / a print) that the plaintext never entered the model context.

## Hour 2.5–4 — Ingestion → "it knows me" 🔵→🟢
- 🟢 **Minimum:** seed a small structured profile (name, tax id, address, expense categories, writing-style notes) the form-fill will use. This alone makes the demo work.
- 🔵 **Depth:** write a parser for **Claude Code JSONL** (`~/.claude/projects/…`) to extract coding-pattern facts, and a parser for the **ChatGPT/Claude export** `conversations.json`. Normalize into the profile store (optionally embed → vector search). Parse *defensively* — the JSONL format changes between releases.
- **Checkpoint:** the dashboard can show 2–3 non-obvious facts the twin "learned about you." (Great demo opener.)

## Hour 4–6 — The acting loop 🟢 (the heart)
1. Agent receives a natural-language task ("presenta mi reporte de gastos de julio").
2. It retrieves the needed fields from the vault (by handle for secrets, directly for profile data).
3. **Playwright MCP** opens your hosted form and fills it field-by-field, **visibly**.
4. At the login wall, invoke the **blind login**: Path A → 1Password for Claude types creds while Claude stops reading the page; Path B → `type_secret(handle)` + screenshot redaction.
5. **Checkpoint:** end-to-end, the form is filled and the login succeeds, and you can show "Claude is blind" during the credential step. **This is the wow — make it bulletproof.**

## Hour 6–7.5 — Approval gate + flightable modes 🟢
1. Add a **`PreToolUse` hook** + **`canUseTool`** callback that intercepts the `submit` action (and any spend/email/credential action).
2. **Telegram bot:** on interception, send the proposed action + args with an inline keyboard `[Approve] [Edit] [Reject]`. Suspend the agent loop on the `callback_query`; on press, `answerCallbackQuery`, edit the message in place, and resume/deny/revise.
3. **Flightable dial**, stored per capability: **always-ask** (route every time) / **use-best-judgement** (auto-approve low-risk, escalate money/send/credentials) / **always-send** (scoped allowlist — never a blanket `bypassPermissions`).
4. **Checkpoint:** submitting the form triggers a real Telegram buzz on your phone; tapping Approve completes it; tapping Reject stops it. Test all three modes.

## Hour 7.5–9 — Audit + polish 🔵/🟢
- 🟢 **Audit log** (append-only JSONL): every tool call, secret-access-by-handle, network request, approval decision. Render it in the dashboard — it's both a security feature and a demo asset.
- 🟢 **UI + Spanish copy.** Make the dashboard *look* like it knows you; make the "Claude is blind" moment visually obvious; brand it.
- 🔵 Gmail MCP "draft a reply in my voice" as a second capability if far ahead.

## Hour 9–10 — Demo prep 🟢
- Rehearse the golden path **10+ times** on your hosted form.
- **Record a screen capture of a perfect run** as a fallback if the live browser stalls.
- Pre-open the dashboard with the "it knows me" facts. Pre-stage the Telegram chat.
- Write the 90-second pitch (see README demo script); lead with the data-sovereignty line and end with the fundable-category line.

---

## The ruthless cut list (if you're behind at any checkpoint)
Drop from the bottom up — never sacrifice the three 🟢 demo beats:
1. ❌ Drop deep ingestion → use the pre-seeded profile (keep 2–3 "learned" facts hardcoded but true).
2. ❌ Drop hand-rolled crypto (Path B) → use 1Password `op://` (Path A). *Faster AND more impressive.*
3. ❌ Drop the Gmail second capability → one capability (form-fill) is enough.
4. ❌ Drop microVM/gVisor sandbox → plain Docker + egress allowlist is credible.
5. ❌ Drop signed audit log → append-only JSONL is fine.
6. ✅ **Never drop:** form-fill with real data · blind login · Telegram approval. That trio is the whole demo.

---

## Definition of done (what "working" means at H10)
> On stage: you type one Spanish instruction → a real form fills itself with your real data → Claude visibly goes blind while it logs in → your phone buzzes with a Telegram approval → you tap Approve → it submits → the audit log shows exactly what happened. All running in a container on your Claude subscription, with your data in a vault only you can open.
