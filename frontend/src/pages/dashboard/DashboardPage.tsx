import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { ProblemListItem, Recommendation } from "../../lib/types";
import { Badge, Card, EmptyState, PageHeader, Spinner, ThemeToggle } from "../../components/ui";

export function DashboardPage() {
  const [problems, setProblems] = useState<ProblemListItem[] | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listProblems(), api.getRecommendations()])
      .then(([p, r]) => {
        setProblems(p);
        setRecommendations(r);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load data"));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6">
      <PageHeader
        title="CP Trainer"
        subtitle="Capture how you solve, judge locally, understand your cognition."
        actions={<ThemeToggle />}
      />

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Recommended next
        </h2>
        {error && <p className="text-sm text-danger">{error}</p>}
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
              <Card key={rec.problem.id} className="p-4">
                <Link to={`/solve/${rec.problem.id}`} className="font-medium text-text hover:text-accent">
                  {rec.problem.title}
                </Link>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rec.why.map((w) => (
                    <Badge key={w} tone="accent">
                      {w}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Problems
        </h2>
        {!error && problems === null && (
          <div className="flex items-center gap-2 text-text-muted">
            <Spinner size="sm" /> Loading problems…
          </div>
        )}
        {problems !== null && problems.length === 0 && !error && (
          <EmptyState
            title="No problems yet"
            description="Run `make seed` to load the problem set."
          />
        )}
        {problems !== null && problems.length > 0 && (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            {problems.map((p) => (
              <Link
                key={p.id}
                to={`/solve/${p.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-alt"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text">{p.title}</span>
                  <div className="flex gap-1">
                    {p.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-text-muted">
                  {p.rating != null && <span>{p.rating}</span>}
                  {p.solved && <Badge tone="success">solved</Badge>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
