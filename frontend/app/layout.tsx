import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Image from "next/image";
import { Header } from "@/components/Header";
import { CopyButton } from "@/components/landing/CopyButton";
import { LogoMark } from "@/components/LogoMark";
import xlayerLogo from "./xlayer-logo-light.png";
import "./globals.css";

const CONTRACT = "0xaa5f6215e947ffce2f46513a926af3239be545d0";
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
  metadataBase: new URL("https://www.xira.surf"),
  title: "XIRA: One Verifiable Risk Number for Every xStock",
  description:
    "AI-powered risk intelligence for tokenized equities on X Layer. Real-time scores, factor breakdowns, and on-chain attestations that agents and protocols can actually use.",
  openGraph: {
    title: "XIRA: One Verifiable Risk Number for Every xStock",
    description:
      "AI-powered risk intelligence for tokenized equities on X Layer. Real-time scores, factor breakdowns, and on-chain attestations that agents and protocols can actually use.",
    type: "website",
    siteName: "XIRA",
    url: "https://www.xira.surf",
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
        <head>
          <link rel="preconnect" href="https://xira-gsb3.onrender.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://xira-gsb3.onrender.com" />
          <link rel="apple-touch-icon" href={`${ASSET_BASE}/apple-touch-icon.png`} />
          <meta name="theme-color" content="#0d0c0b" />
        </head>
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
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent)] focus:text-[var(--accent-ink)] focus:text-sm"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-[var(--card-border)] bg-black/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-md">
                <div className="flex items-center gap-3">
                  <LogoMark size={36} />
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

              <nav aria-label="Footer" className="mt-12 lg:mt-14 pt-10 border-t border-[var(--card-border)] grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
                {[
                  {
                    heading: "Product",
                    links: [
                      { label: "Live dashboard", href: "/dashboard" },
                      { label: "Alerts", href: "/alerts" },
                      { label: "Methodology", href: "/whitepaper" },
                      { label: "Help / FAQ", href: "/#faq" },
                    ],
                  },
                  {
                    heading: "Developers",
                    links: [
                      { label: "Docs", href: "/docs" },
                      { label: "Verify a score", href: "/verify" },
                      { label: "Evidence hash", href: "/docs" },
                      { label: "Contract ABI", href: "/docs" },
                    ],
                  },
                  {
                    heading: "Legal & Compliance",
                    links: [
                      { label: "Privacy Policy", href: "/privacy" },
                      { label: "Terms of Service", href: "/terms" },
                    ],
                  },
                ].map((col) => (
                  <div key={col.heading}>
                    <h3 className="text-[11px] font-medium text-neutral-500 mb-3">
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

                <div>
                  <h3 className="text-[11px] font-medium text-neutral-500 mb-3">
                    Trust &amp; Social
                  </h3>
                  <div className="flex items-center gap-4">
                    <a
                      href="https://github.com/Kohap/xira"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="XIRA on GitHub"
                      className="text-neutral-400 hover:text-[var(--accent-glow)] transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                        <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 015 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.81c0 .27.18.6.69.49A10.25 10.25 0 0022 12.25C22 6.58 17.52 2 12 2z" />
                      </svg>
                    </a>
                    <a
                      href="https://x.com/Xirar1l"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="XIRA on X"
                      className="text-neutral-400 hover:text-[var(--accent-glow)] transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                        <path d="M18.9 2.5h3.2l-7 8 8.2 11h-6.4l-5-6.6-5.8 6.6H2.9l7.5-8.6L2.5 2.5h6.6l4.5 6 5.3-6zm-1.1 17.1h1.8L7.9 4.3H6l11.8 15.3z" />
                      </svg>
                    </a>
                  </div>
                  <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
                    The code is open source. Auditing questions, agent
                    integrations, and feedback are welcome on GitHub.
                  </p>
                </div>
              </nav>

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
