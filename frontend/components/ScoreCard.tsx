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
  sector,
  risk_score,
  risk_level,
  confidence,
  factors,
  anomaly,
  data_source,
  score_delta,
  pinned,
  onTogglePin,
}: {
  symbol: string;
  sector?: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  factors: { name: string; label?: string; score: number }[];
  anomaly: boolean;
  data_source?: string;
  score_delta?: number | null;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const simulated = data_source === "mock";
  return (
    <div className="group relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 hover:border-neutral-600 transition-colors duration-200">
      {anomaly && (
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full" />
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-base flex items-baseline gap-2">
            <span className="truncate">{symbol}</span>
            {sector && (
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                {sector}
              </span>
            )}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <RiskBadge level={risk_level} />
            {score_delta !== undefined && score_delta !== null && score_delta !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums ${
                  score_delta > 0 ? "text-red-400" : "text-green-400"
                }`}
                title={`Change vs previous attestation`}
              >
                {score_delta > 0 ? "▲" : "▼"} {Math.abs(score_delta)}
              </span>
            )}
            {simulated && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider text-yellow-400 bg-yellow-900/20 border border-yellow-700/40"
                title="Score computed from simulated data"
              >
                simulated
              </span>
            )}
          </div>
        </div>
        <GaugeRing score={risk_score} size={56} />
      </div>

      <div className="space-y-1.5 mt-3">
        {factors.slice(0, 4).map((f) => (
          <div key={f.name} className="flex items-center justify-between text-xs gap-2">
            <span className="text-neutral-400 truncate min-w-0">{f.label ?? f.name.toUpperCase()}</span>
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

      <div className="mt-3 pt-2 border-t border-[var(--card-border)] space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>confidence</span>
          <span className="text-neutral-300 tabular-nums">{confidence}%</span>
        </div>
        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-glow)] transition-all duration-500"
            style={{ width: `${confidence}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-neutral-600 font-mono">
              {sector ?? symbol}
            </span>
            {onTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onTogglePin();
                }}
                aria-label={pinned ? `Unpin ${symbol}` : `Pin ${symbol} to watchlist`}
                title={pinned ? "Unpin" : "Pin to watchlist"}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  pinned
                    ? "text-[var(--accent-glow)] hover:text-white"
                    : "text-neutral-600 hover:text-neutral-300"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9L12 3z" />
                </svg>
              </button>
            )}
          </div>
          <a
            href={`/asset/${symbol}`}
            className="inline-flex items-center gap-1 px-2 py-1.5 -mr-1.5 -my-1.5 rounded-lg text-[var(--accent-glow)] hover:underline hover:bg-[var(--card-border)]/50 transition-colors"
            aria-label={`Open ${symbol} details`}
          >
            details →
          </a>
        </div>
      </div>
    </div>
  );
}
