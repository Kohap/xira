"use client";

import { useEffect, useState } from "react";
import { fetchAllAssets } from "@/lib/api";
import type { AllAssetsResponse } from "@/lib/types";

const FALLBACK = [
  "NVDAx 66", "TSLAx 57", "AAPLx 31", "MSFTx 28", "GOOGLx 34",
  "AMZNx 22", "METAx 41", "SPYx 19", "QQQx 24", "AMDx 71",
  "INTCx 62", "NFLXx 45", "BAx 78", "JPMx 16", "XOMx 27",
];

const SCORE_COLOR = (score: number) =>
  score <= 20 ? "text-green-400" :
  score <= 40 ? "text-yellow-400" :
  score <= 60 ? "text-orange-400" :
  score <= 80 ? "text-red-400" : "text-red-500";

export function LiveTicker() {
  const [items, setItems] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllAssets()
      .then((d: AllAssetsResponse) => {
        if (cancelled) return;
        setItems(d.assets.map((a) => `${a.symbol} ${a.risk_score}`));
      })
      .catch(() => {
        if (!cancelled) setItems(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ticker = items ?? FALLBACK;

  return (
    <div
      className="marquee-hover overflow-hidden border-y border-[var(--card-border)] bg-black/30 py-3"
      role="region"
      aria-label="Live risk scores"
    >
      <div className="marquee-track" aria-hidden={false}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {ticker.map((item) => {
              const [symbol, score] = item.split(" ");
              return (
                <span
                  key={`${copy}-${symbol}`}
                  className="flex items-center gap-2 px-4 text-sm font-mono whitespace-nowrap"
                >
                  <span className="text-neutral-400">{symbol}</span>
                  <span className={`tabular-nums font-semibold ${SCORE_COLOR(Number(score))}`}>
                    {score}
                  </span>
                  <span className="text-neutral-700" aria-hidden>·</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}