from __future__ import annotations
import os, hashlib, json, time, logging, random
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf
import httpx

from app.models import AssetMetadata

logger = logging.getLogger(__name__)

TRACKED_ASSETS: list[dict] = [
    {"symbol": "NVDAx", "underlying": "NVDA", "sector": "Technology", "token_address": "0xADDRESS_NVDAx"},
    {"symbol": "TSLAx", "underlying": "TSLA", "sector": "Consumer Cyclical", "token_address": "0xADDRESS_TSLAx"},
    {"symbol": "AAPLx", "underlying": "AAPL", "sector": "Technology", "token_address": "0xADDRESS_AAPLx"},
    {"symbol": "MSFTx", "underlying": "MSFT", "sector": "Technology", "token_address": "0xADDRESS_MSFTx"},
    {"symbol": "GOOGLx", "underlying": "GOOGL", "sector": "Communication", "token_address": "0xADDRESS_GOOGLx"},
    {"symbol": "AMZNx", "underlying": "AMZN", "sector": "Consumer Cyclical", "token_address": "0xADDRESS_AMZNx"},
    {"symbol": "METAx", "underlying": "META", "sector": "Communication", "token_address": "0xADDRESS_METAx"},
    {"symbol": "SPYx", "underlying": "SPY", "sector": "ETF", "token_address": "0xADDRESS_SPYx"},
    {"symbol": "QQQx", "underlying": "QQQ", "sector": "ETF", "token_address": "0xADDRESS_QQQx"},
    {"symbol": "AMDx", "underlying": "AMD", "sector": "Technology", "token_address": "0xADDRESS_AMDx"},
    {"symbol": "INTCx", "underlying": "INTC", "sector": "Technology", "token_address": "0xADDRESS_INTCx"},
    {"symbol": "NFLXx", "underlying": "NFLX", "sector": "Communication", "token_address": "0xADDRESS_NFLXx"},
    {"symbol": "BAx", "underlying": "BA", "sector": "Industrials", "token_address": "0xADDRESS_BAx"},
    {"symbol": "JPMx", "underlying": "JPM", "sector": "Financial", "token_address": "0xADDRESS_JPMx"},
    {"symbol": "XOMx", "underlying": "XOM", "sector": "Energy", "token_address": "0xADDRESS_XOMx"},
]


def get_tracked_symbols() -> list[str]:
    return [a["symbol"] for a in TRACKED_ASSETS]


def get_tracked_assets() -> list[dict]:
    return TRACKED_ASSETS


def get_underlying_tickers() -> list[str]:
    return [a["underlying"] for a in TRACKED_ASSETS]


class PriceData:
    def __init__(self):
        self.price: float = 0.0
        self.change_24h: float = 0.0
        self.volume: int = 0
        self.avg_volume_20d: int = 0
        self.high_52w: float = 0.0
        self.low_52w: float = 0.0
        self.daily_prices: list[float] = []

    def to_dict(self) -> dict:
        return {
            "price": round(self.price, 2),
            "change_24h_pct": round(self.change_24h, 2),
            "volume": self.volume,
            "avg_volume_20d": self.avg_volume_20d,
            "high_52w": round(self.high_52w, 2),
            "low_52w": round(self.low_52w, 2),
        }


def fetch_price_data(ticker: str) -> Optional[PriceData]:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        history = stock.history(period="1mo")

        if history.empty:
            logger.warning(f"No price history for {ticker}")
            return None

        data = PriceData()
        data.daily_prices = history["Close"].tolist()
        closes = data.daily_prices

        data.price = round(closes[-1], 2) if closes else 0.0

        if len(closes) >= 2:
            data.change_24h = round(((closes[-1] - closes[-2]) / closes[-2]) * 100, 2)
        else:
            data.change_24h = 0.0

        data.volume = info.get("volume", 0) or int(history["Volume"].iloc[-1]) if "Volume" in history.columns else 0
        data.avg_volume_20d = info.get("averageVolume", 0) or (
            int(history["Volume"].tail(20).mean()) if "Volume" in history.columns and len(history) >= 5 else data.volume
        )

        data.high_52w = info.get("fiftyTwoWeekHigh", data.price * 1.3)
        data.low_52w = info.get("fiftyTwoWeekLow", data.price * 0.7)

        return data
    except Exception as e:
        logger.error(f"Error fetching {ticker}: {e}")
        return None


def generate_mock_price_data(ticker: str) -> PriceData:
    base = random.gauss(150.0, 40.0)
    volatility = 0.025
    data = PriceData()
    data.daily_prices = [base * (1 + random.gauss(0, volatility)) for _ in range(21)]
    data.price = round(data.daily_prices[-1], 2)
    data.change_24h = round(random.gauss(0, 2.0), 2)
    data.volume = int(random.gauss(50_000_000, 15_000_000))
    data.avg_volume_20d = int(data.volume * random.gauss(1.0, 0.15))
    data.high_52w = round(data.price * random.gauss(1.25, 0.10), 2)
    data.low_52w = round(data.price * random.gauss(0.75, 0.10), 2)
    return data


def generate_mock_sentiment() -> float:
    return round(random.gauss(0, 0.4), 4)


class DataFetcher:
    def __init__(self, use_mock: bool = True):
        self.use_mock = use_mock

    def fetch_all_prices(self, tickers: list[str]) -> dict[str, Optional[PriceData]]:
        results: dict[str, Optional[PriceData]] = {}

        if self.use_mock:
            for t in tickers:
                results[t] = generate_mock_price_data(t)
            return results

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(fetch_price_data, t): t for t in tickers}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    results[ticker] = future.result(timeout=15)
                except Exception:
                    logger.error(f"Timeout/error for {ticker}")
                    results[ticker] = generate_mock_price_data(ticker)

        return results

    def fetch_all_sentiments(self, tickers: list[str]) -> dict[str, float]:
        results: dict[str, float] = {}
        for t in tickers:
            results[t] = generate_mock_sentiment()
        return results


data_fetcher = DataFetcher(use_mock=os.getenv("USE_LIVE_DATA", "false").lower() != "true")
