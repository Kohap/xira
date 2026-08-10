"use client";

import type { FactorScore } from "@/lib/types";
import { riskLevelTextColor, riskLevelLabel } from "@/lib/types";
import type { RiskLevel } from "@/lib/types";

export function FactorBreakdown({ factors }: { factors: FactorScore[] }) {
  return (
    <div className="space-y-3">
      {factors.map((f) => (
        <div key={f.name} className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{f.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">
                weight {Math.round(f.weight * 100)}%
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  f.score <= 20
                    ? "text-green-400"
                    : f.score <= 40
                      ? "text-yellow-400"
                      : f.score <= 60
                        ? "text-orange-400"
                        : f.score <= 80
                          ? "text-red-400"
                          : "text-red-500"
                }`}
              >
                {f.score}/100
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                f.score <= 20
                  ? "bg-green-400"
                  : f.score <= 40
                    ? "bg-yellow-400"
                    : f.score <= 60
                      ? "bg-orange-400"
                      : f.score <= 80
                        ? "bg-red-400"
                        : "bg-red-500"
              }`}
              style={{ width: `${f.score}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1.5">{f.description}</p>
        </div>
      ))}
    </div>
  );
}

export function HistoryChart({
  history,
}: {
  history: { risk_score: number; timestamp: number }[];
}) {
  if (!history.length) return null;

  const maxScore = 100;
  const height = 64;
  const width = history.length * 16;

  const points = history
    .map((h, i) => {
      const x = (i / Math.max(history.length - 1, 1)) * 100;
      const y = 100 - (h.risk_score / maxScore) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 100 100`}
        className="w-full h-20"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="rgb(139, 124, 246)"
          strokeWidth="2"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
        {history.map((h, i) => {
          const x = (i / Math.max(history.length - 1, 1)) * 100;
          const y = 100 - (h.risk_score / maxScore) * 100;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill={
                h.risk_score <= 20
                  ? "#22c55e"
                  : h.risk_score <= 40
                    ? "#eab308"
                    : h.risk_score <= 60
                      ? "#f97316"
                      : h.risk_score <= 80
                        ? "#ef4444"
                        : "#dc2626"
              }
            />
          );
        })}
      </svg>
    </div>
  );
}

export function AlertBanner({
  anomaly,
  anomaly_reason,
}: {
  anomaly: boolean;
  anomaly_reason: string;
}) {
  if (!anomaly) return null;

  return (
    <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 flex items-start gap-3">
      <span className="text-red-400 text-lg flex-shrink-0">&#9888;</span>
      <div>
        <h4 className="text-red-400 font-medium text-sm">Anomaly Detected</h4>
        <p className="text-red-300/80 text-sm mt-0.5">{anomaly_reason}</p>
      </div>
    </div>
  );
}
