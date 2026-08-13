from __future__ import annotations
import json
import os
import sys

os.environ["USE_LIVE_DATA"] = "false"
os.environ["PRIVATE_KEY"] = ""
os.environ["XIRA_CONTRACT_ADDRESS"] = "0x0000000000000000000000000000000000000000"

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
import app.routers.mcp as mcp_router


client = TestClient(app)


@pytest.fixture(autouse=True)
def stub_fetcher(monkeypatch):
    """Give /mcp a deterministic fetcher so tests never hit real HTTP."""

    def fake_fetcher(base_url: str):
        def fetch(path: str) -> dict:
            if path == "/api/assets/health":
                return {"status": "ok", "tracked_assets": 15}
            if path == "/api/alerts":
                return {"generated_at": 0, "total_alerts": 1, "alerts": [{"symbol": "NVDAx"}]}
            if path == "/api/assets/stats":
                return {"total_assets": 15, "average_score": 42}
            if path == "/api/attestations/NVDAx":
                return {"symbol": "NVDAx", "risk_score": 8, "anomaly": False}
            if path == "/api/attestations/NVDAx/history?limit=10":
                return {"symbol": "NVDAx", "history": [{"timestamp": 1, "risk_score": 8}]}
            if path == "/api/assets/all":
                return {"summary": "ok", "data_source": "mock", "assets": [{"symbol": "NVDAx", "risk_score": 8}]}
            return {"error": f"unmocked path: {path}"}

        return fetch

    monkeypatch.setattr(mcp_router, "_make_httpx_fetcher", fake_fetcher)
    yield


def post(body: dict | list) -> dict:
    res = client.post("/mcp", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def test_initialize():
    body = post({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "clientInfo": {"name": "test"}},
    })
    assert body["id"] == 1
    assert body["result"]["protocolVersion"] == "2025-06-18"
    assert body["result"]["serverInfo"]["name"] == "XIRA MCP Server"
    assert "tools" in body["result"]["capabilities"]


def test_initialize_falls_back_to_supported_version():
    body = post({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "initialize",
        "params": {"protocolVersion": "9999.0.0"},
    })
    assert body["result"]["protocolVersion"] == "2024-11-05"


def test_tools_list():
    body = post({"jsonrpc": "2.0", "id": 3, "method": "tools/list"})
    names = [t["name"] for t in body["result"]["tools"]]
    assert names == [
        "xira_get_all_assets",
        "xira_get_asset_risk",
        "xira_get_asset_history",
        "xira_get_health",
        "xira_get_alerts",
        "xira_get_market_stats",
    ]


def test_tools_call_health():
    body = post({"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "xira_get_health"}})
    content = body["result"]["content"][0]["text"]
    assert json.loads(content)["status"] == "ok"


def test_tools_call_asset_risk():
    body = post({
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {"name": "xira_get_asset_risk", "arguments": {"symbol": "NVDAx"}},
    })
    content = json.loads(body["result"]["content"][0]["text"])
    assert content["symbol"] == "NVDAx"
    assert content["risk_score"] == 8


def test_tools_call_missing_argument():
    body = post({"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "xira_get_asset_risk"}})
    assert body["error"]["code"] == -32602


def test_unknown_method():
    body = post({"jsonrpc": "2.0", "id": 7, "method": "tools/nope"})
    assert body["error"]["code"] == -32601


def test_unknown_tool():
    body = post({"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "nope"}})
    assert body["error"]["code"] == -32601


def test_parse_error():
    res = client.post("/mcp", content=b"{not json", headers={"Content-Type": "application/json"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == -32700


def test_notification_only_request_returns_202():
    res = client.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert res.status_code == 202
    assert res.content == b""


def test_batch_request():
    body = post([
        {"jsonrpc": "2.0", "id": 11, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 12, "method": "tools/call", "params": {"name": "xira_get_health"}},
        {"jsonrpc": "2.0", "id": 13, "method": "tools/nope"},
    ])
    assert isinstance(body, list) and len(body) == 3
    by_id = {m["id"]: m for m in body}
    assert by_id[11]["result"]["tools"]
    assert by_id[12]["result"]["content"]
    assert by_id[13]["error"]["code"] == -32601


def test_mcp_endpoint_listed_in_root():
    body = client.get("/").json()
    assert body["endpoints"]["mcp"] == "/mcp"


def test_get_mcp_returns_405():
    res = client.get("/mcp")
    assert res.status_code == 405