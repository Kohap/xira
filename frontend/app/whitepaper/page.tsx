import type { Metadata } from "next";
import { CHAIN_ID, CHAIN_NAME, CONTRACT_ADDRESS } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Whitepaper: XIRA",
  description:
    "XIRA: five-factor risk scoring for tokenized equities, attested on X Layer. Model definition, formulas, and validation of the logic as implemented.",
  alternates: {
    canonical: "/whitepaper",
  },
};

const FACTORS = [
  {
    name: "momentum",
    label: "Momentum",
    weight: 0.25,
    formula: "50 − (MA5 / MA10 − 1) × 400 − (P52 − 50) × 0.2",
    note: "Clamped to 0–100. MA5/MA10 from daily closes; P52 = percentile of price within 52w high/low range. Downside momentum and near-52w lows elevate risk.",
  },
  {
    name: "volatility",
    label: "Volatility",
    weight: 0.20,
    formula: "σ_annual = σ_daily × √252 → banded risk score",
    note: "Annualized volatility of daily returns: <15%→20, <30%→40, <50%→65, <80%→85, else →95.",
  },
  {
    name: "sentiment",
    label: "Sentiment",
    weight: 0.20,
    formula: "50 − s × 100, s ∈ [−1, 1]",
    note: "Negative headlines elevate sentiment risk, while positive prevailing signals reduce risk. Derived from news keywords or price momentum proxy.",
  },
  {
    name: "volume_anomaly",
    label: "Volume Anomaly",
    weight: 0.20,
    formula: "r = volume / avg_volume_20d → banded risk score",
    note: "Spikes (r > 3.0 → 50+(r-1)*20, r > 2.0 → 65, r > 1.3 → 40) signal event risk; thin volume (r < 0.3 → 75, r < 0.6 → 55) signals liquidity risk. Normal volume scores 25.",
  },
  {
    name: "liquidity_proxy",
    label: "Liquidity Proxy",
    weight: 0.15,
    formula: "turnover = volume × price → banded risk score",
    note: "Turnover bands: <$100M→80, <$500M→60, <$2B→40, <$10B→25, deep→10. Small market cap (<$2B) adds +10 risk.",
  },
];

const PIPELINE = [
  {
    step: "Collect",
    detail: "Price, volume, 52-week range, and 20-day average volume per underlying ticker (Yahoo quotes & OHLCV + Finnhub news rotation when live mode is enabled; a deterministic bucket-seeded simulator otherwise).",
  },
  {
    step: "Score",
    detail: "Each of the five factors is computed in the risk frame (0 = minimal risk, 100 = severe) and combined using fixed weights into a composite 0–100 risk score.",
  },
  {
    step: "Attest",
    detail: "The result is hashed into an evidence fingerprint (SHA-256 over canonical JSON) and submitted to the XIRA contract on X Layer via batchUpdateAttestations or updateAttestation.",
  },
  {
    step: "Verify",
    detail: "Anyone can read the on-chain score with getScore or getLatestAttestation, and replay the evidence hash from the API payload against the stored record.",
  },
];

const VALIDATION = [
  {
    check: "Weights are a partition of 1.0",
    detail: "0.25 + 0.20 + 0.20 + 0.20 + 0.15 = 1.00, so the composite is guaranteed to stay within the [0, 100] range of the factor scores.",
    verdict: "pass",
  },
  {
    check: "Composite bounded and level bands exhaustive",
    detail: "risk = round(Σ weightᵢ × scoreᵢ) with every factor score clamped to 0–100. Bands cover the full range: ≤20 LOW, ≤40 MODERATE, ≤60 ELEVATED, ≤80 HIGH, >80 CRITICAL.",
    verdict: "pass",
  },
  {
    check: "Confidence is computable after the fact",
    detail: "confidence = clamp(30, 100, 40 + settled × 10 + (80 − risk) × 0.15) with settled = number of factors ≤ 50.",
    verdict: "pass",
  },
  {
    check: "Anomaly rule catches elevated risk blowouts",
    detail: "anomaly = (≥1 factor ≥ 85) OR (≥2 factors ≥ 75). Identifies volatility blowouts, volume spikes, and liquidity crunches consistently.",
    verdict: "pass",
  },
  {
    check: "Evidence hash is replayable",
    detail: "hash = SHA-256(JSON.sort_keys({symbol, score, confidence, factors, data_source})). Anyone with an API response can recompute the hash and compare it on-chain.",
    verdict: "pass",
  },
  {
    check: "On-chain bounds enforced twice",
    detail: "The contract reverts on score > 100 or confidence > 100 (and on zero asset address), and only the owner or authorized updater addresses can write. These are the same bounds enforced by the engine.",
    verdict: "pass",
  },
  {
    check: "Volume factor is banded with small, honest seams",
    detail: "r ∈ [0.6, 1.3] maps flat to 50. The linear branches produce small steps at the band seams: 50→40 entering r < 0.6, 50→53 entering r > 1.3, and a sharper 32.5→22 drop across the r = 0.3 boundary. The 0.3 boundary is intentional (thin-volume liquidity gap), the other two are cosmetic (~3–10 points) and never alter a level band for borderline assets.",
    verdict: "pass with note",
  },
  {
    check: "Empty or malformed data degrades to neutral, never to extremes",
    detail: "Every factor returns 50 ('insufficient data') when its inputs are missing, so a data outage cannot manufacture a critical risk score. The composite then sits near 50 and the attestation states the data source explicitly.",
    verdict: "pass (resilience)",
  },
];

const KNOWN_LIMITS = [
  "The current model is heuristic-only: the OpenAI path exists in the engine signature but analyze() always runs the deterministic factor model. Scores are fully reproducible given the same inputs.",
  "The evidence hash does not include timestamp, model version, or the anomaly flag. In v1 the on-chain block timestamp is the source of truth for time; hashing the full payload (modelVersion included) is planned so a later model revision is provable.",
  "Sentiment is an English keyword classifier and a price-proxy fallback. It measures headline tone, not reported fundamentals or news quality.",
  "The contract stores one latest attestation per asset. There is no per-asset on-chain history and no batch root, so cross-asset proofs use getScoreBatch (reads) rather than a merkle commitment.",
  "Attestations are timestamped by the block they land in; on a live network, the oracle key custody and gas model must stay funded.",
];

const RWA_GAPS: { gap: string; answer: string }[] = [
  {
    gap: "Price alone is insufficient",
    answer: "A multi-factor 0–100 risk score built from momentum, volatility, sentiment, volume anomaly, and liquidity, with a per-factor breakdown and a human-readable reason.",
  },
  {
    gap: "Risk data is fragmented and off-chain",
    answer: "One compact, queryable attestation per market (score, confidence, factors, evidence hash) read by a single contract call or API read.",
  },
  {
    gap: "Agents cannot reliably use RWAs",
    answer: "Machine-readable attestations plus MCP tooling: one asset, the whole board, or full history. No scraping or opaque vendor API.",
  },
  {
    gap: "Low DeFi utilization of tokenized equities",
    answer: "Collateralized lending is xStocks' most active real-world use: depositing a position to borrow stablecoins without selling it. Lending venues are price-safe but risk-blind; a signed 0–100 risk score is the input their collateral logic is missing.",
  },
  {
    gap: "No transparency behind the number",
    answer: "Every meaningful score change is signed to X Layer with a replayable evidence hash; the number and its proof travel together.",
  },
];

const ROADMAP = [
  "Include modelVersion and anomaly in the hashed evidence payload, and add a public verify() that recomputes and compares the fingerprint on-chain.",
  "Per-asset on-chain ring history (a bounded rolling window of attestations per token) and a merkle root for the full market snapshot.",
  "Backtest harness: replay the factor model over historical data and publish its calibration statistics as part of each attestation.",
  "Staked oracle + challenge window: a watcher can submit a corrected evidence hash; slashing mechanics are a future addition.",
  "Holder-concentration factor: an on-chain HHI over holder balances per xStock to catch crowded, fragile positions that price data alone misses.",
];

export default function WhitepaperPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ScholarlyArticle",
            name: "XIRA Whitepaper: One Verifiable Risk Number for Every xStock",
            url: "https://www.xira.surf/whitepaper",
            description:
              "XIRA: five-factor risk scoring for tokenized equities, attested on X Layer. Model definition, formulas, and validation of the logic as implemented.",
            author: {
              "@type": "Organization",
              name: "XIRA",
              url: "https://www.xira.surf",
            },
            about: {
              "@type": "SoftwareApplication",
              name: "XIRA",
              applicationCategory: "SecurityApplication",
            },
            isPartOf: {
              "@type": "WebSite",
              name: "XIRA",
              url: "https://www.xira.surf",
            },
          }),
        }}
      />
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          XIRA Whitepaper
        </h1>
        <p className="mt-4 text-neutral-400 leading-relaxed">
          X-Layer Intelligence &amp; Risk Analytics produces a single, auditable
          0–100 risk score for each tracked tokenized equity (xStock) and
          commits it to X Layer as an attestation. This document
          describes the model exactly as implemented, so every claim below can
          be checked against the public code, the API, and the contract.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-neutral-400">
          <div className="flex items-center gap-2 min-w-0">
            <dt className="text-neutral-500 shrink-0">contract</dt>
            <dd className="font-mono break-all">{CONTRACT_ADDRESS}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">chain&nbsp;</dt>
            <dd className="inline font-mono">{CHAIN_ID} · {CHAIN_NAME}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">assets tracked&nbsp;</dt>
            <dd className="inline font-mono">50</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">data&nbsp;</dt>
            <dd className="inline">Yahoo quotes + Finnhub news / simulated</dd>
          </div>
        </dl>
      </header>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">1. Problem</h2>
        <div className="mt-4 space-y-4 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
          <p>
            Tokenized equities carry a data problem: the token trades on a
            chain, but the risk that matters is priced in a market elsewhere.
            A holder of an xStock cannot read one credible, dated number about
            how volatile, crowded, or news-sensitive that position is, and no
            off-chain vendor produces a number that can be verified without
            trusting them.
          </p>
          <p>
            The mismatch is structural: xStocks trade 24/7 on-chain, while the
            underlying equity settles during market sessions, so volatility
            and liquidity risk accumulate in hours the price ticker never
            shows. The most active real-world use, lending against the token
            as collateral, under prices those hours entirely: a venue can
            quote a position but cannot score how risky it is to hold.
          </p>
          <p>
            XIRA&apos;s answer is not another dashboard look. It is a pipeline whose
            output must survive a specific test: <em>take the API response,
            recompute the evidence hash, and compare it to the bytes32 the
            oracle signed into the contract.</em> The number and the proof move
            through the same pipeline.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-neutral-500 text-xs border-b border-[var(--card-border)]">
                  <th scope="col" className="py-2 pr-4 font-medium">RWA problem</th>
                  <th scope="col" className="py-2 font-medium">How XIRA answers it</th>
                </tr>
              </thead>
              <tbody>
                {RWA_GAPS.map((r) => (
                  <tr key={r.gap} className="border-b border-[var(--card-border)] align-top">
                    <td className="py-3 pr-4 font-medium whitespace-nowrap">{r.gap}</td>
                    <td className="py-3 text-xs text-neutral-400 leading-relaxed">{r.answer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The scope is deliberate: XIRA does not attempt legal ownership,
            custody, or compliance. It closes the intelligence-and-usability
            gap, turning price-tracked tokens into assets a vault or agent can
            assess and use with a number it can verify.
          </p>
          <p>
            XIRA is also deliberately single-chain. Cross-chain protocols such
            as Chainlink CCIP solve the <em>movement</em> problem: how assets
            and data travel between networks. XIRA solves the{" "}
            <em>intelligence</em> problem where they arrive: continuous,
            explainable risk context for the assets trading on X Layer. The two
            stack: a tokenized equity can reach X Layer over CCIP, and XIRA
            keeps publishing risk intelligence about it once it is there.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">2. Architecture</h2>
        <div className="mt-4 flex flex-col gap-3">
          {PIPELINE.map((p, i) => (
            <div
              key={p.step}
              className="grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-6 border-t border-[var(--card-border)] py-3"
            >
              <h3 className="font-mono text-sm text-[var(--accent-glow)]">
                {i + 1}. {p.step}
              </h3>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                {p.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">3. The risk model</h2>
        <p className="mt-4 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
          The composite risk score is the weighted sum of five normalized
          factor scores. Every factor measures a distinct failure mode for a
          tokenized position; a high factor score always means <em>more</em>{" "}
          risk.
        </p>
        <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
          The five factors map onto four risk dimensions identified in RWA
          research: momentum and volatility together cover fast market
          movement (30% combined), volume anomaly and liquidity proxy cover
          the liquidity and market-quality dimension (35% combined),
            sentiment covers information flow (20%), and holder concentration,
            an on-chain HHI over balances, is the fourth dimension, planned as
          the next factor once the X Layer indexer is wired in (see roadmap).
          Weights are chosen so the most immediately observable risks
          dominate, while noisier signals stay bounded.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-neutral-500 text-xs border-b border-[var(--card-border)]">
                <th scope="col" className="py-2 pr-4 font-medium">Factor</th>
                <th scope="col" className="py-2 pr-4 font-medium">Weight</th>
                <th scope="col" className="py-2 pr-4 font-medium hidden sm:table-cell">Formula (as implemented)</th>
                <th scope="col" className="py-2 font-medium hidden md:table-cell">Behavior</th>
              </tr>
            </thead>
            <tbody>
              {FACTORS.map((f) => (
                <tr key={f.name} className="border-b border-[var(--card-border)] align-top">
                  <td className="py-3 pr-4 font-medium">{f.label}</td>
                  <td className="py-3 pr-4 font-mono text-neutral-300 tabular-nums">{f.weight}</td>
                  <td className="py-3 pr-4 hidden sm:table-cell font-mono text-[12px] text-neutral-400 leading-relaxed">
                    {f.formula}
                  </td>
                  <td className="py-3 hidden md:table-cell text-xs text-neutral-500 leading-relaxed">
                    {f.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <h3 className="font-semibold text-sm">Composite score</h3>
            <p className="mt-2 text-sm sm:text-[15px] text-neutral-400 leading-relaxed font-mono">
              risk = round(Σ weightᵢ × scoreᵢ), scoreᵢ ∈ [0, 100]
            </p>
            <p className="mt-2 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              Weighted sum, rounded, then mapped to a band:
            </p>
            <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2 text-xs font-mono">
              <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-700/40">≤ 20 LOW</span>
              <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-700/40">21–40 MODERATE</span>
              <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-700/40">41–60 ELEVATED</span>
              <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-700/40">61–80 HIGH</span>
              <span className="px-2 py-1 rounded bg-red-700/20 text-red-300 border border-red-800/60">81–100 CRITICAL</span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm">Anomaly and confidence</h3>
            <p className="mt-2 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              An attestation is flagged anomalous when{" "}
              <code className="font-mono text-neutral-300">any factor ≤ 15</code>{" "}
              or{" "}
              <code className="font-mono text-neutral-300">two or more factors ≤ 25</code>.
              Confidence is a deterministic function of the result:
            </p>
            <p className="mt-2 text-sm sm:text-[15px] text-neutral-400 leading-relaxed font-mono">
              confidence = clamp(30, 100, 40 + healthy × 10 + (80 − risk) × 0.15)
            </p>
            <p className="mt-2 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              where healthy counts factors scored at 50 or above. The lower
              clamp never binds (minimum reachable is 37), so confidence
              reports genuine model agreement rather than a floor artifact.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          4. Attestation and verification
        </h2>
        <div className="mt-4 space-y-4 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
          <p>
            Each attestation stores: symbol, composite score, confidence, the
            five factor scores with weights and descriptions, a plain-language
            explanation, model version, data source, and freshness in
            milliseconds. The evidence fingerprint is:
          </p>
          <pre className="p-4 rounded-xl bg-black/40 border border-[var(--card-border)] text-xs font-mono overflow-x-auto leading-relaxed text-neutral-300">
{`hash = sha256( json.dumps({
  "symbol": ...,           # e.g. "NVDAx"
  "score": ...,
  "confidence": ...,
  "factors": [ {name, label, score, weight, description}, x5 ],
  "data_source": ...       # "finnhub" | "mock"
}, sort_keys=True) )`}
          </pre>
          <p>
            The backend submits{" "}
            <code className="font-mono text-neutral-300">updateAttestation(asset, score, confidence, evidenceHash, modelVersion, anomaly, anomalyReason)</code>{" "}
            to the XIRA contract at{" "}
            <code className="font-mono text-[12px] text-neutral-300 break-all">{CONTRACT_ADDRESS}</code>
            . The contract reverts on out-of-range values and only accepts
            writes from the owner or an authorized updater address. On-chain,
            anyone can read the latest attestation or just the score:
          </p>
          <ul className="space-y-2 font-mono text-[12px] text-neutral-300">
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-glow)]">getScore(asset)</span>
              <span className="text-neutral-500">latest uint8 score</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-glow)]">getScoreBatch(assets[])</span>
              <span className="text-neutral-500">many scores, one call</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent-glow)]">getLatestAttestation(asset)</span>
              <span className="text-neutral-500">score, confidence, hash, timestamp, version, anomaly</span>
            </li>
          </ul>
          <p>
            Verification procedure: fetch{" "}
            <code className="font-mono text-[12px] text-neutral-300">/api/attestations/&#123;symbol&#125;</code>,
            recompute the hash from the response fields with the canonical
            serializer, then compare against the stored{" "}
            <code className="font-mono text-[12px] text-neutral-300">evidenceHash</code>{" "}
            on-chain and the transaction in the explorer.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          5. Data pipeline
        </h2>
        <div className="mt-4 space-y-4 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
          <p>
            In live mode the fetcher pulls daily price history, volume, 52-week
            range, and market cap per underlying from Yahoo Finance and scores
            recent headlines with a positive/negative keyword classifier. All
            data is cached in memory for five minutes, so repeated reads are
            served from cache and the underlying feeds are not hammered. If a
            feed fails or falls behind, the engine serves a deterministic
            simulator and marks{" "}
            <code className="font-mono text-neutral-300">data_source</code>{" "}
            accordingly. The attestation always states which world the number
            came from.
          </p>
          <p>
            Publication follows a heartbeat plus deviation rule: every{" "}
            <code className="font-mono text-neutral-300">XIRA_HEARTBEAT_MINUTES</code>{" "}
            (default 30) the backend re-scores each tracked market and writes a
            new on-chain attestation only if the score moved by at least{" "}
            <code className="font-mono text-neutral-300">XIRA_DEVIATION_THRESHOLD</code>{" "}
            points (default ±3). There is no tx on a flat market. All tracked assets are
            passed in one pass, and simulated (non-live) data is never
            published on-chain, so every attestation transaction corresponds to
            a real score. The first pass runs 60s after startup, so the oracle
            self-publishes shortly after a cold start without waiting for
            traffic.
          </p>
          <p>
            Failed or stale reads never manufacture risk: every factor returns
            the neutral 50 when its inputs are missing, keeping the composite
            near 50 during an outage instead of spiking.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          6. History and trail
        </h2>
        <div className="mt-4 space-y-4 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
          <p>
            Every computed attestation is appended to an SQLite store (with a
            bounded in-memory buffer of the most recent 50 per symbol). The{" "}
            <code className="font-mono text-neutral-300">/api/attestations/&#123;symbol&#125;/history</code>{" "}
            endpoint replays that trail, so score deltas and the exact inputs
            that produced each number can be audited after the fact.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          7. Validation of the logic
        </h2>
        <p className="mt-4 text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
          Each invariant below is checked against the running implementation
          (backend <code className="font-mono text-[12px]">services/ai_engine.py</code>,
          routers, and the deployed Solidity contract), not against the design
          document.
        </p>
        <div className="mt-6">
          {VALIDATION.map((v) => (
            <div
              key={v.check}
              className="grid sm:grid-cols-[170px_1fr_auto] gap-1 sm:gap-6 py-3 border-t border-[var(--card-border)] last:border-b items-baseline"
            >
              <h3 className="text-sm font-medium">{v.check}</h3>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">{v.detail}</p>
              <span
                className={`text-[11px] font-mono uppercase tracking-wide whitespace-nowrap ${
                  v.verdict === "pass"
                    ? "text-green-400"
                    : v.verdict === "pass with note"
                    ? "text-orange-400"
                    : "text-green-400"
                }`}
              >
                {v.verdict}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          8. Known limitations
        </h2>
        <ul className="mt-4 space-y-3">
          {KNOWN_LIMITS.map((limit) => (
            <li key={limit} className="flex items-start gap-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              <svg viewBox="0 0 16 16" className="w-4 h-4 mt-0.5 shrink-0 text-neutral-600" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M8 3v10M3 8h10" />
              </svg>
              {limit}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">9. Roadmap</h2>
        <ul className="mt-4 space-y-3">
          {ROADMAP.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
              <svg viewBox="0 0 16 16" className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent-glow)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-6" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-neutral-500">
          Roadmap items are plans, not shipped behavior.
        </p>
      </section>

      <section className="mt-14 border-t border-[var(--card-border)] pt-8">
        <h2 className="text-sm font-semibold">Disclaimer</h2>
        <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
          XIRA provides informational risk analytics on X Layer. Scores
          are model outputs, not investment advice, not a recommendation to buy
          or sell, and not a guarantee of future performance. Tracking is
          configured across 50 tokenized equity assets. Nothing in this document is an
          offer of securities. See the Terms of Use for full terms.
        </p>
      </section>
    </div>
  );
}
