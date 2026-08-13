from __future__ import annotations
import asyncio, logging, os, time

from app.services.data_fetcher import data_fetcher, get_tracked_assets
from app.services.ai_engine import ai_engine, risk_level_from_score
from app.services.history_db import history_db
from app.services.publisher import publisher
from app.services.telegram_notifier import evaluate_alerts, flag_alert, seed_flag
from app.models import AttestationResponse

logger = logging.getLogger(__name__)

HEARTBEAT_MINUTES = float(os.getenv("XIRA_HEARTBEAT_MINUTES", "30"))
DEVIATION_THRESHOLD = int(os.getenv("XIRA_DEVIATION_THRESHOLD", "3"))
FIRST_PASS_DELAY_S = float(os.getenv("XIRA_FIRST_PASS_DELAY_S", "60"))

_last_published: dict[str, int] = {}

# The first pass after startup seeds alert latches instead of firing them.
_risk_baseline_done = False

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


def _check_risk_alert(symbol: str, result, thresholds: dict) -> None:
    """Telegram alert when an asset trips an anomaly or a user threshold.
    Latched per symbol, so a sustained condition alerts once, not every pass.
    The first pass after startup only records the baseline: a restart must not
    replay alerts for conditions that were already true."""
    reasons: list[str] = []
    if result.anomaly:
        reasons.append(result.anomaly_reason or "Anomaly flagged by factor model.")
    t = thresholds.get(symbol)
    if t and t.get("enabled") and t.get("threshold") is not None and result.risk_score >= t["threshold"]:
        reasons.append(f"Score {result.risk_score} is at or above your threshold of {t['threshold']}.")

    if not _risk_baseline_done:
        seed_flag(f"risk:{symbol}", bool(reasons))
        return

    flag_alert(
        f"risk:{symbol}",
        bool(reasons),
        f"{symbol} risk {result.risk_score}/100 ({result.risk_level.value})",
        reasons + [f"Confidence {result.confidence}%."],
    )


def _check_alert_flags() -> None:
    """Evaluate health flags after each pass and fire Telegram alerts on
    transitions. Mirrors the flag formulas in the /api/assets/health route."""
    diag = scheduler_diag()
    last_pass = diag.get("last_pass_at")
    stalled = bool(
        last_pass is not None and (time.time() - last_pass) > 2 * HEARTBEAT_MINUTES * 60
    )
    pub = publisher.status()
    failing = bool(pub["enabled"] and pub["consecutive_failures"] >= 2)
    stale = bool(
        pub["enabled"]
        and pub["last_attempt_at"] is not None
        and pub["last_publish_at"] is None
        and pub["consecutive_failures"] > 0
    )
    evaluate_alerts(
        stalled,
        failing,
        stale,
        {
            "last_pass_hint": (
                time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(last_pass))
                if last_pass
                else "never"
            ),
            "consecutive_failures": pub["consecutive_failures"],
            "last_error": pub["last_error"],
            "signer": pub["signer"],
        },
    )


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

    thresholds = history_db.get_thresholds()

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

            # Risk alerting is independent of publishing: an asset can trip a
            # threshold without its score deviating enough to warrant a tx.
            _check_risk_alert(symbol, result, thresholds)

            # Use the on-chain value as the source of truth so two instances
            # evaluate the same state and don't both publish the same score.
            chain_latest = publisher.read_latest(asset["token_address"])
            chain_score = chain_latest["score"] if chain_latest else None
            if chain_latest is not None and chain_latest.get("evidence_hash", "").replace("0x", "").lower() == result.evidence_hash.lower():
                _diag["skipped_threshold"] += 1
                logger.info(f"Scheduler: {symbol} already published (same evidence hash).")
                _last_published[symbol] = result.risk_score
                # The chain already carries this exact attestation — record it
                # locally as published so the verify page has the API side.
                # Use the chain block time as the signature time; the
                # attestation is identical, not a fresh signing.
                result.timestamp = chain_latest["timestamp"]
                history_db.store_published_from_chain(symbol, result.model_dump())
                continue

            prev = chain_score if chain_score is not None else _last_published.get(symbol)
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

    global _risk_baseline_done
    if not _risk_baseline_done:
        _risk_baseline_done = True
        logger.info("Scheduler: risk alert baseline recorded; alerts arm from the next pass.")


async def backfill_published_from_chain() -> None:
    """Import existing on-chain attestations into the local DB as published
    records, so the verify page works for every market whose chain state
    already matches (e.g. after migrating to a fresh volume). Idempotent:
    assets with a local published record are left untouched."""
    if not publisher.enabled or not publisher.contract:
        return
    for asset in get_tracked_assets():
        try:
            # Heal-or-insert keyed by evidence hash: existing rows for the
            # same attestation with a drifted timestamp are corrected.
            onchain = publisher.read_latest(asset["token_address"])
            if not onchain:
                continue
            result = AttestationResponse(
                symbol=asset["symbol"],
                risk_score=onchain["score"],
                risk_level=risk_level_from_score(onchain["score"]),
                confidence=onchain["confidence"],
                factors=[],
                explanation="Imported from the on-chain attestation on startup.",
                anomaly=bool(onchain.get("anomaly", False)),
                anomaly_reason=onchain.get("anomaly_reason", "") or "",
                evidence_hash=onchain["evidence_hash"],
                timestamp=onchain["timestamp"],
                model_version=onchain.get("model_version", ""),
                data_source="onchain",
                data_freshness_ms=0,
            )
            history_db.store_published_from_chain(asset["symbol"], result.model_dump())
            logger.info(f"Backfill: {asset['symbol']} imported from chain (published).")
        except Exception as e:
            logger.warning(f"Backfill failed for {asset['symbol']}: {e}")


async def scheduler_loop() -> None:
    logger.info(
        f"Scheduler started | heartbeat {HEARTBEAT_MINUTES:.0f} min "
        f"| deviation threshold ±{DEVIATION_THRESHOLD} pts"
    )
    await backfill_published_from_chain()
    await asyncio.sleep(FIRST_PASS_DELAY_S)
    while True:
        started = time.time()
        try:
            await asyncio.to_thread(_run_pass)
        except Exception as e:
            logger.error(f"Scheduler: pass error: {e}")
        await asyncio.to_thread(_check_alert_flags)
        elapsed = time.time() - started
        await asyncio.sleep(max(1.0, HEARTBEAT_MINUTES * 60 - elapsed))