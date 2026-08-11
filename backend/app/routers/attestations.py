from __future__ import annotations
import os, time
from fastapi import APIRouter, HTTPException, Query

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.history_db import history_db
from app.models import AttestationResponse, AttestationHistory

router = APIRouter(prefix="/api/attestations", tags=["attestations"])

HISTORY_STORE: dict[str, list[dict]] = {}


def _store_history(symbol: str, result: AttestationResponse):
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


@router.get("/{symbol}", response_model=AttestationResponse)
async def get_attestation(symbol: str):
    symbol_upper = symbol.upper()
    assets = get_tracked_assets()
    match = next((a for a in assets if a["symbol"].upper() == symbol_upper), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not tracked.")

    model_version = os.getenv("MODEL_VERSION", "v1.0.0-mvp")

    prices, _ = data_fetcher.fetch_all_prices([match["underlying"]])
    price_data = prices.get(match["underlying"])

    sentiments, _ = data_fetcher.fetch_all_sentiments([match["underlying"]], prices)
    sentiment = sentiments.get(match["underlying"])
    s_val = sentiment.score if hasattr(sentiment, "score") else (sentiment if isinstance(sentiment, (int, float)) else 0.0)

    result = ai_engine.analyze(
        symbol=match["symbol"],
        price_data=price_data,
        sentiment=s_val,
        model_version=model_version,
    )

    result.timestamp = int(time.time())

    try:
        from app.services.publisher import publisher
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
            result.chain_tx = tx["tx_hash"]
            result.chain_explorer = tx["explorer_url"]
            result.chain_block = tx.get("block")
            result.chain_id = publisher.chain_id
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

    # Try to get from database first (persistent history)
    db_history = history_db.get_history(match["symbol"], limit=limit)
    
    if db_history:
        # Convert database records to AttestationResponse format
        history_responses = []
        for record in db_history:
            history_responses.append(AttestationResponse(
                symbol=match["symbol"],
                risk_score=record["risk_score"],
                risk_level=record["risk_level"],
                confidence=record["confidence"],
                factors=record["factors"],
                explanation=record["explanation"],
                anomaly=record["anomaly"],
                anomaly_reason=record["anomaly_reason"],
                evidence_hash="",
                timestamp=record["timestamp"],
                model_version="",
                data_source="",
                data_freshness_ms=0,
            ))
        return AttestationHistory(
            symbol=match["symbol"],
            history=history_responses,
        )
    
    # Fallback to in-memory store if database is empty
    history = HISTORY_STORE.get(match["symbol"], [])
    return AttestationHistory(
        symbol=match["symbol"],
        history=[AttestationResponse(**h) for h in history[-limit:]],
    )
