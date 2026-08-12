"use client";

import Link from "next/link";
import type { Attestation } from "@/lib/types";

interface HeatmapProps {
  assets: Attestation[];
}

export function RiskHeatmap({ assets }: HeatmapProps) {
  // Sort by risk score descending (highest risk first, top-left)
  const sorted = [...assets].sort((a, b) => b.risk_score - a.risk_score);

  const getLevel = (score: number) => {
    if (score <= 20) return "LOW";
    if (score <= 40) return "MODERATE";
    if (score <= 60) return "ELEVATED";
    if (score <= 80) return "HIGH";
    return "CRITICAL";
  };

  // Deeper, richer shades so each level is clearly distinct on dark cards.
  const LEVEL_CLASSES: Record<string, string> = {
    LOW: "bg-green-600 border-green-700",
    MODERATE: "bg-yellow-600 border-yellow-700",
    ELEVATED: "bg-orange-600 border-orange-700",
    HIGH: "bg-red-600 border-red-700",
    CRITICAL: "bg-red-800 border-red-900",
  };

  const LEVEL_LEGEND = [
    { level: "LOW", label: "Low (0-20)", cls: "bg-green-600" },
    { level: "MODERATE", label: "Moderate (21-40)", cls: "bg-yellow-600" },
    { level: "ELEVATED", label: "Elevated (41-60)", cls: "bg-orange-600" },
    { level: "HIGH", label: "High (61-80)", cls: "bg-red-600" },
    { level: "CRITICAL", label: "Critical (81-100)", cls: "bg-red-800" },
  ];

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">Risk Heatmap</h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {sorted.map((asset) => {
          const level = getLevel(asset.risk_score);
          const isAnomaly = asset.anomaly;
          return (
            <Link
              key={asset.symbol}
              href={`/asset/${asset.symbol}`}
              aria-label={`${asset.symbol}: risk ${asset.risk_score}, ${asset.risk_level}${isAnomaly ? ", anomaly" : ""}`}
              className={`relative ${isAnomaly ? "bg-red-600 border-red-800" : LEVEL_CLASSES[level]}
                border-2 rounded-lg p-2.5 sm:p-4 flex flex-col items-center justify-center min-h-[84px] sm:min-h-[104px]
                transition-[filter,transform] hover:brightness-110 focus-visible:brightness-110 active:scale-[0.97] group`}
            >
              {/* Depth gradient so tiles read as heat levels, not flat pastels */}
              <span
                className="absolute inset-0 rounded-[6px] bg-gradient-to-b from-black/0 to-black/30 pointer-events-none"
                aria-hidden="true"
              />

              {isAnomaly && (
                <span
                  className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse"
                  aria-hidden="true"
                />
              )}
              <div className="relative text-xs font-semibold text-white mb-1 truncate max-w-full">
                {asset.symbol}
              </div>
              <div className="relative text-xl sm:text-2xl font-bold text-white tabular-nums">
                {asset.risk_score}
              </div>
              <div className="relative text-[10px] sm:text-[11px] text-white/85 mt-1 uppercase tracking-wide">
                {asset.risk_level}
              </div>

              {/* Tooltip */}
              <span
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-[var(--card-border)] max-w-[85vw]"
                role="tooltip"
              >
                <span className="whitespace-nowrap">
                  <span className="font-semibold">{asset.symbol}</span> · risk{" "}
                  {asset.risk_score}/100 · confidence {asset.confidence}%
                  {isAnomaly && <span className="text-red-300"> · anomaly</span>}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-x-5 gap-y-2 text-xs flex-wrap">
        {LEVEL_LEGEND.map((item) => (
          <div key={item.level} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${item.cls}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}