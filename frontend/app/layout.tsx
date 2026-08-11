import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Header } from "@/components/Header";
import { CopyButton } from "@/components/landing/CopyButton";
import "./globals.css";

const CONTRACT = "0x64288ccD936470f66D7035e824A9141C938C32AE";

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
  title: "XIRA — X-Layer Intelligence & Risk Analytics",
  description:
    "AI-powered risk intelligence and signals for tokenized equities on X Layer.",
  openGraph: {
    title: "XIRA — X-Layer Intelligence & Risk Analytics",
    description:
      "One honest 0–100 risk score for every tokenized equity, signed onto X Layer as a verifiable attestation.",
    type: "website",
    siteName: "XIRA",
    url: "https://xira-tan.vercel.app",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "XIRA — X-Layer Intelligence & Risk Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "XIRA — X-Layer Intelligence & Risk Analytics",
    description:
      "One honest 0–100 risk score for every tokenized equity, signed onto X Layer as a verifiable attestation.",
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
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
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
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center font-bold text-white text-sm">
                    X
                  </div>
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
                  One honest 0–100 risk score for every{" "}
                  <span className="font-serif italic text-[var(--accent-glow)]">
                    xStock
                  </span>
                  , signed onto X Layer as a verifiable attestation — readable
                  by humans, agents, and contracts.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-neutral-400">
                    <span className="live-dot w-1.5 h-1.5 rounded-full bg-[var(--accent-glow)]" aria-hidden="true" />
                    oracle live · rescores every 30 min
                  </span>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
                  <span className="text-[10px] text-neutral-500 mr-1">contract</span>
                  <code className="font-mono text-[11px] text-neutral-300">
                    {CONTRACT.slice(0, 10)}…{CONTRACT.slice(-6)}
                  </code>
                  <CopyButton value={CONTRACT} label="contract address" />
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
              <p className="font-mono text-[11px] text-neutral-600">
                chain 1952 · contract 0x6428…32AE · testnet · model v1.0.0
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}