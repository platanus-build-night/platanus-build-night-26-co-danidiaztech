export interface TooltipContent {
  /** Position along the track, 0-100. */
  leftPct: number;
  /** Small uppercase kicker — the category (phase name, "aha", "submit"…). */
  kicker: string;
  /** Time or range, monospaced. */
  time?: string;
  /** Free text: a phase note or an analysis remark. */
  body?: string;
  /** A verbatim transcript line, rendered as a quote. */
  quote?: string;
  /** Accent color for the kicker — usually the phase/verdict color. */
  accent?: string;
}

/**
 * The timeline's single floating tooltip.
 *
 * One element that moves rather than one per target: hovering across a dense
 * bar then costs no mount/unmount churn, and moving between neighbours reads
 * as a glide instead of a flicker. Kept `pointer-events-none` so it can never
 * steal a click meant for the track underneath.
 *
 * The horizontal anchor is clamped so tooltips near either end stay on screen
 * while the caret keeps pointing at the real position.
 */
export function TimelineTooltip({ content }: { content: TooltipContent | null }) {
  // Rendered even when empty (with opacity 0) so the transition has something
  // to animate from — mounting on hover would skip the enter animation.
  const visible = content !== null;
  const anchorPct = content ? Math.min(92, Math.max(8, content.leftPct)) : 50;
  const caretOffsetPct = content ? content.leftPct - anchorPct : 0;

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute bottom-full z-30 mb-2 -translate-x-1/2 transition-[opacity,transform] duration-150 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
      style={{ left: `${anchorPct}%` }}
    >
      <div className="relative min-w-[9rem] max-w-[20rem] rounded-lg border border-border bg-surface px-2.5 py-2 shadow-lg">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: content?.accent ?? "var(--color-text-muted)" }}
          >
            {content?.kicker ?? ""}
          </span>
          {content?.time && (
            <span className="shrink-0 font-mono text-[10px] text-text-muted">{content.time}</span>
          )}
        </div>

        {content?.quote && (
          <p className="mt-1 border-l-2 border-border pl-2 text-xs italic leading-snug text-text">
            “{content.quote}”
          </p>
        )}
        {content?.body && (
          <p className="mt-1 text-xs leading-snug text-text-muted">{content.body}</p>
        )}

        {/* Caret: a rotated square pinned to the true position, so a clamped
            tooltip still points at the thing it describes. */}
        <div
          className="absolute top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-surface"
          style={{ left: `calc(50% + ${caretOffsetPct}%)` }}
        />
      </div>
    </div>
  );
}
