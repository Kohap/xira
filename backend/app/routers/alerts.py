from __future__ import annotations
import os, time
from fastapi import APIRouter

from app.services.ai_engine import ai_engine
from app.models import AlertItem, AlertsResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=AlertsResponse)
async def get_alerts():
    """List of currently flagged anomalies across all tracked assets."""
    from app.routers.assets import _get_board

    board = _get_board()
    alerts = [a for a in board.assets if a.anomaly]
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
                anomaly_reason=a.anomaly_reason or "Anomaly flagged by factor model.",
                timestamp=a.timestamp,
                model_version=a.model_version,
                data_source=a.data_source,
            )
            for a in alerts
        ],
    )