import { memo, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { cn } from "../../../lib/cn";

interface CodePaneProps {
  code: string;
  language: string;
  theme: "light" | "dark";
}

function monacoLanguage(language: string): string {
  const l = language.toLowerCase();
  if (l === "cpp" || l === "c++") return "cpp";
  if (l === "python" || l === "py") return "python";
  return "plaintext";
}

/** Read-only Monaco pane reconstructing the code snapshot <= current t, with
 * a brief accent flash whenever the snapshot changes (a lightweight "diff
 * happened here" cue without a full diff view). Memoized: only re-renders
 * when `code` (a memoized value keyed on snapshot index upstream) actually
 * changes, per the playback engine's no-thrash contract. */
function CodePaneInner({ code, language, theme }: CodePaneProps) {
  const [flashOn, setFlashOn] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setFlashOn(true);
    const raf = requestAnimationFrame(() => setFlashOn(false));
    return () => cancelAnimationFrame(raf);
  }, [code]);

  return (
    <div className="relative h-full min-h-[240px] overflow-hidden rounded-lg border border-border">
      {code ? (
        <Editor
          height="100%"
          language={monacoLanguage(language)}
          value={code}
          theme={theme === "dark" ? "vs-dark" : "light"}
          options={{
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            wordWrap: "on",
            padding: { top: 12 },
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-text-muted">
          No code yet at this point in the session.
        </div>
      )}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-accent/25 transition-opacity duration-500 ease-out",
          flashOn ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

export const CodePane = memo(CodePaneInner);
