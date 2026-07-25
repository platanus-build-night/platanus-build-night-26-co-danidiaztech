# WhatsApp Caller — "Tu agente que hace las llamadas por ti"

## One-liner
Text an agent on WhatsApp — "consígueme cita con el dentista para el jueves" — and it places the real phone call, talks to the receptionist in natural Spanish, and books it for you.

## The idea
Phone calls to businesses are dread-inducing and unavoidable in LatAm: clinics, restaurants, government lines, service providers that only answer by phone. This is an agent that **makes the call for you**. You message it on WhatsApp (the dominant regional channel — despens.ai leaned on exactly this); it places an outbound call via telephony, uses real-time speech + a natural Spanish voice (ElevenLabs, a Platanus sponsor), navigates the conversation (holds, "un momento," transfers), extracts the outcome, and reports back on WhatsApp: "Listo, cita el jueves 3pm."

It's for anyone who hates calling — i.e. everyone, but especially busy people and those with phone anxiety. The agency is unmistakable and the demo is a **live phone call on stage**: the single most jaw-dropping, hard-to-fake wow moment available. This is the FaceTimeOS insight — take a known capability (voice agent) and wrap it in a universally familiar interface (a WhatsApp text → a real call).

Why now: real-time voice + turn-taking + a natural TTS voice finally sound human enough to fool a receptionist for a 60-second transaction, and pairing it with WhatsApp makes it feel like a product, not a lab demo.

## Why this could win
- **The strongest live wow of any idea here** — an actual phone rings and a Claude agent negotiates in Spanish, on stage. Nearly impossible to fake, unforgettable after 20 other demos.
- **LatAm-native interface** — WhatsApp in, voice call out.
- **Sponsor stack showcase** — Claude (brain) + ElevenLabs (voice), both Platanus sponsors.
- **Agentic to the core** — it takes a real-world action with a real outcome.

## Impact — 8/10
Broadly useful, clear willingness to pay, obvious consumer product. Slightly docked because reliability/liability of an AI making calls at scale is a real go-to-market hurdle.

## Complexity — 8/10 (10 = hardest)
High. Telephony (Twilio) + real-time bidirectional audio + STT/TTS + turn-taking + WhatsApp integration is a lot of moving parts for solo/10h. **Riskiest component:** low-latency real-time voice loop that doesn't talk over the human or freeze on silence.

## Fun — 9/10
Extremely fun and a little mischievous — you'll love building it.

## Presentability — 9/10
Top-tier *if it works live*; a real call is the best demo in the room. The risk is entirely execution, not concept.

## Composite score
**6.8 / 10.** `0.30×9 + 0.28×8 + 0.32×(11−8) + 0.10×9 = 6.80` — high ceiling, dragged down by fragility.

## 10-hour build plan
- **H0–1.5 — Telephony spike FIRST.** Twilio outbound call + media stream ↔ your server. **If this isn't working by H2, pivot.** This is the make-or-break, so front-load it.
- **H1.5–3.5 — Voice loop.** Wire STT (Deepgram/Whisper) → Claude → ElevenLabs TTS back into the call. Get one scripted turn working.
- **H3.5–5.5 — Conversation agent.** Claude drives turn-taking with a goal ("book Thursday 3pm"), handles holds/clarifications, decides when done. Structured-output the final result.
- **H5.5–7 — WhatsApp front door.** Inbound message → parse intent → trigger call → report result. (`wa.me` / Twilio WhatsApp sandbox.)
- **H7–8.5 — Harden latency + interruption handling;** barge-in, silence timeouts.
- **H8.5–10 — Demo prep.** Rehearse calling a *controlled* number (a friend/second phone playing receptionist) so the "receptionist" side is reliable. **Cut line:** drop WhatsApp front door, trigger the call from a simple web button; keep the live call.

## Tech stack
- **Model:** `claude-opus-4-8` (conversation policy) — low-latency; consider `claude-haiku-4-5` for snappier turns.
- **Voice:** **ElevenLabs** (sponsor) TTS; Deepgram/Whisper STT.
- **Telephony:** Twilio Programmable Voice + Media Streams; Twilio WhatsApp sandbox.
- **App:** Node/Next on **Vercel** or a small always-on server (telephony needs a stable websocket — a Render/Fly box may be safer than serverless). Flag: **Twilio needs a paid number (~cheap) and setup — do this before the event.**

## Demo script (85s)
1. (10s) On stage: "I need a dentist appointment Thursday. Watch." Send a WhatsApp message to the agent.
2. (10s) Speakerphone: the agent dials. It rings — audibly, live.
3. (40s) A "receptionist" answers; the agent converses in natural Spanish, handles a "let me check" hold, confirms Thursday 3pm.
4. (15s) WhatsApp pings back: "✅ Cita confirmada, jueves 3pm."
5. (10s) "WhatsApp es el canal de LatAm. Nadie quiere llamar. El agente llama por ti."

## Biggest risk
The live real-time voice loop is fragile: latency, barge-in, or a noisy room can make it stall or talk over the human. **Mitigation:** demo by calling a *controlled* second phone (a confederate reading loose lines), not a random business; rehearse the exact call 20×; keep a recorded backup of a successful call to play if the live one fails. **Also: validate Twilio + audio latency in the first 2 hours — this is the one idea with a hard "pivot if the spike fails" gate.**
