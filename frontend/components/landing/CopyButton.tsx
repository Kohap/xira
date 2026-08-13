"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label ?? "value"}`}
      className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-white transition-colors py-1 px-1.5 -m-1.5 rounded-md"
    >
      {copied ? (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-6" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5v-2a1.5 1.5 0 00-1.5-1.5h-5a1.5 1.5 0 00-1.5 1.5v5a1.5 1.5 0 001.5 1.5h2" />
        </svg>
      )}
      <span className="font-mono">{copied ? "copied" : "copy"}</span>
    </button>
  );
}