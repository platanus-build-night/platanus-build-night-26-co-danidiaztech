import { useCallback, useEffect, useRef, useState } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Left pane width as a percentage of the container. */
  defaultLeftPct?: number;
  minLeftPct?: number;
  maxLeftPct?: number;
  /** Persists the user's chosen ratio across sessions. */
  storageKey?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Two panes with a draggable divider between them.
 *
 * Deliberately drives the split with a CSS variable and a `grid-template-columns`
 * on the container rather than per-pane inline widths: during a drag only one
 * custom property changes, so React never re-renders the panes (Monaco and
 * Excalidraw both re-layout expensively) and the divider tracks the cursor at
 * full frame rate. Double-click resets to the default.
 *
 * Keyboard accessible: focus the divider and use ←/→ (Home/End jump to bounds).
 */
export function SplitPane({
  left,
  right,
  defaultLeftPct = 42,
  minLeftPct = 22,
  maxLeftPct = 70,
  storageKey,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [leftPct, setLeftPct] = useState(() => {
    if (!storageKey) return defaultLeftPct;
    const stored = Number(localStorage.getItem(storageKey));
    return Number.isFinite(stored) && stored > 0
      ? clamp(stored, minLeftPct, maxLeftPct)
      : defaultLeftPct;
  });

  // Written straight to the DOM during a drag; state (and localStorage) only
  // catch up on release, so dragging costs no React work.
  const applyPct = useCallback((pct: number) => {
    containerRef.current?.style.setProperty("--split-left", `${pct}%`);
  }, []);

  useEffect(() => {
    applyPct(leftPct);
  }, [leftPct, applyPct]);

  const pctFromClientX = useCallback(
    (clientX: number) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return null;
      return clamp(((clientX - box.left) / box.width) * 100, minLeftPct, maxLeftPct);
    },
    [minLeftPct, maxLeftPct]
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const pct = pctFromClientX(e.clientX);
      if (pct !== null) applyPct(pct);
    };
    const onUp = (e: PointerEvent) => {
      const pct = pctFromClientX(e.clientX);
      if (pct !== null) {
        setLeftPct(pct);
        if (storageKey) localStorage.setItem(storageKey, String(Math.round(pct)));
      }
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Stop the drag from selecting statement text under the cursor.
    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [dragging, pctFromClientX, applyPct, storageKey]);

  const nudge = (deltaPct: number) => {
    setLeftPct((prev) => {
      const next = clamp(prev + deltaPct, minLeftPct, maxLeftPct);
      if (storageKey) localStorage.setItem(storageKey, String(Math.round(next)));
      return next;
    });
  };

  const reset = () => {
    setLeftPct(defaultLeftPct);
    if (storageKey) localStorage.setItem(storageKey, String(defaultLeftPct));
  };

  return (
    <div
      ref={containerRef}
      className="grid min-h-0 flex-1 gap-0"
      style={{ gridTemplateColumns: "var(--split-left, 42%) auto 1fr" }}
    >
      <div className="min-h-0 min-w-0">{left}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDoubleClick={reset}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") nudge(-3);
          else if (e.key === "ArrowRight") nudge(3);
          else if (e.key === "Home") setLeftPct(minLeftPct);
          else if (e.key === "End") setLeftPct(maxLeftPct);
          else return;
          e.preventDefault();
        }}
        title="Drag to resize · double-click to reset"
        className={`group relative w-4 shrink-0 cursor-col-resize touch-none outline-none ${
          dragging ? "" : "transition-colors"
        }`}
      >
        {/* Hairline that thickens and takes the accent colour on hover/drag/focus. */}
        <div
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded transition-all duration-150 group-hover:w-[3px] group-focus-visible:w-[3px] ${
            dragging ? "w-[3px] bg-accent" : "bg-border group-hover:bg-accent/60 group-focus-visible:bg-accent"
          }`}
        />
        {/* Grip dots: only visible when the divider is worth noticing. */}
        <div
          className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-[3px] rounded-full px-[3px] py-1.5 transition-opacity duration-150 ${
            dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-[3px] w-[3px] rounded-full bg-accent" />
          ))}
        </div>
      </div>

      <div className="min-h-0 min-w-0">{right}</div>
    </div>
  );
}
