"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  if (subscribed) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-6" />
        </svg>
        You&apos;re on the list. Updates coming soon.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-1 flex gap-2">
      <label htmlFor="footer-newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="footer-newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-w-0 flex-1 h-9 px-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-600 transition-colors"
      />
      <button
        type="submit"
        className="shrink-0 h-9 px-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-xs font-medium transition-colors active:scale-[0.98]"
      >
        Notify me
      </button>
    </form>
  );
}
