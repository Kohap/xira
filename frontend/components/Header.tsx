"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import xiraLogo from "@/app/xira-logo.jpg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileMenu } from "@/components/MobileMenu";

export function Header() {
  const pathname = usePathname();
  const onLanding = pathname === "/";

  const navItems = [
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
        <Link href="/" className="flex items-center gap-3 group min-w-0" aria-label="XIRA home">
          <Image
            src={xiraLogo}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 shrink-0 rounded-lg object-cover transition-transform group-hover:scale-105 group-active:scale-95"
          />
          <div className="min-w-0">
            <span className="font-semibold text-lg leading-tight block truncate">XIRA</span>
            <span className="hidden min-[400px]:block text-[11px] text-neutral-500 leading-tight block truncate">
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
                className="px-3 py-2 rounded-lg hover:text-white hover:bg-[var(--card-border)]/50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Link
            href="/dashboard"
            className="hidden lg:inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
          >
            Open dashboard
          </Link>

          <ThemeToggle />

          <MobileMenu />
        </nav>
      </div>
    </header>
  );
}
