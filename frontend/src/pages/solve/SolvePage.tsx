import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { ProblemDetail, ProblemMeta } from "../../lib/types";
import { EmptyState, PageHeader, Spinner, ThemeToggle } from "../../components/ui";
import { PreflightGate } from "./PreflightGate";
import { SolveWorkspace } from "./SolveWorkspace";

/**
 * Solve flow, gated in two stages so the statement is never in the browser
 * before the user commits (see CONTRACTS-adjacent note in PreflightGate):
 *   1. Fetch ProblemMeta only (title/rating/limits — no statement/samples/
 *      tags/editorial) and show the pre-flight "ready?" screen.
 *   2. Once the user chooses record-or-not, POST /sessions — the only call
 *      that returns the full ProblemDetail — and mount SolveWorkspace,
 *      whose first render is when the capture clock actually starts.
 */
export function SolvePage() {
  const { problemId } = useParams<{ problemId: string }>();

  const [problemMeta, setProblemMeta] = useState<ProblemMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [session, setSession] = useState<{ problem: ProblemDetail; id: number; recordVoice: boolean } | null>(
    null
  );
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startInFlight = useRef(false);

  useEffect(() => {
    if (!problemId) return;
    api
      .getProblemMeta(Number(problemId))
      .then(setProblemMeta)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load problem"));
  }, [problemId]);

  const handleStart = (recordVoice: boolean) => {
    if (!problemMeta || startInFlight.current) return;
    startInFlight.current = true;
    setStarting(true);
    setStartError(null);
    api
      .createSession(problemMeta.id, "python", recordVoice)
      .then((res) => setSession({ problem: res.problem, id: res.id, recordVoice }))
      .catch((e) => {
        setStartError(
          e instanceof ApiError ? e.message : "Could not start a capture session — try again."
        );
        startInFlight.current = false;
        setStarting(false);
      });
  };

  if (loadError) {
    return (
      <div className="mx-auto flex h-screen max-w-6xl flex-col px-6">
        <PageHeader
          title="Solve"
          subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
          actions={<ThemeToggle />}
        />
        <EmptyState title="Could not load problem" description={loadError} />
      </div>
    );
  }

  if (!problemMeta) {
    return (
      <div className="mx-auto flex h-screen max-w-6xl flex-col px-6">
        <PageHeader
          title="Solve"
          subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
          actions={<ThemeToggle />}
        />
        <div className="flex items-center gap-2 text-text-muted">
          <Spinner size="sm" /> Loading problem…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <PreflightGate
        problemMeta={problemMeta}
        onStart={handleStart}
        starting={starting}
        startError={startError}
      />
    );
  }

  return (
    <SolveWorkspace problem={session.problem} sessionId={session.id} autoStartMic={session.recordVoice} />
  );
}
