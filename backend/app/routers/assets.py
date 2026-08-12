from __future__ import annotations
import os, time
from fastapi import APIRouter, HTTPException, Query

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.publisher import publisher
from app.services.history_db import history_db
from app.models import (
    AllAssetsResponse,
    AssetDetailResponse,
    AttestationResponse,
    HealthResponse,
    MarketHistoryPoint,
    MarketHistoryResponse,
    MarketStatsResponse,
)

router = APIRouter(prefix="/api/assets", tags=["assets"])

HISTORY_STORE: dict[str, list[dict]] = {}

# Shared latest board, refreshed by /api/assets/all and read by /stats & /alerts
_board_cache: dict = {"computed_at": 0, "board": None}
BOARD_TTL_S = 900


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
        if result.data_source == "yahoo":
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
    if force_fresh or _board_cache["board"] is None or stale:
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
async def get_all_assets(fresh: bool = False):
    board = _analyze_all() if fresh else _get_board()
    for asset in board.assets:
        _store_asset_history(asset.symbol, asset)
    return board


@router.get("/stats", response_model=MarketStatsResponse)
async def market_stats():
    """Market-level statistics: risk distribution, average, extremes."""
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
async def health_check():
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
    )


@router.get("/history/stats")
async def history_stats():
    """Get database statistics."""
    stats = history_db.get_stats()
    return {
        "status": "ok",
        "database": "sqlite",
        "stats": stats,
    }


@router.get("/history", response_model=MarketHistoryResponse)
async def market_history(hours: int = Query(default=24, ge=1, le=168)):
    """Average board risk score bucketed over time (1-hour buckets)."""
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
async def verify_attestation(symbol: str):
    """Compare the API attestation against what is stored on-chain."""
    match = _find_asset(symbol)

    board = _get_board()
    api_att = next((a for a in board.assets if a.symbol == match["symbol"]), None)
    api_data = None
    if api_att:
        api_data = {
            "symbol": api_att.symbol,
            "risk_score": api_att.risk_score,
            "confidence": api_att.confidence,
            "evidence_hash": api_att.evidence_hash,
            "timestamp": api_att.timestamp,
            "anomaly": api_att.anomaly,
        }

    onchain_data = publisher.read_latest(match["token_address"])

    match_result = None
    if api_data and onchain_data:
        same_score = api_data["risk_score"] == onchain_data["score"]
        same_hash = api_data["evidence_hash"].lower() == onchain_data["evidence_hash"].lower()
        match_result = {
            "score_matches": same_score,
            "hash_matches": same_hash,
            "verified": same_score and same_hash,
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
async def onchain_history(symbol: str):
    """Last N attestations stored on-chain for an asset (V2 contract)."""
    match = _find_asset(symbol)
    entries = publisher.read_history(match["token_address"])
    return {
        "symbol": match["symbol"],
        "contract": publisher.contract_address,
        "chain_id": publisher.chain_id,
        "history": entries,
        "count": len(entries),
    }


@router.get("/{symbol}", response_model=AssetDetailResponse)
async def get_asset_detail(symbol: str):
    """Single-asset detail: metadata, current score, 24h score delta."""
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
