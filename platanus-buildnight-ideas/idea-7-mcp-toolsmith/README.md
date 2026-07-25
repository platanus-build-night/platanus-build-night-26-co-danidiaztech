# MCP Toolsmith — "Dale a Claude cualquier API y la convierte en herramientas al instante"

## One-liner
Point it at any API (an OpenAPI spec or even undocumented endpoints) and it auto-generates a working MCP server, so Claude can immediately use that service as native tools — no manual glue code.

## The idea
The bottleneck in agentic apps is wiring: every new integration means hand-writing an MCP server or tool schemas. This is a **dev-tool that builds the integration for you**: feed it an OpenAPI/Swagger spec (or a base URL it probes), and an agent generates, tests, and serves a complete **MCP server** — endpoints mapped to tools, auth handled, schemas validated — that any MCP client (Claude Desktop, the Messages API connector) can immediately consume. Then it demos Claude *using* those freshly-minted tools live.

It's for developers building agents — the same B2B/dev-tool lane that produced Platanus overall-winner **Anomala** (1-line-install dev tool). MCP is *the* sponsor-favored integration story right now (375+ connectors, artifacts can call MCP), so a tool that manufactures MCP servers hits Anthropic squarely where it's investing. The agency shows twice: the agent that *writes* the server, and Claude that *uses* it.

Why now: MCP is the current standard and building servers by hand is a known ~1hr chore per integration — automating it is a real pain-killer, and MCP being brand-hot maximizes judge affinity.

## Why this could win
- **Deepest sponsor-tech alignment** — it's an MCP factory at an Anthropic event; it speaks the judges' language.
- **Dev-tool lane has Platanus precedent** (Anomala) and judges are operators who love infra that "just works."
- **Two visible agentic loops** — generate the server, then Claude uses it.
- **Genuinely useful to builders** — clear "I'd install this" reaction from technical judges.

## Impact — 7/10
Real developer value and defensible, but the audience is narrow (developers) and it's infra — less universally graspable, which hurts the "abuelita" test and popular vote.

## Complexity — 6/10 (10 = hardest)
Mid. Codegen from an OpenAPI spec is tractable; the agent-writes-and-tests-a-server loop is the interesting part. **Riskiest component:** generated servers that don't actually work against the live API (auth, edge-case schemas), and the "probe undocumented endpoints" stretch goal (drop it if tight).

## Fun — 8/10
Very satisfying for an engineer — meta, clever, and you'll use it after the hackathon.

## Presentability — 6/10
The weakest demo-ability here: the wow is legible mostly to developers. "A server got generated" is abstract; you must work hard to make it visual (show Claude doing something real with the new tools). Docks the composite most.

## Composite score
**6.2 / 10.** `0.30×6 + 0.28×7 + 0.32×(11−6) + 0.10×8 = 6.16` — strong theme fit, held back by narrow, less-visual demo.

## 10-hour build plan
- **H0–1 — Setup.** Node/TS project, Anthropic key, pick a target API with a clean OpenAPI spec + free tier (e.g. a public weather/GitHub/Stripe-test API).
- **H1–3.5 — Codegen core.** Agent reads the spec → generates an MCP server (tools = endpoints, params from schema). Get 2–3 endpoints working end-to-end.
- **H3.5–5.5 — Test + self-repair loop.** Auto-run the generated server, call a tool, and if it fails feed the error back to Claude to fix. This reliability loop is the credibility of the demo.
- **H5.5–7.5 — "Claude uses it" demo path.** Connect the generated server to the Messages API MCP connector (or Claude Desktop) and have Claude complete a real task with the new tools. **Make this visual** — show the task, not the JSON.
- **H7.5–9 — UI + polish.** Paste-a-spec → watch it generate → see the tools → watch Claude use them. Dev-friendly but clean.
- **H9–10 — Demo prep.** Rehearse on a proven API. **Cut line:** drop the "probe undocumented endpoints" feature and self-repair; keep spec-in → working-server → Claude-uses-it.

## Tech stack
- **Model:** `claude-opus-4-8` (codegen + the usage demo); `claude-haiku-4-5` for schema parsing.
- **Anthropic:** **MCP connector** on the Messages API (`mcp_servers` + `mcp_toolset`, beta `mcp-client-2025-11-20`), **structured outputs** for reliable codegen params, **Agent SDK** optional for the generate/test loop. All self-serve.
- **App:** Node/TS backend that runs generated servers; a thin Next/**Vercel** UI. **Supabase** optional for saved servers.
- Confirmed accessible today.

## Demo script (75s)
1. (10s) "Every AI integration is hours of glue code. Watch this take zero." Paste an OpenAPI spec.
2. (25s) The agent generates the MCP server live, runs its own tests, self-fixes one failing tool.
3. (30s) Switch to Claude: give it a natural-language task; it calls the *just-generated* tools and completes something real (e.g. "book the cheapest option" against the API).
4. (10s) "Cualquier API, herramientas para tu agente, al instante. Esto es infraestructura para la era de agentes."

## Biggest risk
The demo is abstract to non-developers and the generated server may not work against the live API. **Mitigation:** (1) make the payoff a *visible real-world task* Claude completes, not raw tool JSON; (2) scope to one clean, tested API; (3) keep the self-repair loop so a first-try failure looks intentional and impressive rather than broken; (4) rehearse on a proven spec with a known-good task.
