# 00 — Research Summary

Condensed, source-linked findings from four parallel research sweeps (Platanus winner patterns, current Claude/Anthropic API, oversaturated categories, judging criteria). Confidence notes are honest — some Platanus Build Night specifics are gated behind a JS-rendered portal and could not be confirmed first-hand.

---

## 1. What actually wins at Platanus (patterns)

Platanus Ventures is a **YC-style LatAm VC/accelerator**. The hackathons exist to **scout founders and founding teams** — judges are operators and VCs, not academics. That colors everything below.

- **Solve ONE narrow, real pain point with a working, deployed product.** Motto is literally *"de cero a producto"* (zero to product). The fintech-track winner **Kairos** won because it "solved ONE specific pain point rather than overreaching." ([huss.substack.com](https://huss.substack.com/p/ganamos-la-hackaton-de-platanus))
- **B2B / dev-tools and fintech punch above their weight.** Overall + Tech winner **Anomala** was a security dev-tool with a 1-line install and an instantly graspable demo. ([dcc.ing.uc.cl](https://dcc.ing.uc.cl/estudiantes-del-dcc-uc-triunfan-en-la-platanus-hack-2024-con-ideas-transformadoras-para-el-futuro/))
- **Consumer/education wins too when the demo is delightful.** **Little Dragons** (overall + Education) taught kids finance via a gamified dragon — rewarded for emotional/UX polish and a clear "who it helps" story. ([dcc.ing.uc.cl](https://dcc.ing.uc.cl/estudiantes-del-dcc-uc-triunfan-en-la-platanus-hack-2024-con-ideas-transformadoras-para-el-futuro/))
- **Quantify the problem.** Kairos landed "$500B annual rotating interest" — VCs reward a market number. ([huss.substack.com](https://huss.substack.com/p/ganamos-la-hackaton-de-platanus))
- **AI must be the engine, not garnish.** Standouts: **despens.ai** (LLM WhatsApp pantry bot), **FARO** (Claude 3.5 Sonnet vision + smart glasses). ([github/platanus-hack](https://github.com/platanus-hack))
- **Popular vote is a real prize** — 2,200 community votes cast; a shareable, screenshot-able demo helps. ([ing.uc.cl](https://www.ing.uc.cl/noticias/estudiantes-de-ingenieria-uc-destacan-con-increibles-proyectos-en-platanus-hack-2024/))

**Tech-stack patterns:** TypeScript dominates ~140 team repos. Common shape = **Next.js + Node/Python (FastAPI/Nest) + Supabase (Postgres), deployed on Vercel**. Sponsor stack = free credits + judge affinity: **Supabase, Vercel, ElevenLabs, Anthropic**. WhatsApp / mobile / browser-3D are recurring demo surfaces.

**Regional angle:** Spanish is the primary language; flagship is Chile-anchored (winners fly to Santiago; Chilean winner → SF). **Spanish-first UX + a LatAm-specific problem reads as authentic** (Kairos = confusing LatAm card statements; despens.ai = WhatsApp, the dominant regional channel).

> *Confidence: Moderate.* Flagship winner data is well-corroborated. Dedicated **Build Night**-specific winner writeups were **not found** — it's newer and info is thin.

---

## 2. Current Claude / Anthropic capabilities (mid-2026) — your ammo

| Model | ID | Context | $/1M (in/out) | Use for |
|---|---|---|---|---|
| **Opus 4.8** | `claude-opus-4-8` | 1M | $5 / $25 | **Default agent brain** — best tool-use/computer-use/coding |
| Sonnet 5 | `claude-sonnet-5` | 1M | $3 / $15 | Near-Opus, cheaper high-volume |
| Haiku 4.5 | `claude-haiku-4-5` | 200K | $1 / $5 | Fast/cheap subtasks, classification |
| Fable 5 | `claude-fable-5` | 1M | $10 / $50 | Hardest reasoning only (premium) |

**Capabilities that make a demo pop:**
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — Claude Code as a library. `query()` runs the full agentic loop with built-in tools (Read/Write/Bash/WebSearch…), **subagents** (parallel, isolated context), hooks, sessions. *Least code you own for a visible agentic demo.* ([Agent SDK docs](https://code.claude.com/docs/en/agent-sdk/overview))
- **MCP (Model Context Protocol)** — the sponsor-favored integration story. Declare `mcp_servers` on the Messages API, or use the 375+ Connectors Directory. **Artifacts can now call MCP connectors** (live per-viewer data). Building a custom MCP server is a ~1hr task. ([connectors tutorial](https://sunpeak.ai/blogs/claude-connectors-tutorial/))
- **Computer use** (`computer_20251124`, beta) — genuinely demo-ready on Opus 4.8, coordinates map 1:1 to pixels. Still beta → budget for retries.
- **Code execution tool** (`code_execution_20260521`) — server-side Python sandbox (pandas/matplotlib/python-pptx). GA, 1,550 free hrs/mo. Great for "Claude analyzes a CSV → returns a chart/deck live." *Most reliable "wow" per unit risk.*
- **Structured outputs** (`output_config` json_schema / `messages.parse()`) — reliably parseable agent output for chaining.
- **Cost levers:** prompt caching (~90% off cached reads), Batch API (50% off), Haiku for latency-sensitive subtasks.

**Accessibility:** Messages API, tool use, code execution, structured outputs, caching, batch, MCP connector, Agent SDK, and computer use are all **self-serve on a $5 free-credit key — no approval gate** (beta features are just header opt-ins). Artifacts-calling-MCP needs a Pro/Max plan (not free web tier). ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Opus 4.8 announce](https://www.anthropic.com/news/claude-opus-4-8))

**Sponsor-favored angle:** a **visible agentic loop** (Agent SDK + parallel subagents, streaming thinking) + **MCP as the integration layer** + optionally **computer use** or **code execution** producing a real artifact on stage.

> *Confidence: High* on model lineup/pricing/API surface.

---

## 3. What's overdone — AVOID or sharply differentiate

- **Generic chatbots / "ChatGPT wrapper" apps** — judges call these "super boring"; anyone ships one in an afternoon. ([devpost](https://info.devpost.com/blog/hackathon-judging-tips))
- **Basic RAG-over-PDF / document Q&A** — "generic RAG" is oversaturated; only acceptable if domain-specialized or a multi-step agent. ([sinceai.ai](https://sinceai.ai/blog/ai-hackathon-project-ideas))
- **Meeting notetakers / summarizers, AI resume builders, generic productivity apps, CRUD dashboards** — done to death. ([sinceai.ai](https://sinceai.ai/blog/ai-hackathon-project-ideas))
- **"Recycled idea, new label"** — a judge's #1 red flag: fitting a problem to a solution. ([devpost](https://info.devpost.com/blog/hackathon-judging-tips))
- **LLM-brainstormed ideas** — judges say they "have a pattern you can feel." Brainstorm the concept yourself; use AI to build.

**What stands out instead:**
- **Agentic systems that ACT, not answer** (GitLab/Microsoft 2026 winners were all agents that act on events on the user's behalf). ([GitLab winners](https://about.gitlab.com/blog/gitlab-ai-hackathon-2026-meet-the-winners/))
- **Novel + universally relatable interface** — Cal Hacks 12 Grand Prize (**FaceTimeOS**) = control a Mac by voice over a FaceTime call. Known capability, unexpected+familiar surface. ([dylanlu.com](https://blog.dylanlu.com/cal-hacks-12/))
- **Multimodal / real-time / computer-use** demos beat a text box.
- **Niche real problem in a specific domain** beats generic.

**Demo "wow" principles:** one clear *"oh, this is possible now"* moment (not a feature tour); working in **~90 seconds**; **before/after contrast**; **engineer the demo to cut flaky parts** (the Cal Hacks winner removed unreliable agent-clicking and demoed keyboard-only); **front-end polish is worth backend sacrifice**; walk judges through the *experience*, not the architecture.

> *Confidence: Moderate-high* (corroborated across Devpost, JetBrains, GitLab, winner writeups).

---

## 4. Likely judging criteria

**Confirmed Platanus facts:** ~12h (3PM–3AM), small (~25 builders), **entry gated by submitting your own AI agent**, feeds the flagship Platanus Hack 26 (Bogotá ~Sept 11–13, 2026). Projects must be **open source (MIT), deployed, publicly usable**. The **"tu abuelita juzgará tu proyecto"** test — demos are livestreamed and the product **must be usable by anyone in the world**. **Pitch quality explicitly matters** (they offer pitch coaching). Four criteria, **weighted equally**. ([build-night.platan.us](https://build-night.platan.us/), [hack.platan.us/24](https://hack.platan.us/24))

**Best planning model (confirmed emphasis + extrapolated weights):**

| Criterion | Est. weight | Status |
|---|---|---|
| Technical execution / innovation (not a wrapper) | ~25% | confirmed type, extrapolated weight |
| Real-world usefulness & accessibility ("abuelita" test) | ~25% | confirmed emphasis |
| Demo & pitch quality (livestreamed) | ~20% | confirmed emphasis |
| Originality / "wow" | ~15% | extrapolated |
| Claude/AI as core (sponsor = Anthropic) | ~15% | extrapolated |

**Business potential:** unlikely an explicit rubric line, but Platanus is a VC — a project that **reads as a fundable startup** wins tiebreakers and the informal "who do we want to back." **Build something that demos like a company, not a toy.**

> *Confidence: Medium.* Format + open-source/deploy + "abuelita" test + livestreamed pitches + four-equal-criteria are confirmed. Exact criteria names/weights for Build Night are gated in the portal — **verify in the application portal or ask organizers.**

---

## 5. Synthesis → design constraints for the 7 ideas

Everything below is optimized to these distilled rules:
1. **Agentic — it acts, it doesn't chat.** (avoids the #1 saturated bucket)
2. **One narrow, quantifiable, LatAm-real problem.** (Kairos playbook)
3. **A single 90-second "you couldn't do this yesterday" wow moment**, visual and hard to fake.
4. **Deployed + Spanish-first + usable by anyone** (abuelita test).
5. **Claude as the engine** — visible reasoning/agency, ideally Agent SDK + MCP.
6. **Reads like a fundable company**, with a market number in the pitch.
7. **Engineer the demo to remove flaky paths**; front-end polish over backend completeness.

---

### All sources
Platanus: [huss.substack](https://huss.substack.com/p/ganamos-la-hackaton-de-platanus) · [dcc.ing.uc.cl](https://dcc.ing.uc.cl/estudiantes-del-dcc-uc-triunfan-en-la-platanus-hack-2024-con-ideas-transformadoras-para-el-futuro/) · [ing.uc.cl](https://www.ing.uc.cl/noticias/estudiantes-de-ingenieria-uc-destacan-con-increibles-proyectos-en-platanus-hack-2024/) · [hack.platan.us](https://hack.platan.us/) · [hack.platan.us/24](https://hack.platan.us/24) · [build-night.platan.us](https://build-night.platan.us/) · [df.cl](https://www.df.cl/df-lab/innovacion-y-startups/platanus-ventures-internacionaliza-sus-hackathones-lanza-club-de) · [github/platanus-hack](https://github.com/platanus-hack)
Anthropic: [models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8) · [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) · [subagents](https://platform.claude.com/docs/en/agent-sdk/subagents) · [connectors](https://sunpeak.ai/blogs/claude-connectors-tutorial/) · [computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use.md) · [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md)
Hackathon craft: [devpost](https://info.devpost.com/blog/hackathon-judging-tips) · [JetBrains](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/) · [Cal Hacks winner](https://blog.dylanlu.com/cal-hacks-12/) · [GitLab winners](https://about.gitlab.com/blog/gitlab-ai-hackathon-2026-meet-the-winners/) · [sinceai.ai](https://sinceai.ai/blog/ai-hackathon-project-ideas) · [lablab.ai](https://lablab.ai/ai-articles/ai-to-code-winning-hackathons-guide)
