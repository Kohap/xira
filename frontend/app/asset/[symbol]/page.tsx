import type { Metadata } from "next";
import { AssetDetailClient } from "./client";

const SYMBOLS = [
  "NVDAx", "TSLAx", "AAPLx", "MSFTx", "GOOGLx", "AMZNx", "METAx",
  "SPYx", "QQQx", "AMDx", "INTCx", "NFLXx", "BAx", "JPMx", "XOMx",
];

export function generateStaticParams() {
  return SYMBOLS.map((symbol) => ({ symbol }));
}

export const metadata: Metadata = {
  title: "Asset Detail: XIRA",
};

export default function AssetDetailPage() {
  return <AssetDetailClient />;
}
