from __future__ import annotations
import os
import sys

os.environ["USE_LIVE_DATA"] = "false"
os.environ["PRIVATE_KEY"] = ""
os.environ["XIRA_CONTRACT_ADDRESS"] = "0x0000000000000000000000000000000000000000"

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app


client = TestClient(app)


def test_root():
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "XIRA"
    assert "endpoints" in body


def test_health():
    res = client.get("/api/assets/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["tracked_assets"] == 15


def test_assets_all():
    res = client.get("/api/assets/all")
    assert res.status_code == 200
    body = res.json()
    assert len(body["assets"]) == 15
    assert "summary" in body
    assert all(0 <= a["risk_score"] <= 100 for a in body["assets"])
    assert all("factors" in a for a in body["assets"])


def test_assets_stats():
    res = client.get("/api/assets/stats")
    assert res.status_code == 200
    body = res.json()
    assert body["total_assets"] == 15
    assert body["average_score"] >= 0
    assert "distribution" in body
    assert body["best"] is not None
    assert body["worst"] is not None


def test_asset_detail():
    res = client.get("/api/assets/NVDAx")
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "NVDAx"
    assert body["underlying"] == "NVDA"
    assert body["sector"]
    assert 0 <= body["risk_score"] <= 100
    assert "factors" in body


def test_asset_detail_unknown():
    res = client.get("/api/assets/DOESNOTEXISTx")
    assert res.status_code == 404


def test_alerts():
    res = client.get("/api/alerts")
    assert res.status_code == 200
    body = res.json()
    assert "total_alerts" in body
    assert "alerts" in body
    assert isinstance(body["total_alerts"], int)
    for a in body["alerts"]:
        assert "symbol" in a
        assert 0 <= a["risk_score"] <= 100


def test_attestation_history_shape():
    res = client.get("/api/attestations/TSLAx/history?limit=5")
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "TSLAx"
    assert "history" in body


def _fake_attestation():
    from app.models import AttestationResponse
    return AttestationResponse(
        symbol="NVDAx",
        risk_score=60,
        risk_level="MODERATE",
        confidence=80,
        factors=[],
        explanation="test",
        anomaly=False,
        anomaly_reason="",
        evidence_hash="0x" + "ab" * 32,
        timestamp=1_700_000_000,
        model_version="v1.0.0",
        data_source="finnhub",
        data_freshness_ms=0,
    )


def test_rescore_publish_requires_admin_token(monkeypatch):
    from app.routers.assets import publisher as pub
    from app.routers.assets import ai_engine

    calls = []

    monkeypatch.setattr(ai_engine, "analyze", lambda **kw: _fake_attestation())
    monkeypatch.setattr(pub, "enabled", True)
    monkeypatch.setattr(pub, "read_latest", lambda token: {
        "score": 50,
        "confidence": 80,
        "evidence_hash": "0x" + "cd" * 32,
        "timestamp": 1_700_000_000,
        "model_version": "v1.0.0",
        "anomaly": False,
        "anomaly_reason": "",
    })
    monkeypatch.setattr(pub, "update_attestation", lambda **kw: calls.append(kw) or {
        "tx_hash": "0xtx",
        "explorer_url": "https://explorer/tx/0xtx",
        "block": 1,
        "gas_used": 0,
    })
    monkeypatch.setattr(os, "getenv", lambda k, d=None: {
        "XIRA_DEVIATION_THRESHOLD": "3",
    }.get(k, d))

    no_token = client.post("/api/assets/NVDAx/rescore")
    assert no_token.status_code == 200
    body = no_token.json()
    assert body["published"] is False
    assert "admin token" in body["reason"]
    assert calls == []

    monkeypatch.setattr(os, "getenv", lambda k, d=None: {
        "XIRA_DEVIATION_THRESHOLD": "3",
        "XIRA_ADMIN_TOKEN": "test-token",
    }.get(k, d))

    with_token = client.post(
        "/api/assets/NVDAx/rescore",
        headers={"x-admin-token": "test-token"},
    )
    assert with_token.status_code == 200
    body = with_token.json()
    assert body["published"] is True
    assert len(calls) == 1
