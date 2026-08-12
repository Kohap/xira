"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CandleStickChart({ symbol }: { symbol: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `${API_BASE}/api/assets/${encodeURIComponent(symbol)}/candles`
    )
      .then((r) => r.json())
      .then((d: { candles: Candle[] }) => {
        if (!cancelled) {
          setCandles(d.candles ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 animate-pulse">
        <div className="h-4 w-24 bg-neutral-800 rounded mb-3" />
        <div className="h-48 bg-neutral-800/50 rounded" />
      </div>
    );
  }

  if (!candles.length) return null;

  const pad = { top: 12, right: 4, bottom: 24, left: 4 };
  const w = candles.length * 8 + pad.left + pad.right;
  const h = 200;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  let high = -Infinity;
  let low_ = Infinity;
  for (const c of candles) {
    if (c.h > high) high = c.h;
    if (c.l < low_) low_ = c.l;
  }
  const range = high - low_ || 1;

  const y = (v: number) => pad.top + chartH * (1 - (v - low_) / range);
  const bodyW = Math.max(1, (chartW / candles.length) * 0.6);
  const x = (i: number) =>
    pad.left + (chartW / candles.length) * (i + 0.5);

  // Show ~5 date labels
  const labelStep = Math.max(1, Math.floor(candles.length / 5));

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5">
      <h2 className="font-semibold text-sm text-neutral-300 mb-3">
        {symbol}: Daily Candles (90d)
      </h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, maxWidth: "100%", height: "auto" }}>
          {/* grid lines */}
          {[high, (high + low_) / 2, low_].map((val) => (
            <line
              key={val}
              x1={pad.left}
              y1={y(val)}
              x2={w - pad.right}
              y2={y(val)}
              stroke="#1e1e2e"
              strokeWidth={0.5}
            />
          ))}
          {/* candles */}
          {candles.map((c, i) => {
            const green = c.c >= c.o;
            const color = green ? "#22c55e" : "#ef4444";
            const bodyTop = y(Math.max(c.o, c.c));
            const bodyBottom = y(Math.min(c.o, c.c));
            const bodyH = Math.max(1, bodyBottom - bodyTop);
            const cx = x(i);
            return (
              <g key={i}>
                <line
                  x1={cx}
                  y1={y(c.h)}
                  x2={cx}
                  y2={y(c.l)}
                  stroke={color}
                  strokeWidth={1}
                />
                <rect
                  x={cx - bodyW / 2}
                  y={bodyTop}
                  width={bodyW}
                  height={bodyH}
                  fill={color}
                  rx={1}
                />
                {/* date label */}
                {i % labelStep === 0 && (
                  <text
                    x={cx}
                    y={h - 4}
                    textAnchor="middle"
                    fill="#52525b"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {formatDate(c.t)}
                  </text>
                )}
              </g>
            );
          })}
          {/* price labels */}
          <text
            x={pad.left + 2}
            y={y(high) + 3}
            fill="#52525b"
            fontSize={9}
            fontFamily="monospace"
          >
            ${high.toFixed(0)}
          </text>
          <text
            x={pad.left + 2}
            y={y(low_) - 2}
            fill="#52525b"
            fontSize={9}
            fontFamily="monospace"
          >
            ${low_.toFixed(0)}
          </text>
        </svg>
      </div>
    </div>
  );
}
