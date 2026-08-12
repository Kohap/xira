"use client";

import Link from "next/link";
import Image from "next/image";
import { CopyButton } from "@/components/landing/CopyButton";
import xiraLogo from "@/app/xira-logo.jpg";

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

const MENU_GROUPS = [
  {
    heading: "Product",
    items: [
      { label: "Live dashboard", href: "/dashboard", note: "All 15 xStocks, real-time" },
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

export default function MenuPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src={xiraLogo}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg object-cover"
          />
          <div>
            <span className="font-semibold text-base leading-tight block">XIRA</span>
            <span className="text-[11px] text-neutral-500 leading-tight block">
              Menu
            </span>
          </div>
        </div>
        <Link
          href="/"
          aria-label="Close menu and return to home"
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--card-border)]/50 transition-colors active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-8">
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
      </div>

      <div className="mt-8">
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 px-4 h-12 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
        >
          Open dashboard
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
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

      <p className="mt-6 text-center text-[11px] text-neutral-600">
        Mainnet: soon
      </p>
    </div>
  );
}
