import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Image from "next/image";
import { Header } from "@/components/Header";
import xlayerLogo from "./xlayer-logo-light.png";
import "./globals.css";

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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center gap-2.5">
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
        </footer>
      </body>
    </html>
  );
}
