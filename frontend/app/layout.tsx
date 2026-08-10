import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <header className="border-b border-[var(--card-border)] bg-[var(--card-bg)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-bold text-white text-sm">
                X
              </div>
              <div>
                <h1 className="font-semibold text-lg leading-tight">XIRA</h1>
                <p className="text-xs text-neutral-500 leading-tight">
                  X-Layer Intelligence &amp; Risk Analytics
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-6 text-sm text-neutral-400">
              <a href="/" className="hover:text-white transition-colors">
                Dashboard
              </a>
              <a
                href="/docs"
                className="hover:text-white transition-colors hidden sm:inline"
              >
                API Docs
              </a>
              <span className="text-xs border border-[var(--card-border)] rounded-full px-3 py-1 text-neutral-500">
                MVP v1.0
              </span>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--card-border)] py-4 text-center text-xs text-neutral-600">
          XIRA &mdash; X-Layer Intelligence &amp; Risk Analytics &middot; Powered
          by AI &middot; Built on X Layer
        </footer>
      </body>
    </html>
  );
}
