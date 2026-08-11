import type { Metadata } from "next";
import { Reveal } from "@/components/landing/Reveal";
import { LiveBars } from "@/components/landing/LiveBars";
import { LiveTicker } from "@/components/landing/LiveTicker";
import { ProofSection } from "@/components/landing/ProofSection";
import { LiveHeatmap } from "@/components/landing/LiveHeatmap";
import { CopyButton } from "@/components/landing/CopyButton";

export const metadata: Metadata = {
  title: "XIRA — Risk Intelligence on X Layer",
  description:
    "One honest 0–100 risk score for every tokenized equity, signed onto X Layer as a verifiable attestation.",
};

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

const PIPELINE = [
  {
    verb: "Collect",
    copy: "Live quotes, volume, momentum, beta, and news sentiment for all 15 markets.",
  },
  {
    verb: "Score",
    copy: "A five-factor model compresses them into one weighted 0–100 score per asset.",
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

const CAPABILITIES = [
  {
    title: "Risk heatmap",
    copy: "The whole market at a glance — every asset color-coded and sorted by score, with confidence and anomaly flags on hover.",
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
    copy: "Every score keeps its history — past attestations, score deltas, and the chain transaction hash of each one.",
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

export default function LandingPage() {
  return (
    <>
      <LiveTicker />

      <section className="relative overflow-hidden">
        <div className="hero-glow absolute inset-0" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
                One risk number for every{" "}
                <span className="text-[var(--accent-glow)]">xStock</span>.
              </h1>
              <p className="mt-6 text-lg text-neutral-400 max-w-xl leading-relaxed">
                XIRA weighs volatility, momentum, news, volume, and beta into a
                single 0–100 score — then signs it onto X Layer so the number
                you see is the transaction anyone can verify.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white font-medium transition-colors active:scale-[0.98]"
                >
                  Open dashboard
                </a>
                <a
                  href="#chain"
                  className="inline-flex items-center justify-center px-6 h-12 rounded-xl border border-[var(--card-border)] text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors active:scale-[0.98]"
                >
                  Verify on-chain
                </a>
              </div>

              <div className="mt-8 inline-flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
                <span className="text-[11px] text-neutral-500 mr-1">oracle</span>
                <code className="font-mono text-[11px] text-neutral-300">
                  {CONTRACT.slice(0, 10)}…{CONTRACT.slice(-6)}
                </code>
                <CopyButton value={CONTRACT} label="contract address" />
              </div>
            </div>

            <div>
              <LiveBars />
            </div>
          </div>
        </div>
      </section>

      <section
        id="how"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Data in. Signed truth out.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            The pipeline is short on purpose — every step is accountable, so a
            score can be traced back to the feed it came from.
          </p>
        </Reveal>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {PIPELINE.map((step, i) => (
            <Reveal key={step.verb} delay={i * 90}>
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center font-mono text-xs text-[var(--accent-glow)]">
                    {i + 1}
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
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                  {step.copy}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Built for desks, agents, and auditors.
          </h2>
        </Reveal>

        <div className="mt-12">
          {CAPABILITIES.map((cap, i) => (
            <Reveal key={cap.title} delay={Math.min(i * 60, 240)}>
              <div className="grid sm:grid-cols-[260px_1fr] gap-2 sm:gap-8 items-baseline py-5 border-t border-[var(--card-border)] last:border-b">
                <h3 className="font-semibold">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-xl">
                  {cap.copy}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        id="chain"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 scroll-mt-20"
      >
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            Open the oracle.
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">
            The contract is live on X Layer testnet. Watch an attestation land
            in real time, then check it on the explorer.
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
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

      <section className="border-t border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance max-w-xl">
              Start with the full board.
            </h2>
            <p className="mt-3 text-neutral-400">
              Fifteen markets, one number each, all verifiable on X Layer.
            </p>
          </Reveal>
          <Reveal delay={120} className="shrink-0">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center px-8 h-14 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-glow)] text-white font-medium text-lg transition-colors active:scale-[0.98]"
            >
              Open dashboard
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}