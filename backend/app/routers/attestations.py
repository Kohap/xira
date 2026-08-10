from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.models import AttestationResponse, AttestationHistory, RiskLevel

router = APIRouter(prefix="/api/attestations", tags=["attestations"])

HISTORY_STORE: dict[str, list[dict]] = {}


def _store_history(symbol: str, result: AttestationResponse):
    if symbol not in HISTORY_STORE:
        HISTORY_STORE[symbol] = []
    entry = result.model_dump()
    entry["timestamp"] = int(__import__("time").time())
    result.timestamp = entry["timestamp"]
    HISTORY_STORE[symbol].append(entry)
    if len(HISTORY_STORE[symbol]) > 50:
        HISTORY_STORE[symbol] = HISTORY_STORE[symbol][-50:]


@router.get("/{symbol}", response_model=AttestationResponse)
async def get_attestation(symbol: str):
    symbol_upper = symbol.upper()
    assets = get_tracked_assets()
    match = next((a for a in assets if a["symbol"].upper() == symbol_upper), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not tracked.")

    model_version = __import__("os").getenv("MODEL_VERSION", "v1.0.0-mvp")
    price_data = data_fetcher.fetch_all_prices([match["underlying"]]).get(match["underlying"])
    sentiment = data_fetcher.fetch_all_sentiments([match["underlying"]]).get(match["underlying"], 0.0)

    result = ai_engine.analyze(
        symbol=match["symbol"],
        price_data=price_data,
        sentiment=sentiment,
        model_version=model_version,
    )

    import time
    result.timestamp = int(time.time())

    try:
        from app.services.publisher import publisher
        publisher.update_attestation(
            token_address=match["token_address"],
            score=result.risk_score,
            confidence=result.confidence,
            evidence_hash_hex=result.evidence_hash,
            model_version=result.model_version,
            anomaly=result.anomaly,
            anomaly_reason=result.anomaly_reason,
        )
    except Exception:
        pass

    _store_history(match["symbol"], result)
    return result


@router.get("/{symbol}/history", response_model=AttestationHistory)
async def get_attestation_history(symbol: str, limit: int = Query(default=10, le=50)):
    symbol_upper = symbol.upper()
    assets = get_tracked_assets()
    match = next((a for a in assets if a["symbol"].upper() == symbol_upper), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not tracked.")

    history = HISTORY_STORE.get(match["symbol"], [])
    return AttestationHistory(
        symbol=match["symbol"],
        history=[AttestationResponse(**h) for h in history[-limit:]],
    )
