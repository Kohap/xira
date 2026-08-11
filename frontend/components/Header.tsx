"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const onLanding = pathname === "/";

  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Whitepaper", href: "/whitepaper" },
    { label: "Docs", href: "/docs" },
    ...(onLanding
      ? [
          { label: "How it works", href: "/#how" },
          { label: "On-chain", href: "/#chain" },
        ]
      : []),
  ];

  return (
    <header className="border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group" aria-label="XIRA home">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-bold text-white text-sm transition-transform group-hover:scale-105 group-active:scale-95">
            X
          </div>
          <div>
            <span className="font-semibold text-lg leading-tight block">XIRA</span>
            <span className="text-[11px] text-neutral-500 leading-tight block">
              X-Layer Intelligence &amp; Risk Analytics
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Primary">
          <div className="hidden md:flex items-center gap-1 text-sm text-neutral-400">
{navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Link
            href="/dashboard"
            className="hidden md:inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
          >
            Open dashboard
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </nav>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="md:hidden border-t border-[var(--card-border)] bg-[var(--card-bg)]"
        >
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 mt-2 px-4 h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
            >
              Open dashboard
            </Link>
            <p className="text-[11px] text-neutral-600 px-3 pt-2 pb-1 break-all">
              contract <span className="font-mono">{CONTRACT}</span>
            </p>
          </div>
        </nav>
      )}
    </header>
  );
}