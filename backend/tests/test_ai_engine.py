from __future__ import annotations
import pytest
from app.services.ai_engine import (
    score_momentum,
    score_volatility,
    score_sentiment,
    score_volume_anomaly,
    score_liquidity_proxy,
    ai_engine,
    risk_level_from_score,
)
from app.services.data_fetcher import PriceData, SentimentData


def _make_price_data(
    prices: list[float] | None = None,
    price: float = 100.0,
    change_24h: float = 0.0,
    change_7d: float = 0.0,
    volume: int = 50_000_000,
    avg_volume_20d: int = 50_000_000,
    high_52w: float = 120.0,
    low_52w: float = 80.0,
    market_cap: float = 10_000_000_000.0,
    source: str = "mock",
) -> PriceData:
    d = PriceData()
    d.daily_prices = prices if prices is not None else [100.0] * 21
    d.price = price
    d.change_24h = change_24h
    d.change_7d = change_7d
    d.volume = volume
    d.avg_volume_20d = avg_volume_20d
    d.high_52w = high_52w
    d.low_52w = low_52w
    d.market_cap = market_cap
    d.source = source
    return d


def test_momentum_polarity_bearish_is_high_risk():
    # Downward trending prices near 52w low
    bearish = _make_price_data(
        prices=[120.0, 115.0, 110.0, 105.0, 100.0, 95.0, 90.0, 85.0, 82.0, 81.0],
        price=81.0,
        change_24h=-5.0,
        high_52w=150.0,
        low_52w=80.0,
    )
    score, desc = score_momentum(bearish)
    assert score > 50, f"Bearish momentum should produce elevated risk, got {score}"
    assert "Bearish" in desc or "downside risk" in desc


def test_momentum_polarity_bullish_is_low_risk():
    # Upward trending prices near 52w high
    bullish = _make_price_data(
        prices=[80.0, 85.0, 90.0, 95.0, 100.0, 110.0, 120.0, 130.0, 140.0, 148.0],
        price=148.0,
        change_24h=5.0,
        high_52w=150.0,
        low_52w=80.0,
    )
    score, desc = score_momentum(bullish)
    assert score < 50, f"Bullish momentum should produce low risk, got {score}"
    assert "Bullish" in desc or "momentum risk subdued" in desc


def test_sentiment_polarity():
    neg_s = SentimentData()
    neg_s.score = -0.8
    score_neg, desc_neg = score_sentiment(None, neg_s)
    assert score_neg > 70, f"Negative sentiment should produce high risk score, got {score_neg}"

    pos_s = SentimentData()
    pos_s.score = 0.8
    score_pos, desc_pos = score_sentiment(None, pos_s)
    assert score_pos < 30, f"Positive sentiment should produce low risk score, got {score_pos}"


def test_volatility_polarity():
    # Flat daily prices = low volatility risk
    flat = _make_price_data(prices=[100.0] * 21)
    score_flat, _ = score_volatility(flat)
    assert score_flat <= 20

    # Wildly erratic prices = high volatility risk
    erratic_prices = [100.0 * (1.3 if i % 2 == 0 else 0.7) for i in range(21)]
    erratic = _make_price_data(prices=erratic_prices)
    score_erratic, _ = score_volatility(erratic)
    assert score_erratic >= 80


def test_volume_anomaly_polarity():
    # Normal volume = low risk
    normal = _make_price_data(volume=50_000_000, avg_volume_20d=50_000_000)
    score_norm, _ = score_volume_anomaly(normal)
    assert score_norm <= 30

    # Volume spike = high event risk
    spike = _make_price_data(volume=200_000_000, avg_volume_20d=50_000_000)
    score_spike, desc_spike = score_volume_anomaly(spike)
    assert score_spike >= 70
    assert "spike" in desc_spike.lower()

    # Thin volume = high liquidity risk
    thin = _make_price_data(volume=5_000_000, avg_volume_20d=50_000_000)
    score_thin, desc_thin = score_volume_anomaly(thin)
    assert score_thin >= 70
    assert "thin" in desc_thin.lower()


def test_liquidity_proxy_polarity():
    # Deep liquidity & large cap = low risk
    deep = _make_price_data(price=200.0, volume=100_000_000, market_cap=500_000_000_000)
    score_deep, _ = score_liquidity_proxy(deep)
    assert score_deep <= 25

    # Thin turnover = high risk
    illiquid = _make_price_data(price=5.0, volume=1_000_000, market_cap=50_000_000)
    score_illiquid, desc_illiquid = score_liquidity_proxy(illiquid)
    assert score_illiquid >= 70
    assert "Small market cap adds risk" in desc_illiquid


def test_anomaly_detection_fires_on_high_risk():
    # Erratic high-risk asset
    erratic_prices = [100.0 * (1.35 if i % 2 == 0 else 0.65) for i in range(21)]
    p = _make_price_data(
        prices=erratic_prices,
        volume=250_000_000,
        avg_volume_20d=50_000_000,
    )
    result = ai_engine.analyze(symbol="TESTx", price_data=p, sentiment=-0.8)
    assert result.anomaly is True
    assert "alert" in result.anomaly_reason.lower() or "risk factors" in result.anomaly_reason.lower()
    assert "Key risk:" in result.explanation
    assert "Most stable:" in result.explanation


def test_anomaly_does_not_fire_on_stable_asset():
    stable = _make_price_data(
        prices=[100.0] * 21,
        volume=50_000_000,
        avg_volume_20d=50_000_000,
        market_cap=100_000_000_000,
    )
    result = ai_engine.analyze(symbol="STABLEx", price_data=stable, sentiment=0.5)
    assert result.anomaly is False
    assert result.risk_score <= 35
    assert result.risk_level in ("LOW", "MODERATE")
