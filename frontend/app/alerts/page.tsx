"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { AlertsResponse } from "@/lib/types";
import { API_BASE, fetchAlerts } from "@/lib/api";
import { RiskBadge } from "@/components/ScoreCard";

const POLL_SECONDS = 60;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 8000;

function formatAge(now: number, ts: number): string {
  const s = Math.max(0, Math.round(now - ts));
  if (s < 90) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function severityOf(score: number): string {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 41) return "ELEVATED";
  return "MODERATE";
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const retriesRef = useRef(0);
  const dataRef = useRef<AlertsResponse | null>(null);
  const fetchDataRef = useRef<((showLoading?: boolean) => Promise<void>) | null>(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const json = await fetchAlerts();
      setData(json);
      dataRef.current = json;
      retriesRef.current = 0;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (!dataRef.current && retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1;
        setTimeout(() => fetchDataRef.current?.(false), RETRY_DELAY_MS);
      }
      if (dataRef.current) {
        setError("Last refresh failed. Showing the most recent alerts.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const refetch = async () => {
    await fetchData(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Anomaly <span className="font-serif italic text-[var(--accent-glow)]">alerts</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Assets where the factor model&apos;s expectations broke. These flags
            carried in the attestation itself.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center justify-center px-4 h-10 rounded-lg border border-[var(--card-border)] text-sm text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors active:scale-[0.98]"
        >
          ← Back to board
        </Link>
      </div>

      {loading && !data && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 animate-pulse">
          <div className="h-5 w-40 bg-neutral-800 rounded mb-3" />
          <div className="h-4 w-72 bg-neutral-800 rounded" />
        </div>
      )}

      {error && !data && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-10 text-center">
          <p className="text-neutral-400 text-lg mb-2">
            The alert feed is unreachable right now.
          </p>
          <p className="text-red-400/80 text-xs mb-5 font-mono break-all">{error}</p>
          <button
            onClick={refetch}
            className="px-5 h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
          >
            Retry now
          </button>
        </div>
      )}

      {error && data && (
        <div className="mb-4 rounded-lg border border-yellow-800/50 bg-yellow-950/20 px-4 py-3 text-xs text-yellow-400/90">
          {error}
        </div>
      )}

      {data && (
        <>
          {data.total_alerts === 0 ? (
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-12 text-center">
              <div className="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-green-900/40 border border-green-700/50">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 12.5l5 5 12-12" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-1">No active anomalies</p>
              <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
                Every tracked asset is within the factor model&apos;s expected
                range. Alerts appear here once a factor falls below its
                threshold.
              </p>
              <p className="mt-6 text-xs text-neutral-600">
                Last check{" "}
                <span className="text-neutral-400 tabular-nums">
                  {formatAge(now, data.generated_at)}
                </span>{" "}
                ·{" "}
                <button
                  onClick={refetch}
                  className="text-[var(--accent-glow)] hover:underline underline-offset-4"
                >
                  refresh
                </button>
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {data.alerts.map((a) => (
                <li key={a.symbol}>
                  <Link
                    href={`/asset/${a.symbol}`}
                    className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 hover:border-red-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:w-44 shrink-0">
                      <span className="live-dot w-2 h-2 rounded-full bg-red-400" aria-hidden="true" />
                      <span className="font-mono text-sm text-red-300 font-medium">
                        {a.symbol}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-300 leading-relaxed">
                        {a.anomaly_reason}
                      </p>
                      <p className="text-[11px] text-neutral-600 mt-1 tabular-nums">
                        flagged {formatAge(now, a.timestamp)} · confidence{" "}
                        {a.confidence}%
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <span className="text-2xl font-bold tabular-nums text-red-400">
                        {a.risk_score}
                      </span>
                      <RiskBadge level={a.risk_level} />
                      <span className="hidden sm:block text-[10px] uppercase tracking-widest text-neutral-600">
                        {severityOf(a.risk_score)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-500">
            <span>
              Source:{" "}
              <span className="text-neutral-300 font-mono">
                {data.data_source.toUpperCase()}
              </span>{" "}
              · {data.total_alerts} flagged of the tracked universe · auto-refresh
              every {POLL_SECONDS}s
            </span>
            <button
              onClick={refetch}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-neutral-600">
            API: <code className="font-mono">{API_BASE}/api/alerts</code>
          </p>
        </>
      )}
    </div>
  );
}
