"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("xira-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const id = requestAnimationFrame(() => setTheme(getInitialTheme()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const apply = (next: Theme) => {
    setTheme(next);
    try {
      window.localStorage.setItem("xira-theme", next);
    } catch {
      // storage may be unavailable (private mode); theme still applies
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center rounded-lg border border-[var(--card-border)] p-0.5"
    >
      {(["dark", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => apply(t)}
          className={`px-3.5 h-9 rounded-md text-xs transition-colors ${
            theme === t
              ? "bg-[var(--card-border)]/70 text-white font-medium"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {t === "dark" ? "Dark" : "Light"}
        </button>
      ))}
    </div>
  );
}
