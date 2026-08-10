from __future__ import annotations
import os, time
from fastapi import APIRouter, HTTPException
from typing import Optional

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.publisher import publisher
from app.models import AllAssetsResponse, AttestationResponse, HealthResponse

router = APIRouter(prefix="/api/assets", tags=["assets"])

HISTORY_STORE: dict[str, list[dict]] = {}


def _store_asset_history(symbol: str, result: AttestationResponse):
    if symbol not in HISTORY_STORE:
        HISTORY_STORE[symbol] = []
    entry = result.model_dump()
    entry["timestamp"] = int(time.time())
    result.timestamp = entry["timestamp"]
    HISTORY_STORE[symbol].append(entry)
    if len(HISTORY_STORE[symbol]) > 50:
        HISTORY_STORE[symbol] = HISTORY_STORE[symbol][-50:]


@router.get("/all", response_model=AllAssetsResponse)
async def get_all_assets(fresh: bool = False):
    model_version = os.getenv("MODEL_VERSION", "v1.0.0-mvp")
    assets = get_tracked_assets()
    tickers = [a["underlying"] for a in assets]

    prices = data_fetcher.fetch_all_prices(tickers)
    sentiments = data_fetcher.fetch_all_sentiments(tickers)

    results: list[AttestationResponse] = []
    anomaly_count = 0
    total_score = 0

    for asset in assets:
        price_data = prices.get(asset["underlying"])
        sentiment = sentiments.get(asset["underlying"], 0.0)

        result = ai_engine.analyze(
            symbol=asset["symbol"],
            price_data=price_data,
            sentiment=sentiment,
            model_version=model_version,
        )

        result.timestamp = int(time.time())
        results.append(result)

        if result.anomaly:
            anomaly_count += 1
        total_score += result.risk_score

        _store_asset_history(asset["symbol"], result)

    avg_score = total_score / len(results) if results else 0

    if avg_score < 30:
        summary = f"Market outlook: Low risk. Average score {avg_score:.0f}/100 across {len(results)} assets."
    elif avg_score < 55:
        summary = f"Market outlook: Moderate risk. Average score {avg_score:.0f}/100 across {len(results)} assets."
    elif avg_score < 75:
        summary = f"Market outlook: Elevated risk. Average score {avg_score:.0f}/100 across {len(results)} assets. {anomaly_count} anomaly alerts active."
    else:
        summary = f"Market outlook: High risk. Average score {avg_score:.0f}/100 across {len(results)} assets. {anomaly_count} anomaly alerts active."

    return AllAssetsResponse(
        generated_at=int(time.time()),
        model_version=model_version,
        assets=results,
        summary=summary,
    )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    contract_addr = os.getenv("XIRA_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
    return HealthResponse(
        status="ok",
        version=os.getenv("MODEL_VERSION", "v1.0.0-mvp"),
        chain="xlayer-testnet",
        contract=contract_addr,
        tracked_assets=len(get_tracked_assets()),
    )
