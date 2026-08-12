"use client";

import { useEffect, useState, useRef } from "react";
import { fetchAllAssets } from "@/lib/api";
import type { AllAssetsResponse } from "@/lib/types";
import { RiskHeatmap } from "@/components/RiskHeatmap";

const RETRY_MS = 8000;

export function LiveHeatmap() {
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

  if (!data) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-40 bg-[var(--card-border)]/60 rounded animate-pulse" />
          <div className="h-4 w-24 bg-[var(--card-border)]/60 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-[var(--card-border)]/60 animate-pulse" />
          ))}
        </div>
        {tries > 0 && (
          <p className="mt-4 text-xs text-neutral-400 font-mono" role="status">
            reconnecting (retry {tries})
          </p>
        )}
      </div>
    );
  }

  return <RiskHeatmap assets={data.assets} />;
}