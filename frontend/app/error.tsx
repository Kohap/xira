"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-8 shadow-xl">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 mb-4 font-mono text-lg font-bold">
          !
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
          An unexpected error occurred while loading this view.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--foreground)] font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-[var(--card-border)] text-neutral-300 font-medium text-sm hover:bg-[var(--card-border)]/50 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
