# Game Tutor — "Cualquier tema, convertido en un juego jugable"

## One-liner
Type any topic and an agent designs and builds a playable browser mini-game that teaches it — generated live, in front of you, in ~40 seconds.

## The idea
The Platanus Education-track winner (**Little Dragons**) won on delight and a clear "who it helps." This takes that lesson and makes it *generative*: instead of one hand-built game, an **agent that is a game designer** — you give it "fracciones para niños de 8 años" or "cómo funciona el interés compuesto," and it decides the mechanic, writes the game logic + HTML/canvas, and ships a playable game you can click *right now*. The wow is watching a real, interactive artifact — not a quiz, an actual little game — appear from a sentence.

It's for teachers (especially LatAm multi-grade classrooms where one teacher juggles many levels), parents, and self-learners. The agency is real and visible: the model reasons about *pedagogy* ("for 8-year-olds, use a drag-and-drop pizza-slice mechanic, not text") and then *builds the thing*.

Why now: Opus 4.8 is a strong enough coder to reliably emit a self-contained playable canvas game from a spec, and doing it *live on stage* is a pure "you couldn't do this yesterday" moment. It's the most joyful build here and photographs/shares beautifully (popular-vote friendly).

## Why this could win
- **Precedent + delight** — education already wins at Platanus when the demo is delightful; this is delightful *and* novel (generative, not a fixed game).
- **Live generation is the wow** — a playable game materializing from a sentence is visual, fast, hard to fake.
- **"Abuelita"/kid test nailed** — anyone watching instantly gets it; a judge can *play* it.
- **Shareable** — screenshot-able, popular-vote friendly (2,200 votes decided a Platanus prize).
- **Claude-as-engine is undeniable** — it's literally writing a game live.

## Impact — 7/10
Real and lovable, strong for education/LatAm classrooms, but "would someone pay recurring" is softer than fintech — edtech monetization is harder. Fundable but not a slam-dunk business.

## Complexity — 6/10 (10 = hardest)
Mid. The agent must emit *reliably runnable* self-contained games — the hard part. **Riskiest component:** a generated game that errors or is unplayable live. Mitigate by constraining to a few known-good mechanic templates the model fills in, rather than free-form from scratch.

## Fun — 9/10
The most enjoyable build here — you'll be grinning watching it generate games.

## Presentability — 9/10
Excellent: sentence in → playable game out, visual and interactive, judges can touch it.

## Composite score
**7.2 / 10.** `0.30×9 + 0.28×7 + 0.32×(11−6) + 0.10×9 = 7.16`.

## 10-hour build plan
- **H0–1 — Setup.** Vite/Next + Vercel, Anthropic key. Decide on a self-contained-canvas-game output format (single HTML string, no external deps).
- **H1–3 — Generation loop.** Prompt Opus 4.8 to emit a complete playable game from a topic. Get *one* mechanic (drag-and-drop) working reliably.
- **H3–5 — Reliability via templates.** Give the model 3–4 mechanic "skeletons" (drag-drop, matching, timed-quiz-arcade, sorting) to fill in — dramatically raises runnable-rate. Sandboxed iframe render.
- **H5–7 — "Show the design reasoning" + self-repair.** Stream the agent's pedagogical choices; add a validate→auto-fix pass (run the game headless, if it throws, feed the error back to Claude once).
- **H7–8.5 — Polish.** Spanish UI, nice loading state, gallery of 3 pre-generated bangers as fallback.
- **H8.5–10 — Demo prep.** Rehearse a topic you know renders great; keep the gallery as a safety net. **Cut line:** drop self-repair + gallery, keep 2 rock-solid mechanic templates.

## Tech stack
- **Model:** `claude-opus-4-8` (game code gen); `claude-haiku-4-5` for the mechanic-selection step.
- **Anthropic:** Messages API (+ optional structured outputs to pick mechanic/params). Self-serve.
- **App:** Vite/Next on **Vercel**; sandboxed iframe to run generated games; **Supabase** optional to save a shareable gallery.
- Confirmed accessible today.

## Demo script (70s)
1. (10s) "Give me any topic and an age." Type: *"interés compuesto, 10 años."*
2. (25s) Agent narrates: "para niños uso una mecánica visual de monedas que crecen…" then writes the game live.
3. (25s) A playable game appears in the iframe — hand the laptop to a judge, let them play for 15s.
4. (10s) "One teacher, 30 kids, 6 grade levels — un juego para cada uno, al instante."

## Biggest risk
A live-generated game that's broken/unplayable. **Mitigation:** constrain to vetted mechanic templates; add one auto-repair retry; keep a pre-generated gallery to fall back to; rehearse on a topic proven to render.
