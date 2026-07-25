import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useCallback, useRef } from "react";
import type { DrawScene } from "../types";

interface ExcalidrawCanvasProps {
  theme: "light" | "dark";
  onSceneChange: (scene: DrawScene) => void;
}

/** Cheap fingerprint of the drawing's *content*.
 *
 * Excalidraw bumps an element's `version` on every real mutation, so summing
 * the last element's version with the count distinguishes an actual edit from
 * a repaint. Deliberately ignores `appState` (cursor position, selection,
 * zoom): those churn constantly and none of them belong in a scene snapshot.
 */
function sceneSignature(elements: readonly { version?: number }[]): string {
  const last = elements[elements.length - 1];
  return `${elements.length}:${last?.version ?? 0}`;
}

/**
 * Thin wrapper around @excalidraw/excalidraw. Lives in its own module (with
 * its own CSS import) so DrawNotesPanel can React.lazy() it — the whole
 * Excalidraw bundle only loads once the user actually opens the Draw tab,
 * keeping the default Monaco path fast.
 *
 * `onChange` fires on every internal update, including ones caused by our own
 * re-render. Propagating each one into React state produced a setState →
 * render → onChange → setState loop ("Maximum update depth exceeded"), so the
 * callback is identity-stable and only forwards when the content fingerprint
 * actually moves.
 */
export default function ExcalidrawCanvas({ theme, onSceneChange }: ExcalidrawCanvasProps) {
  const onSceneChangeRef = useRef(onSceneChange);
  onSceneChangeRef.current = onSceneChange;
  const lastSignatureRef = useRef<string>("");

  const handleChange = useCallback(
    (elements: readonly { version?: number }[], appState: { viewBackgroundColor: string }) => {
      const signature = sceneSignature(elements);
      if (signature === lastSignatureRef.current) return;
      lastSignatureRef.current = signature;
      onSceneChangeRef.current({
        elements: elements as DrawScene["elements"],
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
      });
    },
    []
  );

  return (
    <div className="h-full w-full">
      <Excalidraw theme={theme} onChange={handleChange} />
    </div>
  );
}
