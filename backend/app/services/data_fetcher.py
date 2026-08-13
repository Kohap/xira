from __future__ import annotations
import os, logging, time, random, re
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import httpx

logger = logging.getLogger(__name__)

# Finnhub free tier: 60 req/min, quote + candles + company profile + news.
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
FINNHUB_BASE = "https://finnhub.io/api/v1"

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


def _fetch_finnhub_quote(ticker: str) -> Optional[dict]:
    """Fetch real-time quote from Finnhub. Returns dict or None."""
    if not FINNHUB_KEY:
        return None
    try:
        url = f"{FINNHUB_BASE}/quote?symbol={ticker}"
        resp = httpx.get(url, timeout=15, headers={"X-Finnhub-Token": FINNHUB_KEY})
        if resp.status_code != 200:
            return None
        data = resp.json()
        # Finnhub returns zeroes when the market is closed — treat as valid.
        if data.get("c", 0) == 0 and data.get("pc", 0) == 0:
            return None
        return data
    except Exception as e:
        logger.warning(f"Finnhub quote failed for {ticker}: {e}")
        return None


def _fetch_finnhub_candles(ticker: str, days: int = 21) -> list[float]:
    """Fetch daily closing prices from Finnhub candles."""
    if not FINNHUB_KEY:
        return []
    try:
        to_ts = int(time.time())
        from_ts = int(time.time() - days * 86400 * 2)  # generous window
        url = (
            f"{FINNHUB_BASE}/stock/candle"
            f"?symbol={ticker}&resolution=D&from={from_ts}&to={to_ts}"
        )
        resp = httpx.get(url, timeout=15, headers={"X-Finnhub-Token": FINNHUB_KEY})
        if resp.status_code != 200:
            return []
        data = resp.json()
        if data.get("s") != "ok" or "c" not in data:
            return []
        return data["c"][-days:]  # last N daily closes
    except Exception as e:
        logger.warning(f"Finnhub candles failed for {ticker}: {e}")
        return []


def _fetch_finnhub_profile(ticker: str) -> dict:
    """Fetch company profile (market cap, etc.)."""
    if not FINNHUB_KEY:
        return {}
    try:
        url = f"{FINNHUB_BASE}/stock/profile2?symbol={ticker}"
        resp = httpx.get(url, timeout=15, headers={"X-Finnhub-Token": FINNHUB_KEY})
        if resp.status_code != 200:
            return {}
        return resp.json()
    except Exception:
        return {}


def _deterministic_gauss(seed_key: str, mean: float, std: float) -> float:
    """Gaussian draw seeded by (ticker, time bucket) instead of the global
    RNG. Finnhub's free tier does not expose volume, so volume-based factors
    must not inject fresh noise into every analysis: the same inputs in the
    same 30-minute bucket must produce the same score, or the on-chain
    evidence hash is not reproducible and the scheduler keeps re-publishing
    random jitter."""
    return random.Random(seed_key).gauss(mean, std)


def fetch_price_data(ticker: str, force: bool = False) -> Optional[PriceData]:
    if not force and ticker in _price_cache:
        cached_data, cached_time = _price_cache[ticker]
        if time.time() - cached_time < CACHE_TTL:
            return cached_data

    if not FINNHUB_KEY:
        return None

    quote = _fetch_finnhub_quote(ticker)
    if not quote:
        return None

    data = PriceData()
    data.price = quote.get("c", 0.0)
    data.change_24h = quote.get("dp", 0.0) or 0.0
    data.source = "finnhub"
    data.fetched_at = time.time()

    closes = _fetch_finnhub_candles(ticker, 21)
    if closes:
        data.daily_prices = closes
    else:
        pc = quote.get("pc", 0.0) or data.price
        data.daily_prices = [pc] * 20 + [data.price]

    # Volume proxies are deterministic within the 30-minute bucket so the
    # score (and its evidence hash) is reproducible from the same inputs.
    bucket = int(time.time() // 1800)
    volume_seed = f"{ticker}:{bucket}"
    data.volume = int(_deterministic_gauss(volume_seed, 50_000_000, 15_000_000))
    data.avg_volume_20d = int(
        data.volume * _deterministic_gauss(volume_seed + ":avg", 1.0, 0.15)
    )
    # 52-week range derived from the closes we actually hold; without real
    # 52w data a fabricated symmetric band makes the momentum term constant.
    if len(data.daily_prices) >= 5:
        hi, lo = max(data.daily_prices), min(data.daily_prices)
        spread = max(hi - lo, max(hi, lo) * 0.001)
        data.high_52w = hi + 0.05 * spread
        data.low_52w = max(0.0, lo - 0.05 * spread)
    else:
        data.high_52w = data.price * 1.05
        data.low_52w = data.price * 0.95
    data.beta = 1.0

    profile = _fetch_finnhub_profile(ticker)
    data.market_cap = profile.get("marketCapitalization", 0.0) or 0.0

    _price_cache[ticker] = (data, time.time())
    logger.info(f"Finnhub: {ticker} ${data.price:.2f}")
    return data


def fetch_news_sentiment(ticker: str) -> SentimentData:
    if FINNHUB_KEY:
        try:
            to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
            url = (
                f"{FINNHUB_BASE}/company-news"
                f"?symbol={ticker}&from={from_date}&to={to_date}"
            )
            resp = httpx.get(url, timeout=15, headers={"X-Finnhub-Token": FINNHUB_KEY})
            if resp.status_code == 200:
                articles = resp.json()
                if isinstance(articles, list) and articles:
                    headlines = [a.get("headline", "") for a in articles[:20] if a.get("headline")]
                    if headlines:
                        return _extract_sentiment_from_headlines(headlines)
        except Exception:
            pass

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

    def fetch_all_prices(self, tickers: list[str], force: bool = False) -> tuple[dict[str, Optional[PriceData]], float]:
        results: dict[str, Optional[PriceData]] = {}

        if not self.use_live:
            for t in tickers:
                results[t] = generate_mock_price_data(t)
            return results, time.time()

        with ThreadPoolExecutor(max_workers=1) as executor:
            futures = {executor.submit(fetch_price_data, t, force): t for t in tickers}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    data = future.result(timeout=25)
                    if data is None:
                        logger.warning(f"No data for {ticker}, using mock")
                        data = generate_mock_price_data(ticker)
                    results[ticker] = data
                except Exception:
                    logger.error(f"Timeout/error for {ticker}, using mock")
                    results[ticker] = generate_mock_price_data(ticker)

        live_count = sum(1 for d in results.values() if d and d.source == "finnhub")
        logger.info(f"Price data: {live_count}/{len(tickers)} from Finnhub")

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
