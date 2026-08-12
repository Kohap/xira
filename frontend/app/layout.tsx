import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Image from "next/image";
import { Header } from "@/components/Header";
import { CopyButton } from "@/components/landing/CopyButton";
import xiraLogo from "./xira-logo.jpg";
import xlayerLogo from "./xlayer-logo-light.png";
import "./globals.css";

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";
const EXPLORER = "https://www.okx.com/web3/explorer/xlayer-test";
const CONTRACT_URL = `${EXPLORER}/address/${CONTRACT}`;
const ASSET_BASE = process.env.VERCEL === "1" ? "" : "/xira";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://xira-tan.vercel.app"),
  title: "XIRA: One Verifiable Risk Number for Every xStock",
  description:
    "AI-powered risk intelligence for tokenized equities on X Layer. Real-time scores, factor breakdowns, and on-chain attestations that agents and protocols can actually use.",
  openGraph: {
    title: "XIRA: One Verifiable Risk Number for Every xStock",
    description:
      "AI-powered risk intelligence for tokenized equities on X Layer. Real-time scores, factor breakdowns, and on-chain attestations that agents and protocols can actually use.",
    type: "website",
    siteName: "XIRA",
    url: "https://xira-tan.vercel.app",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "XIRA: Risk Intelligence on X Layer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "XIRA: One Verifiable Risk Number for Every xStock",
    description:
      "AI-powered risk intelligence for tokenized equities on X Layer. Real-time scores, factor breakdowns, and on-chain attestations that agents and protocols can actually use.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]"
        style={{
          "--supervisual-bg": `url("${ASSET_BASE}/supervisual-bg.jpg")`,
        } as React.CSSProperties}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("xira-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`,
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent)] focus:text-white focus:text-sm"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-[var(--card-border)] bg-black/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-start">
              <div className="max-w-md">
                <div className="flex items-center gap-3">
                  <Image
                    src={xiraLogo}
                    alt=""
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                  <div>
                    <span className="font-semibold text-base leading-tight block">
                      XIRA
                    </span>
                    <span className="text-[11px] text-neutral-500 leading-tight block">
                      X-Layer Intelligence &amp; Risk Analytics
                    </span>
                  </div>
                </div>
                <p className="mt-5 text-sm text-neutral-400 leading-relaxed">
                  AI-powered risk scores for tokenized equities, published
                  onchain. XIRA: X-Layer Intelligence &amp; Risk Analytics.
                </p>

                <div className="mt-6 space-y-3 text-[11px]">
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5">
                    <span className="shrink-0 text-neutral-500 pt-0.5">
                      contract
                    </span>
                    <code className="font-mono text-[11px] text-neutral-300 break-all min-w-0">
                      {CONTRACT}
                    </code>
                    <span className="ml-auto shrink-0">
                      <CopyButton value={CONTRACT} label="contract address" />
                    </span>
                  </div>
                  <p className="text-neutral-500">
                    Chain ID: <span className="font-mono text-neutral-400">1952</span> · X Layer Testnet
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2.5 text-[11px] leading-relaxed">
                  <p className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-6" />
                    </svg>
                    Verified on X Layer Testnet
                  </p>
                  <p className="mt-1 text-neutral-400">1 score = 1 on-chain attestation</p>
                  <p className="text-neutral-500">Updated every 30 minutes</p>
                </div>
              </div>

              <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 gap-10 sm:gap-14">
                {[
                  {
                    heading: "Explore",
                    links: [
                      { label: "Live board", href: "/dashboard" },
                      { label: "Alerts", href: "/alerts" },
                      { label: "Whitepaper", href: "/whitepaper" },
                    ],
                  },
                  {
                    heading: "Developers",
                    links: [
                      { label: "API docs", href: "/docs" },
                      { label: "On-chain verify", href: "/#chain" },
                      { label: "Evidence hash", href: "/docs" },
                    ],
                  },
                  {
                    heading: "Legal",
                    links: [
                      { label: "Terms", href: "/terms" },
                      { label: "Privacy", href: "/privacy" },
                      { label: "Security", href: "/docs" },
                    ],
                  },
                ].map((col) => (
                  <div key={col.heading}>
                    <h3 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
                      {col.heading}
                    </h3>
                    <ul className="space-y-2.5">
                      {col.links.map((link) => (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            className="text-sm text-neutral-400 hover:text-white transition-colors"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>

            <div className="mt-12 pt-6 border-t border-[var(--card-border)] flex flex-col sm:flex-row items-center gap-3 justify-between">
              <p className="text-xs text-neutral-500">
                © 2026 XIRA · Built by <span className="text-neutral-400">Gift</span>
              </p>
              <nav
                aria-label="Footer links"
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
              >
                <a
                  href={CONTRACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  View Contract
                </a>
                <span className="text-neutral-700" aria-hidden="true">·</span>
                <a
                  href="/dashboard"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  Live Dashboard
                </a>
                <span className="text-neutral-700" aria-hidden="true">·</span>
                <span className="text-neutral-500">
                  Mainnet: soon
                </span>
              </nav>
            </div>

            <div className="mt-6 pt-5 border-t border-[var(--card-border)] flex items-center justify-center gap-2.5">
              <span className="text-xs text-neutral-500">Built on</span>
              <span className="inline-flex items-center gap-1.5">
                <Image
                  src={xlayerLogo}
                  alt=""
                  width={20}
                  height={16}
                  className="w-5 h-4 object-contain"
                  loading="lazy"
                />
                <span className="text-sm font-semibold text-neutral-300">
                  XLayer
                </span>
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
