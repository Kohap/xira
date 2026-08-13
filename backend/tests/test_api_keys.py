from __future__ import annotations
import os
import sys

os.environ["USE_LIVE_DATA"] = "false"
os.environ["PRIVATE_KEY"] = ""
os.environ["XIRA_CONTRACT_ADDRESS"] = "0x0000000000000000000000000000000000000000"

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.services.api_keys import api_keys

client = TestClient(app)


def _clean_keys():
    with api_keys._connect() as conn:
        conn.execute("DELETE FROM api_keys")


def test_issue_validate_revoke_roundtrip():
    _clean_keys()
    issued = api_keys.issue("integration-a")
    assert issued["key"].startswith("xira_")
    assert issued["prefix"] == issued["key"][:18]
    assert api_keys.validate(issued["key"]) is True
    assert api_keys.validate("xira_wrong") is False
    assert api_keys.revoke(issued["prefix"]) is True
    assert api_keys.validate(issued["key"]) is False


def test_list_keys_never_returns_hashes():
    _clean_keys()
    api_keys.issue("no-secrets")
    keys = api_keys.list_keys()
    assert len(keys) == 1
    assert "key_hash" not in keys[0]
    assert keys[0]["prefix"].startswith("xira_")


def test_middleware_open_when_not_enforced():
    _clean_keys()
    res = client.get("/api/assets/all")
    assert res.status_code == 200
    res = client.get("/api/assets/all", headers={"Origin": "https://evil.example"})
    assert res.status_code == 200


def test_middleware_enforced(monkeypatch):
    _clean_keys()
    monkeypatch.setenv("XIRA_REQUIRE_API_KEY", "true")
    try:
        # Public reads stay open keyless by the route allowlist — a key is
        # never required (or accepted as the sole credential) for them.
        assert client.get("/api/assets/all").status_code == 200
        assert (
            client.get("/api/assets/all", headers={"Origin": "https://www.xira.surf"}).status_code
            == 200
        )
        assert client.get("/api/assets/all", headers={"X-API-Key": "bogus"}).status_code == 200

        # Non-public surfaces require a key when enforcement is on.
        assert client.get("/api/admin/keys").status_code == 401

        issued = api_keys.issue("enforced-test")
        res = client.get("/api/admin/keys", headers={"X-API-Key": issued["key"]})
        assert res.status_code == 401  # credentials alone are not admin

        # Open surfaces stay reachable without a key.
        assert client.get("/api/assets/health").status_code == 200
        # GET /mcp is not a public read; under enforcement it needs a key
        # before reaching the router's own 405.
        assert client.get("/mcp").status_code == 401
        res = client.get("/mcp", headers={"X-API-Key": issued["key"]})
        assert res.status_code == 405
    finally:
        monkeypatch.delenv("XIRA_REQUIRE_API_KEY")


def test_admin_endpoints_require_admin_token(monkeypatch):
    monkeypatch.setenv("XIRA_ADMIN_TOKEN", "secret-admin")
    try:
        assert client.get("/api/admin/keys").status_code == 401
        assert client.get("/api/admin/keys", headers={"x-admin-token": "wrong"}).status_code == 401

        res = client.post(
            "/api/admin/keys", json={"name": "partner"}, headers={"x-admin-token": "secret-admin"}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["ok"] is True
        assert body["key"].startswith("xira_")

        res = client.get("/api/admin/keys", headers={"x-admin-token": "secret-admin"})
        assert res.status_code == 200
        assert any(k["name"] == "partner" for k in res.json()["keys"])
    finally:
        monkeypatch.delenv("XIRA_ADMIN_TOKEN")
        _clean_keys()
