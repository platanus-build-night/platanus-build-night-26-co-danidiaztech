// Page-local types for the Solve screen (not part of the API surface — see
// lib/types.ts for those).

export type Language = "python" | "cpp";

export const LANGUAGES: Language[] = ["python", "cpp"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python 3",
  cpp: "C++17",
};

/** Monaco's built-in language ids for the syntax highlighter/worker. */
export const MONACO_LANGUAGE_ID: Record<Language, string> = {
  python: "python",
  cpp: "cpp",
};

export const STARTER_TEMPLATE: Record<Language, string> = {
  python: `def solve():\n    pass\n\n\nif __name__ == "__main__":\n    solve()\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    return 0;\n}\n`,
};

/** Minimal serializable snapshot of the Excalidraw scene for draw_snap payloads. */
export interface DrawScene {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
}
