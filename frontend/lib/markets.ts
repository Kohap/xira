export const TRACKED_SYMBOLS = [
  "NVDAx",
  "TSLAx",
  "AAPLx",
  "MSFTx",
  "GOOGLx",
  "AMZNx",
  "METAx",
  "SPYx",
  "QQQx",
  "AMDx",
  "INTCx",
  "NFLXx",
  "BAx",
  "JPMx",
  "XOMx",
] as const;

export const SECTOR_MAP: Record<string, string> = {
  NVDAx: "Technology",
  TSLAx: "Consumer Cyclical",
  AAPLx: "Technology",
  MSFTx: "Technology",
  GOOGLx: "Communication",
  AMZNx: "Consumer Cyclical",
  METAx: "Communication",
  SPYx: "ETF",
  QQQx: "ETF",
  AMDx: "Technology",
  INTCx: "Technology",
  NFLXx: "Communication",
  BAx: "Industrials",
  JPMx: "Financial",
  XOMx: "Energy",
};

const TRACKED_SET = new Set<string>(TRACKED_SYMBOLS);

export function trackedAssets<T extends { symbol: string }>(assets: T[]): T[] {
  return assets.filter((a) => TRACKED_SET.has(a.symbol));
}