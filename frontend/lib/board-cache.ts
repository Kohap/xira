import { fetchAllAssets } from "./api";
import type { AllAssetsResponse } from "./types";

/**
 * Single shared board fetch for all landing components.
 *
 * LiveTicker, LiveBars, LiveHeatmap and ProofSection previously fired four
 * independent requests at the API on mount. This dedupes them into one
 * in-flight request (plus a short TTL cache), so a cold backend is hit once
 * instead of four times.
 */

let inFlight: Promise<AllAssetsResponse> | null = null;
let cached: AllAssetsResponse | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

export function fetchBoard(): Promise<AllAssetsResponse> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return Promise.resolve(cached);
  }
  if (!inFlight) {
    inFlight = fetchAllAssets()
      .then((data) => {
        cached = data;
        cachedAt = Date.now();
        return data;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function clearBoardCache(): void {
  cached = null;
  cachedAt = 0;
}
