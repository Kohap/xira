"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import xiraLogo from "@/app/xira-logo.jpg";
import { CopyButton } from "@/components/landing/CopyButton";

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

const MENU_GROUPS = [
  {
    heading: "Product",
    items: [
      { label: "Alerts", href: "/alerts", note: "Anomalies across the board" },
      { label: "How to verify", href: "/#verify", note: "Check a score onchain" },
      { label: "FAQ", href: "/#faq", note: "Quick answers" },
    ],
  },
  {
    heading: "Learn",
    items: [
      { label: "Whitepaper", href: "/whitepaper", note: "The model, exactly as built" },
      { label: "API docs", href: "/docs", note: "Endpoints, types, contract ABI" },
      { label: "How it works", href: "/#how", note: "Collect, score, sign, verify" },
      { label: "On-chain", href: "/#chain", note: "Open the oracle" },
    ],
  },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const drawer = (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`md:hidden fixed inset-y-0 right-0 z-[60] w-[85%] max-w-sm bg-[var(--background)] border-l border-[var(--card-border)] shadow-2xl flex flex-col transition-transform duration-300 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full invisible"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--card-border)] shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src={xiraLogo}
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="font-semibold text-base leading-tight">XIRA</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--card-border)]/50 transition-colors active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
          {MENU_GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-2">
                {group.heading}
              </h2>
              <ul className="border-t border-[var(--card-border)]">
                {group.items.map((item) => (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex items-baseline justify-between gap-4 py-3.5 border-b border-[var(--card-border)] group"
                    >
                      <span className="text-sm font-medium text-neutral-200 group-hover:text-[var(--accent-glow)] transition-colors">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-neutral-600 text-right shrink-0">
                        {item.note}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <Link
            href="/dashboard"
            onClick={close}
            className="flex items-center justify-center gap-2 px-4 h-12 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
          >
            Open dashboard
          </Link>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <p className="text-[11px] text-neutral-500 mb-1.5">
              Contract (X Layer Testnet)
            </p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[11px] text-neutral-300 break-all min-w-0">
                {CONTRACT}
              </code>
              <span className="ml-auto shrink-0">
                <CopyButton value={CONTRACT} label="contract address" />
              </span>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              Chain ID: <span className="font-mono text-neutral-400">1952</span> · X Layer Testnet
            </p>
          </div>
        </div>

        <p className="shrink-0 px-5 py-4 border-t border-[var(--card-border)] text-center text-[11px] text-neutral-600">
          Mainnet: soon
        </p>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--card-border)]/50 transition-colors active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
