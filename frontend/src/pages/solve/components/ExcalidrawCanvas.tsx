import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { DrawScene } from "../types";

interface ExcalidrawCanvasProps {
  theme: "light" | "dark";
  onSceneChange: (scene: DrawScene) => void;
}

/**
 * Thin wrapper around @excalidraw/excalidraw. Lives in its own module (with
 * its own CSS import) so DrawNotesPanel can React.lazy() it — the whole
 * Excalidraw bundle only loads once the user actually opens the Draw tab,
 * keeping the default Monaco path fast.
 */
export default function ExcalidrawCanvas({ theme, onSceneChange }: ExcalidrawCanvasProps) {
  return (
    <div className="h-full w-full">
      <Excalidraw
        theme={theme}
        onChange={(elements, appState) => {
          onSceneChange({
            elements,
            appState: { viewBackgroundColor: appState.viewBackgroundColor },
          });
        }}
      />
    </div>
  );
}
