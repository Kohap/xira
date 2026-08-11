import type {
  AllAssetsResponse,
  AssetDetail,
  Attestation,
  AttestationHistory,
  AlertsResponse,
  MarketStats,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://xira-gsb3.onrender.com";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
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