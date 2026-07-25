import { Link } from "react-router-dom";
import { Card, ThemeToggle } from "../../components/ui";

const STEPS = [
  {
    n: "01",
    title: "Commit before you look",
    body: "Pick a problem and choose whether to record your voice. The statement, samples and tags stay on the server until you commit — so the clock starts when you actually start.",
  },
  {
    n: "02",
    title: "Solve out loud",
    body: "Write code, sketch on the canvas, run custom tests. Every keystroke, spoken sentence and judge verdict is timestamped as you go. Nothing leaves your machine.",
  },
  {
    n: "03",
    title: "Watch the replay",
    body: "Your session becomes a scrubable timeline — code evolving beside what you were saying, with the dead air compressed away.",
  },
  {
    n: "04",
    title: "Read the diagnosis",
    body: "Claude reads the tape and names one specific, falsifiable thing holding you back — with timestamps and quotes, never generic advice.",
  },
];

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-20">
      <header className="flex items-center justify-between py-6">
        <Link to="/" className="text-sm text-text-muted transition-colors hover:text-text">
          &larr; Back
        </Link>
        <ThemeToggle />
      </header>

      <h1 className="text-3xl font-semibold tracking-tight text-text">About WatchMeCode</h1>
      <p className="mt-3 text-base leading-relaxed text-text-muted">
        Every competitive programming site grades the same thing: whether your final code
        passes. None of them look at how you got there — and that's where the improvement
        actually lives.
      </p>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text">
          How it works
        </h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <Card key={s.n} className="flex gap-4 p-4">
              <span className="font-mono text-xs text-accent">{s.n}</span>
              <div>
                <h3 className="text-sm font-medium text-text">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{s.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text">
          The Aha-Gap
        </h2>
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-text-muted">
            The headline metric: the time between the moment your insight lands — spoken
            aloud, quoted verbatim from your own transcript — and the moment correct code
            exists. Strong solvers think for a long time and then implement fast. A long
            silence followed by a clean first implementation isn't wasted time; it's the
            work. The analysis is built to read it that way, and to stay honest when there's
            no evidence: no transcript means no invented insight.
          </p>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text">
          Built with
        </h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row k="Problems" v="51 curated Codeforces problems from DeepMind's CodeContests (CC BY 4.0), each validated by running a known-correct solution" />
          <Row k="Judge" v="Local sandboxed runner — Python & C++, per-problem time and memory limits, no external judge or API key" />
          <Row k="Recommendations" v="Deterministic scoring over per-topic mastery, rating fit, staleness and diversity — zero AI, fully explainable" />
          <Row k="Analysis" v="Claude, via your own API key or Claude subscription. It's the only step that calls a model" />
          <Row k="Stack" v="React + Vite + Tailwind, FastAPI + Postgres" />
          <Row k="Privacy" v="Self-hosted. Your sessions, recordings and transcripts stay in your own database" />
        </dl>
      </section>

      <p className="mt-10 text-xs text-text-muted">
        Built solo at Platanus Build Night, Bogotá.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{k}</dt>
      <dd className="mt-1 leading-relaxed text-text">{v}</dd>
    </div>
  );
}
