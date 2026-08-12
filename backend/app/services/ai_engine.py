from __future__ import annotations
import logging, math, time, hashlib, json

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
    "momentum": 0.25,
    "volatility": 0.20,
    "sentiment": 0.20,
    "volume_anomaly": 0.20,
    "liquidity_proxy": 0.15,
}


def _clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, v))


def score_momentum(price_data) -> tuple[int, str]:
    if price_data is None or len(price_data.daily_prices) < 5:
        return 50, "Insufficient price data for momentum calculation."

    closes = price_data.daily_prices
    price = closes[-1]

    if len(closes) >= 5:
        ma5 = sum(closes[-5:]) / 5
    else:
        ma5 = price

    if len(closes) >= 10:
        ma10 = sum(closes[-10:]) / 10
    else:
        ma10 = sum(closes) / len(closes)

    if ma10 <= 0:
        return 50, "Invalid price data."

    momentum_ratio = (ma5 / ma10) - 1.0
    pct_52 = ((price - price_data.low_52w) / (price_data.high_52w - price_data.low_52w)) * 100 if price_data.high_52w > price_data.low_52w else 50

    raw = 50 + (momentum_ratio * 400) + (pct_52 - 50) * 0.2
    score = int(round(_clamp(raw)))

    chg = price_data.change_24h
    chg7 = getattr(price_data, "change_7d", 0.0)

    if score <= 30:
        desc = f"Bearish: {chg:+.2f}% (24h), {chg7:+.2f}% (7d). Price near 52w low."
    elif score >= 70:
        desc = f"Bullish: {chg:+.2f}% (24h), {chg7:+.2f}% (7d). Price near 52w high."
    else:
        desc = f"Neutral: {chg:+.2f}% (24h), {chg7:+.2f}% (7d)."

    return score, desc


def score_volatility(price_data) -> tuple[int, str]:
    if price_data is None or len(price_data.daily_prices) < 5:
        return 50, "Insufficient data for volatility assessment."

    closes = price_data.daily_prices
    returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes)) if closes[i - 1] > 0]
    if not returns:
        return 50, "Cannot compute returns."

    mean_r = sum(returns) / len(returns)
    variance = sum((r - mean_r) ** 2 for r in returns) / len(returns)
    daily_vol = math.sqrt(variance)
    annual_vol = daily_vol * math.sqrt(252)

    if annual_vol < 0.15:
        score = 20
        desc = f"Low volatility ({annual_vol*100:.0f}% ann.). Stable price action."
    elif annual_vol < 0.30:
        score = 40
        desc = f"Normal volatility ({annual_vol*100:.0f}% ann.)."
    elif annual_vol < 0.50:
        score = 65
        desc = f"Elevated volatility ({annual_vol*100:.0f}% ann.). Price swings above normal."
    elif annual_vol < 0.80:
        score = 85
        desc = f"High volatility ({annual_vol*100:.0f}% ann.). Significantly erratic."
    else:
        score = 95
        desc = f"Extreme volatility ({annual_vol*100:.0f}% ann.). Highly speculative."

    return score, desc


def score_sentiment(price_data, sentiment) -> tuple[int, str]:
    s_val = sentiment.score if hasattr(sentiment, "score") else sentiment if isinstance(sentiment, (int, float)) else 0.0
    combined = s_val * 100
    score = int(round(_clamp(50 + combined)))

    src = getattr(sentiment, "source", "proxy") if hasattr(sentiment, "source") else "proxy"
    summary = getattr(sentiment, "summary", "") if hasattr(sentiment, "summary") else ""

    if summary:
        desc = f"[{src}] {summary}"
    elif score <= 30:
        desc = f"[{src}] Negative signals detected."
    elif score >= 70:
        desc = f"[{src}] Positive signals prevailing."
    else:
        desc = f"[{src}] Mixed or neutral signals."

    return score, desc


def score_volume_anomaly(price_data) -> tuple[int, str]:
    if price_data is None or price_data.avg_volume_20d <= 0:
        return 50, "Insufficient volume data."
    if price_data.volume <= 0:
        return 50, "No volume data."

    ratio = price_data.volume / price_data.avg_volume_20d
    vol_str = f"{price_data.volume:,.0f}"
    avg_str = f"{price_data.avg_volume_20d:,.0f}"

    if ratio > 3.0:
        score = int(min(100, 50 + (ratio - 1.0) * 20))
        desc = f"Volume spike {ratio:.1f}x avg ({vol_str} vs {avg_str}). Possible event."
    elif ratio > 2.0:
        score = int(50 + (ratio - 1.0) * 18)
        desc = f"Volume elevated {ratio:.1f}x avg ({vol_str} vs {avg_str})."
    elif ratio > 1.3:
        score = int(50 + (ratio - 1.0) * 10)
        desc = f"Volume slightly above avg ({vol_str} vs {avg_str})."
    elif ratio < 0.3:
        score = int(max(0, 50 - (1.0 - ratio) * 40))
        desc = f"Very thin volume {ratio:.2f}x avg. Liquidity concern."
    elif ratio < 0.6:
        score = int(50 - (1.0 - ratio) * 25)
        desc = f"Below-average volume {ratio:.2f}x avg."
    else:
        score = 50
        desc = "Volume within normal range."

    return score, desc


def score_liquidity_proxy(price_data) -> tuple[int, str]:
    if price_data is None or price_data.price <= 0 or price_data.volume <= 0:
        return 50, "Insufficient data for liquidity estimation."

    turnover = price_data.volume * price_data.price
    mcap = getattr(price_data, "market_cap", 0.0) or 0.0
    turnover_str = f"${turnover:,.0f}"

    if turnover < 100_000_000:
        score = 20
        desc = f"Low turnover ({turnover_str}). High slippage risk."
    elif turnover < 500_000_000:
        score = 40
        desc = f"Moderate turnover ({turnover_str}). Some slippage risk."
    elif turnover < 2_000_000_000:
        score = 60
        desc = f"Adequate turnover ({turnover_str}). Acceptable liquidity."
    elif turnover < 10_000_000_000:
        score = 80
        desc = f"High turnover ({turnover_str}). Strong liquidity."
    else:
        score = 95
        desc = f"Deep liquidity ({turnover_str}). Minimal slippage."

    if mcap > 0 and mcap < 2_000_000_000:
        score = min(score + 10, 100)

    return score, desc


def generate_explanation(
    symbol: str,
    risk_score: int,
    risk_level: RiskLevel,
    change_24h: float,
    factors: list[FactorScore],
    anomaly: bool,
    anomaly_reason: str,
    data_source: str,
) -> str:
    direction = "rose" if change_24h >= 0 else "fell"
    pct = abs(change_24h)
    level_label = risk_level.value.lower().replace("_", " ")

    base = f"{symbol} shows {level_label} risk (score {risk_score}/100)."
    if pct > 0.01:
        base += f" Underlying {direction} {pct:.1f}% in 24h."

    worst = min(factors, key=lambda f: f.score)
    best = max(factors, key=lambda f: f.score)
    base += f" Key risk: {worst.label.lower()} ({worst.score}/100)."
    base += f" Strength: {best.label.lower()} ({best.score}/100)."

    if anomaly and anomaly_reason:
        base += f" ALERT: {anomaly_reason}"

    src_label = "real-time" if data_source == "finnhub" else "simulated"
    base += f" Data: {src_label}."

    return base


def compute_evidence_hash(data: dict) -> str:
    raw = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


class AIEngine:
    def __init__(self, mode: str = "heuristic", openai_api_key: str = "", openai_model: str = "gpt-4o-mini"):
        self.mode = mode
        self.openai_api_key = openai_api_key
        self.openai_model = openai_model

    def analyze(
        self,
        symbol: str,
        price_data,
        sentiment,
        model_version: str,
    ) -> AttestationResponse:
        m_score, m_desc = score_momentum(price_data)
        v_score, v_desc = score_volatility(price_data)
        s_score, s_desc = score_sentiment(price_data, sentiment)
        vol_score, vol_desc = score_volume_anomaly(price_data)
        l_score, l_desc = score_liquidity_proxy(price_data)

        factors = [
            FactorScore(name="momentum", label="Momentum", score=m_score, weight=FACTOR_WEIGHTS["momentum"], description=m_desc),
            FactorScore(name="volatility", label="Volatility", score=v_score, weight=FACTOR_WEIGHTS["volatility"], description=v_desc),
            FactorScore(name="sentiment", label="Sentiment", score=s_score, weight=FACTOR_WEIGHTS["sentiment"], description=s_desc),
            FactorScore(name="volume_anomaly", label="Volume Anomaly", score=vol_score, weight=FACTOR_WEIGHTS["volume_anomaly"], description=vol_desc),
            FactorScore(name="liquidity_proxy", label="Liquidity", score=l_score, weight=FACTOR_WEIGHTS["liquidity_proxy"], description=l_desc),
        ]

        weighted = sum(f.score * f.weight for f in factors)
        risk_score = int(round(weighted))
        risk_level = risk_level_from_score(risk_score)

        low_scoring = [f for f in factors if f.score <= 25]
        critical_scoring = [f for f in factors if f.score <= 15]
        anomaly = len(critical_scoring) >= 1 or len(low_scoring) >= 2

        if anomaly and critical_scoring:
            anomaly_reason = f"Critical alert: {', '.join(f.name for f in critical_scoring)} at critically low levels."
        elif anomaly and low_scoring:
            anomaly_reason = f"Alert on {', '.join(f.name for f in low_scoring)}: scores concerning."
        elif anomaly:
            anomaly_reason = "Multiple risk factors indicate elevated uncertainty."
        else:
            anomaly_reason = ""

        healthy = len([f for f in factors if f.score >= 50])
        confidence = int(round(40 + healthy * 10 + (80 - risk_score) * 0.15))
        confidence = int(_clamp(confidence, 30, 100))

        data_source = getattr(price_data, "source", "mock") if price_data else "mock"
        freshness = int((time.time() - getattr(price_data, "fetched_at", time.time())) * 1000) if price_data else 0

        change_24h = price_data.change_24h if price_data else 0.0
        explanation = generate_explanation(
            symbol, risk_score, risk_level, change_24h, factors, anomaly, anomaly_reason, data_source
        )

        evidence_data = {
            "symbol": symbol,
            "score": risk_score,
            "confidence": confidence,
            "factors": [f.model_dump() for f in factors],
            "data_source": data_source,
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
            data_source=data_source,
            data_freshness_ms=freshness,
        )


ai_engine = AIEngine(mode="heuristic")
