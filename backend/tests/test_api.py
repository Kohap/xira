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
