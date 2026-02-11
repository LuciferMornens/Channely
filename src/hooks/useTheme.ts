import { useState, useEffect } from "react";

export interface ThemeState {
  isDark: boolean;
}

/** Detects macOS system appearance (dark/light) and listens for changes */
export function useTheme(): ThemeState {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { isDark };
}
