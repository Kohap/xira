"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Attestation, AttestationHistory } from "@/lib/types";
import { RiskBadge } from "@/components/ScoreCard";
import { FactorBreakdown, HistoryChart, AlertBanner } from "@/components/FactorBreakdown";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function AssetDetailClient() {
  const params = useParams();
  const symbol = params.symbol as string;

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [history, setHistory] = useState<AttestationHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aRes, hRes] = await Promise.all([
        fetch(`${apiBase}/api/attestations/${encodeURIComponent(symbol)}`),
        fetch(`${apiBase}/api/attestations/${encodeURIComponent(symbol)}/history?limit=10`),
      ]);

      if (!aRes.ok) throw new Error(`API error: ${aRes.status}`);
      if (!hRes.ok) throw new Error(`History API error: ${hRes.status}`);

      const aData: Attestation = await aRes.json();
      const hData: AttestationHistory = await hRes.json();

      setAttestation(aData);
      setHistory(hData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [symbol, apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6 inline-block">
          &larr; Back to Dashboard
        </Link>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 animate-pulse">
          <div className="h-8 w-24 bg-neutral-800 rounded mb-3" />
          <div className="h-16 w-16 bg-neutral-800 rounded-full" />
          <div className="h-4 w-96 bg-neutral-800 rounded mt-4" />
        </div>
      </div>
    );
  }

  if (error || !attestation) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6 inline-block">
          &larr; Back to Dashboard
        </Link>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-10 text-center">
          <p className="text-neutral-400 text-lg mb-2">
            Could not load data for &quot;{symbol}&quot;.
          </p>
          {error && (
            <p className="text-red-400/80 text-xs mb-4 font-mono">{error}</p>
          )}
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{attestation.symbol}</h1>
            <div className="flex items-center gap-3 mt-2">
              <RiskBadge level={attestation.risk_level} />
              <span className="text-sm text-neutral-500">
                Last update: {formatTimestamp(attestation.timestamp)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl font-bold tabular-nums ${
                attestation.risk_score <= 20
                  ? "text-green-400"
                  : attestation.risk_score <= 40
                    ? "text-yellow-400"
                    : attestation.risk_score <= 60
                      ? "text-orange-400"
                      : attestation.risk_score <= 80
                        ? "text-red-400"
                        : "text-red-500"
              }`}
            >
              {attestation.risk_score}
            </div>
            <div className="text-xs text-neutral-500">Risk Score /100</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
          <div className="bg-neutral-900/50 rounded-lg p-3">
            <div className="text-lg font-bold tabular-nums">
              {attestation.confidence}%
            </div>
            <div className="text-xs text-neutral-500">Confidence</div>
          </div>
          <div className="bg-neutral-900/50 rounded-lg p-3">
            <div className="text-lg font-bold">{attestation.model_version}</div>
            <div className="text-xs text-neutral-500">Model Version</div>
          </div>
          <div className="bg-neutral-900/50 rounded-lg p-3">
            <div className="text-lg font-bold">{attestation.factors.length}</div>
            <div className="text-xs text-neutral-500">Factors</div>
          </div>
          <div className="bg-neutral-900/50 rounded-lg p-3">
            <div className="text-lg font-bold">
              {history ? history.history.length : 0}
            </div>
            <div className="text-xs text-neutral-500">Data Points</div>
          </div>
        </div>

        <p className="mt-4 text-sm text-neutral-300 leading-relaxed border-t border-[var(--card-border)] pt-4">
          {attestation.explanation}
        </p>
      </div>

      <AlertBanner
        anomaly={attestation.anomaly}
        anomaly_reason={attestation.anomaly_reason}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5">
          <h2 className="font-semibold text-sm text-neutral-300 mb-4">
            Factor Breakdown
          </h2>
          <FactorBreakdown factors={attestation.factors} />
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5">
          <h2 className="font-semibold text-sm text-neutral-300 mb-4">
            Risk Score History
          </h2>
          {history && history.history.length > 1 ? (
            <HistoryChart
              history={history.history.map((h) => ({
                risk_score: h.risk_score,
                timestamp: h.timestamp,
              }))}
            />
          ) : (
            <p className="text-sm text-neutral-600">
              Not enough data points yet. Check back after more updates.
            </p>
          )}
          {history && (
            <div className="mt-4 space-y-2">
              {history.history
                .slice()
                .reverse()
                .slice(0, 5)
                .map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-neutral-500">
                      {formatTimestamp(h.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium tabular-nums ${
                          h.risk_score <= 20
                            ? "text-green-400"
                            : h.risk_score <= 40
                              ? "text-yellow-400"
                              : h.risk_score <= 60
                                ? "text-orange-400"
                                : h.risk_score <= 80
                                  ? "text-red-400"
                                  : "text-red-500"
                        }`}
                      >
                        {h.risk_score}
                      </span>
                      <RiskBadge level={h.risk_level} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5">
        <h2 className="font-semibold text-sm text-neutral-300 mb-3">
          On-chain Verification
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <span className="text-neutral-500">Evidence Hash:</span>
            <br />
            <span className="text-neutral-300 break-all">
              {attestation.evidence_hash}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Timestamp (unix):</span>
            <br />
            <span className="text-neutral-300">{attestation.timestamp}</span>
          </div>
        </div>
        {attestation.chain_tx ? (
          <div className="mt-4 pt-3 border-t border-[var(--card-border)]">
            <span className="text-xs text-neutral-500">
              Latest on-chain tx:{" "}
            </span>
            <a
              href={attestation.chain_explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-glow)] hover:underline break-all font-mono"
            >
              {attestation.chain_tx}
            </a>
            <span className="text-xs text-neutral-600 ml-2">
              block #{attestation.chain_block}
            </span>
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-[var(--card-border)]">
            <span className="text-xs text-neutral-600">
              Deploy the XIRA contract and configure PRIVATE_KEY to enable on-chain attestations.
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--accent-glow)] rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>
    </div>
  );
}
