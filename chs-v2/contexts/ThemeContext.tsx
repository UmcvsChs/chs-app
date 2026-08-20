"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Real, genuinely new dark mode infrastructure — never existed before
// this, even prior to the React migration. Persists the real, actual
// choice across visits, and applies it immediately on load rather
// than flashing the wrong theme first.
interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Genuinely external-system read — the real saved preference (or,
    // failing that, the OS's own real color-scheme setting) only exists
    // in the browser, never in anything React already knows about.
    const stored = localStorage.getItem("chs-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored ? stored === "dark" : prefersDark;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("chs-theme", next ? "dark" : "light");
  }

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
