import { useEffect, useState } from "react";
import { applyTheme, getInitialTheme, type Theme } from "../../lib/theme";
import { Button } from "./Button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      aria-label="Toggle theme"
    >
      {theme === "light" ? "Dark" : "Light"} mode
    </Button>
  );
}
