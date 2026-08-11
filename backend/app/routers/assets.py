from __future__ import annotations
import os, time
from fastapi import APIRouter, HTTPException

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.publisher import publisher
from app.services.history_db import history_db
from app.models import AllAssetsResponse, AttestationResponse, HealthResponse

router = APIRouter(prefix="/api/assets", tags=["assets"])

HISTORY_STORE: dict[str, list[dict]] = {}


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


@router.get("/all", response_model=AllAssetsResponse)
async def get_all_assets(fresh: bool = False):
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

    summary += f" Data: {source_label} ({live_count}/{len(results)} from Yahoo Finance)."

    return AllAssetsResponse(
        generated_at=now,
        model_version=model_version,
        data_source=source_label,
        assets=results,
        summary=summary,
    )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    contract_addr = os.getenv("XIRA_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
    live = os.getenv("USE_LIVE_DATA", "true").lower() == "true"
    return HealthResponse(
        status="ok",
        version=os.getenv("MODEL_VERSION", "v1.0.0"),
        chain="xlayer-testnet",
        contract=contract_addr,
        tracked_assets=len(get_tracked_assets()),
        live_data=live,
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
