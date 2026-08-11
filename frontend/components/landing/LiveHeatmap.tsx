"use client";

import { useEffect, useState } from "react";
import { fetchAllAssets } from "@/lib/api";
import type { AllAssetsResponse } from "@/lib/types";
import { RiskHeatmap } from "@/components/RiskHeatmap";

export function LiveHeatmap() {
  const [data, setData] = useState<AllAssetsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllAssets()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <div className="h-5 w-40 bg-white/5 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return <RiskHeatmap assets={data.assets} />;
}