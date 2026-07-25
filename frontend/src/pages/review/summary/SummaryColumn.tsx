import { useMemo, useState } from "react";
import { marked } from "marked";
import type { AnalysisResult, ProblemDetail, SessionDetail } from "../../../lib/types";
import { Badge, Button, Card, Spinner } from "../../../components/ui";
import { formatMs, formatSec } from "../format";

interface SummaryColumnProps {
  problem: ProblemDetail;
  session: SessionDetail;
  analysis: AnalysisResult | null;
  analyzing: boolean;
  analyzeError: string | null;
  onAnalyze: () => void;
}

function finalVerdict(session: SessionDetail): string | null {
  const events = [...session.events].sort((a, b) => a.t_ms - b.t_ms);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if ((e.kind === "submit" || e.kind === "run") && typeof e.payload.verdict === "string") {
      return e.payload.verdict;
    }
  }
  return null;
}

function verdictTone(verdict: string): "success" | "danger" | "neutral" {
  if (verdict === "AC") return "success";
  if (verdict === "?") return "neutral";
  return "danger";
}

function sessionDurationMs(session: SessionDetail): number {
  const started = new Date(session.started_at).getTime();
  const ended = session.ended_at ? new Date(session.ended_at).getTime() : NaN;
  if (Number.isFinite(ended)) return Math.max(0, ended - started);
  const lastEvent = session.events.reduce((m, e) => Math.max(m, e.t_ms), 0);
  return lastEvent;
}

export function SummaryColumn({
  problem,
  session,
  analysis,
  analyzing,
  analyzeError,
  onAnalyze,
}: SummaryColumnProps) {
  const verdict = finalVerdict(session);
  const durationMs = sessionDurationMs(session);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold text-text">{problem.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {problem.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
          {problem.rating != null && <Badge tone="accent">{problem.rating}</Badge>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Verdict</span>
            <Badge tone={verdict ? verdictTone(verdict) : "neutral"}>{verdict ?? "n/a"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Duration</span>
            <span className="font-mono text-text">{formatMs(durationMs)}</span>
          </div>
        </div>
      </Card>

      {!analysis ? (
        <AnalyzeCTA analyzing={analyzing} error={analyzeError} onAnalyze={onAnalyze} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Cognition analysis
            </span>
            <Button variant="ghost" size="sm" onClick={onAnalyze} disabled={analyzing}>
              {analyzing && <Spinner size="sm" />}
              {analyzing ? "Re-analyzing…" : "Re-analyze"}
            </Button>
          </div>
          {analyzeError && <p className="text-sm text-danger">{analyzeError}</p>}
          <AhaGapStat analysis={analysis} />
          <BottleneckCard bottleneck={analysis.bottleneck} />
          <StrengthsList strengths={analysis.strengths} />
          <DrillsList drills={analysis.drills} />
        </>
      )}

      <EditorialSection editorialMd={problem.editorial_md} />

      {analysis && <EditorialGapSection gap={analysis.editorialGap} />}
    </div>
  );
}

function AnalyzeCTA({
  analyzing,
  error,
  onAnalyze,
}: {
  analyzing: boolean;
  error: string | null;
  onAnalyze: () => void;
}) {
  return (
    <Card className="flex flex-col items-start gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Analysis not run yet</h3>
        <p className="mt-1 text-sm text-text-muted">
          Run cognition analysis to see the aha-gap, bottleneck, strengths, and drills for this
          session.
        </p>
      </div>
      <Button onClick={onAnalyze} disabled={analyzing}>
        {analyzing && <Spinner size="sm" />}
        {analyzing ? "Analyzing…" : "Analyze session"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

function AhaGapStat({ analysis }: { analysis: AnalysisResult }) {
  const { ahaGapSeconds, ahaMomentSec, firstCorrectCodeSec } = analysis;
  return (
    <Card className="relative overflow-hidden border-l-4 border-l-accent p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-accent/5" />
      <div className="relative">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Aha-gap</h3>
        {ahaGapSeconds != null ? (
          <>
            <p className="mt-1 text-4xl font-bold tabular-nums text-accent">{ahaGapSeconds}s</p>
            <p className="mt-1 text-sm text-text-muted">
              {ahaMomentSec != null && firstCorrectCodeSec != null
                ? `From the aha moment at ${formatSec(ahaMomentSec)} to first correct code at ${formatSec(
                    firstCorrectCodeSec
                  )}.`
                : "Time between the key insight and the first correct code."}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-text-muted">No distinct aha moment was detected this run.</p>
        )}
      </div>
    </Card>
  );
}

function BottleneckCard({ bottleneck }: { bottleneck: string }) {
  return (
    <Card className="relative overflow-hidden border-l-4 border-l-warning p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-warning/10" />
      <div className="relative">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">Bottleneck</h3>
        <p className="mt-1 text-sm text-text">{bottleneck}</p>
      </div>
    </Card>
  );
}

function StrengthsList({ strengths }: { strengths: string[] }) {
  if (strengths.length === 0) return null;
  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Strengths</h3>
      <ul className="mt-2 space-y-1.5">
        {strengths.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-text">
            <span className="text-success">+</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DrillsList({ drills }: { drills: AnalysisResult["drills"] }) {
  if (drills.length === 0) return null;
  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Drills</h3>
      <ul className="mt-2 space-y-3">
        {drills.map((d, i) => (
          <li key={i}>
            <p className="text-sm font-medium text-text">{d.title}</p>
            <p className="text-sm text-text-muted">{d.why}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EditorialSection({ editorialMd }: { editorialMd: string | null }) {
  const [open, setOpen] = useState(false);
  const html = useMemo(() => (editorialMd ? (marked.parse(editorialMd) as string) : ""), [editorialMd]);

  if (!editorialMd) return null;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Editorial</h3>
        <span className="text-text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        // eslint-disable-next-line react/no-danger -- editorial_md is app-authored content, not user input
        <div
          className="prose prose-sm mt-3 max-w-none text-text [&_a]:text-accent [&_code]:text-accent [&_h1]:text-base [&_h2]:text-sm [&_p]:text-text-muted [&_li]:text-text-muted"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </Card>
  );
}

function EditorialGapSection({ gap }: { gap: AnalysisResult["editorialGap"] }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Missed insight", value: gap.missedInsight },
    { label: "Faster path", value: gap.fasterPath },
    { label: "Profile advice", value: gap.profileAdvice },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Editorial gap</h3>
      <dl className="mt-2 space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium text-accent">{r.label}</dt>
            <dd className="mt-0.5 text-sm text-text-muted">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
