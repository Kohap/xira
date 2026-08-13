"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { fetchBoard } from "@/lib/board-cache";
import { riskLevelColor } from "@/lib/types";
import type { AllAssetsResponse } from "@/lib/types";
import type React from "react";

const RETRY_MS = 8000;

function scoreStroke(score: number): string {
  if (score <= 20) return "#22c55e";
  if (score <= 40) return "#eab308";
  if (score <= 60) return "#f97316";
  if (score <= 80) return "#ef4444";
  return "#dc2626";
}

function formatAge(now: number, generatedAt: number): string {
  const s = Math.max(0, Math.round((now - generatedAt) / 1000));
  if (s < 90) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export function LiveBars() {
  const [data, setData] = useState<AllAssetsResponse | null>(null);
  const [tries, setTries] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const curveLineRef = useRef<SVGPolylineElement | null>(null);
  const curveDotRef = useRef<HTMLDivElement | null>(null);
  const curveWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const line = curveLineRef.current;
    const dot = curveDotRef.current;
    const wrap = curveWrapRef.current;
    if (!line || !dot || !wrap) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const total = line.getTotalLength();
    if (!total) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const progress = ((t - start) % 3000) / 3000;
      const p = line.getPointAtLength(progress * total);
      dot.style.opacity = "1";
      dot.style.transform = `translate(calc(${(p.x / 100) * wrap.clientWidth}px - 50%), calc(${(p.y / 40) * wrap.clientHeight}px - 50%))`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    let localTries = 0;

    const attempt = () => {
      fetchBoard()
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const offline = tries > 0 && !data;
  const assets = data?.assets ?? [];
  const top = [...assets].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);
  const max = Math.max(1, ...top.map((a) => a.risk_score));

  const curvePoints = top
    .map((a, i) => {
      const x = top.length > 1 ? (i / (top.length - 1)) * 100 : 50;
      const y = 40 - (a.risk_score / 100) * 36;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${offline ? "bg-yellow-400" : "bg-emerald-400"} live-dot`}
            aria-hidden="true"
          />
          <span className="text-xs font-mono font-medium text-neutral-300">
            Live risk board
          </span>
        </div>
        <span className="text-[11px] text-neutral-400 font-mono tabular-nums" role="status">
          {offline
            ? `reconnecting (retry ${tries})`
            : data
            ? `${data.assets.length} markets · updated ${formatAge(now, data.generated_at * 1000)}`
            : "syncing…"}
        </span>
      </div>

      <div className="flex items-end gap-1.5 sm:gap-2 h-32 sm:h-40">
        {offline || !data ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-[var(--card-border)]/60 animate-pulse"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))
        ) : (
          top.map((asset) => (
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
                <div className="text-[10px] font-mono text-neutral-400 truncate tracking-wide">{asset.symbol}</div>
                <div className="text-xs font-semibold text-[var(--foreground)] font-mono tabular-nums leading-none">
                  {asset.risk_score}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {data && top.length > 1 && (
        <div className="mt-4 pt-3.5 border-t border-[var(--card-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-neutral-500">
              Market risk curve
            </span>
            <span className="text-[10px] font-mono tabular-nums text-neutral-600">
              top {top.length} of {data.assets.length}
            </span>
          </div>
          <div className="relative" ref={curveWrapRef}>
            <svg
              key={data.generated_at}
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              className="w-full h-16"
              role="img"
              aria-label="Risk curve of the highest scoring markets"
            >
              <defs>
                <linearGradient id="xira-curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-glow)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--accent-glow)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={`0,40 ${curvePoints} 100,40`}
                fill="url(#xira-curve-fill)"
              />
              <polyline
                ref={curveLineRef}
                points={curvePoints}
                fill="none"
                stroke="var(--accent-glow)"
                strokeWidth="1.5"
                pathLength={100}
                vectorEffect="non-scaling-stroke"
                className="chart-line"
              />
              {top.map((asset, i) => {
                const x = top.length > 1 ? (i / (top.length - 1)) * 100 : 50;
                const y = 40 - (asset.risk_score / 100) * 36;
                return (
                  <circle
                    key={asset.symbol}
                    cx={x}
                    cy={y}
                    r="1.6"
                    fill={scoreStroke(asset.risk_score)}
                    stroke="var(--background)"
                    strokeWidth="0.4"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            <div
              ref={curveDotRef}
              className="absolute top-0 left-0 w-2 h-2 rounded-full bg-[var(--accent-glow)] opacity-0 motion-reduce:hidden"
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      <div className="mt-4 pt-3.5 border-t border-[var(--card-border)] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-neutral-400">
        <span className="font-mono tabular-nums whitespace-nowrap">
          15 markets · 5 factors · 30 min cadence · 1:1 attestation
        </span>
      </div>
    </div>
  );
}
