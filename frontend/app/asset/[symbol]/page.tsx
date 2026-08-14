import type { Metadata } from "next";
import { ASSET_SYMBOLS } from "@/lib/seo";
import { AssetDetailClient } from "./client";

export function generateStaticParams() {
  return ASSET_SYMBOLS.map((symbol) => ({ symbol }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const canonical = `/asset/${symbol}`;
  const title = `${symbol} Risk Score & Factor Breakdown | XIRA`;
  const description = `${symbol}: the latest XIRA 0-100 risk score, five-factor breakdown, and on-chain attestations on X Layer Mainnet.`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function AssetDetailPage() {
  return <AssetDetailClient />;
}