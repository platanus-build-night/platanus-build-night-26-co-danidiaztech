import { useMemo } from "react";
import { marked } from "marked";
import type { ProblemDetail } from "../../../lib/types";
import { Badge, Panel } from "../../../components/ui";
import { SampleBlock } from "./SampleBlock";

marked.setOptions({ breaks: false, gfm: true });

interface StatementPanelProps {
  problem: ProblemDetail;
}

// Tailwind arbitrary-child selectors give us a lightweight "prose" look
// without pulling in @tailwindcss/typography, which isn't installed.
const MARKDOWN_CLASSES = [
  "text-sm leading-relaxed text-text",
  "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:first:mt-0",
  "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:first:mt-0",
  "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_p]:mb-3 [&_p]:last:mb-0",
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:mb-1",
  "[&_code]:rounded [&_code]:bg-surface-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-alt [&_pre]:p-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-text-muted",
  "[&_a]:text-accent [&_a]:underline",
  "[&_strong]:font-semibold",
].join(" ");

export function StatementPanel({ problem }: StatementPanelProps) {
  const html = useMemo(() => marked.parse(problem.statement_md, { async: false }) as string, [
    problem.statement_md,
  ]);

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
      {/* Statement HTML is rendered from our own DB-seeded content (no user
          input), so we skip a sanitizer dependency for this local single-user app. */}
      <div className={MARKDOWN_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />

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
