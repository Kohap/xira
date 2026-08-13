import type {
  AllAssetsResponse,
  AssetDetail,
  Attestation,
  AttestationHistory,
  AlertsResponse,
  MarketStats,
  MarketHistoryResponse,
  VerifyResult,
  ThresholdsResponse,
  OnchainHistoryResponse,
} from "./types";

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export const API_BASE = normalizeBase(
  process.env.NEXT_PUBLIC_API_URL || "https://xira-api-production.up.railway.app"
);

export const API_KEY =
  process.env.NEXT_PUBLIC_XIRA_API_KEY || "";

const FETCH_TIMEOUT_MS = 25_000;

async function fetchJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "X-API-Key": API_KEY },
    });
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

export async function fetchOnchainHistory(
  symbol: string
): Promise<OnchainHistoryResponse> {
  return fetchJSON<OnchainHistoryResponse>(
    `${API_BASE}/api/assets/${encodeURIComponent(symbol)}/onchain-history`
  );
}

export async function fetchMarketHistory(
  hours = 24
): Promise<MarketHistoryResponse> {
  return fetchJSON<MarketHistoryResponse>(
    `${API_BASE}/api/assets/history?hours=${hours}`
  );
}

export async function fetchVerify(symbol: string): Promise<VerifyResult> {
  return fetchJSON<VerifyResult>(
    `${API_BASE}/api/assets/verify/${encodeURIComponent(symbol)}`
  );
}

export async function fetchThresholds(): Promise<ThresholdsResponse> {
  return fetchJSON<ThresholdsResponse>(`${API_BASE}/api/alerts/thresholds`);
}

export async function saveThreshold(
  symbol: string,
  threshold: number,
  enabled: boolean,
  adminToken = ""
): Promise<{ ok: boolean }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = adminToken.trim();
  if (token) headers["X-Admin-Token"] = token;

  const res = await fetch(`${API_BASE}/api/alerts/thresholds`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ symbol, threshold, enabled }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Threshold save failed (${res.status})${body ? " - " + body : ""}`);
  }
  return res.json();
}
