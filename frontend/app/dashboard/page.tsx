import type { Metadata } from "next";
import DashboardClient from "./client";

export const metadata: Metadata = {
  title: "Risk Dashboard: XIRA",
  description:
    "Live XIRA risk scores for all tracked xStocks on X Layer: market risk trend, factor breakdowns, anomaly alerts, and attestation health.",
  alternates: {
    canonical: "/dashboard",
  },
  openGraph: {
    title: "Risk Dashboard: XIRA",
    description:
      "Live XIRA risk scores for all tracked xStocks on X Layer: market risk trend, factor breakdowns, anomaly alerts, and attestation health.",
    url: "/dashboard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Risk Dashboard: XIRA",
    description:
      "Live XIRA risk scores for all tracked xStocks on X Layer: market risk trend, factor breakdowns, anomaly alerts, and attestation health.",
  },
};

export default function DashboardPage() {
  return <DashboardClient />;
}