import type { Metadata } from "next";
import VerifyClient from "./client";

export const metadata: Metadata = {
  title: "Verify Attestations: XIRA",
  description:
    "Check a XIRA attestation on-chain: paste a transaction hash from X Layer and verify the signed score, model version, and inputs.",
  alternates: {
    canonical: "/verify",
  },
  openGraph: {
    title: "Verify Attestations: XIRA",
    description:
      "Check a XIRA attestation on-chain: paste a transaction hash from X Layer and verify the signed score, model version, and inputs.",
    url: "/verify",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verify Attestations: XIRA",
    description:
      "Check a XIRA attestation on-chain: paste a transaction hash from X Layer and verify the signed score, model version, and inputs.",
  },
};

export default function VerifyPage() {
  return <VerifyClient />;
}