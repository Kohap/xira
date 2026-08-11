import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "XIRA — X-Layer Intelligence & Risk Analytics",
  description:
    "AI-powered risk intelligence and signals for tokenized equities on X Layer.",
  openGraph: {
    title: "XIRA — X-Layer Intelligence & Risk Analytics",
    description:
      "AI-powered risk intelligence and signals for tokenized equities on X Layer.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
        <footer className="border-t border-[var(--card-border)] py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4 text-xs text-neutral-400">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span>XIRA — X-Layer Intelligence &amp; Risk Analytics</span>
              <span className="hidden sm:inline text-neutral-600">·</span>
              <span>Built by Gift</span>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {[
                { label: "Whitepaper", href: "/whitepaper" },
                { label: "Docs", href: "/docs" },
                { label: "Terms", href: "/terms" },
                { label: "Privacy", href: "/privacy" },
                { label: "Dashboard", href: "/dashboard" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-neutral-500 hover:text-white transition-colors py-1"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <p className="font-mono text-neutral-600">
              chain 1952 · contract 0x6428…32AE · testnet · v1.0.0-mvp
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}