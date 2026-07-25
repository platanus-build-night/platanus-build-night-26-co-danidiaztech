import { lazy, Suspense } from "react";
import { Panel, Spinner } from "../../../components/ui";
import { ExcalidrawErrorBoundary } from "./ExcalidrawErrorBoundary";
import CanvasFallback from "./CanvasFallback";
import type { DrawScene } from "../types";

const ExcalidrawCanvas = lazy(() => import("./ExcalidrawCanvas"));

interface DrawNotesPanelProps {
  theme: "light" | "dark";
  notes: string;
  onNotesChange: (notes: string) => void;
  onSceneChange: (scene: DrawScene) => void;
}

/**
 * Draw + Notes mode: an Excalidraw sketch pad (majority of the panel) with a
 * persistent notes textarea underneath, both visible at once so scratch
 * diagrams and written thoughts stay side-by-side without tab-switching.
 */
export function DrawNotesPanel({ theme, notes, onNotesChange, onSceneChange }: DrawNotesPanelProps) {
  return (
    <Panel title="Draw + Notes" bodyClassName="flex flex-col gap-3 p-3">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        <ExcalidrawErrorBoundary fallback={<CanvasFallback theme={theme} onSceneChange={onSceneChange} />}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center gap-2 text-text-muted">
                <Spinner size="sm" /> Loading canvas…
              </div>
            }
          >
            <ExcalidrawCanvas theme={theme} onSceneChange={onSceneChange} />
          </Suspense>
        </ExcalidrawErrorBoundary>
      </div>
      <div className="flex h-36 shrink-0 flex-col">
        <label htmlFor="solve-notes" className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Notes
        </label>
        <textarea
          id="solve-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Jot down approach, edge cases, complexity…"
          className="flex-1 resize-none rounded-lg border border-border bg-surface-alt p-2 font-mono text-xs text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
    </Panel>
  );
}
