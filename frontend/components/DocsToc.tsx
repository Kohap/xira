"use client";

import { useEffect, useState } from "react";

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "endpoints", label: "Endpoints" },
  { id: "example", label: "Example response" },
  { id: "contract", label: "On-chain contract" },
  { id: "mcp", label: "Agents (MCP tools)" },
  { id: "quickstart", label: "Quickstart" },
];

export function DocsToc() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    let current = "overview";
    const onScroll = () => {
      const probe = Math.min(window.innerHeight * 0.3, 320);
      let found = current;
      for (const item of TOC) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= probe) {
          found = item.id;
        }
      }
      if (found !== current) {
        current = found;
        setActive(found);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <aside className="hidden lg:block sticky top-24">
        <nav aria-label="On this page">
          <h2 className="text-[11px] font-medium text-neutral-500 mb-3">
            On this page
          </h2>
          <ul className="space-y-1 border-l border-[var(--card-border)]">
            {TOC.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`block pl-4 -ml-px border-l text-sm py-1 transition-colors ${
                      isActive
                        ? "border-[var(--accent-glow)] text-white"
                        : "border-transparent text-neutral-400 hover:text-white hover:border-neutral-600"
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="mt-8 text-[11px] text-neutral-600 leading-relaxed">
          The dashboard, whitepaper, and this reference are generated from the
          same running service.
        </p>
      </aside>

      <nav
        aria-label="On this page"
        className="lg:hidden -mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex gap-2 pb-2"
      >
        {TOC.map((item) => {
          const isActive = active === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                isActive
                  ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--accent-glow)]"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] text-neutral-400 hover:text-white"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
