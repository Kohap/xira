from __future__ import annotations
import time
from app.services.data_fetcher import (
    generate_mock_price_data,
    generate_mock_sentiment,
    get_tracked_assets,
)


def test_mock_price_data_deterministic():
    # Two calls in the same bucket must produce identical prices and volumes
    d1 = generate_mock_price_data("NVDA")
    d2 = generate_mock_price_data("NVDA")
    assert d1.price == d2.price
    assert d1.volume == d2.volume
    assert d1.daily_prices == d2.daily_prices
    assert d1.volume > 0
    assert d1.avg_volume_20d > 0


def test_mock_sentiment_deterministic():
    s1 = generate_mock_sentiment("TSLA")
    s2 = generate_mock_sentiment("TSLA")
    assert s1.score == s2.score
    assert -1.0 <= s1.score <= 1.0


def test_tracked_assets_count_and_fields():
    assets = get_tracked_assets()
    assert len(assets) >= 50
    for a in assets:
        assert "symbol" in a
        assert "underlying" in a
        assert "token_address" in a
        assert a["symbol"].endswith("x")
