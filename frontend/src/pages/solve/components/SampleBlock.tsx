import type { Sample } from "../../../lib/types";
import { CopyButton } from "./CopyButton";

interface SampleBlockProps {
  sample: Sample;
  index: number;
}

export function SampleBlock({ sample, index }: SampleBlockProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt">
      <div className="border-b border-border px-3 py-1.5 text-xs font-semibold text-text-muted">
        Sample {index + 1}
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-text-muted">Input</span>
            <CopyButton text={sample.input} />
          </div>
          <pre className="overflow-x-auto px-3 pb-3 font-mono text-xs text-text">{sample.input}</pre>
        </div>
        <div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-text-muted">Output</span>
            <CopyButton text={sample.output} />
          </div>
          <pre className="overflow-x-auto px-3 pb-3 font-mono text-xs text-text">{sample.output}</pre>
        </div>
      </div>
    </div>
  );
}
