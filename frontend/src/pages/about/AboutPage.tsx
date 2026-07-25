import { Link } from "react-router-dom";
import { ThemeToggle } from "../../components/ui";

const STEPS = [
  ["Commit", "Choose a problem and whether to record. The statement stays hidden until you start."],
  ["Solve out loud", "Keystrokes, speech, sketches and verdicts are all timestamped."],
  ["Replay", "A scrubbable timeline of your session, with the dead air skipped."],
  ["Diagnosis", "Claude names one specific weakness, quoting your own timestamps."],
];

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-24">
      <header className="flex items-center justify-between py-6">
        <Link to="/" className="text-sm text-text-muted transition-colors hover:text-text">
          &larr; Back
        </Link>
        <ThemeToggle />
      </header>

      <h1 className="text-3xl font-semibold tracking-tight text-text">
        Every judge grades your answer.
        <br />
        <span className="text-text-muted">This one grades your thinking.</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
        WatchMeCode records how you solve — then replays it and tells you what actually
        slowed you down.
      </p>

      <figure className="mt-10">
        <img
          src="/timeline-preview.png"
          alt="A finished session: the Aha-Gap, a diagnosed bottleneck, and a colour-coded timeline of the solve beside the code."
          className="w-full rounded-xl border border-border shadow-sm"
          loading="lazy"
        />
        <figcaption className="mt-3 text-xs leading-relaxed text-text-muted">
          A finished session. Left: the diagnosis. Right: your code at every moment,
          your transcript below it, and a timeline coloured by what you were doing —
          reading, thinking, coding, debugging.
        </figcaption>
      </figure>

      <ol className="mt-12 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-sm font-medium text-text">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="text-sm font-semibold text-text">The Aha-Gap</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-muted">
          Seconds between your insight landing and correct code existing. Strong solvers
          think long and implement fast — so a long silence followed by a clean first
          implementation is the work, not wasted time.
        </p>
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-sm font-semibold text-text">How it's built</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-muted">
          51 real Codeforces problems, each validated against a known-correct solution. A
          local Python/C++ judge — no external service. Recommendations are deterministic
          and explain themselves. <strong className="font-medium text-text">Claude is used
          in exactly one place</strong>: reading the session tape. Everything runs on your
          machine, with your own key.
        </p>
      </section>

      <p className="mt-12 text-xs text-text-muted">
        Built solo at Platanus Build Night, Bogotá &middot;{" "}
        <a
          href="https://github.com/danidiaztech"
          className="text-accent hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          @danidiaztech
        </a>
      </p>
    </div>
  );
}
