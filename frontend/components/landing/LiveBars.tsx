"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAllAssets } from "@/lib/api";
import { riskLevelColor } from "@/lib/types";
import type { AllAssetsResponse } from "@/lib/types";
import type React from "react";

export function LiveBars() {
  const [data, setData] = useState<AllAssetsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAllAssets()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assets = data?.assets ?? [];
  const top = [...assets].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);
  const max = Math.max(1, ...top.map((a) => a.risk_score));

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="live-dot w-2.5 h-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="text-xs font-medium text-neutral-300">LIVE RISK BOARD</span>
        </div>
        <span className="text-[11px] text-neutral-500 font-mono">
          {error ? "offline" : data ? `${data.assets.length} markets` : "syncing…"}
        </span>
      </div>

      {error || !data ? (
        <div className="flex items-end gap-2 h-40" aria-label="Loading risk board">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-white/5 animate-pulse"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-end gap-2 h-40">
          {top.map((asset, i) => (
            <Link
              key={asset.symbol}
              href={`/asset/${asset.symbol}`}
              className="flex-1 flex flex-col items-center gap-2 group min-w-0"
              aria-label={`${asset.symbol} risk score ${asset.risk_score}`}
            >
              <div className="flex-1 w-full flex items-end">
                <div
                  className={`w-full rounded-t-md ${riskLevelColor(asset.risk_level)} transition-all duration-700 ease-out group-hover:brightness-125`}
                  style={
                    {
                      height: "0%",
                      animation: `bar-grow 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.07}s forwards`,
                      "--bar-h": `${Math.max(8, (asset.risk_score / max) * 100)}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
              <div className="w-full text-center min-w-0">
                <div className="text-[10px] font-mono text-neutral-400 truncate">{asset.symbol}</div>
                <div className="text-xs font-semibold text-white tabular-nums">{asset.risk_score}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @keyframes bar-grow {
          from { height: 0%; }
          to { height: var(--bar-h); }
        }
      `}</style>

      <div className="mt-5 pt-4 border-t border-[var(--card-border)] flex items-center justify-between text-[11px] text-neutral-500">
        <span>Verified on X Layer testnet</span>
        <span className="font-mono">1 score = 1 attestation tx</span>
      </div>
    </div>
  );
}