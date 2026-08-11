"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { fetchAllAssets } from "@/lib/api";
import { riskLevelColor } from "@/lib/types";
import type { AllAssetsResponse } from "@/lib/types";
import type React from "react";

const RETRY_MS = 8000;

export function LiveBars() {
  const [data, setData] = useState<AllAssetsResponse | null>(null);
  const [tries, setTries] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let localTries = 0;

    const attempt = () => {
      fetchAllAssets()
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setTries(0);
        })
        .catch(() => {
          if (cancelled) return;
          localTries += 1;
          setTries(localTries);
          timerRef.current = setTimeout(attempt, RETRY_MS);
        });
    };

    attempt();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const offline = tries > 0 && !data;
  const assets = data?.assets ?? [];
  const top = [...assets].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);
  const max = Math.max(1, ...top.map((a) => a.risk_score));

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${offline ? "bg-yellow-400" : "bg-emerald-400"} live-dot`}
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-neutral-300">LIVE RISK BOARD</span>
        </div>
        <span className="text-[11px] text-neutral-400 font-mono" role="status">
          {offline
            ? `reconnecting (retry ${tries})`
            : data
            ? `${data.assets.length} markets`
            : "syncing…"}
        </span>
      </div>

      <div className="flex items-end gap-1.5 sm:gap-2 h-32 sm:h-40">
        {offline || !data ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-white/5 animate-pulse"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))
        ) : (
          top.map((asset, i) => (
            <Link
              key={asset.symbol}
              href={`/asset/${asset.symbol}`}
              className="flex-1 flex flex-col items-center gap-1.5 group min-w-0"
              aria-label={`${asset.symbol} risk score ${asset.risk_score}`}
            >
              <div className="flex-1 w-full flex items-end">
                <div
                  className={`score-bar w-full rounded-t-md ${riskLevelColor(asset.risk_level)} transition-[filter] duration-300 group-hover:brightness-125 group-focus-visible:brightness-125`}
                  style={{ "--bar-h": `${Math.max(10, (asset.risk_score / max) * 100)}%` } as React.CSSProperties}
                />
              </div>
              <div className="w-full text-center min-w-0">
                <div className="text-[10px] font-mono text-neutral-400 truncate">{asset.symbol}</div>
                <div className="text-xs font-semibold text-white tabular-nums leading-none">
                  {asset.risk_score}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-[var(--card-border)] flex items-center justify-between gap-3 text-[11px] text-neutral-400">
        <span>Verified on X Layer testnet</span>
        <span className="font-mono whitespace-nowrap">1 score = 1 attestation tx</span>
      </div>
    </div>
  );
}