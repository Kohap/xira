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
