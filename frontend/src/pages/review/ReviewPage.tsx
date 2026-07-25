import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { AnalysisResult, ProblemDetail, SessionDetail } from "../../lib/types";
import { EmptyState, Panel, PageHeader, Spinner, ThemeToggle } from "../../components/ui";
import { SummaryColumn } from "./summary/SummaryColumn";
import { TimeframePlayer } from "./player/TimeframePlayer";

/**
 * Review screen: a left summary column (structured verdict/aha-gap/
 * bottleneck/strengths/drills/editorial sections) and a right "timeframe
 * player" replaying the session's captured events.
 */
export function ReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setSession(null);
    setProblem(null);
    setError(null);
    setAnalysis(null);
    setAnalyzeError(null);

    api
      .getSession(Number(sessionId))
      .then((s) => {
        if (cancelled) return undefined;
        setSession(s);
        return api.getProblem(s.problem_id);
      })
      .then((p) => {
        if (!cancelled && p) setProblem(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load session");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleAnalyze = useCallback(async () => {
    if (!sessionId) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await api.analyzeSession(Number(sessionId));
      setAnalysis(result);
    } catch (e) {
      setAnalyzeError(e instanceof ApiError ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [sessionId]);

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col px-6">
      <PageHeader
        title={problem ? `Review — ${problem.title}` : "Review"}
        subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
        actions={<ThemeToggle />}
      />

      {error && <EmptyState title="Could not load session" description={error} />}

      {!error && (!session || !problem) && (
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading session…
        </div>
      )}

      {session && problem && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pb-6 lg:grid-cols-[360px_1fr]">
          <div className="min-h-0 overflow-y-auto pr-1">
            <SummaryColumn
              problem={problem}
              session={session}
              analysis={analysis}
              analyzing={analyzing}
              analyzeError={analyzeError}
              onAnalyze={handleAnalyze}
            />
          </div>

          <Panel title="Timeframe player" bodyClassName="flex min-h-0 flex-1 flex-col">
            <TimeframePlayer session={session} analysis={analysis} />
          </Panel>
        </div>
      )}
    </div>
  );
}
