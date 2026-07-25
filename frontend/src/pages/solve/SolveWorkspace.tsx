import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import type { CustomRunResult, ProblemDetail, RunResult, SubmitResult } from "../../lib/types";
import { Button, PageHeader, SplitPane, ThemeToggle } from "../../components/ui";
import { StatementPanel } from "./components/StatementPanel";
import { CodeEditor } from "./components/CodeEditor";
import { DrawNotesPanel } from "./components/DrawNotesPanel";
import { BottomBar } from "./components/BottomBar";
import { JudgeResultsPanel } from "./components/JudgeResultsPanel";
import { CustomTestPanel } from "./components/CustomTestPanel";
import { useEventRecorder } from "./hooks/useEventRecorder";
import { useCodeSnapRecorder, useDebouncedSnap } from "./hooks/useThrottledSnap";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useAppTheme } from "./hooks/useAppTheme";
import { useElapsedTime } from "./hooks/useElapsedTime";
import { STARTER_TEMPLATE, type DrawScene, type Language } from "./types";

type RightTab = "code" | "draw" | "custom";
type ResultsMode = "run" | "submit" | null;

interface SolveWorkspaceProps {
  problem: ProblemDetail;
  sessionId: number;
  /** The pre-flight choice — mic permission was already verified when this
   * is true, so recording starts automatically instead of requiring a
   * second click. */
  autoStartMic: boolean;
}

/**
 * The actual solving UI: statement + editor/draw + bottom bar with capture.
 * Only mounted once the pre-flight gate has revealed the statement (see
 * PreflightGate.tsx / SolvePage.tsx) — this component's first render is
 * therefore the moment t=0 starts (useEventRecorder captures Date.now() at
 * mount), not whenever the page happened to load.
 */
export function SolveWorkspace({ problem, sessionId, autoStartMic }: SolveWorkspaceProps) {
  const navigate = useNavigate();
  const appTheme = useAppTheme();

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

  // Scratchpad state lives here (not in CustomTestPanel) so the input survives
  // tab switches — losing hand-typed stdin on a tab change would be maddening.
  const [customStdin, setCustomStdin] = useState("");
  const [customExpected, setCustomExpected] = useState("");
  const [customResult, setCustomResult] = useState<CustomRunResult | null>(null);
  const [customRunning, setCustomRunning] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { record, flush, sessionStartMs } = useEventRecorder(sessionId);
  const code = codeByLanguage[language];

  useCodeSnapRecorder(code, language, record);
  useDebouncedSnap(notes, 3000, (text) => record("note_snap", { text }));
  useDebouncedSnap(drawScene, 3000, (scene) => {
    if (scene) record("draw_snap", { scene });
  });
  const speech = useSpeechRecognition(sessionStartMs, (text) => record("transcript", { text }));
  const elapsed = useElapsedTime(sessionStartMs);

  // Mic access was already verified during the pre-flight gate — start
  // listening immediately instead of making the user click the mic again.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartMic || autoStartedRef.current || !speech.supported) return;
    autoStartedRef.current = true;
    speech.toggle();
    // speech.toggle is stable (useCallback with empty/stable deps); we only
    // want this to fire once, right after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartMic, speech.supported]);

  const handleLanguageChange = useCallback(
    (next: Language) => {
      setLanguage(next);
      record("code_snap", { code: codeByLanguage[next], language: next, event: "language_switch" });
      api.patchSessionLanguage(sessionId, next).catch(() => {
        // Best-effort: the dashboard may show a stale language if this
        // fails, but capture itself (events) is unaffected.
      });
    },
    [codeByLanguage, record, sessionId]
  );

  const handleRun = useCallback(async () => {
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
  }, [problem.id, language, code, record]);

  const handleCustomRun = useCallback(async () => {
    setCustomRunning(true);
    setCustomError(null);
    try {
      const result = await api.runCustom(problem.id, language, code, customStdin, customExpected);
      setCustomResult(result);
      // Recorded as its own event kind: hand-made tests are a distinct
      // debugging behaviour from judging, and the analysis should be able to
      // tell "probed with own input" apart from "fired at the judge".
      record("custom_run", { language, verdict: result.verdict, stdin_chars: customStdin.length });
    } catch (e) {
      setCustomError(e instanceof ApiError ? e.message : "Custom run failed");
    } finally {
      setCustomRunning(false);
    }
  }, [problem.id, language, code, customStdin, customExpected, record]);

  const handleLoadSample = useCallback(() => {
    const first = problem.samples?.[0];
    if (!first) return;
    setCustomStdin(first.input);
    setCustomExpected(first.output);
  }, [problem.samples]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await api.submit(problem.id, language, code, sessionId);
      setSubmitResult(result);
      setResultsMode("submit");
      record("submit", { language, verdict: result.verdict, time_ms: result.time_ms });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [problem.id, language, code, sessionId, record]);

  const handleFinish = useCallback(async () => {
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

  return (
    // Wider than the rest of the app on purpose: this is the working screen and
    // the editor benefits from every pixel. Capped so lines don't sprawl on
    // ultrawide displays.
    <div className="mx-auto flex h-screen max-w-[1800px] flex-col px-6">
      <PageHeader
        title={problem.title}
        subtitle={<Link to="/" className="hover:text-accent">&larr; Back to problems</Link>}
        actions={<ThemeToggle />}
      />

      {actionError && <p className="mb-2 shrink-0 text-sm text-danger">{actionError}</p>}

      <SplitPane
        storageKey="trainer-solve-split"
        defaultLeftPct={38}
        minLeftPct={20}
        maxLeftPct={68}
        left={
          <div className="h-full min-h-0 pb-4 pr-2">
            <StatementPanel problem={problem} />
          </div>
        }
        right={
          <div className="flex h-full min-h-0 flex-col gap-3 pb-4 pl-2">
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
                variant={rightTab === "custom" ? "primary" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setRightTab("custom")}
              >
                Custom test
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

            {/* All three panes stay mounted and are hidden with CSS rather than
                unmounted: remounting Monaco/Excalidraw on every tab switch
                loses cursor position, undo history and scroll — and costs a
                visible re-layout. */}
            <div className="relative min-h-0 flex-1">
              <div className={`absolute inset-0 ${rightTab === "code" ? "" : "hidden"}`}>
                <CodeEditor
                  language={language}
                  code={code}
                  onLanguageChange={handleLanguageChange}
                  onCodeChange={(next) =>
                    setCodeByLanguage((prev) => ({ ...prev, [language]: next }))
                  }
                />
              </div>
              <div className={`absolute inset-0 ${rightTab === "custom" ? "" : "hidden"}`}>
                <CustomTestPanel
                  stdin={customStdin}
                  expected={customExpected}
                  onStdinChange={setCustomStdin}
                  onExpectedChange={setCustomExpected}
                  onRun={handleCustomRun}
                  running={customRunning}
                  result={customResult}
                  error={customError}
                  onLoadSample={problem.samples?.length ? handleLoadSample : undefined}
                />
              </div>
              <div className={`absolute inset-0 ${rightTab === "draw" ? "" : "hidden"}`}>
                <DrawNotesPanel
                  theme={appTheme}
                  notes={notes}
                  onNotesChange={setNotes}
                  onSceneChange={setDrawScene}
                />
              </div>
            </div>
          </div>
        }
      />

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
        micStatus={speech.status}
        micErrorMessage={speech.errorMessage}
        micSilentWarning={speech.silentWarning}
        micWordsCaptured={speech.wordsCaptured}
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
