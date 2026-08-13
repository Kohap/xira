"use client";

import Link from "next/link";
import type { Attestation } from "@/lib/types";

interface HeatmapProps {
  assets: Attestation[];
}

export function RiskHeatmap({ assets }: HeatmapProps) {
  const HEATMAP_LIMIT = 15;

  const sorted = [...assets]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, HEATMAP_LIMIT);

  const getLevel = (score: number) => {
    if (score <= 20) return "LOW";
    if (score <= 40) return "MODERATE";
    if (score <= 60) return "ELEVATED";
    if (score <= 80) return "HIGH";
    return "CRITICAL";
  };

  // Tonal fills: quiet, desaturated tile surfaces (per the brand's risk
  // treatment on badges and bands), hue tells the level, not brightness.
  const LEVEL_CLASSES: Record<string, string> = {
    LOW: "bg-green-900/50 border-green-700/50",
    MODERATE: "bg-yellow-900/50 border-yellow-700/50",
    ELEVATED: "bg-orange-900/50 border-orange-700/50",
    HIGH: "bg-red-900/55 border-red-700/55",
    CRITICAL: "bg-red-800/70 border-red-500/60",
  };

  const LEVEL_TEXT: Record<string, string> = {
    LOW: "text-green-200",
    MODERATE: "text-yellow-200",
    ELEVATED: "text-orange-200",
    HIGH: "text-red-200",
    CRITICAL: "text-red-100",
  };

  const LEVEL_LEGEND = [
    { level: "LOW", label: "Low (0-20)", cls: "bg-green-900/50 border-green-700/50" },
    { level: "MODERATE", label: "Moderate (21-40)", cls: "bg-yellow-900/50 border-yellow-700/50" },
    { level: "ELEVATED", label: "Elevated (41-60)", cls: "bg-orange-900/50 border-orange-700/50" },
    { level: "HIGH", label: "High (61-80)", cls: "bg-red-900/55 border-red-700/55" },
    { level: "CRITICAL", label: "Critical (81-100)", cls: "bg-red-800/70 border-red-500/60" },
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
              className={`relative ${LEVEL_CLASSES[level]}
                border-2 rounded-lg p-2.5 sm:p-4 flex flex-col items-center justify-center min-h-[84px] sm:min-h-[104px]
                transition-[filter] hover:brightness-110 focus-visible:brightness-110 active:scale-[0.97] group`}
            >
              {isAnomaly && (
                <span
                  className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full"
                  aria-hidden="true"
                />
              )}
              <div className="text-xs font-semibold text-white mb-1 truncate max-w-full">
                {asset.symbol}
              </div>
              <div className={`text-xl sm:text-2xl font-bold tabular-nums ${LEVEL_TEXT[level]}`}>
                {asset.risk_score}
              </div>
              <div className="text-[11px] sm:text-[11px] text-white/85 mt-1 uppercase tracking-wide">
                {asset.risk_level}
              </div>

              {/* Tooltip: anchored inside the tile so it can never be cut by
                  the viewport edge, even on the last column */}
              <span
                className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-max max-w-[calc(100vw-2rem)] px-3 py-2 bg-[var(--card-bg)] text-white text-xs rounded-lg border border-[var(--card-border)] opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                role="tooltip"
              >
                <span className="sm:whitespace-nowrap">
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
            <div className={`w-4 h-4 rounded border ${item.cls}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}