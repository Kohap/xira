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


# Canonical data_source vocabulary exposed by the API. Internally the
# engines track concrete providers (yahoo, finnhub, mock, ...) and keep
# them inside evidence hashes for on-chain stability; only the public
# value is normalized to this enum.
LIVE_SOURCES = frozenset({"finnhub", "yahoo", "onchain"})
MOCK_SOURCES = frozenset({"mock", "gauss", "simulated", ""})


def normalize_data_source(source: str | None) -> str:
    """Map a provider source to the public enum: live | partial | mock."""
    key = (source or "").strip().lower()
    if key in LIVE_SOURCES:
        return "live"
    if key in MOCK_SOURCES:
        return "mock"
    # Unknown providers (e.g. a future feed) are still real data.
    return "live" if key else "mock"


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
    onchain_verified: bool = False
    previous_score: Optional[int] = None
    score_delta: Optional[int] = None


class AttestationHistory(BaseModel):
    symbol: str
    history: list[AttestationResponse]


class RescoreResponse(AttestationResponse):
    published: bool = False
    reason: str = ""


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
    signer: Optional[str] = None
    scheduler: Optional[dict] = None
    last_publish_error: Optional[str] = None
    publisher: Optional[dict] = None
    scheduler_stalled: bool = False
    publish_failing: bool = False
    publish_stale: bool = False


class AssetDetailResponse(BaseModel):
    symbol: str
    underlying: str
    sector: str
    token_address: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    confidence: int = Field(ge=0, le=100)
    change_24h: float = 0.0
    score_delta_24h: Optional[int] = None
    factors: list[FactorScore]
    explanation: str
    anomaly: bool
    anomaly_reason: str = ""
    evidence_hash: str
    timestamp: int
    model_version: str
    data_source: str = "mock"
    data_freshness_ms: int = 0


class AlertItem(BaseModel):
    symbol: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    confidence: int = Field(ge=0, le=100)
    anomaly_reason: str
    timestamp: int
    model_version: str
    data_source: str = "mock"


class AlertsResponse(BaseModel):
    generated_at: int
    model_version: str
    data_source: str = "mock"
    total_alerts: int
    alerts: list[AlertItem]


class MarketStatsResponse(BaseModel):
    generated_at: int
    model_version: str
    data_source: str = "mock"
    cache_age_ms: int = 0
    total_assets: int
    average_score: float
    distribution: dict[str, int]
    anomalies: int
    best: Optional[dict] = None
    worst: Optional[dict] = None


class MarketHistoryPoint(BaseModel):
    ts: int
    avg_score: float
    count: int


class MarketHistoryResponse(BaseModel):
    generated_at: int
    hours: int
    points: list[MarketHistoryPoint]
