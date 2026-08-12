import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use: XIRA",
  description: "Terms governing the use of the XIRA risk analytics service.",
};

const LAST_UPDATED = "August 2026";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          Terms of Use
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          Last updated: {LAST_UPDATED}. Built by Gift, for the XIRA open
          project (github.com/Kohap/xira).
        </p>
      </header>

      <div className="mt-10 space-y-8 text-sm text-neutral-400 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">1. The service</h2>
          <p className="mt-3">
            XIRA provides informational risk analytics for the 15 tracked
            tokenized equities (xStocks) on X Layer testnet. The service
            computes a 0–100 risk score per asset and, when an oracle key is
            configured, commits each score to the XIRA contract on-chain. The
            service is provided for research and informational use.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">2. Not financial advice</h2>
          <p className="mt-3">
            Risk scores, factor breakdowns, explanations, anomaly flags, and
            any other output of XIRA are model outputs, not investment advice,
            not research reports, and not recommendations to buy, sell, or
            hold any asset. Nothing on this site constitutes an offer of
            securities. You alone are responsible for your trading and
            investment decisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">3. No warranty</h2>
          <p className="mt-3">
            The service, the model, the API, and the contract are provided
            "as is" and "as available", without warranty of any kind. Scores
            may be delayed, stale, incomplete, or wrong. In live mode the
            data sources (Yahoo Finance and news feeds) are third-party
            services outside XIRA's control; in mock mode the data is
            simulated and must not be treated as market data. Testnet tokens
            and attestations have no value and can be reset by the network.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">4. Acceptable use</h2>
          <p className="mt-3">
            You agree not to use XIRA in a way that is unlawful, that overloads
            or disrupts the backend, that misrepresents scores as your own, or
            that attempts to access systems you are not authorized to use.
            You may use the API for any compliant purpose, including agent
            tooling, subject to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">5. Intellectual property</h2>
          <p className="mt-3">
            The XIRA model, names, and documentation are released as part of
            the open project; license terms for the code live in the
            repository. Underlying market data belongs to its respective
            providers and is used under their terms. Nothing in these terms
            transfers ownership of any of the above to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">6. Limitation of liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by law, XIRA and its operator
            (Gift) shall not be liable for any loss or damage arising from use
            of the service, including lost trading profits, reliance on
            scores, or service unavailability. Because this is a free,
            experimental research service on a testnet, you accept all risk of
            using it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">7. Changes and termination</h2>
          <p className="mt-3">
            The service, its endpoints, the model, and these terms may change
            at any time. The frontend, backend, and contract are open source:
            you can audit, fork, and run your own instance. We may suspend or
            restrict access at any time and without notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">8. Governing law</h2>
          <p className="mt-3">
            These terms are governed by the laws of the jurisdiction in which
            you access the service, except where that conflicts with mandatory
            local consumer law; the applicable contract is with you directly.
            Disputes are resolved in the competent courts of that
            jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight">9. Contact</h2>
          <p className="mt-3">
            The project is public at github.com/Kohap/xira. Open an issue
            there for questions, corrections, or security concerns.
          </p>
        </section>
      </div>
    </div>
  );
}
