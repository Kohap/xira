from __future__ import annotations
import os, logging, time, random, re, json
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import httpx

logger = logging.getLogger(__name__)

# Finnhub free tier: 60 req/min, quote + candles + company profile + news.
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
FINNHUB_BASE = "https://finnhub.io/api/v1"

# Hybrid quotes: Yahoo chart API is the default bulk provider (no key, full
# OHLCV + real 52w range); Finnhub is reserved for news/sentiment headers.
QUOTE_PROVIDER = os.getenv("XIRA_QUOTE_PROVIDER", "yahoo").strip().lower()  # yahoo|finnhub|mock
YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
YAHOO_DAYS = 370

# In-memory cache for price data (5 minute TTL)
_price_cache: dict[str, tuple[PriceData, float]] = {}
CACHE_TTL = 300  # 5 minutes

# Tracked assets come from the versioned catalog. The env var may carry a
# legacy CWD-relative path that dies under Docker (WORKDIR /app), so we
# probe a candidate list in order and use the first file that loads.
CATALOG_CANDIDATES = [
    os.getenv("XIRA_CATALOG_PATH", "").strip(),
    "/app/catalogs/asset_catalog.json",  # Docker image layout (backend/Dockerfile)
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "..", "..", "catalogs", "asset_catalog.json",
    ),  # repo layout (backend/app/services -> repo root)
    os.path.join(os.getcwd(), "catalogs", "asset_catalog.json"),  # cwd layout
]


def _load_catalog() -> list[dict]:
    """Tracked assets come from the versioned catalog (built by
    scripts/build_catalog.py from OKX + Backed + on-chain verification).
    Only `enabled` entries are active; the `listed` tail stays available."""
    for path in CATALOG_CANDIDATES:
        if not path:
            continue
        try:
            with open(path) as f:
                catalog = json.load(f)
        except OSError:
            continue
        assets = []
        for a in catalog.get("assets", []):
            if not a.get("enabled", False):
                continue
            assets.append(
                {
                    "symbol": a["symbol"],
                    "underlying": a["underlying"],
                    "sector": a.get("sector") or "Equity",
                    "token_address": a["token_address"],
                    "quote_asset": a.get("quote_asset", "USDT"),
                    "okx_pair": a.get("okx_pair", ""),
                    "name": a.get("name", ""),
                }
            )
        if not assets:
            logger.warning(
                f"Catalog at {path} has no enabled assets; trying next candidate."
            )
            continue
        logger.info(f"Loaded asset catalog from {path} ({len(assets)} enabled).")
        return assets
    logger.warning("Catalog load failed on all candidates; empty asset universe.")
    return []


TRACKED_ASSETS: list[dict] = _load_catalog()


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


def _fetch_yahoo_chart(ticker: str) -> Optional[dict]:
    """One-call bulk quote + OHLCV for a ticker. No API key required."""
    url = f"{YAHOO_CHART_BASE}/{ticker}?range={YAHOO_DAYS}d&interval=1d"
    try:
        resp = httpx.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
        if resp.status_code != 200:
            logger.warning(f"Yahoo chart failed for {ticker}: HTTP {resp.status_code}")
            return None
        return resp.json().get("chart", {}).get("result", [None])[0]
    except Exception as e:
        logger.warning(f"Yahoo chart error for {ticker}: {e}")
        return None


def _yahoo_candles(result: dict) -> tuple[list[float], list[int]]:
    ts = result.get("timestamp", [])
    q = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes, volumes = q.get("close", []), q.get("volume", [])
    pairs = [
        (t, c, v)
        for t, c, v in zip(ts, closes, volumes)
        if c is not None and v is not None
    ]
    return [c for _, c, _ in pairs], [v for _, _, v in pairs]


def fetch_price_data_yahoo(ticker: str) -> Optional[PriceData]:
    result = _fetch_yahoo_chart(ticker)
    if not result or result.get("timestamp") is None:
        return None
    closes, volumes = _yahoo_candles(result)
    if len(closes) < 5 or closes[-1] is None:
        return None
    if closes[-1] <= 0:
        return None

    data = PriceData()
    data.price = closes[-1]
    data.daily_prices = closes[-21:]
    data.volume = volumes[-1] if volumes else 0
    data.avg_volume_20d = int(sum(volumes[-20:]) / max(1, len(volumes[-20:])))
    data.high_52w = max(closes)
    data.low_52w = min(closes)
    data.change_24h = (
        (closes[-1] - closes[-2]) / closes[-2] * 100 if len(closes) >= 2 and closes[-2] > 0 else 0.0
    )
    idx7 = len(closes) - 8
    data.change_7d = (
        (closes[-1] - closes[idx7]) / closes[idx7] * 100
        if 0 <= idx7 < len(closes) - 1 and closes[idx7] > 0
        else 0.0
    )
    data.market_cap = 0.0
    data.beta = 1.0
    data.source = "yahoo"
    data.fetched_at = time.time()
    return data


def fetch_price_data(ticker: str, force: bool = False) -> Optional[PriceData]:
    if not force and ticker in _price_cache:
        cached_data, cached_time = _price_cache[ticker]
        if time.time() - cached_time < CACHE_TTL:
            return cached_data

    if QUOTE_PROVIDER == "mock":
        return None

    if QUOTE_PROVIDER == "finnhub":
        data = _fetch_finnhub_price(ticker)
    else:
        data = fetch_price_data_yahoo(ticker)

    if data is None:
        return None

    # Real 52w range; only fall back to a derived band when the candle
    # history can't support it (e.g. a freshly listed ticker).
    if not data.high_52w and len(data.daily_prices) >= 5:
        hi, lo = max(data.daily_prices), min(data.daily_prices)
        spread = max(hi - lo, max(hi, lo) * 0.001)
        data.high_52w = hi + 0.05 * spread
        data.low_52w = max(0.0, lo - 0.05 * spread)

    _price_cache[ticker] = (data, time.time())
    logger.info(f"Quote ({data.source}): {ticker} ${data.price:.2f} vol {data.volume:,}")
    return data


def _fetch_finnhub_price(ticker: str) -> Optional[PriceData]:
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
    # Deterministic simulator: seeded by (ticker, 30-minute bucket) so the
    # same inputs in the same bucket always produce the same score and the
    # on-chain evidence hash stays reproducible (mirrors the Finnhub
    # provider's bucket-seeded volume in _deterministic_gauss).
    bucket = int(time.time() // 1800)
    rng = random.Random(f"{ticker}:{bucket}")
    base = rng.gauss(150.0, 40.0)
    volatility = 0.025
    data = PriceData()
    data.daily_prices = [base * (1 + rng.gauss(0, volatility)) for _ in range(21)]
    data.price = round(data.daily_prices[-1], 2)
    data.change_24h = round(rng.gauss(0, 2.0), 2)
    data.change_7d = round(rng.gauss(0, 4.0), 2)
    data.volume = max(1, int(rng.gauss(50_000_000, 15_000_000)))
    data.avg_volume_20d = max(1, int(data.volume * rng.gauss(1.0, 0.15)))
    data.high_52w = round(data.price * rng.gauss(1.25, 0.10), 2)
    data.low_52w = round(data.price * rng.gauss(0.75, 0.10), 2)
    data.market_cap = max(0.0, data.price * rng.gauss(500_000_000, 200_000_000))
    data.source = "mock"
    data.fetched_at = time.time()
    return data


def generate_mock_sentiment(ticker: str) -> SentimentData:
    """Deterministic mock sentiment, bucket-seeded like the mock prices."""
    s = SentimentData()
    bucket = int(time.time() // 1800)
    rng = random.Random(f"{ticker}:{bucket}:sentiment")
    s.score = round(max(-1.0, min(1.0, rng.gauss(0, 0.4))), 4)
    s.source = "mock"
    s.summary = "Mock sentiment signal."
    return s


class DataFetcher:
    def __init__(self, use_live: bool = True):
        self.use_live = use_live
        self._news_offset = 0
        # Finnhub news is the only rate-limit-sensitive call left in the
        # hybrid design; rotate which assets get fresh headlines per pass
        # (price-proxy for the rest) so 50+ assets stay under 60 req/min.
        self.news_per_pass = max(1, int(os.getenv("XIRA_NEWS_PER_PASS", "15")))

    def fetch_all_prices(self, tickers: list[str], force: bool = False) -> tuple[dict[str, Optional[PriceData]], float]:
        results: dict[str, Optional[PriceData]] = {}

        if not self.use_live:
            for t in tickers:
                results[t] = generate_mock_price_data(t)
            return results, time.time()

        # Finnhub's free tier is 60 req/min and needs ~3 calls per ticker,
        # so it stays serial; the keyless Yahoo chart API tolerates a pool.
        workers = 1 if QUOTE_PROVIDER == "finnhub" else 8
        with ThreadPoolExecutor(max_workers=workers) as executor:
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

        live_count = sum(1 for d in results.values() if d and d.source in ("finnhub", "yahoo"))
        logger.info(f"Price data: {live_count}/{len(tickers)} live ({QUOTE_PROVIDER} provider)")

        return results, time.time()

    def fetch_all_sentiments(
        self, tickers: list[str], price_data: Optional[dict[str, Optional[PriceData]]] = None
    ) -> tuple[dict[str, SentimentData], float]:
        results: dict[str, SentimentData] = {}

        if not self.use_live:
            for t in tickers:
                results[t] = generate_mock_sentiment(t)
            return results, time.time()

        n = len(tickers)
        if n == 0:
            return results, time.time()
        start = self._news_offset % n
        news_set = set(tickers[start : start + self.news_per_pass])
        if start + self.news_per_pass > n:
            news_set.update(tickers[: (start + self.news_per_pass) % n])
        self._news_offset += self.news_per_pass

        for ticker in tickers:
            if ticker in news_set:
                sentiment = fetch_news_sentiment(ticker)
            else:
                sentiment = SentimentData()
            if sentiment.headline_count == 0:
                pd = price_data.get(ticker) if price_data else None
                sentiment = _derive_sentiment_from_price(pd) if pd else SentimentData()
                if sentiment.source == "price_proxy":
                    sentiment.headline_count = 0
            results[ticker] = sentiment

        headline_count = sum(1 for s in results.values() if s.source == "headlines")
        logger.info(
            f"Sentiment: {headline_count}/{len(tickers)} headlines this pass "
            f"(rotation {self.news_per_pass}/pass), rest price proxy"
        )

        return results, time.time()


data_fetcher = DataFetcher(
    # Default off (mock) to match main.py: a missing env var must never
    # silently start burning upstream API quota.
    use_live=os.getenv("USE_LIVE_DATA", "false").lower() == "true",
)
