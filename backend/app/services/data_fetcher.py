from __future__ import annotations
import os, logging, time, random, re
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

import yfinance as yf
import httpx

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


SENTIMENT_POSITIVE = re.compile(
    r"\b(beat|surge|jump|rally|soar|upgrade|buy|outperform|"
    r"strong|record|profit|growth|bullish|raised|positive|"
    r"gains|higher|boost|outlook|exceed)\b",
    re.IGNORECASE,
)
SENTIMENT_NEGATIVE = re.compile(
    r"\b(miss|plunge|drop|fall|downgrade|sell|underperform|"
    r"weak|decline|loss|bearish|cut|lowered|negative|"
    r"risk|warn|caution|concern|lawsuit|probe|investigation)\b",
    re.IGNORECASE,
)


class PriceData:
    __slots__ = ("price", "change_24h", "change_7d", "volume", "avg_volume_20d",
                 "high_52w", "low_52w", "daily_prices", "market_cap",
                 "beta", "pe_ratio", "source", "fetched_at")

    def __init__(self):
        self.price: float = 0.0
        self.change_24h: float = 0.0
        self.change_7d: float = 0.0
        self.volume: int = 0
        self.avg_volume_20d: int = 0
        self.high_52w: float = 0.0
        self.low_52w: float = 0.0
        self.daily_prices: list[float] = []
        self.market_cap: float = 0.0
        self.beta: float = 1.0
        self.pe_ratio: float = 0.0
        self.source: str = "mock"
        self.fetched_at: float = 0.0


class SentimentData:
    __slots__ = ("score", "headline_count", "positive_count", "negative_count",
                 "source", "summary")

    def __init__(self):
        self.score: float = 0.0
        self.headline_count: int = 0
        self.positive_count: int = 0
        self.negative_count: int = 0
        self.source: str = "proxy"
        self.summary: str = ""


def _extract_sentiment_from_headlines(headlines: list[str]) -> SentimentData:
    s = SentimentData()
    s.headline_count = len(headlines)
    for h in headlines:
        pos = len(SENTIMENT_POSITIVE.findall(h))
        neg = len(SENTIMENT_NEGATIVE.findall(h))
        s.positive_count += pos
        s.negative_count += neg

    total = s.positive_count + s.negative_count
    if total > 0:
        s.score = round((s.positive_count - s.negative_count) / total, 4)
    else:
        s.score = 0.0

    s.source = "headlines"
    if s.score > 0.3:
        s.summary = f"{s.positive_count} positive vs {s.negative_count} negative signals in {s.headline_count} headlines."
    elif s.score < -0.3:
        s.summary = f"{s.negative_count} negative vs {s.positive_count} positive signals in {s.headline_count} headlines."
    else:
        s.summary = f"Mixed signals in {s.headline_count} recent headlines."
    return s


def _derive_sentiment_from_price(price_data: PriceData) -> SentimentData:
    s = SentimentData()
    s.source = "price_proxy"
    closes = price_data.daily_prices
    if len(closes) >= 5:
        momentum = (closes[-1] - closes[-5]) / closes[-5]
        s.score = round(max(-1.0, min(1.0, momentum * 5)), 4)
        if s.score > 0.2:
            s.summary = "Derived from positive price momentum (proxy)."
        elif s.score < -0.2:
            s.summary = "Derived from negative price momentum (proxy)."
        else:
            s.summary = "Derived from flat price action (proxy)."
    s.headline_count = 0
    return s


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
        data.source = "yahoo"
        data.fetched_at = time.time()

        if len(closes) >= 2:
            data.change_24h = round(((closes[-1] - closes[-2]) / closes[-2]) * 100, 2)
        if len(closes) >= 6:
            data.change_7d = round(((closes[-1] - closes[-6]) / closes[-6]) * 100, 2)

        data.volume = info.get("volume", 0) or (
            int(history["Volume"].iloc[-1]) if "Volume" in history.columns else 0
        )
        data.avg_volume_20d = info.get("averageVolume", 0) or (
            int(history["Volume"].tail(20).mean())
            if "Volume" in history.columns and len(history) >= 5
            else data.volume
        )

        data.high_52w = info.get("fiftyTwoWeekHigh", data.price * 1.3)
        data.low_52w = info.get("fiftyTwoWeekLow", data.price * 0.7)
        data.market_cap = info.get("marketCap", 0.0) or 0.0
        data.beta = info.get("beta", 1.0) or 1.0
        data.pe_ratio = info.get("trailingPE", 0.0) or info.get("forwardPE", 0.0) or 0.0

        return data
    except Exception as e:
        logger.error(f"Error fetching {ticker}: {e}")
        return None


def fetch_news_sentiment(ticker: str) -> SentimentData:
    try:
        stock = yf.Ticker(ticker)
        news = stock.news
        if news and len(news) > 0:
            headlines = [
                item.get("content", {}).get("title", "")
                for item in news[:20]
                if item.get("content", {}).get("title")
            ]
            if headlines:
                return _extract_sentiment_from_headlines(headlines)
    except Exception as e:
        logger.warning(f"News fetch failed for {ticker}: {e}")

    return SentimentData()


def generate_mock_price_data(ticker: str) -> PriceData:
    base = random.gauss(150.0, 40.0)
    volatility = 0.025
    data = PriceData()
    data.daily_prices = [base * (1 + random.gauss(0, volatility)) for _ in range(21)]
    data.price = round(data.daily_prices[-1], 2)
    data.change_24h = round(random.gauss(0, 2.0), 2)
    data.change_7d = round(random.gauss(0, 4.0), 2)
    data.volume = int(random.gauss(50_000_000, 15_000_000))
    data.avg_volume_20d = int(data.volume * random.gauss(1.0, 0.15))
    data.high_52w = round(data.price * random.gauss(1.25, 0.10), 2)
    data.low_52w = round(data.price * random.gauss(0.75, 0.10), 2)
    data.market_cap = data.price * random.gauss(500_000_000, 200_000_000)
    data.source = "mock"
    data.fetched_at = time.time()
    return data


class DataFetcher:
    def __init__(self, use_live: bool = True):
        self.use_live = use_live

    def fetch_all_prices(self, tickers: list[str]) -> tuple[dict[str, Optional[PriceData]], float]:
        results: dict[str, Optional[PriceData]] = {}

        if not self.use_live:
            for t in tickers:
                results[t] = generate_mock_price_data(t)
            return results, time.time()

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(fetch_price_data, t): t for t in tickers}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    data = future.result(timeout=20)
                    if data is None:
                        logger.warning(f"Yahoo returned None for {ticker}, using mock")
                        data = generate_mock_price_data(ticker)
                    results[ticker] = data
                except Exception:
                    logger.error(f"Timeout/error for {ticker}, using mock")
                    results[ticker] = generate_mock_price_data(ticker)

        live_count = sum(1 for d in results.values() if d and d.source == "yahoo")
        logger.info(f"Price data: {live_count}/{len(tickers)} from Yahoo Finance (live)")

        return results, time.time()

    def fetch_all_sentiments(
        self, tickers: list[str], price_data: Optional[dict[str, Optional[PriceData]]] = None
    ) -> tuple[dict[str, SentimentData], float]:
        results: dict[str, SentimentData] = {}

        if not self.use_live:
            for t in tickers:
                s = SentimentData()
                s.score = round(random.gauss(0, 0.4), 4)
                s.source = "mock"
                s.summary = "Mock sentiment signal."
                results[t] = s
            return results, time.time()

        for ticker in tickers:
            sentiment = fetch_news_sentiment(ticker)
            if sentiment.headline_count == 0:
                pd = price_data.get(ticker) if price_data else None
                sentiment = _derive_sentiment_from_price(pd) if pd else SentimentData()
                if sentiment.source == "price_proxy":
                    sentiment.headline_count = 0
            results[ticker] = sentiment

        headline_count = sum(1 for s in results.values() if s.source == "headlines")
        logger.info(f"Sentiment: {headline_count}/{len(tickers)} from news headlines, rest from price proxy")

        return results, time.time()


data_fetcher = DataFetcher(
    use_live=os.getenv("USE_LIVE_DATA", "false").lower() == "true",
)
