import type { ProblemDetail } from "../../../lib/types";
import { Badge, Panel } from "../../../components/ui";
import { SampleBlock } from "./SampleBlock";
import { MathMarkdown } from "../../../lib/mathmd";

interface StatementPanelProps {
  problem: ProblemDetail;
}

export function StatementPanel({ problem }: StatementPanelProps) {
  return (
    <Panel
      title={problem.title}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-1">
          {problem.rating != null && <Badge tone="accent">{problem.rating}</Badge>}
          {problem.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      }
      bodyClassName="space-y-5"
    >
      <MathMarkdown source={problem.statement_md} />

      {problem.samples.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Samples</h3>
          {problem.samples.map((sample, i) => (
            <SampleBlock key={i} sample={sample} index={i} />
          ))}
        </div>
      )}
    </Panel>
  );
}
