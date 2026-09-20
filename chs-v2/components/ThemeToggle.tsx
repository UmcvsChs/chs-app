"use client";

import { useTheme } from "@/contexts/ThemeContext";
import InfoTip from "./InfoTip";

// A real, working dark mode toggle — genuinely new, never existed
// before this, even prior to the React migration.
export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <span className="relative inline-block">
      <button
        onClick={toggleTheme}
        className="bg-white/15 w-8 h-8 rounded-full flex items-center justify-center text-sm"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? "☀️" : "🌙"}
      </button>
      <span className="absolute -top-1 -right-1"><InfoTip term="dark_mode" /></span>
    </span>
  );
}
