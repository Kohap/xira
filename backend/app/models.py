from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FactorScore(BaseModel):
    name: str
    label: str
    score: int = Field(ge=0, le=100)
    weight: float = Field(ge=0.0, le=1.0)
    description: str


class AttestationResponse(BaseModel):
    symbol: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    confidence: int = Field(ge=0, le=100)
    factors: list[FactorScore]
    explanation: str
    anomaly: bool
    anomaly_reason: str = ""
    evidence_hash: str
    timestamp: int
    model_version: str
    data_source: str = "mock"
    data_freshness_ms: int = 0
    chain_tx: Optional[str] = None
    chain_explorer: Optional[str] = None
    chain_block: Optional[int] = None
    chain_id: Optional[int] = None


class AttestationHistory(BaseModel):
    symbol: str
    history: list[AttestationResponse]


class AllAssetsResponse(BaseModel):
    generated_at: int
    model_version: str
    data_source: str = "mock"
    assets: list[AttestationResponse]
    summary: str


class AssetMetadata(BaseModel):
    symbol: str
    token_address: str
    underlying: str
    sector: str


class HealthResponse(BaseModel):
    status: str
    version: str
    chain: str
    contract: str
    tracked_assets: int
    live_data: bool = False
