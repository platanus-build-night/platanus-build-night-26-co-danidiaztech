import { useEffect, useMemo, useRef } from "react";
import type { EventOut } from "../../../lib/types";
import { cn } from "../../../lib/cn";
import { formatMs } from "../format";
import { findIndexAtOrBefore } from "./timelineUtils";

interface TranscriptStripProps {
  segments: EventOut[]; // kind === "transcript", sorted by t_ms
  currentMs: number;
  onSeek: (ms: number) => void;
}

/** Horizontally scrolling transcript strip: active segment (last one whose
 * tMs <= currentMs) is highlighted and kept in view; clicking any segment
 * seeks the player to its tMs. Renders a clean placeholder when the session
 * has no captured voice (mic was off) rather than an empty strip. */
export function TranscriptStrip({ segments, currentMs, onSeek }: TranscriptStripProps) {
  const times = useMemo(() => segments.map((s) => s.t_ms), [segments]);
  const activeIdx = findIndexAtOrBefore(times, currentMs);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIdx]);

  if (segments.length === 0) {
    return (
      <p className="px-1 text-xs italic text-text-muted">
        No voice transcript captured for this session (mic was off).
      </p>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-1" role="list" aria-label="Transcript">
      {segments.map((seg, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={seg.id}
            ref={active ? activeRef : undefined}
            type="button"
            role="listitem"
            onClick={() => onSeek(seg.t_ms)}
            className={cn(
              "w-[200px] shrink-0 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors",
              active
                ? "border-accent bg-accent/15 text-text"
                : "border-border bg-surface-alt text-text-muted hover:text-text"
            )}
          >
            <span className="mb-0.5 block font-mono text-[10px] text-text-muted">{formatMs(seg.t_ms)}</span>
            <span className="line-clamp-2 leading-snug">{String(seg.payload.text ?? "")}</span>
          </button>
        );
      })}
    </div>
  );
}
