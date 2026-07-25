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

    // Rehydration: if this session was already analyzed, render it
    // immediately — no CTA, no re-running Claude just to view the page.
    api
      .getPersistedAnalysis(Number(sessionId))
      .then((a) => {
        if (!cancelled) setAnalysis(a.result);
      })
      .catch(() => {
        // 404 (not analyzed yet) is expected and not an error state.
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
    // h-screen (not h-full): the app shell only sets min-height on its root,
    // so a percentage height here would resolve against an indefinite
    // ancestor height. A viewport unit gives this page a definite height
    // regardless, which the flex chain below needs to constrain the player.
    <div className="mx-auto flex h-screen max-w-[1500px] flex-col px-6">
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pb-6 lg:flex-row">
          <div className="min-h-0 overflow-y-auto pr-1 lg:w-[360px] lg:shrink-0">
            <SummaryColumn
              problem={problem}
              session={session}
              analysis={analysis}
              analyzing={analyzing}
              analyzeError={analyzeError}
              onAnalyze={handleAnalyze}
            />
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            <Panel
              title="Timeframe player"
              className="h-full min-w-0"
              bodyClassName="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <TimeframePlayer session={session} analysis={analysis} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
