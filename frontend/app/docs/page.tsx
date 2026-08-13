import type { Metadata } from "next";
import { DocsToc } from "@/components/DocsToc";
import { API_BASE } from "@/lib/api";
import { CHAIN_ID, CHAIN_NAME, CONTRACT_ADDRESS, EXPLORER_BASE } from "@/lib/chain";

export const metadata: Metadata = {
  title: "API Docs: XIRA",
  description:
    "A plain-language guide to the XIRA API: what it does, how to read a score, the on-chain contract, and how agents use it.",
};

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/assets/all",
    desc: "The main board. Returns a risk score for every tracked market plus a one-line market summary.",
    query: "?fresh=true forces a recalculation (requires the XIRA_ADMIN_TOKEN header)",
    returns: "AllAssetsResponse",
    note: "data_source is 'live', 'partial', or 'mock' depending on how many assets resolved from Finnhub.",
  },
  {
    method: "GET",
    path: "/api/attestations/{symbol}",
    desc: "The full record for one asset: its score, confidence, the five factor scores, the explanation, and the on-chain transaction when one was published.",
    query: "symbol is case-insensitive; must be a tracked symbol (NVDAx, TSLAx, ...)",
    returns: "AttestationResponse",
    note: "Read-only: serves the latest published attestation from the store. A GET never writes on-chain; publishing happens on the oracle's schedule.",
  },
  {
    method: "GET",
    path: "/api/attestations/{symbol}/history",
    desc: "A trail of past scores for one asset, newest first. Useful for spotting trends.",
    query: "?limit=N, 1–50, default 10",
    returns: "AttestationHistory",
    note: "Historical entries may omit evidence_hash and chain fields (they are retro-fit from the score log).",
  },
  {
    method: "GET",
    path: "/api/assets/{symbol}",
    desc: "A single asset's profile: which underlying ticker it tracks, its sector, the token address, and how the score moved since the last attestation.",
    query: "symbol is case-insensitive",
    returns: "AssetDetailResponse",
    note: "score_delta_24h compares the latest score with the previous one.",
  },
  {
    method: "GET",
    path: "/api/assets/stats",
    desc: "Market-level picture: the average score, how many assets sit in each risk band, and which markets score best and worst.",
    query: "",
    returns: "MarketStatsResponse",
    note: "Served from the shared board cache.",
  },
  {
    method: "GET",
    path: "/api/alerts",
    desc: "Every market currently flagged as an anomaly, sorted from highest to lowest risk, with the reason for each flag.",
    query: "",
    returns: "AlertsResponse",
    note: "Anomalies are factors scoring at critically low levels.",
  },
  {
    method: "GET",
    path: "/api/assets/health",
    desc: "Service health: version, chain, contract address, tracked asset count, and whether live data is enabled.",
    query: "",
    returns: "HealthResponse",
    note: "The landing page's oracle card mirrors this data.",
  },
  {
    method: "POST",
    path: "/api/assets/{symbol}/rescore",
    desc: "Force a fresh re-score for one market, bypassing the price cache. If the new score deviates past the publish threshold (default ±3), the attestation is signed on-chain and the transaction is returned in the response.",
    query: "publish follows the same ±3 deviation rule as the heartbeat scheduler",
    returns: "RescoreResponse",
    note: "Read-only until a meaningful change: scores within the threshold return the reason instead of a transaction.",
  },
  {
    method: "GET",
    path: "/api/assets/history/stats",
    desc: "SQLite store statistics (row counts per symbol).",
    query: "",
    returns: "{ status, database, stats }",
    note: "Diagnostics.",
  },
  {
    method: "GET",
    path: "/debug/data-sources",
    desc: "Per-ticker data source, cache age, and live-data flag.",
    query: "",
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
      "status · version · chain · contract · tracked_assets · live_data · signer · scheduler (pass stats) · publisher (enabled, publishes, last publish/attempt, consecutive failures) · scheduler_stalled · publish_failing · publish_stale",
  },
];

const CONTRACT_FUNCTIONS = [
  {
    sig: "updateAttestation(asset, score, confidence, evidenceHash, modelVersion, anomaly, anomalyReason)",
    access: "owner / authorized updater",
    note: "Requires score ≤ 100 and confidence ≤ 100; reverts otherwise.",
  },
  {
    sig: "batchUpdateAttestations(inputs[])",
    access: "owner / authorized updater",
    note: "Write several attestations in one transaction.",
  },
  {
    sig: "getLatestAttestation(asset)",
    access: "anyone · view",
    note: "Returns the full stored attestation including evidenceHash and timestamp.",
  },
  {
    sig: "getHistory(asset)",
    access: "anyone · view",
    note: "Returns the last 20 attestations for an asset, oldest first.",
  },
  {
    sig: "getScore(asset)",
    access: "anyone · view",
    note: "The single uint8 risk score: one call, one number.",
  },
  {
    sig: "getScoreBatch(assets[])",
    access: "anyone · view",
    note: "Many scores in one call; O(n) read, no per-call fee.",
  },
  {
    sig: "getAllTrackedAssetsWithScores()",
    access: "anyone · view",
    note: "All registered symbols, their asset addresses, scores, and timestamps in one call.",
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
  {
    name: "xira_get_alerts",
    maps: "GET /api/alerts",
    returns: "All currently flagged anomalies.",
  },
  {
    name: "xira_get_market_stats",
    maps: "GET /api/assets/stats",
    returns: "Market-level risk statistics.",
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
  "data_source": "finnhub",
  "data_freshness_ms": 4120,
  "chain_tx": "0xabf3…",
  "chain_explorer": "${EXPLORER_BASE}/tx/0xabf3…",
  "chain_block": 9480231,
  "chain_id": ${CHAIN_ID}
}`;

export default function DocsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16 items-start">
        {/* Sticky topic navigation with scroll-spy */}
        <DocsToc />

        <div className="min-w-0">
          <header id="overview" className="scroll-mt-24">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              XIRA API reference
            </h1>
            <p className="mt-4 text-neutral-400 leading-relaxed">
              XIRA turns messy market data into one clean, verifiable risk
              score per asset. This page explains what that means in plain
              terms, where to get the data, and how to check it for yourself.
            </p>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              An API is simply a set of web addresses that answer questions.
              Each address below is called an <em>endpoint</em>: you visit it,
              and it returns a JSON response your app (or you, in a browser)
              can read. The base URL for every endpoint is{" "}
              <code className="font-mono text-[12px] text-neutral-300 break-all">{API_BASE}</code>.
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              The frontend is statically hosted; the API is a separate server
              with a 5-minute in-memory price cache. A cold Railway instance
              may take 30–60s to wake.
            </p>
          </header>

          <section id="endpoints" className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Endpoints</h2>
            <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              Every endpoint serves one job: the board, one asset, its
              history, market stats, alerts, or health. The interactive
              OpenAPI docs at <code className="font-mono text-[12px] text-neutral-300">/docs</code>{" "}
              of the same origin let you try each one in the browser.
            </p>
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
                  <p className="mt-2 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                    {e.desc}
                  </p>
                  {e.query !== "" && (
                    <p className="mt-1 text-xs text-neutral-500 font-mono">{e.query}</p>
                  )}
                  {e.note && (
                    <p className="mt-1 text-xs text-neutral-600">{e.note}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section id="example" className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Example response</h2>
            <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              This is what one asset&apos;s record looks like. The important
              parts: <code className="font-mono text-[12px] text-neutral-300">risk_score</code>{" "}
              (the 0–100 number), <code className="font-mono text-[12px] text-neutral-300">factors</code>{" "}
              (why the number is what it is), and{" "}
              <code className="font-mono text-[12px] text-neutral-300">evidence_hash</code>{" "}
              (the fingerprint that proves this record matches what was
              published onchain).
            </p>
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
            <pre className="mt-4 p-4 rounded-xl bg-black/40 border border-[var(--card-border)] text-xs font-mono overflow-x-auto leading-relaxed text-neutral-300">
{SAMPLE_ATTESTATION}
            </pre>
          </section>

          <section id="contract" className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">On-chain contract</h2>
            <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
              Every score is also published to a small program on the X Layer
              blockchain, so the number does not live only on one server.
              Anyone can read it there, and the stored fingerprint lets you
              confirm the API and the chain agree. The contract runs on X
              Layer {CHAIN_NAME} (chain {CHAIN_ID}) at{" "}
              <code className="font-mono text-[12px] text-neutral-300 break-all">{CONTRACT_ADDRESS}</code>.
            </p>
            <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
              Think of it as a public notice board: the oracle posts the
              latest score for each market, and anyone can check the post.
              Read functions are open to everyone; only the oracle can write.
            </p>
            <div className="mt-4">
              {CONTRACT_FUNCTIONS.map((f) => (
                <div
                  key={f.sig}
                  className="border-t border-[var(--card-border)] py-3 last:border-b"
                >
                  <code className="text-xs font-mono text-neutral-200 leading-relaxed block break-all">
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

          <section id="mcp" className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Agents (MCP tools)</h2>
            <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
              AI agents can use the same data through MCP (Model Context
              Protocol) tools. Instead of reading a dashboard, an agent asks
              one of these tools and receives the answer directly, with the
              attestation behind it. Each tool maps one-to-one onto an
              endpoint.
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
                    : {t.returns}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
              The tools are served over HTTP at{" "}
              <code className="font-mono text-xs text-neutral-300">{API_BASE}/mcp</code>,
              so any MCP client can point straight at the hosted endpoint,
              no local server to run:
            </p>
            <pre className="mt-3 p-4 rounded-xl bg-black/40 border border-[var(--card-border)] text-xs font-mono overflow-x-auto leading-relaxed text-neutral-300">
{`{
  "mcpServers": {
    "XIRA": {
      "url": "${API_BASE}/mcp"
    }
  }
}`}
            </pre>
          </section>

          <section id="quickstart" className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Quickstart</h2>
            <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              REST endpoints need an API key, sent as an{" "}
              <code className="font-mono text-neutral-300">X-API-Key</code>{" "}
              header. Health checks and the MCP endpoint stay open, so agents
              connect without one. To request a key, open an issue on{" "}
              <a
                href="https://github.com/Kohap/xira"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent-glow)] hover:underline"
              >
                GitHub
              </a>
              .
            </p>
            <pre className="mt-3 p-4 rounded-xl bg-black/40 border border-[var(--card-border)] text-xs font-mono overflow-x-auto leading-relaxed text-neutral-300">
{`export XIRA_KEY=xira_your_key_here

# one market
curl -H "X-API-Key: $XIRA_KEY" ${API_BASE}/api/attestations/NVDAx

# the whole board
curl -H "X-API-Key: $XIRA_KEY" ${API_BASE}/api/assets/all

# a score trail
curl -H "X-API-Key: $XIRA_KEY" "${API_BASE}/api/attestations/BAx/history?limit=20"

# market stats and alerts
curl -H "X-API-Key: $XIRA_KEY" ${API_BASE}/api/assets/stats
curl -H "X-API-Key: $XIRA_KEY" ${API_BASE}/api/alerts

# health + contract, no key needed
curl ${API_BASE}/api/assets/health`}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
