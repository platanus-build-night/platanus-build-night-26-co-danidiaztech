import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Marker, Phase } from "../../../lib/types";
import { formatMs } from "../format";
import { MARKER_GLYPH, PHASE_COLORS, type IdleRegion } from "./timelineUtils";

export interface RunTick {
  id: number;
  atMs: number;
  kind: "run" | "submit";
  verdict: string;
}

interface TimelineBarProps {
  durationMs: number;
  currentMs: number;
  phases: Phase[];
  markers: Marker[];
  idleRegions: IdleRegion[];
  runTicks: RunTick[];
  onSeek: (ms: number) => void;
}

/** Bottom timeline bar: phase-colored segments, aha/hesitation/wrong-turn
 * marker glyphs, dimmed idle/dead-air regions, run/submit ticks, and a
 * draggable scrubber. Full session duration always maps to 100% width. */
export function TimelineBar({
  durationMs,
  currentMs,
  phases,
  markers,
  idleRegions,
  runTicks,
  onSeek,
}: TimelineBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pct = useCallback(
    (ms: number) => (durationMs > 0 ? Math.min(100, Math.max(0, (ms / durationMs) * 100)) : 0),
    [durationMs]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || durationMs <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(ratio * durationMs);
    },
    [durationMs, onSeek]
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekFromClientX(e.clientX);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div className="select-none">
      <div className="mb-1 flex justify-between font-mono text-[10px] text-text-muted">
        <span>0:00</span>
        <span>{formatMs(durationMs)}</span>
      </div>

      <div
        ref={trackRef}
        className="relative h-4 w-full cursor-pointer touch-none rounded-full bg-surface-alt"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={currentMs}
      >
        {phases.map((p, i) => (
          <div
            key={i}
            title={`${p.label}${p.note ? ` — ${p.note}` : ""} (${formatMs(p.startSec * 1000)}–${formatMs(
              p.endSec * 1000
            )})`}
            className="absolute top-0 h-full first:rounded-l-full last:rounded-r-full"
            style={{
              left: `${pct(p.startSec * 1000)}%`,
              width: `${Math.max(pct((p.endSec - p.startSec) * 1000), 0.4)}%`,
              backgroundColor: PHASE_COLORS[p.label] ?? "var(--color-border)",
              opacity: 0.55,
            }}
          />
        ))}

        {idleRegions.map((r, i) => (
          <div
            key={i}
            title="Idle / no activity"
            className="absolute top-0 h-full bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18)_4px,transparent_4px,transparent_8px)]"
            style={{ left: `${pct(r.startMs)}%`, width: `${pct(r.endMs - r.startMs)}%` }}
          />
        ))}

        <div
          aria-hidden
          className="absolute top-1/2 z-10 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text shadow"
          style={{ left: `${pct(currentMs)}%` }}
        />
      </div>

      {runTicks.length > 0 && (
        <div className="relative mt-1 h-3">
          {runTicks.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              title={`${r.kind} — ${r.verdict} @ ${formatMs(r.atMs)}`}
              onClick={() => onSeek(r.atMs)}
              className="absolute top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-sm ring-1 ring-border"
              style={{
                left: `${pct(r.atMs)}%`,
                backgroundColor: r.verdict === "AC" ? "var(--color-success)" : "var(--color-danger)",
              }}
            />
          ))}
        </div>
      )}

      {markers.length > 0 && (
        <div className="relative mt-1 h-7">
          {markers.map((m, i) => (
            <button
              key={i}
              type="button"
              title={`${m.kind}${m.quote ? `: "${m.quote}"` : ""}${m.note ? ` — ${m.note}` : ""}`}
              onClick={() => onSeek(m.atSec * 1000)}
              className="absolute -translate-x-1/2 rounded-full border border-border bg-surface text-xs leading-none shadow-sm hover:border-accent"
              style={{ left: `${pct(m.atSec * 1000)}%` }}
            >
              <span className="block px-1.5 py-1">{MARKER_GLYPH[m.kind] ?? "•"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
