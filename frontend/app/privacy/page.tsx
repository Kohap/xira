import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy: XIRA",
  description: "How XIRA handles (and doesn't handle) your data.",
  alternates: {
    canonical: "/privacy",
  },
};

const LAST_UPDATED = "August 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          Last updated: {LAST_UPDATED}. The short version: this service does
          not create accounts, does not track you, and stores no personal
          data.
        </p>
      </header>

      <div className="mt-10 space-y-8 text-sm text-neutral-400 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">1. What we collect</h2>
          <p className="mt-3">
            Nothing that identifies you. The frontend runs as a static site on
            Vercel and does not set cookies, run analytics, or maintain
            sessions. Your browser fetches public risk data directly from the
            API; no account, login, or personal profile exists.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">2. Requests and logs</h2>
          <p className="mt-3">
            The API server (hosted on Railway) receives HTTP requests
            containing your IP address, as any web server does, for standard
            operational logging and abuse prevention. The backend application
            itself does not log request bodies. Third-party platforms (Vercel
            for hosting, Railway for the API) process traffic under
            their own privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">3. Attestation history</h2>
          <p className="mt-3">
            Computed risk scores are stored in an SQLite database to provide
            the per-symbol history trail. This store contains symbols, scores,
            factor values, explanations, and timestamps only; no user data,
            no IPs, no device fingerprints.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">4. Third-party data sources</h2>
          <p className="mt-3">
            In live mode, the backend fetches market data (Finnhub) and
            news headlines on your behalf, server-side. Your browser never
            talks to those providers directly, and the XIRA server forwards
            no personal data to them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">5. No selling, no ads</h2>
          <p className="mt-3">
            We do not sell, rent, or share personal data (we have none to
            sell). There is no advertising on the service and no third-party
            ad scripts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">6. Children</h2>
          <p className="mt-3">
            The service is not directed at children under 13, and we do not
            knowingly process their data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">7. Your rights</h2>
          <p className="mt-3">
            Since no personal data is held, there is nothing to access,
            correct, or delete on your behalf. If you believe data about you
            has found its way into the service (for example, in logs held by
            hosting providers), contact us via a GitHub issue at
            github.com/Kohap/xira and we will investigate.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">8. Changes</h2>
          <p className="mt-3">
            If this policy changes, the &quot;last updated&quot; date above will change
            accordingly. Material changes will be announced in the
            repository.
          </p>
        </section>
      </div>
    </div>
  );
}
