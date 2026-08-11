"use client";

import Link from "next/link";
import type { Attestation } from "@/lib/types";

interface HeatmapProps {
  assets: Attestation[];
}

export function RiskHeatmap({ assets }: HeatmapProps) {
  // Sort by risk score descending
  const sorted = [...assets].sort((a, b) => b.risk_score - a.risk_score);

  const getColor = (score: number, anomaly: boolean) => {
    if (anomaly) return "bg-red-500 border-red-600";
    if (score <= 20) return "bg-green-500 border-green-600";
    if (score <= 40) return "bg-yellow-500 border-yellow-600";
    if (score <= 60) return "bg-orange-500 border-orange-600";
    if (score <= 80) return "bg-red-500 border-red-600";
    return "bg-red-700 border-red-800";
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Risk Heatmap</h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-5 gap-3">
        {sorted.map((asset) => (
          <Link
            key={asset.symbol}
            href={`/asset/${asset.symbol}`}
            aria-label={`${asset.symbol}: risk ${asset.risk_score}, ${asset.risk_level}${asset.anomaly ? ", anomaly" : ""}`}
            className={`relative ${getColor(asset.risk_score, asset.anomaly)}
              border-2 rounded-lg p-4 flex flex-col items-center justify-center
              transition-[filter,opacity] hover:brightness-110 focus-visible:brightness-110 group`}
          >
            {asset.anomaly && (
              <span
                className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse"
                aria-hidden="true"
              />
            )}
            <div className="text-xs font-medium text-white/80 mb-1">
              {asset.symbol}
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {asset.risk_score}
            </div>
            <div className="text-[11px] text-white/70 mt-1 uppercase tracking-wide">
              {asset.risk_level}
            </div>

            {/* Tooltip */}
            <span
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-[var(--card-border)]"
              role="tooltip"
            >
              <span className="font-semibold">{asset.symbol}</span> · risk{" "}
              {asset.risk_score}/100 · confidence {asset.confidence}%
              {asset.anomaly && <span className="text-red-300"> · anomaly</span>}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>Low (0-20)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded" />
          <span>Moderate (21-40)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded" />
          <span>Elevated (41-60)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span>High (61-80)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-700 rounded" />
          <span>Critical (81-100)</span>
        </div>
      </div>
    </div>
  );
}