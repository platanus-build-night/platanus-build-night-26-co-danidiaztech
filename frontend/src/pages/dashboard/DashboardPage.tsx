import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { ProblemListItem, Recommendation, SessionListItem } from "../../lib/types";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, ThemeToggle } from "../../components/ui";
import { cn } from "../../lib/cn";

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

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <PageHeader
        title="CP Trainer"
        subtitle="Capture how you solve, judge locally, understand your cognition."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate("/settings")} aria-label="Settings">
              <span aria-hidden>⚙</span> Settings
            </Button>
            <ThemeToggle />
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <RecommendedSection recommendations={recommendations} error={!!error} />

      <RecentSessionsSection sessions={sessions} problems={problems} error={!!error} />

      <ProblemsSection problems={problems} error={!!error} />
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
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
        Recommended next
      </h2>
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
        <div className="grid gap-3 sm:grid-cols-3">
          {recommendations.map((rec) => (
            <Card key={rec.problem.id} className="flex flex-col gap-3 p-4">
              <div>
                <Link
                  to={`/solve/${rec.problem.id}`}
                  className="font-medium text-text hover:text-accent"
                >
                  {rec.problem.title}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {rec.problem.rating != null && <Badge tone="neutral">{rec.problem.rating}</Badge>}
                  {rec.problem.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-1 flex-wrap items-start gap-1.5">
                {rec.why.map((w) => (
                  <Badge key={w} tone="accent">
                    {w}
                  </Badge>
                ))}
              </div>
              <Link to={`/solve/${rec.problem.id}`} className="mt-auto">
                <Button size="sm" className="w-full">
                  Practice
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------ Recent sessions

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

  if (error) return null;
  if (sessions === null) {
    return (
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Recent sessions
        </h2>
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading sessions…
        </div>
      </section>
    );
  }

  const recent = [...sessions]
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 8);

  if (recent.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
        Recent sessions
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {recent.map((s) => {
          const title = titleFor.get(s.problem_id) ?? `Problem #${s.problem_id}`;
          const content = (
            <Card
              className={cn(
                "flex w-56 shrink-0 flex-col gap-2 p-3",
                s.status === "finished" && "cursor-pointer hover:border-accent"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={s.status === "finished" ? "success" : "neutral"}>{s.status}</Badge>
                <span className="text-xs text-text-muted">{relativeTime(s.started_at)}</span>
              </div>
              <span className="truncate text-sm font-medium text-text">{title}</span>
              <span className="text-xs text-text-muted">{s.language}</span>
            </Card>
          );
          return s.status === "finished" ? (
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

function ProblemsSection({ problems, error }: { problems: ProblemListItem[] | null; error: boolean }) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const p of problems ?? []) for (const t of p.tags) tags.add(t);
    return [...tags].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    if (!problems) return [];
    const q = query.trim().toLowerCase();
    const min = minRating === "" ? null : Number(minRating);
    const max = maxRating === "" ? null : Number(maxRating);
    return problems.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (selectedTags.size > 0 && !p.tags.some((t) => selectedTags.has(t))) return false;
      if (min != null && (p.rating ?? 0) < min) return false;
      if (max != null && (p.rating ?? 0) > max) return false;
      return true;
    });
  }, [problems, query, selectedTags, minRating, maxRating]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Problems</h2>

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
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search problems…"
                aria-label="Search problems"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
              />
              <input
                type="number"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                placeholder="Min"
                aria-label="Minimum rating"
                className="w-20 rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
              />
              <input
                type="number"
                value={maxRating}
                onChange={(e) => setMaxRating(e.target.value)}
                placeholder="Max"
                aria-label="Maximum rating"
                className="w-20 rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
              />
              {(query || selectedTags.size > 0 || minRating || maxRating) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setSelectedTags(new Set());
                    setMinRating("");
                    setMaxRating("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <button key={t} type="button" onClick={() => toggleTag(t)} aria-pressed={selectedTags.has(t)}>
                  <Badge
                    tone={selectedTags.has(t) ? "accent" : "neutral"}
                    className={cn("cursor-pointer select-none", selectedTags.has(t) && "ring-1 ring-accent")}
                  >
                    {t}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No problems match your filters"
              description="Try clearing the search, tags, or rating range."
            />
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-surface">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to={`/solve/${p.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-alt"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate font-medium text-text">{p.title}</span>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm text-text-muted">
                    {p.rating != null && <span>{p.rating}</span>}
                    {p.solved && <Badge tone="success">solved</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
