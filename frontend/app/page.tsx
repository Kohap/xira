"use client";

import { useEffect, useState, useCallback } from "react";
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
}: {
  summary: string;
  generatedAt: number;
  modelVersion: string;
  anomalyCount: number;
  totalAssets: number;
}) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Market Risk Overview</h2>
          <p className="text-sm text-neutral-400 mt-1">{summary}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>
            Updated{" "}
            <span className="text-neutral-300 tabular-nums">
              {formatTimestamp(generatedAt)}
            </span>
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

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/assets/all`);
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      const json: AllAssetsResponse = await res.json();
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 mb-6 animate-pulse">
          <div className="h-5 w-48 bg-neutral-800 rounded mb-2" />
          <div className="h-4 w-96 bg-neutral-800 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-10 text-center">
          <p className="text-neutral-400 text-lg mb-2">
            Unable to connect to the XIRA backend.
          </p>
          <p className="text-neutral-600 text-sm mb-2">
            Make sure the API server is running:
          </p>
          <pre className="bg-neutral-900 rounded-lg p-3 text-xs text-neutral-400 inline-block text-left mt-1 mb-4">
            cd backend && source venv/bin/activate && python -m app.main
          </pre>
          <p className="text-neutral-500 text-xs mb-4">
            API Base: <code className="text-[var(--accent-glow)]">{apiBase}</code>
          </p>
          {error && (
            <p className="text-red-400/80 text-xs mb-4 font-mono">
              {error}
            </p>
          )}
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const anomalyCount = data.assets.filter((a) => a.anomaly).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-4">
        <SummaryBar
          summary={data.summary}
          generatedAt={data.generated_at}
          modelVersion={data.model_version}
          anomalyCount={anomalyCount}
          totalAssets={data.assets.length}
        />
      </div>

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
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--accent-glow)] rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
        <span className="text-xs text-neutral-600">
          XIRA v{data.model_version}
        </span>
      </div>
    </div>
  );
}
