from __future__ import annotations
import os, time
from fastapi import APIRouter, HTTPException, Query, Request

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.history_db import history_db
from app.services.rate_limit import enforce_rate_limit
from app.models import AttestationResponse, AttestationHistory

router = APIRouter(prefix="/api/attestations", tags=["attestations"])

HISTORY_STORE: dict[str, list[dict]] = {}


def _store_history(symbol: str, result: AttestationResponse, published: bool = False):
    if symbol not in HISTORY_STORE:
        HISTORY_STORE[symbol] = []
    entry = result.model_dump()
    entry["timestamp"] = int(time.time())
    result.timestamp = entry["timestamp"]
    HISTORY_STORE[symbol].append(entry)
    if len(HISTORY_STORE[symbol]) > 50:
        HISTORY_STORE[symbol] = HISTORY_STORE[symbol][-50:]

    history_db.store_score(symbol, entry, published=published)


@router.get("/{symbol}", response_model=AttestationResponse)
async def get_attestation(symbol: str, request: Request):
    enforce_rate_limit(request, "attestation", limit=20)
    symbol_upper = symbol.upper()
    assets = get_tracked_assets()
    match = next((a for a in assets if a["symbol"].upper() == symbol_upper), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not tracked.")

    model_version = os.getenv("MODEL_VERSION", "v1.0.0")

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

    # Read-only on-chain sync: attach the latest stored attestation so the
    # frontend can link the contract on the explorer. Publishing is left to
    # the heartbeat scheduler; a GET must never spend gas / sign a tx.
    try:
        from app.services.publisher import publisher, XLAYER_EXPLORER
        onchain = publisher.read_latest(match["token_address"])
        if onchain:
            result.chain_id = publisher.chain_id
            # Verified = the displayed score is the one attested on-chain
            # (evidence hashes drift between publishes as data re-scores,
            # so an exact-evidence match alone would almost never show).
            same_evidence = (
                onchain["evidence_hash"].replace("0x", "").lower()
                == result.evidence_hash.replace("0x", "").lower()
            )
            result.onchain_verified = bool(
                same_evidence or int(onchain["score"]) == result.risk_score
            )
            last = publisher.last_tx(match["token_address"])
            if last:
                result.chain_tx = last["tx_hash"]
                result.chain_explorer = last["explorer_url"]
            else:
                result.chain_explorer = (
                    f"{XLAYER_EXPLORER}/address/{publisher.contract_address}"
                    if publisher.contract_address
                    else None
                )
    except Exception:
        pass

    _store_history(match["symbol"], result)
    return result


@router.get("/{symbol}/history", response_model=AttestationHistory)
async def get_attestation_history(symbol: str, request: Request, limit: int = Query(default=10, le=50)):
    enforce_rate_limit(request, "attestation_history", limit=60)
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
