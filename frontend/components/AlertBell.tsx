"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchAlerts } from "@/lib/api";
import type { AlertsResponse } from "@/lib/types";

const POLL_MS = 60_000;

function formatAge(now: number, ts: number): string {
  const s = Math.max(0, Math.round(now - ts));
  if (s < 90) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export function AlertBell() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchAlerts()
        .then((d) => {
          if (!cancelled) setAlerts(d);
        })
        .catch(() => {});
    };
    const id = setTimeout(() => void load(), 0);
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = alerts?.total_alerts ?? 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Anomaly alerts${count ? ` (${count})` : ""}`}
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--card-border)]/50 transition-colors active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {count > 0 && (
          <>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
              {count}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Anomaly alerts"
          className="absolute right-0 top-full mt-2 w-[min(22rem,92vw)] z-50 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
            <div className="flex items-center gap-2">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Anomaly alerts</h2>
              <span className="text-[11px] font-mono text-neutral-500 tabular-nums">{count}</span>
            </div>
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-[var(--accent-glow)] hover:underline underline-offset-4"
            >
              View all
            </Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alerts === null ? (
              <p className="px-4 py-6 text-xs text-neutral-500 text-center">
                Loading alerts…
              </p>
            ) : count === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="mx-auto mb-3 flex items-center justify-center w-9 h-9 rounded-full bg-emerald-900/40 border border-emerald-700/50">
                  <svg viewBox="0 0 16 16" className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-200">No active anomalies</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Every tracked market is within expected range.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--card-border)]">
                {alerts.alerts.map((a) => (
                  <li key={a.symbol}>
                    <Link
                      href={`/asset/${a.symbol}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--card-border)]/30 transition-colors"
                    >
                      <span className="shrink-0 font-mono text-xs text-red-300 font-medium pt-0.5">
                        {a.symbol}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-neutral-400 leading-relaxed">
                          {a.anomaly_reason}
                        </span>
                        <span className="block text-[11px] text-neutral-600 mt-0.5 tabular-nums">
                          flagged {formatAge(now, a.timestamp)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold text-red-400 tabular-nums">
                        {a.risk_score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[var(--card-border)] text-[10px] text-neutral-600">
            Refreshes every 60s · {alerts ? alerts.data_source.toUpperCase() : "…"}
          </div>
        </div>
      )}
    </div>
  );
}
