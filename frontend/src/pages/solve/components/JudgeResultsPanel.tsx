import { Badge, Button, Panel } from "../../../components/ui";
import type { RunResult, SubmitResult, Verdict } from "../../../lib/types";

const VERDICT_TONE: Record<Verdict, "success" | "danger" | "warning"> = {
  AC: "success",
  WA: "danger",
  TLE: "warning",
  RE: "danger",
  CE: "danger",
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const tone = VERDICT_TONE[verdict as Verdict] ?? "danger";
  return <Badge tone={tone}>{verdict}</Badge>;
}

interface TestRow {
  verdict: string;
  time_ms: number;
  stdout: string;
  expected: string;
}

function toTestRow(entry: Record<string, unknown>): TestRow {
  return {
    verdict: typeof entry.verdict === "string" ? entry.verdict : "?",
    time_ms: typeof entry.time_ms === "number" ? entry.time_ms : 0,
    stdout: typeof entry.stdout === "string" ? entry.stdout : "",
    expected: typeof entry.expected === "string" ? entry.expected : "",
  };
}

interface JudgeResultsPanelProps {
  mode: "run" | "submit";
  runResults: RunResult[] | null;
  submitResult: SubmitResult | null;
  onClose: () => void;
}

/** Slide-up strip showing the latest Run (per-sample) or Submit (per-test) verdicts. */
export function JudgeResultsPanel({ mode, runResults, submitResult, onClose }: JudgeResultsPanelProps) {
  const rows: TestRow[] =
    mode === "run"
      ? (runResults ?? []).map((r) => toTestRow(r as unknown as Record<string, unknown>))
      : (submitResult?.per_test ?? []).map(toTestRow);

  const overallVerdict =
    mode === "submit" ? submitResult?.verdict : rows.every((r) => r.verdict === "AC") ? "AC" : "WA";

  return (
    <Panel
      title={mode === "run" ? "Run results (samples)" : "Submit result"}
      actions={
        <div className="flex items-center gap-2">
          {overallVerdict && <VerdictBadge verdict={overallVerdict} />}
          {mode === "submit" && submitResult && (
            <span className="text-xs text-text-muted">{submitResult.time_ms}ms</span>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close results">
            Close
          </Button>
        </div>
      }
      bodyClassName="space-y-2"
    >
      {rows.length === 0 && <p className="text-sm text-text-muted">No test cases returned.</p>}
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface-alt p-2">
          <div className="mb-1.5 flex items-center gap-2 text-xs text-text-muted">
            <span className="font-medium text-text">Test {i + 1}</span>
            <VerdictBadge verdict={row.verdict} />
            <span>{row.time_ms}ms</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <div className="mb-0.5 text-[11px] font-medium text-text-muted">stdout</div>
              <pre className="overflow-x-auto rounded bg-surface p-1.5 font-mono text-xs text-text">
                {row.stdout || " "}
              </pre>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] font-medium text-text-muted">expected</div>
              <pre className="overflow-x-auto rounded bg-surface p-1.5 font-mono text-xs text-text">
                {row.expected || " "}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </Panel>
  );
}
