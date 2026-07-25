import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { ProblemListItem, Recommendation, SessionListItem } from "../../lib/types";
import { Badge, Button, Card, EmptyState, Spinner, ThemeToggle } from "../../components/ui";
import { cn } from "../../lib/cn";
import {
  DIFFICULTY_BANDS,
  SORT_OPTIONS,
  bandFor,
  compareProblems,
  type SortKey,
} from "../../lib/difficulty";

export function DashboardPage() {
  const navigate = useNavigate();

  const [problems, setProblems] = useState<ProblemListItem[] | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listProblems(), api.getRecommendations(), api.listSessions()])
      .then(([p, r, s]) => {
        setProblems(p);
        setRecommendations(r);
        setSessions(s);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load data"));
  }, []);

  const solvedCount = (problems ?? []).filter((p) => p.solved).length;
  const finishedSessions = (sessions ?? []).filter((s) => s.status === "finished").length;

  return (
    <div className="mx-auto max-w-6xl px-6 pb-20">
      <Masthead onSettings={() => navigate("/settings")} />

      <Hero
        problemCount={problems?.length ?? null}
        solvedCount={solvedCount}
        sessionCount={finishedSessions}
      />

      {error && (
        <p className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <RecommendedSection recommendations={recommendations} error={!!error} />
      <RecentSessionsSection sessions={sessions} problems={problems} error={!!error} />
      <ProblemsSection problems={problems} error={!!error} />
    </div>
  );
}

// ------------------------------------------------------------------ Masthead --

function Masthead({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="flex items-center justify-between py-6">
      <Link to="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="text-lg font-semibold tracking-tight text-text">
          Watch<span className="text-accent">Me</span>Code
        </span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link
          to="/about"
          className="rounded-md px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          About
        </Link>
        <Button variant="secondary" size="sm" onClick={onSettings} aria-label="Settings">
          <span aria-hidden>⚙</span> Settings
        </Button>
        <ThemeToggle />
      </nav>
    </header>
  );
}

/** The mark: a play triangle inside a rounded square — "watch" plus "run". */
function Logo() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-contrast"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M4 3.2v7.6L11 7 4 3.2Z" fill="currentColor" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------- Hero --

function Hero({
  problemCount,
  solvedCount,
  sessionCount,
}: {
  problemCount: number | null;
  solvedCount: number;
  sessionCount: number;
}) {
  return (
    <section className="mb-10 border-b border-border pb-8">
      {/* The setup line is muted and the payoff carries full contrast — the
          brand name is the punchline, so it shouldn't be the greyed half. */}
      {/* text-balance keeps the two clauses from orphaning a single word onto a
          third line as the viewport narrows. */}
      <h1 className="max-w-4xl text-pretty text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[2.4rem]">
        <span className="text-text-muted">Codeforces grades your answer.</span>
        <br />
        <span className="text-text">
          Watch<span className="text-accent">Me</span>Code grades your thinking.
        </span>
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-text-muted">
        Solve while thinking out loud. Every keystroke and spoken word is timestamped, then
        replayed as a cognitive timeline — so you can see exactly where the insight landed
        and what it cost you to get there.
      </p>
      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        <Stat label="Problems" value={problemCount === null ? "—" : String(problemCount)} />
        <Stat label="Solved" value={String(solvedCount)} />
        <Stat label="Sessions analysed" value={String(sessionCount)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-xl text-text">{value}</dd>
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text">{title}</h2>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

// ------------------------------------------------------- Recommended next --

function RecommendedSection({
  recommendations,
  error,
}: {
  recommendations: Recommendation[] | null;
  error: boolean;
}) {
  return (
    <section className="mb-12">
      <SectionHeading title="Recommended next" hint="Picked from your per-topic mastery" />

      {!error && recommendations === null && (
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading recommendations…
        </div>
      )}
      {recommendations !== null && recommendations.length === 0 && !error && (
        <EmptyState
          title="No recommendations yet"
          description="Solve a few problems and recommendations will appear here."
        />
      )}
      {recommendations !== null && recommendations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {recommendations.map((rec) => {
            const band = bandFor(rec.problem.rating);
            return (
              <Card
                key={rec.problem.id}
                className="group relative flex flex-col gap-3 overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
              >
                {/* Difficulty stripe — the card's colour tells you the tier before you read it. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ backgroundColor: band.color }}
                />
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/solve/${rec.problem.id}`}
                    className="font-medium leading-snug text-text transition-colors hover:text-accent"
                  >
                    {rec.problem.title}
                  </Link>
                  {rec.problem.rating != null && (
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {rec.problem.rating}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className="text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: band.color }}
                  >
                    {band.label}
                  </span>
                  {rec.problem.tags.slice(0, 2).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>

                <ul className="flex flex-1 flex-col gap-1 text-xs text-text-muted">
                  {rec.why.map((w) => (
                    <li key={w} className="flex gap-1.5">
                      <span aria-hidden className="text-accent">
                        ·
                      </span>
                      {w}
                    </li>
                  ))}
                </ul>

                <Link to={`/solve/${rec.problem.id}`} className="mt-auto">
                  <Button size="sm" className="w-full">
                    Practice
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------- Recent sessions --

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function RecentSessionsSection({
  sessions,
  problems,
  error,
}: {
  sessions: SessionListItem[] | null;
  problems: ProblemListItem[] | null;
  error: boolean;
}) {
  const titleFor = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of problems ?? []) map.set(p.id, p.title);
    return map;
  }, [problems]);

  if (error || sessions === null) return null;

  const recent = [...sessions]
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 8);

  if (recent.length === 0) return null;

  return (
    <section className="mb-12">
      <SectionHeading title="Recent sessions" hint="Finished sessions open their replay" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {recent.map((s) => {
          const title = titleFor.get(s.problem_id) ?? `Problem #${s.problem_id}`;
          const finished = s.status === "finished";
          const content = (
            <Card
              className={cn(
                "flex h-full w-52 shrink-0 flex-col gap-2 p-3.5 transition-all duration-200",
                finished && "cursor-pointer hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    finished ? "bg-success" : "bg-text-muted"
                  )}
                  aria-hidden
                />
                <span className="text-[11px] text-text-muted">{relativeTime(s.started_at)}</span>
              </div>
              <span className="line-clamp-2 text-sm font-medium leading-snug text-text">{title}</span>
              <span className="mt-auto font-mono text-[11px] text-text-muted">{s.language}</span>
            </Card>
          );
          return finished ? (
            <Link key={s.id} to={`/review/${s.id}`}>
              {content}
            </Link>
          ) : (
            <div key={s.id}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- Problems --

function ProblemsSection({
  problems,
  error,
}: {
  problems: ProblemListItem[] | null;
  error: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [band, setBand] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("difficulty");
  const [hideSolved, setHideSolved] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  // Tags ranked by how many problems carry them: the long tail of one-off tags
  // is noise, so only the useful ones show until "more" is clicked.
  const rankedTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of problems ?? []) {
      for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [problems]);

  const visibleTags = showAllTags ? rankedTags : rankedTags.slice(0, 10);

  const filtered = useMemo(() => {
    if (!problems) return [];
    const q = query.trim().toLowerCase();
    const activeBand = band ? DIFFICULTY_BANDS.find((b) => b.key === band) : null;

    return problems
      .filter((p) => {
        if (q && !p.title.toLowerCase().includes(q)) return false;
        if (selectedTags.size > 0 && !p.tags.some((t) => selectedTags.has(t))) return false;
        if (hideSolved && p.solved) return false;
        if (activeBand) {
          const r = p.rating ?? 0;
          if (r < activeBand.min || r > activeBand.max) return false;
        }
        return true;
      })
      .sort(compareProblems(sort));
  }, [problems, query, selectedTags, band, sort, hideSolved]);

  // Counts per band drive the filter pills — a band with nothing in it is
  // shown greyed rather than hidden, so the scale stays legible.
  const bandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of problems ?? []) {
      const b = bandFor(p.rating);
      counts.set(b.key, (counts.get(b.key) ?? 0) + 1);
    }
    return counts;
  }, [problems]);

  // Grouping only makes sense while sorted by difficulty; any other sort would
  // interleave bands and the headers would lie.
  const grouped = sort === "difficulty" && band === null;

  const hasFilters = query || selectedTags.size > 0 || band !== null || hideSolved;

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function clearAll() {
    setQuery("");
    setSelectedTags(new Set());
    setBand(null);
    setHideSolved(false);
  }

  return (
    <section>
      <SectionHeading
        title="Problem set"
        hint={problems ? `${filtered.length} of ${problems.length} shown` : undefined}
      />

      {!error && problems === null && (
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading problems…
        </div>
      )}

      {problems !== null && problems.length === 0 && !error && (
        <EmptyState title="No problems yet" description="Run `make seed` to load the problem set." />
      )}

      {problems !== null && problems.length > 0 && (
        <>
          <div className="mb-5 space-y-3">
            {/* Difficulty band pills — the primary axis of separation. */}
            <div className="flex flex-wrap gap-1.5">
              <BandPill
                label="All"
                count={problems.length}
                active={band === null}
                onClick={() => setBand(null)}
              />
              {DIFFICULTY_BANDS.map((b) => (
                <BandPill
                  key={b.key}
                  label={b.label}
                  count={bandCounts.get(b.key) ?? 0}
                  color={b.color}
                  active={band === b.key}
                  onClick={() => setBand(band === b.key ? null : b.key)}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search problems…"
                aria-label="Search problems"
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort problems"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setHideSolved((v) => !v)}
                aria-pressed={hideSolved}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  hideSolved
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface text-text-muted hover:text-text"
                )}
              >
                Hide solved
              </button>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {visibleTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.has(tag)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selectedTags.has(tag)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-text-muted hover:border-text-muted hover:text-text"
                  )}
                >
                  {tag} <span className="opacity-60">{count}</span>
                </button>
              ))}
              {rankedTags.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllTags((v) => !v)}
                  className="px-1.5 py-1 text-xs text-accent hover:underline"
                >
                  {showAllTags ? "Show fewer" : `+${rankedTags.length - 10} more`}
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No problems match your filters"
              description="Try clearing the search, tags, or difficulty band."
            />
          ) : grouped ? (
            <div className="space-y-8">
              {DIFFICULTY_BANDS.map((b) => {
                const rows = filtered.filter((p) => bandFor(p.rating).key === b.key);
                if (rows.length === 0) return null;
                return (
                  <div key={b.key}>
                    <div className="mb-2 flex items-baseline gap-2.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: b.color }}
                      />
                      <h3 className="text-sm font-semibold text-text">{b.label}</h3>
                      <span className="font-mono text-xs text-text-muted">
                        {b.max === Number.MAX_SAFE_INTEGER ? `${b.min}+` : `${b.min}–${b.max}`}
                      </span>
                      <span className="ml-auto text-xs text-text-muted">{rows.length}</span>
                    </div>
                    <p className="mb-2.5 text-xs text-text-muted">{b.blurb}</p>
                    <ProblemTable rows={rows} />
                  </div>
                );
              })}
            </div>
          ) : (
            <ProblemTable rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}

function BandPill({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  const empty = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-text-muted hover:border-text-muted hover:text-text",
        empty && "cursor-not-allowed opacity-40 hover:border-border hover:text-text-muted"
      )}
    >
      {color && (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className="font-mono opacity-60">{count}</span>
    </button>
  );
}

function ProblemTable({ rows }: { rows: ProblemListItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map((p, i) => {
        const band = bandFor(p.rating);
        return (
          <Link
            key={p.id}
            to={`/solve/${p.id}`}
            className={cn(
              "group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-alt",
              i > 0 && "border-t border-border"
            )}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: band.color }}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text group-hover:text-accent">
              {p.title}
            </span>
            <div className="hidden shrink-0 gap-1 sm:flex">
              {p.tags.slice(0, 3).map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
            {p.solved && (
              <span className="shrink-0 text-xs font-medium text-success" title="Solved">
                ✓
              </span>
            )}
            <span className="w-10 shrink-0 text-right font-mono text-xs text-text-muted">
              {p.rating ?? "—"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
