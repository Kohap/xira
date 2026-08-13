import type { Metadata } from "next";
import { Reveal } from "@/components/landing/Reveal";
import { LiveBars } from "@/components/landing/LiveBars";
import { LiveTicker } from "@/components/landing/LiveTicker";
import { ProofSection } from "@/components/landing/ProofSection";
import { LiveHeatmap } from "@/components/landing/LiveHeatmap";
import { CopyButton } from "@/components/landing/CopyButton";
import {
  CHAIN_LABEL,
  CHAIN_NAME,
  CONTRACT_ADDRESS,
  CONTRACT_URL,
} from "@/lib/chain";

export const metadata: Metadata = {
  title: "XIRA: One Verifiable Risk Number for Every xStock",
  description:
    "AI-powered risk intelligence for tokenized equities on X Layer. Real-time scores, factor breakdowns, and on-chain attestations that agents and protocols can actually use.",
};

const PIPELINE = [
  {
    verb: "Collect",
    copy: "Live quotes, volume, momentum, beta, and news sentiment for every tracked xStock.",
  },
  {
    verb: "Score",
    copy: "A five-factor model compresses them into one weighted 0-100 score per asset.",
  },
  {
    verb: "Sign",
    copy: "Score, model version, and inputs hash into an evidence fingerprint the oracle signs.",
  },
  {
    verb: "Verify",
    copy: "The signature lands as an X Layer transaction. Open it in the explorer and check.",
  },
];

const WITHOUT_PROOF = [
  {
    claim: "Price is quoted as risk",
    note: "The number ships without a model anyone can inspect.",
  },
  {
    claim: "Risk data is fragmented",
    note: "Dashboards scatter scores, and nothing downstream can reference them on-chain.",
  },
  {
    claim: "Agents get screenshots, not records",
    note: "No machine-readable shape to build a position on.",
  },
  {
    claim: "Claims are made off-chain",
    note: "No transaction exists to open and check.",
  },
];

const WITH_ATTESTATION = [
  {
    claim: "Five weighted factors, one number",
    note: "Momentum, volatility, sentiment, volume, and liquidity in a readable score.",
  },
  {
    claim: "One compact record per market",
    note: "Score, factors, and evidence hash in a single attestation.",
  },
  {
    claim: "The same records feed agents",
    note: "MCP tools serve one asset, the whole board, or full history.",
  },
  {
    claim: "Every change is a transaction",
    note: "Each meaningful score update lands on X Layer as a signed attestation.",
  },
];

const CAPABILITIES = [
  {
    title: "Risk heatmap",
    copy: "The whole market at a glance, every asset color-coded and sorted by score, with confidence and anomaly flags on hover.",
  },
  {
    title: "Factor breakdown",
    copy: "Why a number is what it is: per-factor scores, weights, and a plain-language explanation behind every attestation.",
  },
  {
    title: "Anomaly alerting",
    copy: "Scores beyond what the factor model expects get flagged on the board, with the reason carried in the attestation itself.",
  },
  {
    title: "Agent-ready",
    copy: "Talk to risk from your own tooling: MCP tools for every asset, all assets at once, and full attestation history.",
  },
  {
    title: "Proof trail",
    copy: "Every score keeps its history: past attestations, score deltas, and the chain transaction hash of each one.",
  },
  {
    title: "Batch reads",
    copy: "Contracts and agents can pull many symbols in a single on-chain call instead of looping one by one.",
  },
];

const MCP_TOOLS = [
  "xira_get_asset_risk",
  "xira_get_all_assets",
  "xira_get_attestation_history",
];

const VERIFY_STEPS = [
  {
    title: "Copy the oracle contract address",
    detail: "This is the address every score is published to:",
  },
  {
    title: "Open it on the OKX Explorer",
    detail: "Each meaningful score update is recorded onchain as a transaction.",
  },
  {
    title: "Check the latest transactions and events",
    detail: "Match the score, timestamp, and evidence hash shown on this dashboard with the on-chain data.",
  },
  {
    title: "Verify, independently",
    detail: "Every risk number you see can be verified without trusting this site.",
  },
];

const FAQ = [
  {
    q: "What is XIRA?",
    a: "XIRA (X-Layer Intelligence & Risk Analytics) generates real-time risk scores for xStocks and publishes them as verifiable attestations on X Layer.",
  },
  {
    q: "How is the risk score calculated?",
    a: "It uses a transparent five-factor model: Momentum, Volatility, Sentiment, Volume Anomaly, and Liquidity Proxy. These are combined into a single 0-100 score.",
  },
  {
    q: "Why put the score onchain?",
    a: "So agents, smart contracts, and users can trust and use the data without relying on a centralized API or dashboard.",
  },
  {
    q: "How often are scores updated?",
    a: "The system re-scores all markets every 30 minutes and only writes a new attestation when the score changes meaningfully.",
  },
  {
    q: "Can agents use this data?",
    a: "Yes. XIRA exposes MCP tools (xira_get_asset_risk, xira_get_all_assets, xira_get_attestation_history) so agents can query risk data directly.",
  },
  {
    q: "Is this live on mainnet?",
    a: "Yes. Scores are attested onchain to the XIRA contract on X Layer Mainnet.",
  },
];







function ComparisonCard({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "muted" | "primary";
  rows: { claim: string; note: string }[];
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 sm:p-7 ${
        tone === "primary"
          ? "border-[var(--accent)]/30 bg-[var(--card-bg)]"
          : "border-[var(--card-border)] bg-black/20"
      }`}
    >
      <h3 className="text-sm font-semibold text-neutral-200">{title}</h3>
      <dl className="mt-5 flex-1">
        {rows.map((row) => (
          <div
            key={row.claim}
            className="border-t border-[var(--card-border)] py-4 first:border-t-0 first:pt-0"
          >
            <dt className="text-[15px] font-medium text-neutral-100">{row.claim}</dt>
            <dd className="mt-1 text-sm text-neutral-500 leading-relaxed">{row.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <LiveTicker />

      <section className="relative">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-24 lg:pt-28 pb-14 sm:pb-20">
          <Reveal delay={60}>
            <h1 className="max-w-3xl text-[2.6rem] leading-[1.05] sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
              One risk number for every{" "}
              <span className="font-serif italic text-[var(--accent-glow)] tracking-normal">
                xStock
              </span>
              .
            </h1>
          </Reveal>
          <Reveal delay={90}>
            <p className="mt-6 text-lg text-neutral-400 max-w-xl leading-relaxed">
              XIRA weighs volatility, momentum, news, volume, and beta into a
              single 0-100 score, then signs it onto X Layer so the number you
              see is the transaction anyone can verify.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center px-6 h-12 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-glow)] font-medium transition-colors"
              >
                Open live board
              </a>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]/70 px-3 py-2">
                <span className="text-[11px] text-neutral-500 mr-1">oracle</span>
                <code className="font-mono text-[11px] text-neutral-300">
                  {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}
                </code>
                <CopyButton value={CONTRACT_ADDRESS} label="contract address" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-12 sm:mt-16">
              <LiveBars />
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="how"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            One cycle, start to proof.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            The pipeline is short on purpose: every step is accountable, so a
            score can be traced back to the feed it came from.
          </p>
        </Reveal>

        <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-9">
          {PIPELINE.map((step, i) => (
            <Reveal key={step.verb} delay={i * 90}>
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--accent-glow)] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-semibold text-lg">{step.verb}</h3>
                </div>
                {i < PIPELINE.length - 1 && (
                  <span
                    className="hidden lg:block absolute -right-4 top-4 w-8 text-[var(--accent)]/40"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M5 12h14M14 6l6 6-6 6" />
                    </svg>
                  </span>
                )}
                <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                  {step.copy}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        id="compare"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Verified, not promised.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            A risk score is only as good as the evidence it ships with. This
            one ships with a transaction.
          </p>
        </Reveal>

        <div className="mt-10 grid lg:grid-cols-2 gap-5">
          <Reveal>
            <ComparisonCard
              title="A risk feed without proof"
              tone="muted"
              rows={WITHOUT_PROOF}
            />
          </Reveal>
          <Reveal delay={120}>
            <ComparisonCard
              title="An XIRA attestation"
              tone="primary"
              rows={WITH_ATTESTATION}
            />
          </Reveal>
        </div>

        <Reveal delay={180}>
          <p className="mt-8 text-sm text-neutral-300 leading-relaxed max-w-2xl">
            The number and the evidence ship together: open a transaction,
            replay the inputs, and the score explains itself.{" "}
            <a
              href="#verify"
              className="text-[var(--accent-glow)] hover:underline underline-offset-4"
            >
              Verify it on-chain
            </a>
            .
          </p>
        </Reveal>
      </section>

      <section
        id="chain"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Open the oracle.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            The contract is live on {CHAIN_NAME}. The oracle re-scores every
            tracked market every 30 minutes and signs each meaningful change to
            the chain, open a transaction, and check it against the model.
          </p>
        </Reveal>

        <div className="mt-12 grid lg:grid-cols-2 gap-6 items-start">
          <Reveal>
            <ProofSection />
          </Reveal>
          <Reveal delay={120}>
            <LiveHeatmap />
          </Reveal>
        </div>
      </section>

      <section
        id="features"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Built for trading teams, agents, and auditors.
          </h2>
        </Reveal>

        <div className="mt-12">
          {CAPABILITIES.map((cap, i) => (
            <Reveal key={cap.title} delay={Math.min(i * 60, 240)}>
              <div className="grid sm:grid-cols-[260px_1fr] gap-1 sm:gap-8 items-baseline py-4 sm:py-5 border-t border-[var(--card-border)] last:border-b group">
                <h3 className="font-semibold flex items-baseline gap-3 transition-colors group-hover:text-[var(--accent-glow)]">
                  <span className="font-mono text-xs text-neutral-600 tabular-nums w-5 shrink-0 group-hover:text-neutral-400 transition-colors">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {cap.title}
                </h3>
                <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-xl">
                  {cap.copy}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Give your agents a risk desk.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            The same endpoints the dashboard uses are exposed as MCP tools, so
            any agent can ask about risk and read the attestation behind the
            answer.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <ul className="mt-8 flex flex-wrap gap-2">
            {MCP_TOOLS.map((tool) => (
              <li
                key={tool}
                className="px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] font-mono text-xs text-neutral-300"
              >
                {tool}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section
        id="verify"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            How to verify a score.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            Every risk number you see can be independently verified on
            {CHAIN_LABEL} in a few steps.
          </p>
        </Reveal>

        <ol className="mt-10 space-y-5">
          {VERIFY_STEPS.map((step, i) => (
            <Reveal key={step.title} delay={Math.min(i * 80, 240)}>
              <li className="flex gap-4 sm:gap-5">
                <span
                  className="shrink-0 font-mono text-xs font-semibold text-[var(--accent-glow)] tabular-nums pt-1"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-neutral-200 leading-snug">
                    {step.title}
                  </h3>
                  <div className="mt-2">
                    {i === 0 ? (
                      <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
                        <code className="font-mono text-[11px] text-neutral-300 break-all">
                          {CONTRACT_ADDRESS}
                        </code>
                        <CopyButton value={CONTRACT_ADDRESS} label="contract address" />
                      </div>
                    ) : i === 1 ? (
                      <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                        <a
                          href={CONTRACT_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent-glow)] hover:underline underline-offset-4"
                        >
                          Open the contract on the OKX Explorer
                        </a>{" "}
                        and check its latest transactions.
                      </p>
                    ) : (
                      <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section
        id="faq"
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Frequently asked questions.
          </h2>
        </Reveal>

        <div className="mt-8">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i * 50, 200)}>
              <details className="group border-b border-[var(--card-border)] py-4">
                <summary className="flex items-center justify-between gap-4 cursor-pointer text-sm font-medium text-neutral-200 hover:text-white transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span
                    className="shrink-0 w-5 h-5 flex items-center justify-center text-[var(--accent-glow)] transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M8 3v10M3 8h10" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm sm:text-[15px] text-neutral-400 leading-relaxed pr-8">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>


      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24">
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <h2 className="max-w-2xl text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              One verifiable risk number for every{" "}
              <span className="font-serif italic text-[var(--accent-glow)] tracking-normal">
                xStock
              </span>
              .
            </h2>
            <p className="mt-4 text-neutral-400 max-w-xl leading-relaxed">
              The board is live. Scores update every 30 minutes, and every
              meaningful change is a transaction you can check.
            </p>
            <a
              href="/dashboard"
              className="mt-8 inline-flex items-center justify-center px-6 h-12 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-glow)] font-medium transition-colors"
            >
              Open live board
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
