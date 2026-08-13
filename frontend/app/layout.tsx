import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Header } from "@/components/Header";
import XiraMark from "@/components/XiraMark";
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
          <link rel="preconnect" href="https://xira-api-production.up.railway.app" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://xira-api-production.up.railway.app" />
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
            <nav aria-label="Footer" className="grid grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
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
            </nav>

            <div className="mt-12 pt-6 border-t border-[var(--card-border)] flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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

              <div className="flex items-center justify-center gap-2.5">
                <span className="text-xs text-neutral-500">Built on</span>
                <XiraMark className="w-5 h-5" />
                <span className="text-sm font-semibold text-neutral-300">
                  XLayer
                </span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
