"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchAlerts } from "@/lib/api";
import type { AlertsResponse } from "@/lib/types";

const POLL_MS = 60_000;
const STORAGE_KEY = "xira-read-alerts";

function alertKey(symbol: string, timestamp: number): string {
  return `${symbol}:${timestamp}`;
}

function loadReadKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistReadKeys(keys: Set<string>) {
  try {
    const capped = Array.from(keys).slice(-500);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // storage may be unavailable (private mode); read state applies per tab
  }
}

function formatAge(now: number, ts: number): string {
  const s = Math.max(0, Math.round(now - ts));
  if (s < 90) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export function AlertBell() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [readKeys, setReadKeys] = useState<Set<string>>(() => loadReadKeys());
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

  const isRead = useCallback(
    (symbol: string, timestamp: number) => readKeys.has(alertKey(symbol, timestamp)),
    [readKeys]
  );

  const unreadCount = useMemo(
    () => (alerts?.alerts ?? []).filter((a) => !isRead(a.symbol, a.timestamp)).length,
    [alerts, isRead]
  );

  const markRead = useCallback((symbol: string, timestamp: number) => {
    setReadKeys((prev) => {
      const next = new Set(prev);
      next.add(alertKey(symbol, timestamp));
      persistReadKeys(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadKeys((prev) => {
      const next = new Set(prev);
      for (const a of alerts?.alerts ?? []) {
        next.add(alertKey(a.symbol, a.timestamp));
      }
      persistReadKeys(next);
      return next;
    });
  }, [alerts]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Anomaly alerts${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-neutral-300 hover:text-white hover:bg-[var(--card-border)]/50 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
            {unreadCount}
          </span>
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
              <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                {unreadCount} unread
              </span>
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-[var(--accent-glow)] hover:underline underline-offset-4"
                >
                  Mark all as read
                </button>
              )}
              <Link
                href="/alerts"
                onClick={() => setOpen(false)}
                className="text-xs text-[var(--accent-glow)] hover:underline underline-offset-4"
              >
                View all
              </Link>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alerts === null ? (
              <p className="px-4 py-6 text-xs text-neutral-500 text-center">
                Loading alerts…
              </p>
            ) : alerts.alerts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-neutral-200">No active anomalies</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Every tracked market is within expected range.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--card-border)]">
                {alerts.alerts.map((a) => {
                  const read = isRead(a.symbol, a.timestamp);
                  return (
                    <li key={alertKey(a.symbol, a.timestamp)}>
                      <div className="flex items-start gap-2 pl-4 pr-2 py-2.5 hover:bg-[var(--card-border)]/30 transition-colors">
                        <Link
                          href={`/asset/${a.symbol}`}
                          onClick={() => {
                            markRead(a.symbol, a.timestamp);
                            setOpen(false);
                          }}
                          className="flex items-start gap-3 min-w-0 flex-1"
                        >
                          <span
                            className={`shrink-0 font-mono text-xs font-medium pt-0.5 ${
                              read ? "text-neutral-400" : "text-red-300"
                            }`}
                          >
                            {a.symbol}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-xs leading-relaxed ${
                                read ? "text-neutral-500" : "text-neutral-400"
                              }`}
                            >
                              {a.anomaly_reason}
                            </span>
                            <span className="block text-[11px] text-neutral-600 mt-0.5 tabular-nums">
                              flagged {formatAge(now, a.timestamp)}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                              read ? "text-neutral-500" : "text-red-400"
                            }`}
                          >
                            {a.risk_score}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => markRead(a.symbol, a.timestamp)}
                          aria-label={read ? `Mark ${a.symbol} alert as unread` : `Mark ${a.symbol} alert as read`}
                          title={read ? "Mark as unread" : "Mark as read"}
                          className="shrink-0 self-center inline-flex items-center justify-center w-9 h-9 text-neutral-600 hover:text-[var(--accent-glow)] transition-colors"
                        >
                          {read ? (
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
                              <path d="M12 2.5c-5.2 0-9.5 4.3-9.5 9.5s4.3 9.5 9.5 9.5 9.5-4.3 9.5-9.5-4.3-9.5-9.5-9.5zm-1.2 14.3l-3.8-3.8 1.4-1.4 2.4 2.4 5.2-5.2 1.4 1.4-6.6 6.6z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M8.5 12.5l2.5 2.5 4.5-4.5" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
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
