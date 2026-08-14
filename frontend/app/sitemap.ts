import type { MetadataRoute } from "next";
import { ASSET_SYMBOLS, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

// Stable "content frozen at" date; do not regenerate per build so the
// sitemap output never churns between deploys.
const LAST_MODIFIED = new Date("2026-08-13T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const assetUrls: MetadataRoute.Sitemap = ASSET_SYMBOLS.map((symbol) => ({
    url: `${SITE_URL}/asset/${symbol}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: LAST_MODIFIED, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/dashboard`, lastModified: LAST_MODIFIED, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/alerts`, lastModified: LAST_MODIFIED, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/verify`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/docs`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/whitepaper`, lastModified: LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/brand`, lastModified: LAST_MODIFIED, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [...staticUrls, ...assetUrls];
}