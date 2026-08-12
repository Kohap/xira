from __future__ import annotations
import asyncio, logging, os, time

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine
from app.services.publisher import publisher

logger = logging.getLogger(__name__)

HEARTBEAT_MINUTES = float(os.getenv("XIRA_HEARTBEAT_MINUTES", "30"))
DEVIATION_THRESHOLD = int(os.getenv("XIRA_DEVIATION_THRESHOLD", "3"))
FIRST_PASS_DELAY_S = float(os.getenv("XIRA_FIRST_PASS_DELAY_S", "60"))

_last_published: dict[str, int] = {}

_diag: dict = {
    "last_pass_at": None,
    "pass_count": 0,
    "publishes": 0,
    "skipped_mock": 0,
    "skipped_threshold": 0,
    "missing_prices": 0,
    "errors": [],
}


def scheduler_diag() -> dict:
    return {
        **_diag,
        "heartbeat_minutes": HEARTBEAT_MINUTES,
        "deviation_threshold": DEVIATION_THRESHOLD,
        "last_published": dict(_last_published),
    }


def _store_history(symbol: str, result):
    from app.routers.attestations import _store_history as store

    store(symbol, result, published=True)


def _deviation_ok(prev: int | None, new_score: int) -> bool:
    if prev is None:
        return False
    return abs(new_score - prev) < DEVIATION_THRESHOLD


def _run_pass() -> None:
    if not publisher.enabled:
        logger.info("Scheduler: publisher disabled (no contract/key). Skipping publish pass.")
        return

    _diag["last_pass_at"] = int(time.time())
    _diag["pass_count"] += 1

    for asset in get_tracked_assets():
        symbol = asset["symbol"]
        try:
            prices, _ = data_fetcher.fetch_all_prices([asset["underlying"]])
            price_data = prices.get(asset["underlying"])
            if price_data is None:
                _diag["missing_prices"] += 1
                continue

            sentiments, _ = data_fetcher.fetch_all_sentiments([asset["underlying"]], prices)
            sentiment = sentiments.get(asset["underlying"])
            s_val = (
                sentiment.score
                if hasattr(sentiment, "score")
                else sentiment if isinstance(sentiment, (int, float)) else 0.0
            )

            model_version = os.getenv("MODEL_VERSION", "v1.0.0")
            result = ai_engine.analyze(
                symbol=symbol,
                price_data=price_data,
                sentiment=s_val,
                model_version=model_version,
            )

            if result.data_source == "mock":
                _diag["skipped_mock"] += 1
                logger.info(f"Scheduler: {symbol} on simulated data — no on-chain publish.")
                continue

            prev = _last_published.get(symbol)
            if _deviation_ok(prev, result.risk_score):
                _diag["skipped_threshold"] += 1
                logger.info(
                    f"Scheduler: {symbol} score {result.risk_score} "
                    f"(prev {prev}) — within threshold, skipping tx."
                )
                continue

            result.timestamp = int(time.time())
            tx = publisher.update_attestation(
                token_address=asset["token_address"],
                score=result.risk_score,
                confidence=result.confidence,
                evidence_hash_hex=result.evidence_hash,
                model_version=result.model_version,
                anomaly=result.anomaly,
                anomaly_reason=result.anomaly_reason,
            )
            if tx:
                _last_published[symbol] = result.risk_score
                _diag["publishes"] += 1
                _store_history(symbol, result)
                logger.info(f"Scheduler: {symbol} published ({tx['tx_hash'][:14]}…).")
        except Exception as e:
            msg = f"{symbol}: {e}"
            if len(_diag["errors"]) >= 5:
                _diag["errors"].pop(0)
            _diag["errors"].append(msg)
            logger.error(f"Scheduler: pass failed for {symbol}: {e}")


async def scheduler_loop() -> None:
    logger.info(
        f"Scheduler started | heartbeat {HEARTBEAT_MINUTES:.0f} min "
        f"| deviation threshold ±{DEVIATION_THRESHOLD} pts"
    )
    await asyncio.sleep(FIRST_PASS_DELAY_S)
    while True:
        started = time.time()
        try:
            await asyncio.to_thread(_run_pass)
        except Exception as e:
            logger.error(f"Scheduler: pass error: {e}")
        elapsed = time.time() - started
        await asyncio.sleep(max(1.0, HEARTBEAT_MINUTES * 60 - elapsed))