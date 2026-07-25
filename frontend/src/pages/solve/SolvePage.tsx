import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { ProblemDetail, RunResult, SubmitResult } from "../../lib/types";
import { Button, EmptyState, PageHeader, Spinner, ThemeToggle } from "../../components/ui";
import { StatementPanel } from "./components/StatementPanel";
import { CodeEditor } from "./components/CodeEditor";
import { DrawNotesPanel } from "./components/DrawNotesPanel";
import { BottomBar } from "./components/BottomBar";
import { JudgeResultsPanel } from "./components/JudgeResultsPanel";
import { useEventRecorder } from "./hooks/useEventRecorder";
import { useCodeSnapRecorder, useDebouncedSnap } from "./hooks/useThrottledSnap";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useAppTheme } from "./hooks/useAppTheme";
import { useElapsedTime } from "./hooks/useElapsedTime";
import { STARTER_TEMPLATE, type DrawScene, type Language } from "./types";

type RightTab = "code" | "draw";
type ResultsMode = "run" | "submit" | null;

export function SolvePage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const appTheme = useAppTheme();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const sessionCreationStarted = useRef(false);

  const [rightTab, setRightTab] = useState<RightTab>("code");
  const [language, setLanguage] = useState<Language>("python");
  const [codeByLanguage, setCodeByLanguage] = useState<Record<Language, string>>({
    python: STARTER_TEMPLATE.python,
    cpp: STARTER_TEMPLATE.cpp,
  });
  const [notes, setNotes] = useState("");
  const [drawScene, setDrawScene] = useState<DrawScene | null>(null);

  const [resultsMode, setResultsMode] = useState<ResultsMode>(null);
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { record, flush, sessionStartMs } = useEventRecorder(sessionId);
  const code = codeByLanguage[language];

  // --- load problem ---------------------------------------------------
  useEffect(() => {
    if (!problemId) return;
    api
      .getProblem(Number(problemId))
      .then(setProblem)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load problem"));
  }, [problemId]);

  // --- start session once the problem is known -------------------------
  useEffect(() => {
    if (!problem || sessionCreationStarted.current) return;
    sessionCreationStarted.current = true;
    api
      .createSession(problem.id, language)
      .then((res) => setSessionId(res.id))
      .catch(() => setActionError("Could not start a capture session — your work won't be recorded."));
    // Session is created once for the lifetime of this page; language
    // switches thereafter are recorded on each code_snap event instead of
    // re-POSTing /sessions (the API has no session-update endpoint).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  // --- capture hooks -----------------------------------------------------
  useCodeSnapRecorder(code, language, record);
  useDebouncedSnap(notes, 3000, (text) => record("note_snap", { text }));
  useDebouncedSnap(drawScene, 3000, (scene) => {
    if (scene) record("draw_snap", { scene });
  });
  const speech = useSpeechRecognition(sessionStartMs, (text) => record("transcript", { text }));
  const elapsed = useElapsedTime(sessionStartMs);

  const handleLanguageChange = useCallback(
    (next: Language) => {
      setLanguage(next);
      record("code_snap", { code: codeByLanguage[next], language: next, event: "language_switch" });
    },
    [codeByLanguage, record]
  );

  const handleRun = useCallback(async () => {
    if (!problem) return;
    setRunning(true);
    setActionError(null);
    try {
      const results = await api.run(problem.id, language, code);
      setRunResults(results);
      setResultsMode("run");
      record("run", { language, verdicts: results.map((r) => r.verdict) });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }, [problem, language, code, record]);

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await api.submit(problem.id, language, code, sessionId ?? undefined);
      setSubmitResult(result);
      setResultsMode("submit");
      record("submit", { language, verdict: result.verdict, time_ms: result.time_ms });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [problem, language, code, sessionId, record]);

  const handleFinish = useCallback(async () => {
    if (!sessionId) return;
    setFinishing(true);
    setActionError(null);
    try {
      flush();
      await api.finishSession(sessionId);
      navigate(`/review/${sessionId}`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not finish the session");
      setFinishing(false);
    }
  }, [sessionId, flush, navigate]);

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

  if (!problem) {
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

  return (
    <div className="mx-auto flex h-screen max-w-7xl flex-col px-6">
      <PageHeader
        title={problem.title}
        subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
        actions={<ThemeToggle />}
      />

      {actionError && <p className="mb-2 shrink-0 text-sm text-danger">{actionError}</p>}

      <div className="grid min-h-0 flex-1 grid-rows-1 grid-cols-1 gap-4 pb-4 lg:grid-cols-2">
        <div className="min-h-0">
          <StatementPanel problem={problem} />
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex shrink-0 gap-1 rounded-lg border border-border bg-surface-alt p-1">
            <Button
              variant={rightTab === "code" ? "primary" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setRightTab("code")}
            >
              Code
            </Button>
            <Button
              variant={rightTab === "draw" ? "primary" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setRightTab("draw")}
            >
              Draw + Notes
            </Button>
          </div>

          <div className="min-h-0 flex-1">
            {rightTab === "code" ? (
              <CodeEditor
                language={language}
                code={code}
                onLanguageChange={handleLanguageChange}
                onCodeChange={(next) => setCodeByLanguage((prev) => ({ ...prev, [language]: next }))}
              />
            ) : (
              <DrawNotesPanel
                theme={appTheme}
                notes={notes}
                onNotesChange={setNotes}
                onSceneChange={setDrawScene}
              />
            )}
          </div>
        </div>
      </div>

      {resultsMode && (
        <div className="h-64 shrink-0 pb-4">
          <JudgeResultsPanel
            mode={resultsMode}
            runResults={runResults}
            submitResult={submitResult}
            onClose={() => setResultsMode(null)}
          />
        </div>
      )}

      <BottomBar
        elapsed={elapsed}
        micSupported={speech.supported}
        listening={speech.listening}
        liveTranscript={speech.interimText || speech.lastFinalText}
        onToggleMic={speech.toggle}
        onRun={handleRun}
        onSubmit={handleSubmit}
        onFinish={handleFinish}
        running={running}
        submitting={submitting}
        finishing={finishing}
      />
    </div>
  );
}
