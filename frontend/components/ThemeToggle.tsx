"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const mounted = useRef(false);

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("xira-theme", theme);
    } catch {
      // storage may be unavailable (private mode); theme still applies
    }
  }, [theme]);

  const apply = (next: Theme) => {
    setTheme(next);
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
          aria-label={t === "dark" ? "Dark theme" : "Light theme"}
          title={t === "dark" ? "Dark" : "Light"}
          onClick={() => apply(t)}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            theme === t
              ? "bg-[var(--card-border)]/70 text-[var(--foreground)]"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {t === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>
      ))}
    </div>
  );
}