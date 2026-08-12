"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchVerify } from "@/lib/api";
import type { VerifyResult } from "@/lib/types";

const SYMBOLS = [
  "NVDAx", "TSLAx", "AAPLx", "MSFTx", "GOOGLx", "AMZNx", "METAx",
  "SPYx", "QQQx", "AMDx", "INTCx", "NFLXx", "BAx", "JPMx", "XOMx",
];

function fmt(ts: number): string {
  if (!ts) return "–";
  return new Date(ts * 1000).toLocaleString();
}

function shortHash(h: string): string {
  if (!h) return "–";
  if (h.startsWith("0x") && h.length > 18) return `${h.slice(0, 10)}…${h.slice(-6)}`;
  if (h.length > 18) return `${h.slice(0, 10)}…${h.slice(-6)}`;
  return h;
}

function Row({
  label,
  apiValue,
  chainValue,
  match,
}: {
  label: string;
  apiValue: React.ReactNode;
  chainValue: React.ReactNode;
  match?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 border-b border-[var(--card-border)] items-center">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-200 font-mono">{apiValue}</span>
      <span className="flex items-center gap-2 text-sm text-neutral-200 font-mono">
        {chainValue}
        {match !== undefined && (
          <span
            className={`text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-full ${
              match
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-red-900/40 text-red-400"
            }`}
          >
            {match ? "MATCH" : "MISMATCH"}
          </span>
        )}
      </span>
    </div>
  );
}

export default function VerifyPage() {
  const [symbol, setSymbol] = useState("NVDAx");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (sym: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchVerify(sym);
        setResult(r);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Verify failed");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const id = setTimeout(() => void run(symbol), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = result?.match?.verified;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6 inline-block"
      >
        &larr; Back to dashboard
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
        Verify a score <span className="font-serif italic text-[var(--accent-glow)]">onchain</span>
      </h1>
      <p className="mt-4 text-neutral-400 leading-relaxed max-w-2xl">
        Pick a market and compare what the oracle last signed against what
        the XIRA contract actually stores on X Layer Testnet (Chain ID 1952).
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <label htmlFor="verify-symbol" className="sr-only">
          Symbol
        </label>
        <select
          id="verify-symbol"
          value={symbol}
          onChange={(e) => {
            setSymbol(e.target.value);
            void run(e.target.value);
          }}
          className="h-11 px-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-neutral-200 focus:border-neutral-600 transition-colors"
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void run(symbol)}
          disabled={loading}
          className="inline-flex items-center justify-center px-5 h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-[var(--accent-ink)] text-sm font-medium transition-colors disabled:opacity-50 active:scale-[0.98]"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-800/50 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-semibold">{result.symbol}</span>
              {verified !== undefined && (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    verified
                      ? "bg-emerald-900/40 text-emerald-400 border-emerald-700/50"
                      : "bg-red-900/40 text-red-400 border-red-800/50"
                  }`}
                >
                  {verified ? "VERIFIED" : "MISMATCH"}
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">
              contract {shortHash(result.contract)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-[11px] sm:text-[11px] font-medium text-neutral-600 border-b border-[var(--card-border)] pb-2">
            <span>Field</span>
            <span>Published</span>
            <span>On-chain</span>
          </div>

          <Row
            label="Risk score"
            apiValue={result.api ? `${result.api.risk_score}/100` : "–"}
            chainValue={result.onchain ? `${result.onchain.score}/100` : "–"}
            match={result.match?.score_matches}
          />
          <Row
            label="Confidence"
            apiValue={result.api ? `${result.api.confidence}%` : "–"}
            chainValue={result.onchain ? `${result.onchain.confidence}%` : "–"}
          />
          <Row
            label="Evidence hash"
            apiValue={shortHash(result.api?.evidence_hash ?? "")}
            chainValue={shortHash(result.onchain?.evidence_hash ?? "")}
            match={result.match?.hash_matches}
          />
          <Row
            label="Timestamp"
            apiValue={fmt(result.api?.timestamp ?? 0)}
            chainValue={fmt(result.onchain?.timestamp ?? 0)}
            match={result.match?.time_matches}
          />
          <Row
            label="Anomaly"
            apiValue={result.api ? (result.api.anomaly ? "yes" : "no") : "–"}
            chainValue={result.onchain ? (result.onchain.anomaly ? "yes" : "no") : "–"}
          />

          {!result.onchain && (
            <p className="mt-4 text-xs text-neutral-500">
              No on-chain record found for this market yet. The oracle publishes
              a new attestation each time a score moves past the deviation
              threshold; check back after the next publish pass.
            </p>
          )}
          {!result.api && (
            <p className="mt-4 text-xs text-neutral-500">
              No API record found for this market.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
