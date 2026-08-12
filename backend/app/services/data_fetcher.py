from __future__ import annotations
import os, logging, time, random, re
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from functools import lru_cache
import yfinance as yf
import httpx

logger = logging.getLogger(__name__)

# Yahoo Finance now requires a proper User-Agent for API access.
YF_SESSION = None
try:
    import requests as _requests
    _session = _requests.Session()
    _session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
    })
    # Prevent connection-pool exhaustion under concurrent fetches.
    from urllib3.util import Retry
    adapter = _requests.adapters.HTTPAdapter(
        pool_connections=20, pool_maxsize=20, max_retries=Retry(total=1, backoff_factor=0.5)
    )
    _session.mount("https://", adapter)
    YF_SESSION = _session
except ImportError:
    pass

# In-memory cache for price data (5 minute TTL)
_price_cache: dict[str, tuple[PriceData, float]] = {}
CACHE_TTL = 300  # 5 minutes

TRACKED_ASSETS: list[dict] = [
    {"symbol": "NVDAx", "underlying": "NVDA", "sector": "Technology", "token_address": "0xc845b2894dbddd03858fd2d643b4ef725fe0849d"},
    {"symbol": "TSLAx", "underlying": "TSLA", "sector": "Consumer Cyclical", "token_address": "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0"},
    {"symbol": "AAPLx", "underlying": "AAPL", "sector": "Technology", "token_address": "0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a"},
    {"symbol": "MSFTx", "underlying": "MSFT", "sector": "Technology", "token_address": "0x5621737f42dae558b81269fcb9e9e70c19aa6b35"},
    {"symbol": "GOOGLx", "underlying": "GOOGL", "sector": "Communication", "token_address": "0xe92f673ca36c5e2efd2de7628f815f84807e803f"},
    {"symbol": "AMZNx", "underlying": "AMZN", "sector": "Consumer Cyclical", "token_address": "0x3557ba345b01efa20a1bddc61f573bfd87195081"},
    {"symbol": "METAx", "underlying": "META", "sector": "Communication", "token_address": "0x96702be57cd9777f835117a809c7124fe4ec989a"},
    {"symbol": "SPYx", "underlying": "SPY", "sector": "ETF", "token_address": "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48"},
    {"symbol": "QQQx", "underlying": "QQQ", "sector": "ETF", "token_address": "0xa753a7395cae905cd615da0b82a53e0560f250af"},
    {"symbol": "AMDx", "underlying": "AMD", "sector": "Technology", "token_address": "0x3522513e5f146a2006e2901b05f16b2821485e19"},
    {"symbol": "INTCx", "underlying": "INTC", "sector": "Technology", "token_address": "0xf8a80d1cb9cfd70d03d655d9df42339846f3b3c8"},
    {"symbol": "NFLXx", "underlying": "NFLX", "sector": "Communication", "token_address": "0xa6a65ac27e76cd53cb790473e4345c46e5ebf961"},
    {"symbol": "BAx", "underlying": "BA", "sector": "Industrials", "token_address": "0xDDdDddDdDdddDDddDDddDDDDdDdDDdDDdDDDDDDd"},
    {"symbol": "JPMx", "underlying": "JPM", "sector": "Financial", "token_address": "0xd9fc3e075d45254a1d834fea18af8041207dea0a"},
    {"symbol": "XOMx", "underlying": "XOM", "sector": "Energy", "token_address": "0xeedb0273c5af792745180e9ff568cd01550ffa13"},
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
    # Check cache first
    if ticker in _price_cache:
        cached_data, cached_time = _price_cache[ticker]
        if time.time() - cached_time < CACHE_TTL:
            logger.debug(f"Cache hit for {ticker}")
            return cached_data

    for attempt in range(2):  # 2 attempts with retry
        try:
            logger.info(f"Fetching live data for {ticker} (attempt {attempt + 1})...")
            time.sleep(2)  # space requests to avoid Yahoo rate-limiting on shared IPs
            stock = yf.Ticker(ticker, session=YF_SESSION)

            # Single history call with timeout
            history = stock.history(period="1mo", timeout=15)

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

            data.volume = int(history["Volume"].iloc[-1]) if "Volume" in history.columns else 0
            data.avg_volume_20d = (
                int(history["Volume"].tail(20).mean())
                if "Volume" in history.columns and len(history) >= 5
                else data.volume
            )

            data.high_52w = data.price * 1.3
            data.low_52w = data.price * 0.7
            data.market_cap = 0.0
            data.beta = 1.0
            data.pe_ratio = 0.0

            # Try to get additional info with shorter timeout (optional)
            try:
                info = stock.info
                data.high_52w = info.get("fiftyTwoWeekHigh", data.high_52w)
                data.low_52w = info.get("fiftyTwoWeekLow", data.low_52w)
                data.market_cap = info.get("marketCap", 0.0) or 0.0
                data.beta = info.get("beta", 1.0) or 1.0
            except Exception as e:
                logger.debug(f"Info fetch failed for {ticker}: {e}")

            # Cache the successful result
            _price_cache[ticker] = (data, time.time())
            logger.info(f"Successfully fetched and cached {ticker}")
            return data
        except Exception as e:
            logger.error(f"Error fetching {ticker} (attempt {attempt + 1}): {type(e).__name__}: {e}")
            if attempt == 0:
                time.sleep(1)  # Brief delay before retry
        
        # Return stale cache if available
        if ticker in _price_cache:
            cached_data, _ = _price_cache[ticker]
            logger.warning(f"Using stale cache for {ticker}")
            return cached_data
        return None


def fetch_news_sentiment(ticker: str) -> SentimentData:
    try:
        stock = yf.Ticker(ticker, session=YF_SESSION)
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

        with ThreadPoolExecutor(max_workers=1) as executor:
            futures = {executor.submit(fetch_price_data, t): t for t in tickers}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    data = future.result(timeout=25)
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
    use_live=os.getenv("USE_LIVE_DATA", "true").lower() == "true",
)
