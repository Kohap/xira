"use client";

import type { RiskLevel } from "@/lib/types";
import { riskLevelColor, riskLevelTextColor, riskLevelLabel } from "@/lib/types";

function GaugeRing({ score, size = 64 }: { score: number; size?: number }) {
  const strokeW = size * 0.12;
  const r = size / 2 - strokeW;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score <= 20
      ? "stroke-green-400"
      : score <= 40
        ? "stroke-yellow-400"
        : score <= 60
          ? "stroke-orange-400"
          : score <= 80
            ? "stroke-red-400"
            : "stroke-red-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          className="text-neutral-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeW}
          strokeLinecap="round"
          className={`${color} transition-all duration-700 ease-out`}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute text-lg font-bold tabular-nums">{score}</span>
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${riskLevelTextColor(level)} bg-neutral-800/60 border border-neutral-700`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${riskLevelColor(level)}`} />
      {riskLevelLabel(level)}
    </span>
  );
}

export function ScoreCard({
  symbol,
  risk_score,
  risk_level,
  confidence,
  factors,
  anomaly,
}: {
  symbol: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  factors: { name: string; score: number }[];
  anomaly: boolean;
}) {
  return (
    <div className="group relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 hover:border-neutral-600 transition-all duration-200 animate-fade-in">
      {anomaly && (
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-base">{symbol}</h3>
          <RiskBadge level={risk_level} />
        </div>
        <GaugeRing score={risk_score} size={56} />
      </div>

      <div className="space-y-1.5 mt-3">
        {factors.slice(0, 4).map((f) => (
          <div key={f.name} className="flex items-center justify-between text-xs gap-2">
            <span className="text-neutral-400 truncate min-w-0">{f.name.toUpperCase()}</span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 sm:w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
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
              <span className="tabular-nums w-6 text-right">{f.score}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-[var(--card-border)] flex items-center justify-between text-xs text-neutral-500">
        <span>confidence {confidence}%</span>
        <a
          href={`/asset/${symbol}`}
          className="inline-flex items-center gap-1 px-2 py-1.5 -mr-1.5 -my-1.5 rounded-lg text-[var(--accent-glow)] hover:underline hover:bg-white/5 transition-colors"
          aria-label={`Open ${symbol} details`}
        >
          details →
        </a>
      </div>
    </div>
  );
}
