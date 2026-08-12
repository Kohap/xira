import type {
  AllAssetsResponse,
  AssetDetail,
  Attestation,
  AttestationHistory,
  AlertsResponse,
  MarketStats,
  MarketHistoryResponse,
} from "./types";

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export const API_BASE = normalizeBase(
  process.env.NEXT_PUBLIC_API_URL || "https://xira-gsb3.onrender.com"
);

const FETCH_TIMEOUT_MS = 25_000;

async function fetchJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAllAssets(): Promise<AllAssetsResponse> {
  return fetchJSON<AllAssetsResponse>(`${API_BASE}/api/assets/all`);
}

export async function fetchAttestation(symbol: string): Promise<Attestation> {
  return fetchJSON<Attestation>(`${API_BASE}/api/attestations/${symbol}`);
}

export async function fetchAttestationHistory(
  symbol: string,
  limit = 10
): Promise<AttestationHistory> {
  return fetchJSON<AttestationHistory>(
    `${API_BASE}/api/attestations/${symbol}/history?limit=${limit}`
  );
}

export async function fetchAlerts(): Promise<AlertsResponse> {
  return fetchJSON<AlertsResponse>(`${API_BASE}/api/alerts`);
}

export async function fetchStats(): Promise<MarketStats> {
  return fetchJSON<MarketStats>(`${API_BASE}/api/assets/stats`);
}

export async function fetchAssetDetail(symbol: string): Promise<AssetDetail> {
  return fetchJSON<AssetDetail>(
    `${API_BASE}/api/assets/${encodeURIComponent(symbol)}`
  );
}

export async function fetchMarketHistory(
  hours = 24
): Promise<MarketHistoryResponse> {
  return fetchJSON<MarketHistoryResponse>(
    `${API_BASE}/api/assets/history?hours=${hours}`
  );
}