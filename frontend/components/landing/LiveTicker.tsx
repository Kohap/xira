"use client";

import { useEffect, useState } from "react";
import { fetchBoard } from "@/lib/board-cache";
import type { AllAssetsResponse } from "@/lib/types";

const SCORE_COLOR = (score: number) =>
  score <= 20 ? "text-green-400" :
  score <= 40 ? "text-yellow-400" :
  score <= 60 ? "text-orange-400" :
  score <= 80 ? "text-red-400" : "text-red-500";

export function LiveTicker() {
  const [items, setItems] = useState<string[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBoard()
      .then((d: AllAssetsResponse) => {
        if (cancelled) return;
        setItems(d.assets.map((a) => `${a.symbol} ${a.risk_score}`));
        setOffline(false);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) {
    return (
      <div
        className="overflow-hidden border-y border-[var(--card-border)] bg-black/30 py-3"
        role="region"
        aria-label="Live risk scores"
      >
        <div className="text-center text-[11px] font-mono text-neutral-600">
          {offline ? "Risk board offline – scores unavailable" : "Loading risk scores…"}
        </div>
      </div>
    );
  }

  const ticker = items;

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