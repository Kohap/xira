from __future__ import annotations
import os, time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai_engine import ai_engine
from app.services.history_db import history_db
from app.models import AlertItem, AlertsResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class ThresholdUpdate(BaseModel):
    symbol: str
    threshold: int
    enabled: bool = True


@router.get("/thresholds")
async def get_thresholds():
    """Per-asset risk thresholds set by the user."""
    return {"thresholds": history_db.get_thresholds()}


@router.put("/thresholds")
async def set_threshold(update: ThresholdUpdate):
    """Set (or disable) a risk threshold for one asset."""
    if update.threshold < 0 or update.threshold > 100:
        raise HTTPException(status_code=400, detail="Threshold must be 0-100.")
    ok = history_db.set_threshold(update.symbol.upper(), update.threshold, update.enabled)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not save threshold.")
    return {"ok": True, **update.model_dump()}


@router.get("", response_model=AlertsResponse)
async def get_alerts():
    """List of currently flagged anomalies across all tracked assets."""
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