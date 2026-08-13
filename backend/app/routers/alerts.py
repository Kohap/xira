from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.auth import admin_authorized
from app.services.data_fetcher import get_tracked_assets
from app.services.history_db import history_db
from app.services.rate_limit import enforce_rate_limit
from app.models import AlertItem, AlertsResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class ThresholdUpdate(BaseModel):
    symbol: str
    threshold: int
    enabled: bool = True


@router.post("/ops/test")
async def test_ops_alert(request: Request):
    """Send a test message to the configured Telegram channel. Admin only —
    it is an external side effect. Dormant until TELEGRAM_BOT_TOKEN and
    TELEGRAM_CHAT_ID are set."""
    enforce_rate_limit(request, "alerts_ops_test", limit=5)
    if not admin_authorized(request):
        raise HTTPException(status_code=401, detail="Admin token required.")
    from app.services.telegram_notifier import enabled as notifier_enabled, send_message

    if not notifier_enabled():
        return {
            "ok": False,
            "detail": "Telegram not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).",
        }
    ok = send_message(
        "XIRA Ops Alert: test message\n- Notifier is live and chat is reachable."
    )
    return {"ok": ok, "detail": "sent" if ok else "send failed (see backend logs)"}


@router.get("/thresholds")
async def get_thresholds(request: Request):
    """Per-asset risk thresholds set by the user."""
    enforce_rate_limit(request, "alerts_thresholds_get", limit=60)
    return {"thresholds": history_db.get_thresholds()}


@router.put("/thresholds")
async def set_threshold(update: ThresholdUpdate, request: Request):
    """Set (or disable) a risk threshold for one asset. Admin only — writes
    user-scoped state shared with push alerting."""
    enforce_rate_limit(request, "alerts_thresholds_put", limit=10)
    if not admin_authorized(request):
        raise HTTPException(status_code=401, detail="Admin token required.")
    if update.threshold < 0 or update.threshold > 100:
        raise HTTPException(status_code=400, detail="Threshold must be 0-100.")
    symbol_upper = update.symbol.upper()
    tracked = {a["symbol"].upper() for a in get_tracked_assets()}
    if symbol_upper not in tracked:
        raise HTTPException(status_code=400, detail=f"Asset '{update.symbol}' not tracked.")
    ok = history_db.set_threshold(symbol_upper, update.threshold, update.enabled)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not save threshold.")
    return {"ok": True, **update.model_dump()}


@router.get("", response_model=AlertsResponse)
async def get_alerts(request: Request):
    """List of currently flagged anomalies across all tracked assets."""
    enforce_rate_limit(request, "alerts", limit=120)
    from app.routers.assets import _get_board

    board = _get_board()
    thresholds = history_db.get_thresholds()

    alerts = []
    for a in board.assets:
        reason = ""
        if a.anomaly:
            reason = a.anomaly_reason or "Anomaly flagged by factor model."
        t = thresholds.get(a.symbol)
        if t and t["enabled"] and t["threshold"] is not None and a.risk_score >= t["threshold"]:
            reason = (
                f"{reason} " if reason else ""
            ) + f"Above your threshold of {t['threshold']}."
        if reason:
            alerts.append(a)

    alerts.sort(key=lambda a: a.risk_score, reverse=True)

    return AlertsResponse(
        generated_at=board.generated_at,
        model_version=board.model_version,
        data_source=board.data_source,
        total_alerts=len(alerts),
        alerts=[
            AlertItem(
                symbol=a.symbol,
                risk_score=a.risk_score,
                risk_level=a.risk_level,
                confidence=a.confidence,
                anomaly_reason=(
                    a.anomaly_reason or "Anomaly flagged by factor model."
                )
                + (
                    f" Above your threshold."
                    if thresholds.get(a.symbol) and thresholds[a.symbol]["enabled"]
                    and a.risk_score >= (thresholds[a.symbol]["threshold"] or 0)
                    else ""
                ),
                timestamp=a.timestamp,
                model_version=a.model_version,
                data_source=a.data_source,
            )
            for a in alerts
        ],
    )