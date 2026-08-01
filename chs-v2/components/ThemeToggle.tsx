"use client";

import { useTheme } from "@/contexts/ThemeContext";

// A real, working dark mode toggle — genuinely new, never existed
// before this, even prior to the React migration.
export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="bg-white/15 w-8 h-8 rounded-full flex items-center justify-center text-sm"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
