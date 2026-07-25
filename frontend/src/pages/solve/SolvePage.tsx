import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { ProblemDetail } from "../../lib/types";
import { Badge, EmptyState, Panel, PageHeader, Spinner, ThemeToggle } from "../../components/ui";

/**
 * Placeholder for the solve wireframe (statement | code/draw toggle | run bar).
 * Owned by Agent C — this is scaffolding that proves the route + API wiring
 * work end-to-end; Agent C replaces the body with Monaco/Excalidraw + capture.
 */
export function SolvePage() {
  const { problemId } = useParams<{ problemId: string }>();
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!problemId) return;
    api
      .getProblem(Number(problemId))
      .then(setProblem)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load problem"));
  }, [problemId]);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6">
      <PageHeader
        title={problem?.title ?? "Solve"}
        subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
        actions={<ThemeToggle />}
      />

      {error && <EmptyState title="Could not load problem" description={error} />}

      {!error && !problem && (
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading problem…
        </div>
      )}

      {problem && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pb-6 md:grid-cols-2">
          <Panel title="Statement">
            <div className="mb-3 flex flex-wrap gap-1">
              {problem.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
              {problem.rating != null && <Badge tone="accent">{problem.rating}</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-sm text-text">{problem.statement_md}</p>
          </Panel>
          <Panel title="Code / Draw (placeholder)">
            <EmptyState
              title="Solve workspace coming soon"
              description="Monaco editor, Excalidraw canvas, mic capture, and the run/submit bar land here."
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
