"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { AssetDetail, Attestation, AttestationHistory, OnchainHistoryResponse } from "@/lib/types";
import { API_BASE } from "@/lib/api";
import { RiskBadge } from "@/components/ScoreCard";
import { FactorBreakdown, HistoryChart, AlertBanner } from "@/components/FactorBreakdown";

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function ScoreDelta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-neutral-500 font-mono">
        <span className="text-neutral-600">Δ</span> 0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono ${
        up ? "text-red-400" : "text-green-400"
      }`}
      title="Change vs previous attestation"
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

export function AssetDetailClient() {
  const params = useParams();
  const symbol = params.symbol as string;

  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [history, setHistory] = useState<AttestationHistory | null>(null);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [onchainHistory, setOnchainHistory] = useState<OnchainHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const copySummary = async () => {
    if (!attestation) return;
    const factors = attestation.factors
      .map((f) => `${f.label.toLowerCase()} ${f.score}`)
      .join(" · ");
    const text = [
      `XIRA score: ${attestation.symbol} ${attestation.risk_score}/100 (${attestation.risk_level})`,
      `Confidence: ${attestation.confidence}%`,
      `Factors: ${factors}`,
      `Evidence: ${attestation.evidence_hash.slice(0, 16)}…`,
      attestation.chain_tx
        ? `On-chain: ${attestation.chain_explorer ?? attestation.chain_tx}`
        : "On-chain: not published for this read",
      "Verified on X Layer Testnet (Chain ID 1952)",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const apiBase = API_BASE;

  const fetchData = useCallback(async () => {
    try {
      const [aRes, hRes, dRes, cRes] = await Promise.all([
        fetch(`${apiBase}/api/attestations/${encodeURIComponent(symbol)}`),
        fetch(`${apiBase}/api/attestations/${encodeURIComponent(symbol)}/history?limit=10`),
        fetch(`${apiBase}/api/assets/${encodeURIComponent(symbol)}`),
        fetch(`${apiBase}/api/assets/${encodeURIComponent(symbol)}/onchain-history`),
      ]);

      if (!aRes.ok) throw new Error(`API error: ${aRes.status}`);
      if (!hRes.ok) throw new Error(`History API error: ${hRes.status}`);
      if (!dRes.ok) throw new Error(`Detail API error: ${dRes.status}`);
      if (!cRes.ok) throw new Error(`On-chain history error: ${cRes.status}`);

      const aData: Attestation = await aRes.json();
      const hData: AttestationHistory = await hRes.json();
      const dData: AssetDetail = await dRes.json();
      const cData: OnchainHistoryResponse = await cRes.json();

      setAttestation(aData);
      setHistory(hData);
      setDetail(dData);
      setOnchainHistory(cData);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [symbol, apiBase]);

  useEffect(() => {
    const id = setTimeout(() => void fetchData(), 0);
    return () => clearTimeout(id);
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
            <h1 className="text-2xl font-bold">
              {attestation.symbol}{" "}
              {detail && (
                <span className="text-base font-normal text-neutral-500">
                  {detail.underlying} · {detail.sector}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <RiskBadge level={attestation.risk_level} />
              <span className="text-sm text-neutral-500">
                Last update: {formatTimestamp(attestation.timestamp)}
              </span>
              {detail && (
                <ScoreDelta delta={detail.score_delta_24h} />
              )}
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

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 text-center">
          <div className="bg-neutral-900/50 rounded-lg p-3">
            <div className="text-lg font-bold tabular-nums">
              {attestation.confidence}%
            </div>
            <div className="text-xs text-neutral-500">Confidence</div>
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
            {attestation.chain_explorer ? (
              <>
                <span className="text-xs text-neutral-600">
                  No recent on-chain tx for this read. The oracle signs a new
                  attestation when a score moves past the deviation threshold;{" "}
                </span>
                <a
                  href={attestation.chain_explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent-glow)] hover:underline"
                >
                  view the contract on the explorer
                </a>
                <span className="text-xs text-neutral-600">.</span>
              </>
            ) : (
              <span className="text-xs text-neutral-600">
                On-chain publishing is not configured for this deployment.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold text-sm text-neutral-300">
            On-chain history
          </h2>
          <span className="text-[11px] text-neutral-500 font-mono">
            last {onchainHistory?.count ?? 0} of 20 stored on contract
          </span>
        </div>
        {onchainHistory && onchainHistory.count > 0 ? (
          <ul className="space-y-2">
            {onchainHistory.history
              .slice()
              .reverse()
              .map((entry, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 text-sm border-b border-[var(--card-border)] last:border-0 pb-2 last:pb-0"
                >
                  <span className="text-neutral-500 text-xs tabular-nums">
                    {new Date(entry.timestamp * 1000).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-2">
                    {entry.anomaly && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="Anomaly" aria-label="Anomaly" />
                    )}
                    <span
                      className={`font-mono tabular-nums ${
                        entry.score <= 20
                          ? "text-green-400"
                          : entry.score <= 40
                            ? "text-yellow-400"
                            : entry.score <= 60
                              ? "text-orange-400"
                              : entry.score <= 80
                                ? "text-red-400"
                                : "text-red-500"
                      }`}
                    >
                      {entry.score}/100
                    </span>
                    <span className="text-[11px] text-neutral-600">
                      conf {entry.confidence}%
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500 leading-relaxed">
            No attestations stored on-chain for this market yet. The oracle
            writes to the V2 contract once the backend is pointed at it and a
            meaningful score change occurs.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={copySummary}
          aria-label="Copy attestation summary"
          className={`inline-flex items-center gap-2 px-4 h-11 rounded-lg border text-sm font-medium transition-colors active:scale-[0.98] ${
            copied
              ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-400"
              : "border-[var(--card-border)] text-neutral-300 hover:text-white hover:border-neutral-600"
          }`}
        >
          {copied ? (
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-6" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 5.5v-2a1.5 1.5 0 00-1.5-1.5h-5a1.5 1.5 0 00-1.5 1.5v5a1.5 1.5 0 001.5 1.5h2" />
            </svg>
          )}
          {copied ? "Copied summary" : "Copy score summary"}
        </button>
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
