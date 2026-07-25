# 01 — Scoring Rubric

The explicit, reproducible rubric used to score and rank all 7 ideas. If you disagree with the weights, change them here and recompute — every idea's four sub-scores are shown so you can re-derive its composite yourself.

---

## The four scored axes (each /10)

1. **Impact /10** — real-world usefulness + "would someone actually pay/use this" + does it read as a *fundable startup* to a VC judge. (Maps to Platanus's confirmed "usefulness/accessibility" criterion + their founder-scouting incentive.)
2. **Complexity /10 — where 10 = HARDEST.** Honest technical difficulty for a *solo* build in ~10 hrs. Higher = riskier = worse for shipping. The riskiest single component is called out in each idea.
3. **Fun /10** — how genuinely enjoyable this is to build, independent of winning.
4. **Presentability /10** — how well it demos live in ~90 seconds: is the wow moment **visual, fast, and hard to fake**? (Maps to Platanus's confirmed livestreamed-pitch + "abuelita" emphasis.)

---

## Composite formula

Because **Complexity is a cost, not a benefit**, it enters as inverted *Feasibility* = `(11 − Complexity)`. Weights reflect the confirmed Platanus judging emphasis (demo + usefulness heavy) and the hard reality that a solo hacker must actually *ship a live demo*:

```
Composite (/10) =
    0.30 × Presentability
  + 0.28 × Impact
  + 0.32 × (11 − Complexity)      ← feasibility; punishes fragile builds
  + 0.10 × Fun
```

**Rationale for the weights:**
- **Presentability 0.30** — at a livestreamed hackathon judged in minutes, the demo *is* the product. Confirmed emphasis.
- **Impact 0.28** — Platanus is a VC; fundability and real usefulness win tiebreakers.
- **Feasibility 0.32** — the highest-ceiling idea is worth nothing if it dies live at hour 10. This deliberately drags down flashy-but-fragile concepts. Solo + 10 hrs is unforgiving.
- **Fun 0.10** — real, but it shouldn't override winning; small weight keeps it a tiebreaker.

---

## Win-fit tiebreaker (qualitative, applied AFTER the composite)

The composite is deliberately risk-averse, so it can rank the *safest* idea #1 even when a slightly riskier idea has a much higher **win ceiling**. So the **final recommendation (`99-`) applies one qualitative overlay** the numbers don't fully capture:

- **Platanus precedent** — does an idea in this exact lane already have a documented Platanus win? (e.g. fintech/Kairos, education/Little Dragons)
- **LatAm authenticity** — Spanish-first, WhatsApp, regional pain point.
- **"Demos like a company"** — has a market number and an obvious next user.
- **Claude-as-engine visibility** — sponsor affinity.

This overlay is why the top-composite idea and the final pick may differ — and that gap is stated explicitly in `99-final-recommendation.md`.

---

## Score table (all 7, ranked by composite)

| # | Idea | Impact | Complexity | Fun | Present. | **Composite** |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Analyst-in-a-box (code-exec data agent) | 8 | 4 | 6 | 8 | **7.5** |
| 2 | Debt Autopilot (LatAm fintech agent) | 9 | 5 | 6 | 8 | **7.4** |
| 3 | Game Tutor (generative playable lessons) | 7 | 6 | 9 | 9 | **7.2** |
| 8 | **Gemelo — Secure Digital Twin** (added later) | 9 | 8 | 9 | 9 | **7.1** |
| 4 | WhatsApp Caller (voice phone agent) | 8 | 8 | 9 | 9 | **6.8** |
| 5 | Trámite Autopilot (computer-use bureaucracy) | 9 | 9 | 8 | 9 | **6.7** |
| 6 | Agent Swarm Builder (multi-agent ships an app) | 7 | 8 | 9 | 9 | **6.5** |
| 7 | MCP Toolsmith (auto-generate tools devtool) | 7 | 6 | 8 | 6 | **6.2** |

> Note how the composite **rewards shippability**: the flashiest ideas (Trámite, Swarm) rank *lower* than duller-but-reliable ones (Analyst, Debt) because a fragile live demo is a real risk. The `99-` doc reconciles composite rank vs. win ceiling. Folder files are numbered in the original composite-rank order (`idea-1` = highest composite).
>
> **Idea 8 — Gemelo (Secure Digital Twin)** was added after the original 7, at the user's direction (it's the concept they actually want to build). Composite **7.1** places it 4th on the risk-averse math — held back only by high scope/complexity (8/10). On the **win-fit overlay** (Anthropic agent-security theme, fundability, novelty, and builder motivation) it is the strongest in the set. Its full package lives in `idea-8-digital-twin/` (README + `SECURITY.md` + `BUILD-STEPS.md`). See `99-` for how composite rank and win-ceiling reconcile — and why a motivated builder who scopes ruthlessly should strongly consider it despite the lower composite.
