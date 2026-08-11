"use client";

import { useEffect, useState } from "react";
import { fetchAllAssets, fetchAttestation } from "@/lib/api";
import type { Attestation } from "@/lib/types";
import { CopyButton } from "./CopyButton";

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

export function ProofSection() {
  const [latest, setLatest] = useState<Attestation | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllAssets()
      .then((d) => {
        if (cancelled) return;
        const entry = d.assets[0];
        if (entry) {
          fetchAttestation(entry.symbol)
            .then((a) => {
              if (!cancelled) setLatest(a);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  let explorerBase = "https://xplorer.altlayer.io";
  if (latest?.chain_explorer) {
    try {
      explorerBase = new URL(latest.chain_explorer).origin;
    } catch {
      explorerBase = "https://xplorer.altlayer.io";
    }
  }
  const contractUrl = `${explorerBase}/address/${CONTRACT}`;

  return (
    <div className="space-y-6">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">XIRA Risk Oracle</h3>
          <a
            href={contractUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-white transition-colors"
          >
            view on explorer
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h7v7M13 3L4 12" />
            </svg>
          </a>
        </div>
        <div className="flex items-center justify-between gap-3">
          <code className="font-mono text-xs text-neutral-300 truncate">{CONTRACT}</code>
          <CopyButton value={CONTRACT} label="contract address" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
          <span>chain 1952 · X Layer testnet</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {latest ? "attesting live" : "syncing"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-600" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--card-border)]" />
        <span>LATEST ATTESTATION</span>
        <span className="h-px flex-1 bg-[var(--card-border)]" />
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 sm:p-6">
        {latest ? (
          <dl className="grid sm:grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-3 sm:col-span-2 border-b border-[var(--card-border)] pb-3">
              <dt className="sr-only">Symbol</dt>
              <dd className="font-mono text-base font-semibold text-white">{latest.symbol}</dd>
              <dd className="text-[11px] text-neutral-500 font-mono">score {latest.risk_score}/100</dd>
              <dd className="text-[11px] text-neutral-500 font-mono">conf {latest.confidence}%</dd>
            </div>
            <dt className="text-neutral-500 text-xs pt-0.5">evidence hash</dt>
            <dd className="font-mono text-xs text-neutral-300 break-all">
              <span aria-hidden="true">{latest.evidence_hash.slice(0, 18)}…{latest.evidence_hash.slice(-6)}</span>
              <CopyButton value={latest.evidence_hash} label="evidence hash" />
            </dd>
            <dt className="text-neutral-500 text-xs pt-0.5">chain tx</dt>
            <dd className="font-mono text-xs text-neutral-300 break-all">
              {latest.chain_tx ? (
                <>
                  <a
                    href={latest.chain_explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white underline underline-offset-4 decoration-neutral-700 transition-colors"
                  >
                    {latest.chain_tx.slice(0, 18)}…{latest.chain_tx.slice(-4)}
                  </a>
                  <CopyButton value={latest.chain_tx} label="chain transaction" />
                </>
              ) : (
                <span className="text-neutral-600">not yet mined</span>
              )}
            </dd>
            <dt className="text-neutral-500 text-xs pt-0.5">timestamp</dt>
            <dd className="font-mono text-xs text-neutral-300">
              {new Date(latest.timestamp * 1000).toLocaleString()}
            </dd>
            <dt className="text-neutral-500 text-xs pt-0.5">factors</dt>
            <dd className="text-xs text-neutral-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              {latest.factors.map((f) => (
                <span key={f.name} className="font-mono">
                  {f.name} <span className="text-neutral-500">{f.score}</span>
                </span>
              ))}
            </dd>
          </dl>
        ) : (
          <>
            <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
            <div className="mt-3 h-3 w-full bg-white/5 rounded animate-pulse" />
            <div className="mt-2 h-3 w-3/4 bg-white/5 rounded animate-pulse" />
          </>
        )}
      </div>
    </div>
  );
}