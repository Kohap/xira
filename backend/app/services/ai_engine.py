from __future__ import annotations
import logging, math, random
from typing import Optional

from app.models import FactorScore, RiskLevel, AttestationResponse

logger = logging.getLogger(__name__)


def risk_level_from_score(score: int) -> RiskLevel:
    if score <= 20:
        return RiskLevel.LOW
    elif score <= 40:
        return RiskLevel.MODERATE
    elif score <= 60:
        return RiskLevel.ELEVATED
    elif score <= 80:
        return RiskLevel.HIGH
    return RiskLevel.CRITICAL


FACTOR_WEIGHTS = {
    "momentum": 0.30,
    "sentiment": 0.25,
    "volume_anomaly": 0.25,
    "liquidity_proxy": 0.20,
}


def score_momentum(price_data) -> tuple[int, str]:
    if price_data is None or len(price_data.daily_prices) < 5:
        return 50, "Insufficient price data for momentum calculation."

    closes = price_data.daily_prices
    if len(closes) == 0:
        return 50, "No price data available."

    ma_short = sum(closes[-5:]) / min(5, len(closes)) if len(closes) >= 5 else closes[-1]
    ma_long = sum(closes) / len(closes)
    price = closes[-1]

    if ma_short <= 0 or ma_long <= 0:
        return 50, "Invalid price data for momentum."

    momentum_ratio = (ma_short / ma_long) - 1.0
    percentile = position_in_range(price, price_data.low_52w, price_data.high_52w)

    raw = (momentum_ratio * 300) + (percentile - 50) * 0.3
    clamped = max(0, min(100, 50 + raw))
    score = int(round(clamped))

    if score <= 30:
        desc = f"Bearish momentum: {price_data.change_24h:+.2f}% 24h, price near lower range."
    elif score >= 70:
        desc = f"Bullish momentum: {price_data.change_24h:+.2f}% 24h, price near upper range."
    else:
        desc = f"Neutral momentum: {price_data.change_24h:+.2f}% 24h change."

    return score, desc


def position_in_range(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 50.0
    pct = ((value - lo) / (hi - lo)) * 100.0
    return max(0.0, min(100.0, pct))


def score_sentiment(price_data, sentiment: float) -> tuple[int, str]:
    combined = sentiment * 100
    score = int(round(max(0, min(100, 50 + combined))))

    if score <= 30:
        desc = "Negative sentiment signals detected across news sources."
    elif score >= 70:
        desc = "Positive sentiment prevailing in recent coverage."
    else:
        desc = "Mixed or neutral sentiment signals."

    return score, desc


def score_volume_anomaly(price_data) -> tuple[int, str]:
    if price_data is None or price_data.avg_volume_20d <= 0:
        return 50, "Insufficient volume data."

    if price_data.volume <= 0:
        return 50, "No volume data."

    ratio = price_data.volume / price_data.avg_volume_20d

    if ratio > 2.5:
        score = int(min(100, 50 + (ratio - 1.0) * 25))
        desc = f"Volume spike: {ratio:.1f}x average. Possible unusual activity."
    elif ratio > 1.5:
        score = int(50 + (ratio - 1.0) * 15)
        desc = f"Above-average volume: {ratio:.1f}x. Elevated attention."
    elif ratio < 0.3:
        score = int(max(0, 50 - (1.0 - ratio) * 30))
        desc = f"Very low volume: {ratio:.2f}x average. Low liquidity concern."
    elif ratio < 0.6:
        score = int(50 - (1.0 - ratio) * 20)
        desc = f"Below-average volume: {ratio:.2f}x average."
    else:
        score = 50
        desc = "Volume within normal range."

    return score, desc


def score_liquidity_proxy(price_data) -> tuple[int, str]:
    if price_data is None or price_data.price <= 0 or price_data.volume <= 0:
        return 50, "Insufficient data for liquidity estimation."

    turnover = price_data.volume * price_data.price
    if turnover < 100_000_000:
        score = 20
        desc = "Very low dollar turnover. High slippage risk."
    elif turnover < 500_000_000:
        score = 40
        desc = "Low dollar turnover. Moderate slippage risk."
    elif turnover < 2_000_000_000:
        score = 60
        desc = "Adequate dollar turnover. Acceptable liquidity."
    elif turnover < 10_000_000_000:
        score = 80
        desc = "High dollar turnover. Strong liquidity."
    else:
        score = 95
        desc = "Very deep liquidity. Minimal slippage expected."

    return score, desc


def generate_explanation(
    symbol: str,
    risk_score: int,
    risk_level: RiskLevel,
    change_24h: float,
    factors: list[FactorScore],
    anomaly: bool,
    anomaly_reason: str,
) -> str:
    direction = "gained" if change_24h >= 0 else "lost"
    pct = abs(change_24h)
    level_label = risk_level.value.lower().replace("_", " ")

    base = f"{symbol} shows {level_label} risk (score {risk_score}/100)."
    base += f" The underlying {direction} {pct:.1f}% in the last 24h."

    worst = min(factors, key=lambda f: f.score)
    best = max(factors, key=lambda f: f.score)
    base += f" Key concern: {worst.label.lower()} ({worst.score}/100)."
    base += f" Strength: {best.label.lower()} ({best.score}/100)."

    if anomaly and anomaly_reason:
        base += f" ALERT: {anomaly_reason}"

    return base


class AIEngine:
    def __init__(self, mode: str = "heuristic", openai_api_key: str = "", openai_model: str = "gpt-4o-mini"):
        self.mode = mode
        self.openai_api_key = openai_api_key
        self.openai_model = openai_model

    def analyze(
        self,
        symbol: str,
        price_data,
        sentiment: float,
        model_version: str,
    ) -> AttestationResponse:
        m_score, m_desc = score_momentum(price_data)
        s_score, s_desc = score_sentiment(price_data, sentiment)
        v_score, v_desc = score_volume_anomaly(price_data)
        l_score, l_desc = score_liquidity_proxy(price_data)

        factors = [
            FactorScore(name="momentum", label="Momentum", score=m_score, weight=FACTOR_WEIGHTS["momentum"], description=m_desc),
            FactorScore(name="sentiment", label="Sentiment", score=s_score, weight=FACTOR_WEIGHTS["sentiment"], description=s_desc),
            FactorScore(name="volume_anomaly", label="Volume Anomaly", score=v_score, weight=FACTOR_WEIGHTS["volume_anomaly"], description=v_desc),
            FactorScore(name="liquidity_proxy", label="Liquidity Proxy", score=l_score, weight=FACTOR_WEIGHTS["liquidity_proxy"], description=l_desc),
        ]

        weighted = sum(f.score * f.weight for f in factors)
        risk_score = int(round(weighted))
        risk_level = risk_level_from_score(risk_score)

        low_scoring = [f for f in factors if f.score <= 30]
        anomaly = any(f.score <= 20 for f in factors)
        if anomaly and low_scoring:
            anomaly_reason = f"Alert on {', '.join(f.name for f in low_scoring)} — scores critically low."
        elif anomaly:
            anomaly_reason = "Multiple risk factors indicate elevated uncertainty."
        else:
            anomaly_reason = ""

        confidence = int(round(50 + (30 * (1.0 - (len(low_scoring) / len(factors))) + 20 * (1.0 if price_data else 0))))

        change_24h = price_data.change_24h if price_data else 0.0
        explanation = generate_explanation(symbol, risk_score, risk_level, change_24h, factors, anomaly, anomaly_reason)

        evidence_data = {
            "symbol": symbol,
            "score": risk_score,
            "confidence": confidence,
            "factors": [f.model_dump() for f in factors],
            "timestamp": 0,
        }
        evidence_hash = compute_evidence_hash(evidence_data)

        return AttestationResponse(
            symbol=symbol,
            risk_score=risk_score,
            risk_level=risk_level,
            confidence=confidence,
            factors=factors,
            explanation=explanation,
            anomaly=anomaly,
            anomaly_reason=anomaly_reason,
            evidence_hash=evidence_hash,
            timestamp=0,
            model_version=model_version,
        )


def compute_evidence_hash(data: dict) -> str:
    import json, hashlib
    raw = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


ai_engine = AIEngine(
    mode="heuristic",
)
