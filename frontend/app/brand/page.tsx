import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { BuiltOnXLayerBadge } from "@/components/BuiltOnXLayerBadge";

export const metadata: Metadata = {
  title: "Brand - XIRA",
  description:
    "The XIRA brand kit: the mark, the palette, the type system, and usage rules.",
};

const CONTRACT = "0xaa5f6215e947ffce2f46513a926af3239be545d0";

const BRAND_RULES = [
  "Keep the mark at 32 px or larger, with clearspace of one full mark width on every side.",
  "Never recolor, redraw, or rotate the mark. It ships in an ivory duotone for dark surfaces and an ink duotone for light.",
  "Geist carries UI and body copy. Geist Mono is for data: hashes, addresses, timestamps. Instrument Serif italic is reserved for the single accent word in the hero.",
  "Palette is warm charcoal and ivory. Risk colors belong to scores on the heatmap, nowhere else.",
];

const PALETTE = [
  { name: "Background", hex: "#0D0C0B", cls: "bg-[#0D0C0B] border border-[var(--card-border)]" },
  { name: "Card", hex: "#161412", cls: "bg-[#161412] border border-[var(--card-border)]" },
  { name: "Border", hex: "#28241E", cls: "bg-[#28241E]" },
  { name: "Foreground", hex: "#E9E7E2", cls: "bg-[#E9E7E2]" },
  { name: "Accent", hex: "#E0DCD2", cls: "bg-[#E0DCD2]" },
  { name: "Accent ink", hex: "#141210", cls: "bg-[#141210] border border-[var(--card-border)]" },
];

const RISK_RAMP = [
  { label: "Low", hex: "#22C55E", cls: "bg-[#22C55E]" },
  { label: "Moderate", hex: "#EAB308", cls: "bg-[#EAB308]" },
  { label: "Elevated", hex: "#F97316", cls: "bg-[#F97316]" },
  { label: "High", hex: "#EF4444", cls: "bg-[#EF4444]" },
  { label: "Critical", hex: "#DC2626", cls: "bg-[#DC2626]" },
];

export default function BrandPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-6 inline-block"
      >
        &larr; Back to home
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
        The XIRA brand.
      </h1>
      <p className="mt-4 text-neutral-400 leading-relaxed max-w-2xl">
        The mark, the palette, and the type system: everything needed to use
        the XIRA identity the way it was drawn.
      </p>

      <section className="mt-10 grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[var(--card-border)] bg-black/20 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-200">Wordmark</h2>
            <span className="text-[11px] text-neutral-500">primary lockup</span>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-[#0D0C0B] border border-[var(--card-border)] px-5 py-4">
              <LogoMark size={36} />
              <span className="text-xl font-semibold tracking-tight text-[#E9E7E2]">
                XIRA
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#F5F3EE] border border-[#DFDBD1] px-5 py-4">
              <LogoMark size={36} />
              <span className="text-xl font-semibold tracking-tight text-[#1D1B17]">
                XIRA
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-black/20 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-200">The mark</h2>
            <span className="text-[11px] text-neutral-500">ivory duotone, dark surface</span>
          </div>
          <div className="mt-5 flex items-start gap-6">
            <div className="shrink-0 rounded-xl bg-[#0D0C0B] border border-[var(--card-border)] p-6">
              <LogoMark size={72} />
            </div>
            <ul className="space-y-2.5 text-sm text-neutral-400 leading-relaxed">
              <li>Minimum size: 32 px.</li>
              <li>Clearspace: one full mark width on every side.</li>
              <li>Never recolor, redraw, or rotate the mark.</li>
            </ul>
          </div>
          <div className="mt-5 pt-5 border-t border-[var(--card-border)]">
            <h3 className="text-sm font-medium text-neutral-200">On X Layer</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <BuiltOnXLayerBadge />
              <span className="text-sm text-neutral-500">
                Use the badge as drawn. No recolor, no re-layout.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[var(--card-border)] bg-black/20 p-5 sm:p-7">
          <h2 className="text-sm font-semibold text-neutral-200">Palette</h2>
          <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PALETTE.map((c) => (
              <div key={c.name}>
                <div className={`aspect-square rounded-lg ${c.cls}`} />
                <p className="mt-1.5 text-[11px] font-mono text-neutral-500 leading-tight">
                  {c.hex}
                </p>
                <p className="text-[11px] text-neutral-400 leading-tight">{c.name}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-medium text-neutral-200">Risk ramp</h3>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {RISK_RAMP.map((c) => (
              <div key={c.label}>
                <div className={`aspect-square rounded-lg ${c.cls}`} />
                <p className="mt-1.5 text-[11px] font-mono text-neutral-500 leading-tight">
                  {c.hex}
                </p>
                <p className="text-[11px] text-neutral-400 leading-tight">{c.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-neutral-500 leading-relaxed">
            Warm charcoal and ivory everywhere else. Risk colors exist only
            where scores are shown.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-black/20 p-5 sm:p-7">
          <h2 className="text-sm font-semibold text-neutral-200">Type</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-[var(--card-bg)] px-5 py-4">
              <p className="text-lg font-medium">
                The quick brown fox jumps over the lazy dog
              </p>
              <p className="mt-1 text-[11px] font-mono text-neutral-500">
                Geist · UI and body
              </p>
            </div>
            <div className="rounded-xl bg-[var(--card-bg)] px-5 py-4">
              <p className="text-lg font-mono text-neutral-200">
                {CONTRACT.slice(0, 6)}…{CONTRACT.slice(-6)} · score 12 · 30 min
                cadence
              </p>
              <p className="mt-1 text-[11px] font-mono text-neutral-500">
                Geist Mono · data and code
              </p>
            </div>
            <div className="rounded-xl bg-[var(--card-bg)] px-5 py-4">
              <p className="text-lg font-serif italic">
                xStock
              </p>
              <p className="mt-1 text-[11px] font-mono text-neutral-500">
                Instrument Serif italic · hero accent word only
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[var(--card-border)] bg-black/20 p-5 sm:p-7">
        <h2 className="text-sm font-semibold text-neutral-200">
          Usage rules
        </h2>
        <ol className="mt-5 space-y-4">
          {BRAND_RULES.map((rule, i) => (
            <li key={rule} className="flex gap-4 sm:gap-5">
              <span
                className="shrink-0 font-mono text-xs text-neutral-600 tabular-nums pt-0.5"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm sm:text-[15px] text-neutral-400 leading-relaxed max-w-2xl">
                {rule}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-6 pt-5 border-t border-[var(--card-border)] flex flex-wrap items-center gap-3">
          <p className="text-sm text-neutral-500">
            Need the source files for an integration?
          </p>
          <a
            href="https://github.com/Kohap/xira"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--accent-glow)] hover:underline underline-offset-4"
          >
            Open the repository on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}