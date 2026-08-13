from __future__ import annotations
import hmac, os, threading, time
from fastapi import APIRouter, HTTPException, Query, Request

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.publisher import publisher, XLAYER_EXPLORER
from app.services.scheduler import scheduler_diag
from app.services.history_db import history_db
from app.services.rate_limit import enforce_rate_limit
from app.models import (
    AllAssetsResponse,
    AssetDetailResponse,
    AttestationResponse,
    HealthResponse,
    MarketHistoryPoint,
    MarketHistoryResponse,
    MarketStatsResponse,
    RescoreResponse,
)

router = APIRouter(prefix="/api/assets", tags=["assets"])

HISTORY_STORE: dict[str, list[dict]] = {}

# Shared latest board, refreshed by /api/assets/all and read by /stats & /alerts
_board_cache: dict = {"computed_at": 0, "board": None}
BOARD_TTL_S = 900
_board_lock = threading.Lock()


def _store_asset_history(symbol: str, result: AttestationResponse):
    # Store in memory (for quick access)
    if symbol not in HISTORY_STORE:
        HISTORY_STORE[symbol] = []
    entry = result.model_dump()
    entry["timestamp"] = int(time.time())
    result.timestamp = entry["timestamp"]
    HISTORY_STORE[symbol].append(entry)
    if len(HISTORY_STORE[symbol]) > 50:
        HISTORY_STORE[symbol] = HISTORY_STORE[symbol][-50:]

    # Also persist to SQLite database
    history_db.store_score(symbol, entry)


def _analyze_all() -> AllAssetsResponse:
    model_version = os.getenv("MODEL_VERSION", "v1.0.0")
    assets = get_tracked_assets()
    tickers = [a["underlying"] for a in assets]

    prices, _ = data_fetcher.fetch_all_prices(tickers)
    sentiments, _ = data_fetcher.fetch_all_sentiments(tickers, prices)

    results: list[AttestationResponse] = []
    anomaly_count = 0
    total_score = 0
    live_count = 0
    now = int(time.time())

    for asset in assets:
        price_data = prices.get(asset["underlying"])
        sentiment = sentiments.get(asset["underlying"])
        s_val = sentiment.score if hasattr(sentiment, "score") else (sentiment if isinstance(sentiment, (int, float)) else 0.0)

        result = ai_engine.analyze(
            symbol=asset["symbol"],
            price_data=price_data,
            sentiment=s_val,
            model_version=model_version,
        )

        result.timestamp = now
        if result.data_source == "finnhub":
            live_count += 1

        # Previous stored score for delta arrows on the board.
        prev_rows = history_db.get_history(asset["symbol"], limit=1)
        if prev_rows:
            result.previous_score = prev_rows[0]["risk_score"]
            result.score_delta = result.risk_score - prev_rows[0]["risk_score"]

        results.append(result)
        if result.anomaly:
            anomaly_count += 1
        total_score += result.risk_score
        _store_asset_history(asset["symbol"], result)

    avg_score = total_score / len(results) if results else 0
    source_label = "live" if live_count >= len(results) * 0.7 else ("partial" if live_count > 0 else "mock")

    if avg_score < 30:
        summary = f"Market outlook: Low risk. Avg {avg_score:.0f}/100 across {len(results)} assets."
    elif avg_score < 55:
        summary = f"Market outlook: Moderate risk. Avg {avg_score:.0f}/100 across {len(results)} assets."
    elif avg_score < 75:
        summary = f"Market outlook: Elevated risk. Avg {avg_score:.0f}/100 across {len(results)} assets. {anomaly_count} alerts."
    else:
        summary = f"Market outlook: High risk. Avg {avg_score:.0f}/100 across {len(results)} assets. {anomaly_count} alerts."

    summary += f" Data: {source_label} ({live_count}/{len(results)} live)."

    return AllAssetsResponse(
        generated_at=now,
        model_version=model_version,
        data_source=source_label,
        assets=results,
        summary=summary,
    )


def _get_board(force_fresh: bool = False) -> AllAssetsResponse:
    now = time.time()
    stale = now - _board_cache["computed_at"] > BOARD_TTL_S
    if not (force_fresh or _board_cache["board"] is None or stale):
        return _board_cache["board"]
    # Serialize expensive Finnhub passes so concurrent visitors share one
    # computation instead of each burning the upstream quota.
    with _board_lock:
        now = time.time()
        stale = now - _board_cache["computed_at"] > BOARD_TTL_S
        if not (force_fresh or _board_cache["board"] is None or stale):
            return _board_cache["board"]
        _board_cache["board"] = _analyze_all()
        _board_cache["computed_at"] = now
    return _board_cache["board"]


def _board_age_ms() -> int:
    if _board_cache["computed_at"] == 0:
        return -1
    return int((time.time() - _board_cache["computed_at"]) * 1000)


def _find_asset(symbol: str) -> dict:
    assert_symbol = symbol.upper()
    assets = get_tracked_assets()
    match = next((a for a in assets if a["symbol"].upper() == assert_symbol), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not tracked.")
    return match


@router.get("/all", response_model=AllAssetsResponse)
async def get_all_assets(fresh: bool = False, request: Request = None):
    enforce_rate_limit(request, "assets_all", limit=30)
    if fresh:
        # Manual refresh burns the full upstream quota; gate it behind an
        # admin token instead of exposing it to the public. The board cache
        # already self-refreshes every 15 minutes.
        expected = os.getenv("XIRA_ADMIN_TOKEN", "")
        supplied = (
            request.headers.get("x-admin-token")
            or request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        )
        if not expected or not supplied or not hmac.compare_digest(expected, supplied):
            raise HTTPException(
                status_code=403,
                detail="Manual refresh requires an admin token.",
            )
    board = _analyze_all() if fresh else _get_board()
    for asset in board.assets:
        _store_asset_history(asset.symbol, asset)
    return board


@router.get("/stats", response_model=MarketStatsResponse)
async def market_stats(request: Request):
    """Market-level statistics: risk distribution, average, extremes."""
    enforce_rate_limit(request, "assets_stats", limit=60)
    board = _get_board()
    distribution: dict[str, int] = {}
    total = 0
    anomalies = 0
    for a in board.assets:
        distribution[a.risk_level.value] = distribution.get(a.risk_level.value, 0) + 1
        total += a.risk_score
        if a.anomaly:
            anomalies += 1

    avg = total / len(board.assets) if board.assets else 0
    best = min(board.assets, key=lambda a: a.risk_score) if board.assets else None
    worst = max(board.assets, key=lambda a: a.risk_score) if board.assets else None

    return MarketStatsResponse(
        generated_at=board.generated_at,
        model_version=board.model_version,
        data_source=board.data_source,
        cache_age_ms=_board_age_ms(),
        total_assets=len(board.assets),
        average_score=round(avg, 1),
        distribution=distribution,
        anomalies=anomalies,
        best={"symbol": best.symbol, "score": best.risk_score} if best else None,
        worst={"symbol": worst.symbol, "score": worst.risk_score} if worst else None,
    )


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request):
    enforce_rate_limit(request, "assets_health", limit=120)
    contract_addr = os.getenv("XIRA_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
    live = os.getenv("USE_LIVE_DATA", "true").lower() == "true"
    signer = publisher.account.address if publisher.enabled and publisher.account else None
    return HealthResponse(
        status="ok",
        version=os.getenv("MODEL_VERSION", "v1.0.0"),
        chain="xlayer-testnet",
        contract=contract_addr,
        tracked_assets=len(get_tracked_assets()),
        live_data=live,
        signer=signer,
        scheduler=scheduler_diag(),
        last_publish_error=publisher.last_tx_error,
    )


@router.get("/history/stats")
async def history_stats(request: Request):
    """Get database statistics."""
    enforce_rate_limit(request, "assets_history_stats", limit=60)
    stats = history_db.get_stats()
    return {
        "status": "ok",
        "database": "sqlite",
        "stats": stats,
    }


@router.get("/history", response_model=MarketHistoryResponse)
async def market_history(request: Request, hours: int = Query(default=24, ge=1, le=168)):
    """Average board risk score bucketed over time (1-hour buckets)."""
    enforce_rate_limit(request, "assets_history", limit=60)
    cutoff = int(time.time()) - hours * 3600
    rows = history_db.get_market_history(cutoff)
    if not rows:
        return MarketHistoryResponse(generated_at=int(time.time()), hours=hours, points=[])

    bucket_size = 3600
    buckets: dict[int, list[int]] = {}
    for row in rows:
        b = (row["ts"] // bucket_size) * bucket_size
        buckets.setdefault(b, []).append(row["risk_score"])

    points = [
        MarketHistoryPoint(
            ts=b,
            avg_score=round(sum(v) / len(v), 1),
            count=len(v),
        )
        for b, v in sorted(buckets.items())
    ]
    return MarketHistoryResponse(generated_at=int(time.time()), hours=hours, points=points)


@router.get("/verify/{symbol}")
async def verify_attestation(symbol: str, request: Request):
    """Compare the last published attestation against what is stored on-chain.

    The API side is the record the oracle actually signed (stored in the
    history DB after a successful transaction), not a fresh live analysis.
    A live recomputation would drift from the signed snapshot as market
    inputs change, making hash comparison meaningless.
    """
    enforce_rate_limit(request, "assets_verify", limit=30)
    match = _find_asset(symbol)

    published = history_db.get_latest(match["symbol"])
    api_data = None
    if published:
        api_data = {
            "symbol": published["symbol"],
            "risk_score": published["risk_score"],
            "confidence": published["confidence"],
            "evidence_hash": published["evidence_hash"],
            "timestamp": published["timestamp"],
            "anomaly": published["anomaly"],
        }

    onchain_data = publisher.read_latest(match["token_address"])

    match_result = None
    if api_data and onchain_data:
        same_score = api_data["risk_score"] == onchain_data["score"]
        same_hash = (
            api_data["evidence_hash"].lower().replace("0x", "")
            == onchain_data["evidence_hash"].lower().replace("0x", "")
        )
        # The DB stores the time the tx was broadcast; the chain stores the
        # block timestamp. Allow a few minutes for confirmation drift.
        time_ok = abs(api_data["timestamp"] - onchain_data["timestamp"]) <= 300
        match_result = {
            "score_matches": same_score,
            "hash_matches": same_hash,
            "time_matches": time_ok,
            "verified": same_score and same_hash and time_ok,
        }

    return {
        "symbol": match["symbol"],
        "contract": publisher.contract_address,
        "chain_id": publisher.chain_id,
        "api": api_data,
        "onchain": onchain_data,
        "match": match_result,
        "checked_at": int(time.time()),
    }


@router.get("/{symbol}/onchain-history")
async def onchain_history(symbol: str, request: Request):
    """Last N attestations stored on-chain for an asset (V2 contract)."""
    enforce_rate_limit(request, "assets_onchain_history", limit=30)
    match = _find_asset(symbol)
    entries = publisher.read_history(match["token_address"])
    return {
        "symbol": match["symbol"],
        "contract": publisher.contract_address,
        "chain_id": publisher.chain_id,
        "history": entries,
        "count": len(entries),
    }


@router.post("/{symbol}/rescore", response_model=RescoreResponse)
async def rescore_asset(symbol: str, request: Request):
    """Force a fresh re-score for one asset, bypassing the price cache.

    Mirrors the heartbeat scheduler for a single symbol: if the new score
    deviates past the threshold (and differs from the on-chain evidence),
    the attestation is published on-chain and the tx is returned.
    """
    enforce_rate_limit(request, "assets_rescore", limit=10)
    match = _find_asset(symbol)
    ticker = match["underlying"]

    prices, _ = data_fetcher.fetch_all_prices([ticker], force=True)
    price_data = prices.get(ticker)
    if price_data is None:
        raise HTTPException(status_code=502, detail=f"No price data for {ticker}.")

    sentiments, _ = data_fetcher.fetch_all_sentiments([ticker], prices)
    sentiment = sentiments.get(ticker)
    s_val = (
        sentiment.score
        if hasattr(sentiment, "score")
        else sentiment if isinstance(sentiment, (int, float)) else 0.0
    )

    model_version = os.getenv("MODEL_VERSION", "v1.0.0")
    result = ai_engine.analyze(
        symbol=match["symbol"],
        price_data=price_data,
        sentiment=s_val,
        model_version=model_version,
    )
    result.timestamp = int(time.time())

    published = False
    reason = ""

    if not publisher.enabled:
        reason = "On-chain publishing is not configured for this deployment."
    elif result.data_source == "mock":
        reason = "Scored on simulated data – not published to chain."
    else:
        chain_latest = publisher.read_latest(match["token_address"])
        chain_score = chain_latest["score"] if chain_latest else None
        same_hash = (
            chain_latest is not None
            and chain_latest.get("evidence_hash", "").replace("0x", "").lower()
            == result.evidence_hash.lower()
        )
        if same_hash:
            reason = "Score unchanged since the last attestation – nothing to publish."
        else:
            delta = abs(result.risk_score - chain_score) if chain_score is not None else None
            if delta is not None and delta < int(os.getenv("XIRA_DEVIATION_THRESHOLD", "3")):
                reason = (
                    f"Score moved {delta} pts – below the ±3 publish threshold, "
                    "no new attestation."
                )
            else:
                tx = publisher.update_attestation(
                    token_address=match["token_address"],
                    score=result.risk_score,
                    confidence=result.confidence,
                    evidence_hash_hex=result.evidence_hash,
                    model_version=result.model_version,
                    anomaly=result.anomaly,
                    anomaly_reason=result.anomaly_reason,
                )
                if tx:
                    published = True
                    result.chain_tx = tx["tx_hash"]
                    result.chain_explorer = f"{XLAYER_EXPLORER}/tx/{tx['tx_hash']}"
                    reason = "Attestation published on-chain."
                else:
                    reason = "Publish failed – check the API health diagnostics."

    if published:
        from app.routers.attestations import _store_history as store_published

        store_published(match["symbol"], result, published=True)
    else:
        _store_asset_history(match["symbol"], result)

    _board_cache["board"] = None
    _board_cache["computed_at"] = 0

    return RescoreResponse(**result.model_dump(), published=published, reason=reason)


@router.get("/{symbol}", response_model=AssetDetailResponse)
async def get_asset_detail(symbol: str, request: Request):
    """Single-asset detail: metadata, current score, 24h score delta."""
    enforce_rate_limit(request, "assets_detail", limit=60)
    match = _find_asset(symbol)
    board = _get_board()

    current = next((a for a in board.assets if a.symbol == match["symbol"]), None)
    if current is None:
        prices, _ = data_fetcher.fetch_all_prices([match["underlying"]])
        price_data = prices.get(match["underlying"])
        sentiments, _ = data_fetcher.fetch_all_sentiments([match["underlying"]], prices)
        sentiment = sentiments.get(match["underlying"])
        s_val = (
            sentiment.score
            if hasattr(sentiment, "score")
            else sentiment if isinstance(sentiment, (int, float)) else 0.0
        )
        current = ai_engine.analyze(
            symbol=match["symbol"],
            price_data=price_data,
            sentiment=s_val,
            model_version=os.getenv("MODEL_VERSION", "v1.0.0"),
        )
        current.timestamp = int(time.time())

    history = history_db.get_history(match["symbol"], limit=2)
    delta = None
    if len(history) >= 2 and history[0]["risk_score"] != history[1]["risk_score"]:
        delta = history[1]["risk_score"] - history[0]["risk_score"]
    elif len(history) == 1 and history[0]["risk_score"] != current.risk_score:
        delta = current.risk_score - history[0]["risk_score"]

    prices, _ = data_fetcher.fetch_all_prices([match["underlying"]])
    price_data = prices.get(match["underlying"])

    return AssetDetailResponse(
        symbol=current.symbol,
        underlying=match["underlying"],
        sector=match["sector"],
        token_address=match["token_address"],
        risk_score=current.risk_score,
        risk_level=current.risk_level,
        confidence=current.confidence,
        change_24h=price_data.change_24h if price_data else 0.0,
        score_delta_24h=delta,
        factors=current.factors,
        explanation=current.explanation,
        anomaly=current.anomaly,
        anomaly_reason=current.anomaly_reason,
        evidence_hash=current.evidence_hash,
        timestamp=current.timestamp,
        model_version=current.model_version,
        data_source=current.data_source,
        data_freshness_ms=current.data_freshness_ms,
    )
