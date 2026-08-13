import type { Metadata } from "next";
import { AssetDetailClient } from "./client";

// Mirrors the enabled assets in catalogs/asset_catalog.json (50).
const SYMBOLS = [
  "SNDKx", "SPCXx", "MUx", "SOXLx", "LITEx", "MRVLx", "SKHYx", "INTCx",
  "MSTRx", "AAPLx", "GOOGLx", "CRCLx", "NBISx", "PLx", "TSLAx", "METAx",
  "NVDAx", "EWYx", "AMDx", "COINx", "ORCLx", "ONDSx", "DELLx", "CSCOx",
  "CRWVx", "HIMSx", "PLTRx", "TSMx", "QQQx", "HOODx", "AMZNx", "SPYx",
  "MSFTx", "ARMx", "RKLBx", "ASTSx", "AVGOx", "CBRSx", "TQQQx", "ADBEx",
  "IRENx", "AAOIx", "ASMLx", "IBMx", "XLEx", "NFLXx", "BMNRx", "TERx",
  "USARx", "GMEx",
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
