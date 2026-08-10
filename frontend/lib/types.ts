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
}

export interface AllAssetsResponse {
  generated_at: number;
  model_version: string;
  data_source: string;
  assets: Attestation[];
  summary: string;
}

export interface AttestationHistory {
  symbol: string;
  history: Attestation[];
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
