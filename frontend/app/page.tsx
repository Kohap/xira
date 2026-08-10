"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { AllAssetsResponse } from "@/lib/types";
import { ScoreCard } from "@/components/ScoreCard";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function SummaryBar({
  summary,
  generatedAt,
  modelVersion,
  anomalyCount,
  totalAssets,
  nextRefresh,
  dataSource,
}: {
  summary: string;
  generatedAt: number;
  modelVersion: string;
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Market Risk Overview</h2>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                isLive
                  ? "bg-green-900/40 text-green-400 border border-green-700/50"
                  : "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50"
              }`}
            >
              {isLive ? "LIVE" : dataSource.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-neutral-400 mt-1">{summary}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
          <span>
            Updated{" "}
            <span className="text-neutral-300 tabular-nums">
              {formatTimestamp(generatedAt)}
            </span>
          </span>
          <span>
            Refresh in{" "}
            <span className="text-neutral-300 tabular-nums">{nextRefresh}s</span>
          </span>
          <span>
            Model: <span className="text-neutral-300">{modelVersion}</span>
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
  const [loading, setLoading] = useState(true);
  const [coldStart, setColdStart] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
        setColdStart(false);
        setCountdown(60);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (msg.includes("fetch") || msg.includes("NetworkError")) {
          setColdStart(true);
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiBase]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

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
        <p className="text-center text-neutral-500 text-sm mb-6">
          {coldStart
            ? "Waking up backend (Render free tier cold start, ~30s)..."
            : "Loading risk data for 15 xStocks..."}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-10 text-center">
          <div className="text-4xl mb-4">&#128225;</div>
          <p className="text-neutral-400 text-lg mb-2">
            Unable to connect to the XIRA backend.
          </p>
          <p className="text-neutral-500 text-xs mb-4">
            API: <code className="text-[var(--accent-glow)]">{apiBase}</code>
          </p>
          {error && (
            <p className="text-red-400/80 text-xs mb-6 font-mono bg-red-900/10 rounded p-2 inline-block">
              {error}
            </p>
          )}
          <div className="space-y-3">
            <p className="text-neutral-600 text-xs">
              {coldStart
                ? "The backend is on Render free tier and may take 30-60s to wake from sleep."
                : "Make sure the API server is running."}
            </p>
            <button
              onClick={() => fetchData(true)}
              className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const anomalyCount = data.assets.filter((a) => a.anomaly).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SummaryBar
        summary={data.summary}
        generatedAt={data.generated_at}
        modelVersion={data.model_version}
        anomalyCount={anomalyCount}
        totalAssets={data.assets.length}
        nextRefresh={countdown}
        dataSource={data.data_source || "mock"}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.assets.map((asset) => (
          <ScoreCard
            key={asset.symbol}
            symbol={asset.symbol}
            risk_score={asset.risk_score}
            risk_level={asset.risk_level}
            confidence={asset.confidence}
            factors={asset.factors}
            anomaly={asset.anomaly}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="px-4 py-2 bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--accent-glow)] rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Now"}
          </button>
          <span className="text-xs text-neutral-500">
            Auto-refresh every 60s
          </span>
        </div>
        <span className="text-xs text-neutral-600">
          XIRA v{data.model_version}
        </span>
      </div>
    </div>
  );
}
