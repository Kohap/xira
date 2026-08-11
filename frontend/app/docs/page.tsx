import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs — XIRA",
  description:
    "XIRA API reference: attestation endpoints, payload shapes, the on-chain contract, and MCP tooling — as implemented in v1.0.0.",
};

const API_BASE = "https://xira-gsb3.onrender.com";
const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/assets/all",
    desc: "Risk attestations for all 15 tracked assets, plus market summary. The dashboard's main board.",
    query: "?fresh=true forces a recalculation past the price cache",
    returns: "AllAssetsResponse",
    note: "data_source is 'live', 'partial', or 'mock' depending on how many assets resolved from Yahoo Finance.",
  },
  {
    method: "GET",
    path: "/api/attestations/{symbol}",
    desc: "Full attestation for one asset: score, confidence, five factors, explanation, anomaly, evidence hash, and on-chain tx when published.",
    query: "symbol is case-insensitive; must be a tracked symbol (NVDAx, TSLAx, …)",
    returns: "AttestationResponse",
    note: "Computes (or serves from the 5-minute price cache) and attempts an on-chain updateAttestation.",
  },
  {
    method: "GET",
    path: "/api/attestations/{symbol}/history",
    desc: "Trail of past attestations for a symbol, newest first, from the SQLite store with an in-memory fallback.",
    query: "?limit=N, 1–50, default 10",
    returns: "AttestationHistory",
    note: "Historical entries may omit evidence_hash and chain fields (they are retro-fit from the score log).",
  },
  {
    method: "GET",
    path: "/api/assets/health",
    desc: "Service health: version, chain, contract address, tracked asset count, and whether live data is enabled.",
    query: "—",
    returns: "HealthResponse",
    note: "The landing page's oracle card mirrors this data.",
  },
  {
    method: "GET",
    path: "/api/assets/history/stats",
    desc: "SQLite store statistics (row counts per symbol).",
    query: "—",
    returns: "{ status, database, stats }",
    note: "Diagnostics.",
  },
  {
    method: "GET",
    path: "/debug/data-sources",
    desc: "Per-ticker data source, cache age, and live-data flag.",
    query: "—",
    returns: "{ use_live_data, cache_ttl, cached_tickers, cache_details, env_vars }",
    note: "Diagnostics; may be disabled in stricter deployments.",
  },
];

const TYPES = [
  {
    name: "AttestationResponse",
    fields:
      "symbol · risk_score (0–100) · risk_level (LOW/MODERATE/ELEVATED/HIGH/CRITICAL) · confidence (37–100) · factors[5] · explanation · anomaly · anomaly_reason · evidence_hash (sha256 hex) · timestamp (unix) · model_version · data_source · data_freshness_ms · chain_tx? · chain_explorer? · chain_block? · chain_id?",
  },
  {
    name: "FactorScore",
    fields: "name · label · score (0–100) · weight · description",
  },
  {
    name: "AllAssetsResponse",
    fields:
      "generated_at · model_version · data_source · summary · assets[]",
  },
  {
    name: "AttestationHistory",
    fields: "symbol · history[]",
  },
  {
    name: "HealthResponse",
    fields:
      "status · version · chain · contract · tracked_assets · live_data",
  },
];

const CONTRACT_FUNCTIONS = [
  {
    sig: "updateAttestation(asset, score, confidence, evidenceHash, modelVersion, anomaly, anomalyReason)",
    access: "owner / authorized updater",
    note: "Requires score ≤ 100 and confidence ≤ 100; reverts otherwise.",
  },
  {
    sig: "getLatestAttestation(asset)",
    access: "anyone · view",
    note: "Returns the full stored attestation including evidenceHash and timestamp.",
  },
  {
    sig: "getScore(asset)",
    access: "anyone · view",
    note: "The single uint8 risk score — one call, one number.",
  },
  {
    sig: "getScoreBatch(assets[])",
    access: "anyone · view",
    note: "Many scores in one call; O(n) read, no per-call fee on testnet.",
  },
  {
    sig: "getAllTrackedSymbols()",
    access: "anyone · view",
    note: "Symbol names registered by the owner.",
  },
  {
    sig: "registerAsset / setAuthorizedUpdater / transferOwnership",
    access: "owner only",
    note: "Admin surface for asset registration and updater rotation.",
  },
];

const MCP_TOOLS = [
  {
    name: "xira_get_asset_risk",
    maps: "GET /api/attestations/{symbol}",
    returns: "Full attestation for one symbol.",
  },
  {
    name: "xira_get_all_assets",
    maps: "GET /api/assets/all",
    returns: "All tracked assets with scores, factors, and market summary.",
  },
  {
    name: "xira_get_attestation_history",
    maps: "GET /api/attestations/{symbol}/history",
    returns: "Recent score trail for one symbol.",
  },
];

const SAMPLE_ATTESTATION = `{
  "symbol": "NVDAx",
  "risk_score": 62,
  "risk_level": "HIGH",
  "confidence": 83,
  "factors": [
    { "name": "momentum", "label": "Momentum", "score": 58, "weight": 0.25,
      "description": "Neutral: +0.12% (24h), +1.80% (7d)." }
  ],
  "explanation": "NVDAx shows high risk (score 62/100). ...",
  "anomaly": false,
  "anomaly_reason": "",
  "evidence_hash": "0x4d8a…",
  "timestamp": 1786471527,
  "model_version": "v1.0.0",
  "data_source": "yahoo",
  "data_freshness_ms": 4120,
  "chain_tx": "0xabf3…",
  "chain_explorer": "https://www.okx.com/web3/explorer/xlayer-test/tx/0xabf3…",
  "chain_block": 9480231,
  "chain_id": 1952
}`;

export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          XIRA API reference
        </h1>
        <p className="mt-4 text-neutral-400 leading-relaxed">
          Everything below is generated from the running service: the base URL
          is{" "}
          <code className="font-mono text-[12px] text-neutral-300">
            {API_BASE}
          </code>
          , the model is{" "}
          <code className="font-mono text-[12px] text-neutral-300">
            v1.0.0
          </code>
          , and every endpoint is also browsable via interactive OpenAPI docs
          at <code className="font-mono text-[12px] text-neutral-300">/docs</code> of the
          same origin.
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          The frontend is statically hosted; the API is a separate server with
          a 5-minute in-memory price cache. A cold Render instance may take
          30–60s to wake.
        </p>
      </header>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">Endpoints</h2>
        <div className="mt-4">
          {ENDPOINTS.map((e) => (
            <div
              key={e.path}
              className="border-t border-[var(--card-border)] py-5 last:border-b"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                    e.method === "GET"
                      ? "text-emerald-400 border-emerald-700/50 bg-emerald-900/20"
                      : "text-[var(--accent-glow)] border-[var(--accent)]/40 bg-[var(--accent)]/10"
                  }`}
                >
                  {e.method}
                </span>
                <code className="font-mono text-sm text-neutral-200 break-all">
                  {e.path}
                </code>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {e.returns}
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                {e.desc}
              </p>
              {e.query !== "—" && (
                <p className="mt-1 text-xs text-neutral-500 font-mono">{e.query}</p>
              )}
              {e.note && (
                <p className="mt-1 text-xs text-neutral-600">{e.note}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Payload shapes
        </h2>
        <div className="mt-4 space-y-2">
          {TYPES.map((t) => (
            <div key={t.name} className="flex flex-col sm:flex-row gap-1 sm:gap-6 py-2 border-t border-[var(--card-border)] last:border-b">
              <code className="font-mono text-xs text-[var(--accent-glow)] shrink-0 pt-0.5">
                {t.name}
              </code>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {t.fields}
              </p>
            </div>
          ))}
        </div>

        <h3 className="mt-8 font-semibold text-sm">Example attestation</h3>
        <pre className="mt-3 p-4 rounded-xl bg-black/40 border border-[var(--card-border)] text-xs font-mono overflow-x-auto leading-relaxed text-neutral-300">
{SAMPLE_ATTESTATION}
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          On-chain contract
        </h2>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed max-w-2xl">
          The XIRA oracle contract on X Layer testnet (chain 1952) at{" "}
          <code className="font-mono text-[12px] text-neutral-300 break-all">{CONTRACT}</code>.
          See the whitepaper for how the evidence fingerprint is computed.
        </p>
        <div className="mt-4">
          {CONTRACT_FUNCTIONS.map((f) => (
            <div
              key={f.sig}
              className="border-t border-[var(--card-border)] py-3 last:border-b"
            >
              <code className="text-xs font-mono text-neutral-200 leading-relaxed block">
                {f.sig}
              </code>
              <p className="mt-1 text-[11px] text-neutral-500 font-mono">
                {f.access}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{f.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">MCP tools</h2>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed max-w-2xl">
          The API is exposed to agents as MCP tools with a one-to-one mapping
          onto endpoints, so a model can ask about risk and read the
          attestation behind the answer.
        </p>
        <div className="mt-4">
          {MCP_TOOLS.map((t) => (
            <div
              key={t.name}
              className="border-t border-[var(--card-border)] py-3 last:border-b flex flex-col sm:flex-row gap-1 sm:gap-6"
            >
              <code className="font-mono text-xs text-neutral-200 shrink-0">
                {t.name}
              </code>
              <p className="text-xs text-neutral-400">
                <span className="text-neutral-600 font-mono">{t.maps}</span>{" "}
                — {t.returns}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Quickstart</h2>
        <pre className="mt-3 p-4 rounded-xl bg-black/40 border border-[var(--card-border)] text-xs font-mono overflow-x-auto leading-relaxed text-neutral-300">
{`# one market
curl ${API_BASE}/api/attestations/NVDAx

# the whole board
curl ${API_BASE}/api/assets/all

# a score trail
curl "${API_BASE}/api/attestations/BAx/history?limit=20"

# health + contract
curl ${API_BASE}/api/assets/health`}
        </pre>
      </section>

      <section className="mt-14 border-t border-[var(--card-border)] pt-8">
        <h2 className="text-sm font-semibold">Versioning and compatibility</h2>
        <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
          Endpoints are additive; breaking changes will bump the
          model version and the docs page together. The contract ABI is fixed
          at the deployed address and is the compatibility boundary — a
          future verify() addition would be an additive function.
        </p>
      </section>
    </div>
  );
}