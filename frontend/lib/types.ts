export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface FactorScore {
  name: string;
  label: string;
  score: number;
  weight: number;
  description: string;
}

export interface Attestation {
  symbol: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  factors: FactorScore[];
  explanation: string;
  anomaly: boolean;
  anomaly_reason: string;
  evidence_hash: string;
  timestamp: number;
  model_version: string;
  data_source: string;
  data_freshness_ms: number;
  chain_tx?: string;
  chain_explorer?: string;
  chain_block?: number;
  onchain_verified?: boolean;
  previous_score?: number | null;
  score_delta?: number | null;
}

export interface MarketHistoryPoint {
  ts: number;
  avg_score: number;
  count: number;
}

export interface MarketHistoryResponse {
  generated_at: number;
  hours: number;
  points: MarketHistoryPoint[];
}

export interface VerifyResult {
  symbol: string;
  contract: string;
  chain_id: number;
  api: {
    symbol: string;
    risk_score: number;
    confidence: number;
    evidence_hash: string;
    timestamp: number;
    anomaly: boolean;
  } | null;
  onchain: {
    score: number;
    confidence: number;
    evidence_hash: string;
    timestamp: number;
    model_version: string;
    anomaly: boolean;
  } | null;
  match: {
    score_matches: boolean;
    hash_matches: boolean;
    time_matches?: boolean;
    verified: boolean;
  } | null;
  checked_at: number;
}

export interface ThresholdsResponse {
  thresholds: Record<string, { threshold: number; enabled: boolean }>;
}

export interface OnchainHistoryEntry {
  score: number;
  confidence: number;
  evidence_hash: string;
  timestamp: number;
  model_version: string;
  anomaly: boolean;
}

export interface OnchainHistoryResponse {
  symbol: string;
  contract: string;
  chain_id: number;
  history: OnchainHistoryEntry[];
  count: number;
}

export interface AllAssetsResponse {
  generated_at: number;
  model_version: string;
  data_source: string;
  assets: Attestation[];
  summary: string;
  contract_address?: string;
  chain_id?: number;
}

export interface AttestationHistory {
  symbol: string;
  history: Attestation[];
}

export interface AlertItem {
  symbol: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  anomaly_reason: string;
  timestamp: number;
  model_version: string;
  data_source: string;
}

export interface AlertsResponse {
  generated_at: number;
  model_version: string;
  data_source: string;
  total_alerts: number;
  alerts: AlertItem[];
}

export interface MarketStats {
  generated_at: number;
  model_version: string;
  data_source: string;
  cache_age_ms: number;
  total_assets: number;
  average_score: number;
  distribution: Record<string, number>;
  anomalies: number;
  best?: { symbol: string; score: number };
  worst?: { symbol: string; score: number };
}

export interface AssetDetail {
  symbol: string;
  underlying: string;
  sector: string;
  token_address: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  change_24h: number;
  score_delta_24h: number | null;
  factors: FactorScore[];
  explanation: string;
  anomaly: boolean;
  anomaly_reason: string;
  evidence_hash: string;
  timestamp: number;
  model_version: string;
  data_source: string;
  data_freshness_ms: number;
}

export interface RescoreResponse {
  symbol: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  factors: FactorScore[];
  explanation: string;
  anomaly: boolean;
  anomaly_reason: string;
  evidence_hash: string;
  timestamp: number;
  model_version: string;
  data_source: string;
  data_freshness_ms: number;
  previous_score: number | null;
  score_delta: number | null;
  chain_tx: string | null;
  chain_explorer: string | null;
  published: boolean;
  reason: string;
}

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "LOW":
      return "bg-[var(--risk-low)]";
    case "MODERATE":
      return "bg-[var(--risk-moderate)]";
    case "ELEVATED":
      return "bg-[var(--risk-elevated)]";
    case "HIGH":
      return "bg-[var(--risk-high)]";
    case "CRITICAL":
      return "bg-[var(--risk-critical)]";
  }
}

export function riskLevelTextColor(level: RiskLevel): string {
  switch (level) {
    case "LOW":
      return "text-green-400";
    case "MODERATE":
      return "text-yellow-400";
    case "ELEVATED":
      return "text-orange-400";
    case "HIGH":
      return "text-red-400";
    case "CRITICAL":
      return "text-red-500";
  }
}

export function riskLevelLabel(level: RiskLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

export function scoreRiskLevel(score: number): RiskLevel {
  if (score <= 20) return "LOW";
  if (score <= 40) return "MODERATE";
  if (score <= 60) return "ELEVATED";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

export function scoreColor(score: number): string {
  return riskLevelColor(scoreRiskLevel(score));
}

export function scoreTextColor(score: number): string {
  return riskLevelTextColor(scoreRiskLevel(score));
}

export function formatAge(timestampSeconds: number, nowSeconds?: number): string {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestampSeconds);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function severityOf(score: number, anomaly: boolean): { label: string; badgeClass: string } {
  if (score >= 80 || (anomaly && score >= 60)) {
    return { label: "Critical", badgeClass: "bg-red-500/15 text-red-400 border-red-500/30" };
  }
  if (score >= 60 || anomaly) {
    return { label: "Elevated", badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
  }
  if (score >= 40) {
    return { label: "Moderate", badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
  }
  return { label: "Low", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
}
