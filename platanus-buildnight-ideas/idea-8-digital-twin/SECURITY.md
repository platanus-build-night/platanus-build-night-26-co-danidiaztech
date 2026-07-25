# Gemelo — Security Architecture

The security model *is* the product. This doc is the reference design; `BUILD-STEPS.md` is the hour-by-hour path. The single most important idea: **the LLM is treated as hostile-capable at all times, and secrets are resolved on the tool side by handle — the model never sees plaintext.** Get that one thing right and most of the threat model collapses.

---

## The six trust rings

Secrets live in the innermost ring; the LLM lives in the outermost, least-trusted ring.

```
┌──────────────────────────────────────────────────────────┐
│  RING 6 — LLM (Claude)          ← untrusted, sees handles │
│   ┌────────────────────────────────────────────────────┐ │
│   │ RING 5 — Sandbox (container, default-deny egress)  │ │
│   │  ┌──────────────────────────────────────────────┐  │ │
│   │  │ RING 4 — Audit log (append-only, immutable)  │  │ │
│   │  │  ┌────────────────────────────────────────┐  │  │ │
│   │  │  │ RING 3 — Approval gate (human-in-loop) │  │  │ │
│   │  │  │  ┌──────────────────────────────────┐  │  │  │ │
│   │  │  │  │ RING 2 — Secret broker (by handle)│ │  │  │ │
│   │  │  │  │  ┌────────────────────────────┐  │  │  │  │ │
│   │  │  │  │  │ RING 1 — Vault (at rest)   │  │  │  │  │ │
│   │  │  │  │  │  SQLCipher + Argon2id      │  │  │  │  │ │
│   │  │  │  │  └────────────────────────────┘  │  │  │  │ │
│   │  │  │  └──────────────────────────────────┘  │  │  │ │
│   │  │  └────────────────────────────────────────┘  │  │ │
│   │  └──────────────────────────────────────────────┘  │ │
│   └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Ring 1 — Data at rest (the vault)

- **Store** all personal data and secrets in an encrypted **SQLite via SQLCipher** (transparent AES-256).
- **Derive** the DB key from the user's **master password** using **Argon2id** (memory-hard; the 2026 standard, beats scrypt/bcrypt/PBKDF2).
- The master password and derived key exist **only in process memory for the session** — never written to disk. This is the zero-knowledge property: lose the master password, lose the data.
- For file-level secrets/config, **age + sops** gives envelope encryption with near-zero ops.
- **HashiCorp Vault is overkill** for a hackathon (it's a server you must run + seal/unseal). Only reach for it in a "full" build for dynamic/short-lived secrets.

> **Hackathon shortcut:** you can skip hand-rolling this entirely and use **1Password Service Accounts + `op://` secret references** (or Bitwarden `bws` machine accounts) as both your vault *and* your broker. Faster to build, more impressive to demo, and it's the same primitive real products use. Keep the SQLCipher vault only for the *non-credential* personal data (your profile/memory).

---

## Ring 2 — The secret broker (the core trick)

A small local process (a loopback HTTP proxy or an MCP tool-server) that **owns the vault key and is the only thing that ever touches plaintext secrets.**

**The rule:** the agent asks for a secret **by handle/alias** — `op://vault/gmail/password`, `SECRET:gmail_pw` — never by value. The broker resolves it, uses it at the action boundary, and discards it. The plaintext never enters the model's context or leaves for the model provider's servers.

Three concrete implementations (pick one for the demo):

1. **Tool-side injection.** The tool signature is e.g. `http_request(url, headers={"Authorization": "SECRET:github_token"})`. The broker swaps the placeholder for the real token *after* the model has decided the request and *before* it leaves the host. Prompt-injection can't steal what isn't in context.
2. **Computer-use / Playwright secret typing.** The agent issues `type_secret(handle)`; the controller types the value straight into the input event stream and **redacts it from the screenshot** returned to the model.
3. **`op run` / env injection.** Wrap the action process so `op://` references resolve to env vars *only inside* that short-lived process, then vanish on exit.

**This is real and shipping.** *1Password for Claude* (July 2026) implements exactly pattern 2: when Claude hits a login, it **stops reading the page** ("Claude is blind"), 1Password types username + password + MFA and submits, and if it fails the filled values are **wiped before Claude resumes**. Claude only ever gets back the item title, username, site, and success/failure. **This is your demo centerpiece — and you don't have to build it.**

---

## Ring 3 — Approval gate (human-in-the-loop as a security control)

Before any **sensitive or irreversible** action (send email, submit form, spend money, delete, access a credential), the agent **pauses for human approval.**

- **Mechanism:** the Agent SDK's **`canUseTool` callback** (session policy) and/or a **`PreToolUse` hook** (deterministic, fires before every tool call, doesn't route through the model). These are first-class "pause, ask human, resume" primitives — you don't need LangGraph.
- **Channel:** a **Telegram bot** sends the proposed action + arguments with an inline keyboard (`approve:<id>` / `edit:<id>` / `reject:<id>`). The agent loop suspends on the `callback_query`; on press you `answerCallbackQuery`, edit the message in place to show the outcome, and resume/deny/revise.
- **The "flightable" 3-mode dial**, stored **per capability**:
  - **always-ask** → every action routes through Telegram (SDK `default` mode).
  - **use-best-judgement** → a policy check auto-approves low-risk actions (read a file, draft a doc) and **escalates anything touching money / external send / credentials** to Telegram.
  - **always-send** → pre-approved allowlist, skip the gate. **Never** use the SDK's `bypassPermissions` mode for anything touching money or email — "always-send" should still be a *scoped allowlist*, not a blanket bypass.
- Example policy: `email: ask`, `calendar: best-judgement`, `read-files: always-send`, `spend: ask + hard cap`.

---

## Ring 4 — Audit log

- **Append-only, immutable** log (JSONL minimum; signed/tamper-evident in the full tier) of every tool call, network request, **secret access *by handle* (never value)**, file write, and approval decision.
- This is also a **demo asset** and the enterprise wedge: "which agent did what, on behalf of whom, with whose credentials — and can we prove it?" is exactly the audit primitive enterprise buyers (and Arcade's entire $60M pitch) are paying for.

---

## Ring 5 — Sandbox

- Run the agent in a **container** (microVM / gVisor in the full tier) with **default-deny network egress** and an **allowlist** of the exact domains it needs.
- **Block cloud metadata (169.254.169.254) and RFC1918 ranges** to stop lateral movement / exfiltration.
- Read-only filesystem where possible; seccomp in the full tier.

---

## Ring 6 — LLM isolation

- The model gets **tools, aliases, and redacted context — never plaintext secrets, never the full vault dump.**
- **Context-minimization:** load only the records needed for the current task, not the whole profile.
- Consider a **local model** for the most sensitive reasoning steps so that data never leaves the box at all (full tier).

---

## Threat model — top 5 + mitigations

| # | Threat (OWASP LLM ref) | Mitigation |
|---|---|---|
| 1 | **Prompt injection → exfiltration** (LLM01): malicious text in an email/webpage tells the agent to leak the vault | Secrets-by-handle (nothing in context to reveal) · egress allowlist · treat all fetched content as untrusted · plan-then-execute separation |
| 2 | **Over-broad permissions / confused deputy**: one compromised step touches everything | Least-privilege task-scoped tools · short-lived/JIT credentials · per-workflow machine accounts · approval gates on writes |
| 3 | **Data leaves to the model provider**: PII in the context window is transmitted off-box | Context-minimization · redaction before send · never put secrets in context · local model for the most sensitive steps |
| 4 | **Secrets at rest stolen**: DB theft or a leaked `.env` | SQLCipher + Argon2id · key only in memory · sops/age for files · never plaintext |
| 5 | **Autonomous harmful action** (hallucination/manipulation): wrong form, money sent, data deleted | Human-in-the-loop approval · sandbox default-deny egress · immutable audit log for forensics/rollback |

---

## Minimum-viable-secure vs full

| Layer | Minimum viable (hackathon) | Full (production) |
|---|---|---|
| At-rest | SQLCipher + Argon2id, key in memory; **or** 1Password `op://` refs | + age/sops for files, OS keychain / HSM for master key |
| Broker | Local tool-server resolves aliases; **or** 1Password for Claude off-the-shelf | Loopback proxy w/ network-boundary injection, JIT/short-lived tokens |
| Sandbox | Docker + egress allowlist | microVM/gVisor, seccomp, read-only FS |
| Audit | Append-only JSONL | Signed/tamper-evident log |
| Approval | Telegram Approve/Reject on write actions | + typed confirmation, policy engine, spend caps |

**For the demo, "minimum viable secure" is enough to be credible** — and pairing it with the off-the-shelf 1Password blind-login gives you a security story that's both real and visually undeniable.

---

## Sources
1Password for Claude: [press](https://1password.com/press/2026/july/1password-for-claude) · [how it works](https://1password.com/blog/1password-for-claude) · [TNW](https://thenextweb.com/news/1password-claude-credential-zero-exposure-agentic-mode) · [Environments MCP (JIT)](https://codex.danielvaughan.com/2026/05/20/1password-codex-mcp-just-in-time-credential-access-agent-secrets-security/) · [op secret references](https://www.1password.dev/cli/secret-references) · [securing MCP with 1Password](https://1password.com/blog/securing-mcp-servers-with-1password-stop-credential-exposure-in-your-agent)
Bitwarden: [Secrets Manager CLI](https://bitwarden.com/help/secrets-manager-cli/) · [secure AI agent access](https://bitwarden.com/blog/secure-ai-agent-access-with-secrets-manager/)
Broker pattern: [TRM Labs — never give an agent a credential](https://www.trmlabs.com/trm-tech-blog/never-give-an-ai-agent-a-credential-a-broker-and-the-process-we-trusted-to-build-one) · [Aembit — securing agents without static creds](https://aembit.io/blog/securing-ai-agents-without-secrets/) · [Riptides — secretless injection](https://riptides.io/solutions/secretless-ai/)
Standards: [arXiv 2506.08837 — securing LLM agents vs prompt injection](https://arxiv.org/pdf/2506.08837) · [OWASP LLM Top 10 2025 (PDF)](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf) · [OWASP LLM examples/mitigations](https://www.oligo.security/academy/owasp-top-10-llm-updated-2025-examples-and-mitigation-strategies)
Crypto/sandbox: [Argon2id 2025 standard](https://medium.com/@sumanbhadrasuman/password-security-in-2025-why-argon2id-is-the-standard-you-should-use-7c0797349836) · [local-first vault w/ SQLCipher](https://mhmtsr.medium.com/building-a-local-first-password-manager-tauri-rust-sqlx-and-sqlcipher-09d0134db5bc) · [Northflank — sandboxing agents](https://northflank.com/blog/how-to-sandbox-ai-agents) · [Microsoft — least privilege for AI agents](https://www.microsoft.com/en-us/security/blog/2026/07/16/least-privilege-for-ai-agents-identity-access-and-tool-binding/) · [computer-use sandboxing patterns](https://dev.to/gabrielanhaia/computer-use-agents-3-sandboxing-patterns-that-dont-leak-credentials-4hci)
Agent SDK HITL: [permissions](https://platform.claude.com/docs/en/agent-sdk/permissions) · [hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
