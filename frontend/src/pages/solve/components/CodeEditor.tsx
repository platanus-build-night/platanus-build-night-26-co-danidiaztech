import type { ReactNode } from "react";
import Editor from "@monaco-editor/react";
import { Panel, Spinner } from "../../../components/ui";
import { useAppTheme } from "../hooks/useAppTheme";
import { LANGUAGE_LABELS, LANGUAGES, MONACO_LANGUAGE_ID, type Language } from "../types";

interface CodeEditorProps {
  language: Language;
  code: string;
  onLanguageChange: (language: Language) => void;
  onCodeChange: (code: string) => void;
  actions?: ReactNode;
}

export function CodeEditor({ language, code, onLanguageChange, onCodeChange, actions }: CodeEditorProps) {
  const theme = useAppTheme();

  return (
    <Panel
      title="Code"
      bodyClassName="p-0 flex flex-col"
      actions={
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            aria-label="Language"
            className="rounded-md border border-border bg-surface-alt px-2 py-1 text-xs font-medium text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
          {actions}
        </div>
      }
    >
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={MONACO_LANGUAGE_ID[language]}
          value={code}
          onChange={(value) => onCodeChange(value ?? "")}
          theme={theme === "dark" ? "vs-dark" : "light"}
          loading={
            <div className="flex h-full items-center justify-center gap-2 text-text-muted">
              <Spinner size="sm" /> Loading editor…
            </div>
          }
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            tabSize: language === "python" ? 4 : 2,
          }}
        />
      </div>
    </Panel>
  );
}
