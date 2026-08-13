import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE_URL = "https://www.xira.surf";

const ASSET_SYMBOLS = [
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
];

export default function sitemap(): MetadataRoute.Sitemap {
  const assetUrls: MetadataRoute.Sitemap = ASSET_SYMBOLS.map((symbol) => ({
    url: `${BASE_URL}/asset/${symbol}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/dashboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/alerts`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/verify`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/whitepaper`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...assetUrls,
  ];
}
