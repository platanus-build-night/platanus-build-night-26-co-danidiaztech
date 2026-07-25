import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Tracks the global `data-theme` attribute (toggled by <ThemeToggle/>) so
 * Monaco can follow the app theme without this page owning theme state. */
export function useCurrentTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "light"
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme((el.getAttribute("data-theme") as Theme | null) ?? "light");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
