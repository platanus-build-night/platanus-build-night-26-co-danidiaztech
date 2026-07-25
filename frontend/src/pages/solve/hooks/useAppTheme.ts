import { useEffect, useState } from "react";
import type { Theme } from "../../../lib/theme";

/**
 * Read-only mirror of the app's `data-theme` attribute (set by
 * ThemeToggle/theme.ts) so Monaco can pick a matching editor theme. Watches
 * via MutationObserver instead of subscribing to theme.ts state, since that
 * module belongs to the shared UI kit and isn't ours to extend.
 */
export function useAppTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "light"
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme((root.getAttribute("data-theme") as Theme | null) ?? "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
