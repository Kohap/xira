"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { AllAssetsResponse, MarketHistoryResponse } from "@/lib/types";
import { API_BASE, fetchMarketHistory } from "@/lib/api";
import { ScoreCard, RiskBadge } from "@/components/ScoreCard";
import { RiskHeatmap } from "@/components/RiskHeatmap";

const POLL_SECONDS = 60;
const MAX_COLD_START_RETRIES = 8;
const RETRY_DELAY_MS = 10000;

const SECTOR_MAP: Record<string, string> = {
  NVDAx: "Technology",
  TSLAx: "Consumer Cyclical",
  AAPLx: "Technology",
  MSFTx: "Technology",
  GOOGLx: "Communication",
  AMZNx: "Consumer Cyclical",
  METAx: "Communication",
  SPYx: "ETF",
  QQQx: "ETF",
  AMDx: "Technology",
  INTCx: "Technology",
  NFLXx: "Communication",
  BAx: "Industrials",
  JPMx: "Financial",
  XOMx: "Energy",
};

const RISK_BAR_COLORS: Record<string, string> = {
  LOW: "bg-[var(--risk-low)]",
  MODERATE: "bg-[var(--risk-moderate)]",
  ELEVATED: "bg-[var(--risk-elevated)]",
  HIGH: "bg-[var(--risk-high)]",
  CRITICAL: "bg-[var(--risk-critical)]",
};

const RISK_ORDER = ["LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"] as const;

function MarketPulse({ assets }: { assets: AllAssetsResponse["assets"] }) {
  if (assets.length === 0) return null;
  const avg = Math.round(
    assets.reduce((sum, a) => sum + a.risk_score, 0) / assets.length
  );
  const counts = RISK_ORDER.map((level) => ({
    level,
    count: assets.filter((a) => a.risk_level === level).length,
  }));
  const best = [...assets].sort((a, b) => a.risk_score - b.risk_score)[0];
  const worst = [...assets].sort((a, b) => b.risk_score - a.risk_score)[0];

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 mb-6">
      <div className="grid sm:grid-cols-[auto_1fr_auto] gap-6 items-center">
        <div className="text-center sm:text-left">
          <div className="text-3xl font-bold tabular-nums text-[var(--accent-glow)]">
            {avg}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Average risk / 100
          </div>
        </div>

        <div>
          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--card-border)]">
            {counts.map(({ level, count }) =>
              count > 0 ? (
                <div
                  key={level}
                  className={`${RISK_BAR_COLORS[level]} h-full`}
                  style={{ width: `${(count / assets.length) * 100}%` }}
                  title={`${level}: ${count}`}
                />
              ) : null
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {counts.map(({ level, count }) => (
              <span key={level} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
                <span className={`w-2 h-2 rounded-sm ${RISK_BAR_COLORS[level]}`} aria-hidden="true" />
                {level} <span className="text-neutral-300 tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex sm:flex-col gap-4 sm:gap-2 text-[11px]">
          <Link href={`/asset/${best.symbol}`} className="group flex items-center gap-2">
            <span className="text-neutral-500">Best</span>
            <span className="font-mono text-green-400 group-hover:underline underline-offset-4">{best.symbol}</span>
            <span className="text-neutral-300 tabular-nums">{best.risk_score}</span>
          </Link>
          <Link href={`/asset/${worst.symbol}`} className="group flex items-center gap-2">
            <span className="text-neutral-500">Worst</span>
            <span className="font-mono text-red-400 group-hover:underline underline-offset-4">{worst.symbol}</span>
            <span className="text-neutral-300 tabular-nums">{worst.risk_score}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatAge(now: number, generatedAt: number): string {
  const s = Math.max(0, Math.round(now - generatedAt));
  if (s < 90) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function SummaryBar({
  summary,
  generatedAt,
  now,
  anomalyCount,
  totalAssets,
  nextRefresh,
  dataSource,
}: {
  summary: string;
  generatedAt: number;
  now: number;
  anomalyCount: number;
  totalAssets: number;
  nextRefresh: number;
  dataSource: string;
}) {
  const isLive = dataSource === "live";
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold">Market Risk Overview</h2>
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isLive
                  ? "bg-green-900/40 text-green-400 border border-green-700/50"
                  : "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50"
              }`}
            >
              {isLive && (
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
              )}
              {isLive ? "LIVE" : dataSource.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-neutral-400 mt-1">{summary}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
          <span title={new Date(generatedAt * 1000).toLocaleString()}>
            Updated <span className="text-neutral-300 tabular-nums">{formatAge(now, generatedAt)}</span>
          </span>
          <span>
            Next attestation in{" "}
            <span className="text-neutral-300 tabular-nums">{nextRefresh}s</span>
          </span>
          {anomalyCount > 0 && (
            <span className="px-2 py-0.5 bg-red-900/40 text-red-400 rounded-full font-medium">
              {anomalyCount}/{totalAssets} alerts
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertsStrip({ assets }: { assets: AllAssetsResponse["assets"] }) {
  const alerts = assets.filter((a) => a.anomaly);
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-800/50 bg-red-950/20 p-4" role="status">
      <div className="flex items-center gap-2 mb-3">
        <span className="live-dot w-2 h-2 rounded-full bg-red-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-red-300">Anomaly alerts</h3>
        <span className="text-[11px] text-red-400/70 font-mono">factor consensus broken</span>
        <Link
          href="/alerts"
          className="ml-auto text-xs text-red-400/90 hover:text-red-300 hover:underline underline-offset-4 transition-colors"
        >
          View all alerts →
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li key={a.symbol}>
            <Link
              href={`/asset/${a.symbol}`}
              className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 rounded-lg px-3 py-2 bg-black/30 border border-[var(--card-border)] hover:border-red-800/60 transition-colors group"
            >
              <span className="font-mono text-xs text-red-300 whitespace-nowrap">
                {a.symbol}
              </span>
              <span className="text-xs text-neutral-400 leading-relaxed">
                {a.anomaly_reason || "Anomaly flagged by factor model."}
              </span>
              <span className="mt-auto sm:mt-0 sm:ml-auto font-mono text-[11px] text-neutral-600 tabular-nums whitespace-nowrap group-hover:text-neutral-400 transition-colors">
                score {a.risk_score}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-5 w-16 bg-neutral-800 rounded mb-2" />
          <div className="h-4 w-14 bg-neutral-800 rounded" />
        </div>
        <div className="h-14 w-14 rounded-full bg-neutral-800" />
      </div>
      <div className="space-y-2 mt-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3 bg-neutral-800 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<AllAssetsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coldStart, setColdStart] = useState(false);
  const [countdown, setCountdown] = useState(POLL_SECONDS);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "symbol" | "confidence">("score");
  const [retryCount, setRetryCount] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [copied, setCopied] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchReady, setWatchReady] = useState(false);
  const [marketHistory, setMarketHistory] = useState<MarketHistoryResponse | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("xira-watchlist");
        if (raw) setWatchlist(JSON.parse(raw));
      } catch {
        // ignore malformed storage
      }
      setWatchReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!watchReady) return;
    try {
      window.localStorage.setItem("xira-watchlist", JSON.stringify(watchlist));
    } catch {
      // storage may be unavailable; watchlist still works for the session
    }
  }, [watchlist, watchReady]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      fetchMarketHistory(24)
        .then((d) => {
          if (!cancelled) setMarketHistory(d);
        })
        .catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const dataRef = useRef<AllAssetsResponse | null>(null);

  const apiBase = API_BASE;

  const scheduleRetry = useCallback((fn: () => void) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(fn, RETRY_DELAY_MS);
  }, []);

  const fetchDataRef = useRef<((showLoading?: boolean) => Promise<void>) | null>(null);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/api/assets/all`);
        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }
        const json: AllAssetsResponse = await res.json();
        setData(json);
        dataRef.current = json;
        setColdStart(false);
        setRefreshError(false);
        retriesRef.current = 0;
        setRetryCount(0);
        setCountdown(POLL_SECONDS);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (msg.includes("fetch") || msg.includes("NetworkError")) {
          setColdStart(true);
          if (!dataRef.current && retriesRef.current < MAX_COLD_START_RETRIES) {
            retriesRef.current += 1;
            setRetryCount(retriesRef.current);
            scheduleRetry(() => fetchDataRef.current?.(false));
          }
        } else {
          setColdStart(false);
        }
        if (dataRef.current) {
          setRefreshError(true);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiBase, scheduleRetry]
  );

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    const id = setTimeout(() => void fetchData(), 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(false);
          return POLL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const togglePin = useCallback((symbol: string) => {
    setWatchlist((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  }, []);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 mb-6 animate-pulse">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-[var(--accent-glow)]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <div className="h-5 w-48 bg-neutral-800 rounded mb-2" />
              <div className="h-4 w-72 bg-neutral-800 rounded" />
            </div>
          </div>
        </div>
        <p className="text-center text-sm mb-6" role="status">
          {coldStart ? (
            <span className="text-neutral-400">
              Waking up the backend (free-tier cold start, ~30s)… retrying{" "}
              <span className="text-neutral-300 tabular-nums">
                {retryCount}/{MAX_COLD_START_RETRIES}
              </span>
            </span>
          ) : (
            <span className="text-neutral-500">Loading risk data for 15 xStocks…</span>
          )}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-10 text-center">
          <svg
            viewBox="0 0 24 24"
            className="w-10 h-10 mx-auto mb-4 text-red-400/70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.8L2.6 17a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z" />
          </svg>
          <p className="text-lg mb-1">The risk board is unreachable right now.</p>
          <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto leading-relaxed">
            {coldStart
              ? "The backend is on a free-tier host and may take 30–60s to wake from sleep."
              : "The API did not answer. It should recover on its own; if it does not, the service has changed or is down."}
          </p>
          {error && (
            <p className="text-red-400/80 text-xs mb-6 font-mono bg-red-900/10 rounded p-2 inline-block break-all">
              {error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => fetchData(true)}
              className="inline-flex items-center justify-center px-5 h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white text-sm font-medium transition-colors active:scale-[0.98]"
            >
              Retry now
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 h-11 rounded-lg border border-[var(--card-border)] text-sm text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors active:scale-[0.98]"
            >
              Back to overview
            </Link>
          </div>
          <p className="mt-6 text-xs text-neutral-600">
            Upstream API: <code className="font-mono text-neutral-400">{apiBase}</code>
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const anomalyCount = data.assets.filter((a) => a.anomaly).length;
  const levelCounts = RISK_ORDER.reduce<Record<string, number>>((acc, level) => {
    acc[level] = data.assets.filter((a) => a.risk_level === level).length;
    return acc;
  }, {});

  const sectors = Array.from(
    new Set(data.assets.map((a) => SECTOR_MAP[a.symbol]).filter(Boolean))
  ).sort();

  const visibleAssets = data.assets
    .filter(
      (a) =>
        (query.trim() === "" ||
          a.symbol.toLowerCase().includes(query.trim().toLowerCase())) &&
        (levelFilter === "ALL" || a.risk_level === levelFilter) &&
        (sectorFilter === "ALL" || SECTOR_MAP[a.symbol] === sectorFilter) &&
        (!anomalyOnly || a.anomaly)
    )
    .slice()
    .sort((a, b) => {
      switch (sortBy) {
        case "symbol":
          return a.symbol.localeCompare(b.symbol);
        case "confidence":
          return b.confidence - a.confidence;
        case "score":
        default:
          return b.risk_score - a.risk_score;
      }
    });

  const recentMoves = data.assets
    .filter((a) => a.score_delta !== null && a.score_delta !== undefined && a.score_delta !== 0)
    .sort((a, b) => Math.abs(b.score_delta ?? 0) - Math.abs(a.score_delta ?? 0))
    .slice(0, 6);

  const pinnedAssets = watchReady
    ? data.assets.filter((a) => watchlist.includes(a.symbol))
    : [];

  const copyBoard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {refreshError && (
        <div
          className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-xl border border-yellow-800/50 bg-yellow-950/20 px-4 py-3"
          role="status"
        >
          <p className="text-xs text-yellow-400/90">
            Last refresh failed. Showing the most recent attestations. Auto-retry continues.
          </p>
          <button
            onClick={() => fetchData(false)}
            className="text-xs text-yellow-300 underline underline-offset-4 hover:text-yellow-200 transition-colors"
          >
            Refresh now
          </button>
        </div>
      )}

      <SummaryBar
        summary={data.summary}
        generatedAt={data.generated_at}
        now={now}
        anomalyCount={anomalyCount}
        totalAssets={data.assets.length}
        nextRefresh={countdown}
        dataSource={data.data_source || "mock"}
      />

      <MarketPulse assets={data.assets} />

      <div className="animate-fade-in">
        <AlertsStrip assets={data.assets} />

        <RiskHeatmap assets={data.assets} />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="relative flex-1 max-w-sm min-w-0">
          <span className="sr-only">Search assets</span>
          <svg
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols…"
            className="w-full h-10 pl-9 pr-9 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </label>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <label htmlFor="sort-select" className="text-xs text-neutral-500">
            Sort
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 px-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-neutral-300 hover:border-neutral-600 transition-colors sm:flex-none"
          >
            <option value="score">Risk score</option>
            <option value="symbol">Symbol</option>
            <option value="confidence">Confidence</option>
          </select>
          <span className="text-xs text-neutral-600 tabular-nums whitespace-nowrap">
            {visibleAssets.length}/{data.assets.length}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by risk level"
        >
          {["ALL", ...RISK_ORDER].map((level) => {
            const active = levelFilter === level;
            const count = level === "ALL" ? data.assets.length : levelCounts[level];
            return (
              <button
                key={level}
                type="button"
                onClick={() => setLevelFilter(level)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs transition-colors ${
                  active
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--accent-glow)]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-neutral-400 hover:text-white hover:border-neutral-600"
                }`}
              >
                {level !== "ALL" && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${RISK_BAR_COLORS[level]}`}
                    aria-hidden="true"
                  />
                )}
                {level === "ALL" ? "All" : level.charAt(0) + level.slice(1).toLowerCase()}
                <span className="text-neutral-600 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by sector"
        >
          {["ALL", ...sectors].map((sector) => {
            const active = sectorFilter === sector;
            const count =
              sector === "ALL"
                ? data.assets.length
                : data.assets.filter((a) => SECTOR_MAP[a.symbol] === sector).length;
            return (
              <button
                key={sector}
                type="button"
                onClick={() => setSectorFilter(sector)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs transition-colors ${
                  active
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--accent-glow)]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-neutral-400 hover:text-white hover:border-neutral-600"
                }`}
              >
                {sector === "ALL" ? "All sectors" : sector}
                <span className="text-neutral-600 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => setAnomalyOnly((v) => !v)}
            aria-pressed={anomalyOnly}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs transition-colors ${
              anomalyOnly
                ? "border-red-700/60 bg-red-950/30 text-red-300"
                : "border-[var(--card-border)] bg-[var(--card-bg)] text-neutral-400 hover:text-white hover:border-neutral-600"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${anomalyOnly ? "bg-red-400" : "bg-neutral-600"}`} aria-hidden="true" />
            Alerts only
            <span className="text-neutral-600 tabular-nums">{anomalyCount}</span>
          </button>

          <div className="inline-flex items-center rounded-lg border border-[var(--card-border)] overflow-hidden" role="group" aria-label="View">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-xs transition-colors ${
                view === "grid"
                  ? "bg-[var(--accent)]/15 text-[var(--accent-glow)]"
                  : "bg-[var(--card-bg)] text-neutral-400 hover:text-white"
              }`}
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-xs transition-colors ${
                view === "table"
                  ? "bg-[var(--accent)]/15 text-[var(--accent-glow)]"
                  : "bg-[var(--card-bg)] text-neutral-400 hover:text-white"
              }`}
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" />
                <path d="M6 4v8M11 4v8" />
              </svg>
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={copyBoard}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs transition-colors ${
              copied
                ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-400"
                : "border-[var(--card-border)] bg-[var(--card-bg)] text-neutral-400 hover:text-white hover:border-neutral-600"
            }`}
          >
            {copied ? (
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-6" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                <path d="M10.5 5.5v-2a1.5 1.5 0 00-1.5-1.5h-5a1.5 1.5 0 00-1.5 1.5v5a1.5 1.5 0 001.5 1.5h2" />
              </svg>
            )}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>

      {pinnedAssets.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[var(--accent-glow)]" fill="currentColor" aria-hidden="true">
              <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9L12 3z" />
            </svg>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Watchlist
            </h2>
            <span className="text-[11px] text-neutral-600 tabular-nums">
              {pinnedAssets.length} pinned
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedAssets.map((asset) => (
              <ScoreCard
                key={asset.symbol}
                symbol={asset.symbol}
                sector={SECTOR_MAP[asset.symbol]}
                risk_score={asset.risk_score}
                risk_level={asset.risk_level}
                confidence={asset.confidence}
                factors={asset.factors}
                anomaly={asset.anomaly}
                data_source={asset.data_source}
                score_delta={asset.score_delta}
                pinned
                onTogglePin={() => togglePin(asset.symbol)}
              />
            ))}
          </div>
        </div>
      )}

      {recentMoves.length > 0 && (
        <div className="mt-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              What&apos;s changed
            </h2>
            <span className="text-[10px] text-neutral-600">
              vs previous attestation
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentMoves.map((a) => {
              const up = (a.score_delta ?? 0) > 0;
              return (
                <Link
                  key={a.symbol}
                  href={`/asset/${a.symbol}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    up
                      ? "border-red-800/50 bg-red-950/20 text-red-300 hover:border-red-700/70"
                      : "border-emerald-800/50 bg-emerald-950/20 text-emerald-300 hover:border-emerald-700/70"
                  }`}
                >
                  <span className="font-mono font-medium">{a.symbol}</span>
                  <span className="text-neutral-500 tabular-nums">
                    {a.previous_score ?? "—"}→{a.risk_score}
                  </span>
                  <span className={`tabular-nums ${up ? "text-red-400" : "text-emerald-400"}`}>
                    {up ? "▲" : "▼"} {Math.abs(a.score_delta ?? 0)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {marketHistory && marketHistory.points.length >= 2 && (
        <div className="mt-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Market risk trend
            </h2>
            <span className="text-[10px] text-neutral-600 tabular-nums">
              avg score · last {marketHistory.hours}h
            </span>
          </div>
          <svg
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            className="w-full h-20"
            role="img"
            aria-label="Average market risk over the last 24 hours"
          >
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b7cf6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#8b7cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const pts = marketHistory.points;
              const min = Math.min(...pts.map((p) => p.avg_score)) - 5;
              const max = Math.max(...pts.map((p) => p.avg_score)) + 5;
              const range = Math.max(1, max - min);
              const coords = pts.map((p, i) => {
                const x = (i / (pts.length - 1)) * 100;
                const y = 30 - ((p.avg_score - min) / range) * 28;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              });
              const line = coords.join(" ");
              return (
                <>
                  <polygon points={`0,32 ${line} 100,32`} fill="url(#trend-fill)" />
                  <polyline
                    points={line}
                    fill="none"
                    stroke="#8b7cf6"
                    strokeWidth="1.5"
                    pathLength={100}
                    vectorEffect="non-scaling-stroke"
                    className="chart-line"
                  />
                </>
              );
            })()}
          </svg>
        </div>
      )}

      {visibleAssets.length === 0 ? (
        <div className="mt-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-8 text-center">
          <p className="text-sm text-neutral-400">
            No assets match your filters.
          </p>
          <button
            onClick={() => {
              setQuery("");
              setLevelFilter("ALL");
              setSectorFilter("ALL");
              setAnomalyOnly(false);
            }}
            className="mt-3 text-xs text-[var(--accent-glow)] hover:underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : view === "table" ? (
        <div className="mt-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] font-mono uppercase tracking-widest text-neutral-500 border-b border-[var(--card-border)]">
                <th scope="col" className="px-4 py-3 font-medium">Asset</th>
                <th scope="col" className="px-4 py-3 font-medium">Sector</th>
                <th scope="col" className="px-4 py-3 font-medium">Risk</th>
                <th scope="col" className="px-4 py-3 font-medium">Δ</th>
                <th scope="col" className="px-4 py-3 font-medium">Confidence</th>
                <th scope="col" className="px-4 py-3 font-medium">Source</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleAssets.map((asset) => (
                <tr
                  key={asset.symbol}
                  className="border-b border-[var(--card-border)] last:border-0 hover:bg-[var(--card-border)]/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/asset/${asset.symbol}`} className="group flex items-center gap-2">
                      <span className="font-mono font-medium text-neutral-200 group-hover:text-[var(--accent-glow)] transition-colors">
                        {asset.symbol}
                      </span>
                      {asset.anomaly && (
                        <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-400" title="Anomaly" aria-label="Anomaly" />
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {SECTOR_MAP[asset.symbol] ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          asset.risk_score <= 20
                            ? "text-green-400"
                            : asset.risk_score <= 40
                              ? "text-yellow-400"
                              : asset.risk_score <= 60
                                ? "text-orange-400"
                                : asset.risk_score <= 80
                                  ? "text-red-400"
                                  : "text-red-500"
                        }`}
                      >
                        {asset.risk_score}
                      </span>
                      <RiskBadge level={asset.risk_level} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {asset.score_delta !== null &&
                    asset.score_delta !== undefined &&
                    asset.score_delta !== 0 ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-mono tabular-nums ${
                          asset.score_delta > 0 ? "text-red-400" : "text-green-400"
                        }`}
                        title={`Change vs previous attestation`}
                      >
                        {asset.score_delta > 0 ? "▲" : "▼"} {Math.abs(asset.score_delta)}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent-glow)]"
                          style={{ width: `${asset.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500 tabular-nums w-8 text-right">
                        {asset.confidence}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${asset.data_source === "yahoo" ? "text-emerald-400" : "text-yellow-400"}`}>
                      <span className={`w-1 h-1 rounded-full ${asset.data_source === "yahoo" ? "bg-emerald-400" : "bg-yellow-400"}`} aria-hidden="true" />
                      {asset.data_source === "yahoo" ? "LIVE" : asset.data_source.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => togglePin(asset.symbol)}
                      aria-label={watchlist.includes(asset.symbol) ? `Unpin ${asset.symbol}` : `Pin ${asset.symbol}`}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                        watchlist.includes(asset.symbol)
                          ? "text-[var(--accent-glow)] hover:text-white"
                          : "text-neutral-600 hover:text-neutral-300"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={watchlist.includes(asset.symbol) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9L12 3z" />
                      </svg>
                    </button>
                    <Link
                      href={`/asset/${asset.symbol}`}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--accent-glow)] hover:underline hover:bg-[var(--card-border)]/50 transition-colors"
                    >
                      details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {visibleAssets.map((asset) => (
            <ScoreCard
              key={asset.symbol}
              symbol={asset.symbol}
              sector={SECTOR_MAP[asset.symbol]}
              risk_score={asset.risk_score}
              risk_level={asset.risk_level}
              confidence={asset.confidence}
              factors={asset.factors}
              anomaly={asset.anomaly}
              data_source={asset.data_source}
              score_delta={asset.score_delta}
              pinned={watchlist.includes(asset.symbol)}
              onTogglePin={() => togglePin(asset.symbol)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="px-4 py-2 bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--accent-glow)] rounded-lg text-sm transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Refreshing..." : "Refresh Now"}
          </button>
          <span className="text-xs text-neutral-500">
            Auto-refresh every {POLL_SECONDS}s
          </span>
        </div>
      </div>
    </div>
  );
}
