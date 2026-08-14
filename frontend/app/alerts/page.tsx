import type { Metadata } from "next";
import AlertsClient from "./client";

export const metadata: Metadata = {
  title: "Anomaly Alerts: XIRA",
  description:
    "Threshold alerts on XIRA risk scores for every tracked xStock: set your own score deltas and see which assets moved on X Layer.",
  alternates: {
    canonical: "/alerts",
  },
  openGraph: {
    title: "Anomaly Alerts: XIRA",
    description:
      "Threshold alerts on XIRA risk scores for every tracked xStock: set your own score deltas and see which assets moved on X Layer.",
    url: "/alerts",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anomaly Alerts: XIRA",
    description:
      "Threshold alerts on XIRA risk scores for every tracked xStock: set your own score deltas and see which assets moved on X Layer.",
  },
};

export default function AlertsPage() {
  return <AlertsClient />;
}