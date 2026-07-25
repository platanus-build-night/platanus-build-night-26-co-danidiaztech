import { useState } from "react";
import { Badge, Button, Spinner } from "../../../components/ui";
import type { CustomRunResult } from "../../../lib/types";

const VERDICT_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  AC: "success",
  OK: "success",
  WA: "danger",
  RE: "danger",
  CE: "danger",
  TLE: "warning",
};

/** Explains what the verdict means *for a scratchpad run*, where "no expected
 * output" is a normal, valid way to work rather than a missing field. */
const VERDICT_HINT: Record<string, string> = {
  OK: "Ran cleanly — no expected output given, so nothing was compared.",
  AC: "Output matches your expected output.",
  WA: "Output differs from your expected output.",
  RE: "Crashed at runtime — see stderr.",
  CE: "Didn't compile.",
  TLE: "Exceeded the time limit.",
};

interface CustomTestPanelProps {
  stdin: string;
  expected: string;
  onStdinChange: (v: string) => void;
  onExpectedChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
  result: CustomRunResult | null;
  error: string | null;
  /** Fills stdin from the problem's first sample — the common starting point. */
  onLoadSample?: () => void;
}

function OutputBlock({
  label,
  value,
  tone = "default",
  empty = "(empty)",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
  empty?: string;
}) {
  const isEmpty = value.length === 0;
  return (
    <div className="flex min-h-0 flex-col">
      <div
        className={`mb-1 text-[11px] font-medium uppercase tracking-wide ${
          tone === "danger" ? "text-danger" : "text-text-muted"
        }`}
      >
        {label}
      </div>
      <pre
        className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-2 font-mono text-xs ${
          tone === "danger"
            ? "border-danger/30 bg-danger/5 text-text"
            : "border-border bg-surface text-text"
        } ${isEmpty ? "italic text-text-muted" : ""}`}
      >
        {isEmpty ? empty : value}
      </pre>
    </div>
  );
}

/**
 * Scratchpad: run the current code against hand-written stdin.
 *
 * Distinct from Run/Submit on purpose — this is the debugging surface, so it
 * shows stderr and the exit code (which the judge paths hide) and treats
 * "expected output" as optional.
 */
export function CustomTestPanel({
  stdin,
  expected,
  onStdinChange,
  onExpectedChange,
  onRun,
  running,
  result,
  error,
  onLoadSample,
}: CustomTestPanelProps) {
  const [showExpected, setShowExpected] = useState(false);
  const verdict = result?.verdict;

  // Ctrl/Cmd+Enter runs from inside either textarea — the muscle memory every
  // judge UI trains.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !running) {
      e.preventDefault();
      onRun();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button size="sm" onClick={onRun} disabled={running}>
          {running ? <Spinner /> : null}
          {running ? "Running…" : "Run custom test"}
        </Button>
        <span className="text-[11px] text-text-muted">⌘/Ctrl + ⏎</span>
        {onLoadSample && (
          <Button size="sm" variant="ghost" onClick={onLoadSample}>
            Load sample 1
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowExpected((v) => !v)}>
          {showExpected ? "Hide expected" : "+ Expected output"}
        </Button>
        {verdict && (
          <div className="ml-auto flex items-center gap-2">
            <Badge tone={VERDICT_TONE[verdict] ?? "neutral"}>{verdict}</Badge>
            <span className="text-xs text-text-muted">{result?.time_ms}ms</span>
            {typeof result?.exit_code === "number" && result.exit_code !== 0 && (
              <span className="text-xs text-text-muted">exit {result.exit_code}</span>
            )}
          </div>
        )}
      </div>

      {verdict && VERDICT_HINT[verdict] && (
        <p className="shrink-0 text-xs text-text-muted">{VERDICT_HINT[verdict]}</p>
      )}
      {error && <p className="shrink-0 text-xs text-danger">{error}</p>}

      <div className={`grid min-h-0 flex-1 gap-3 ${showExpected ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="flex min-h-0 flex-col">
          <label
            htmlFor="custom-stdin"
            className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted"
          >
            stdin
          </label>
          <textarea
            id="custom-stdin"
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder="Type the input your program should read…"
            className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-surface p-2 font-mono text-xs text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
          />
        </div>

        {showExpected && (
          <div className="flex min-h-0 flex-col">
            <label
              htmlFor="custom-expected"
              className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted"
            >
              expected
            </label>
            <textarea
              id="custom-expected"
              value={expected}
              onChange={(e) => onExpectedChange(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              placeholder="Optional — fill in to get AC/WA instead of OK."
              className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-surface p-2 font-mono text-xs text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
            />
          </div>
        )}

        {/* stderr replaces stdout as the focus whenever the program failed —
            that's the line you actually need when debugging. */}
        {result?.compile_error ? (
          <OutputBlock label="compiler error" value={result.compile_error} tone="danger" />
        ) : result?.stderr ? (
          <div className="flex min-h-0 flex-col gap-3">
            <OutputBlock label="stdout" value={result?.stdout ?? ""} />
            <OutputBlock label="stderr" value={result.stderr} tone="danger" />
          </div>
        ) : (
          <OutputBlock
            label="stdout"
            value={result?.stdout ?? ""}
            empty={running ? "running…" : "Run to see output."}
          />
        )}
      </div>
    </div>
  );
}
