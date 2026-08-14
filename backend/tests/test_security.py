from __future__ import annotations
"""
Mainnet-security regression suite.

Covers: auth-by-route-allowlist (never Origin/Referer), no DB writes on
public GETs, admin-only mutating routes, publish idempotency via the ledger,
startup chain gates, and X-Forwarded-For spoof resistance.
"""
import os
import sys

os.environ["USE_LIVE_DATA"] = "false"
os.environ["PRIVATE_KEY"] = ""
os.environ["XIRA_CONTRACT_ADDRESS"] = "0x0000000000000000000000000000000000000000"

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.services.history_db import HistoryDB, history_db

client = TestClient(app)


def _snapshot_records() -> int:
    stats = history_db.get_stats()
    return int(stats.get("total_records", 0) or 0)


# ---------------------------------------------------------------------------
# Public reads: open keyless, never persist
# ---------------------------------------------------------------------------


def test_public_gets_open_keyless_with_require_api_key(monkeypatch):
    monkeypatch.setenv("XIRA_REQUIRE_API_KEY", "true")
    for path in (
        "/api/assets/all",
        "/api/assets/NVDAx",
        "/api/assets/stats",
        "/api/attestations/NVDAx",
        "/api/attestations/NVDAx/history",
        "/api/alerts",
        "/api/assets/health",
    ):
        res = client.get(path)
        assert res.status_code == 200, f"{path} should be public: {res.status_code}"


def test_public_gets_do_not_write_db(monkeypatch):
    monkeypatch.setenv("XIRA_REQUIRE_API_KEY", "true")
    before = _snapshot_records()
    assert client.get("/api/assets/all").status_code == 200
    assert client.get("/api/attestations/NVDAx").status_code == 200
    assert client.get("/api/assets/stats").status_code == 200
    assert _snapshot_records() == before, "public GETs must never store scores"


# ---------------------------------------------------------------------------
# Mutating routes: admin token required
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("put", "/api/alerts/thresholds", {"symbol": "NVDAx", "threshold": 70}),
        ("post", "/api/assets/NVDAx/rescore", None),
        ("post", "/api/alerts/ops/test", None),
        ("post", "/api/admin/keys", {"name": "t"}),
    ],
)
def test_mutating_routes_reject_missing_auth(monkeypatch, method, path, body):
    monkeypatch.setenv("XIRA_ADMIN_TOKEN", "topsecret")
    kwargs = {"json": body} if body is not None else {}
    res = getattr(client, method)(path, **kwargs)
    assert res.status_code == 401, f"{method.upper()} {path} must 401 without admin auth"


def test_mutating_routes_reject_wrong_token(monkeypatch):
    monkeypatch.setenv("XIRA_ADMIN_TOKEN", "topsecret")
    res = client.put(
        "/api/alerts/thresholds",
        json={"symbol": "NVDAx", "threshold": 70},
        headers={"x-admin-token": "wrong"},
    )
    assert res.status_code == 401
    res = client.post(
        "/api/assets/NVDAx/rescore",
        headers={"x-admin-token": "wrong"},
    )
    assert res.status_code == 401


def test_mutating_routes_accept_admin_token(monkeypatch):
    monkeypatch.setenv("XIRA_ADMIN_TOKEN", "topsecret")
    res = client.put(
        "/api/alerts/thresholds",
        json={"symbol": "NVDAx", "threshold": 70},
        headers={"x-admin-token": "topsecret"},
    )
    assert res.status_code == 200
    res = client.put(
        "/api/alerts/thresholds",
        json={"symbol": "NVDAx", "threshold": 70},
        headers={"authorization": "Bearer topsecret"},
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Origin/Referer can never authenticate
# ---------------------------------------------------------------------------


def test_forged_origin_does_not_bypass_auth(monkeypatch):
    monkeypatch.setenv("XIRA_REQUIRE_API_KEY", "true")
    monkeypatch.setenv("XIRA_ADMIN_TOKEN", "topsecret")
    forged = {
        "origin": "https://www.xira.surf",
        "referer": "https://www.xira.surf/",
    }
    res = client.post("/api/alerts/ops/test", headers=forged)
    assert res.status_code == 401, "forged frontend Origin must not bypass admin auth"
    res = client.get("/api/admin/keys", headers=forged)
    assert res.status_code == 401, "forged Origin must not bypass the API-key gate"
    res = client.get("/api/assets/history", headers=forged)
    assert res.status_code == 200, "public reads stay open regardless of Origin"


def test_debug_endpoint_requires_admin_even_when_enabled(monkeypatch):
    monkeypatch.setenv("XIRA_ENABLE_DEBUG", "true")
    monkeypatch.setenv("XIRA_ADMIN_TOKEN", "topsecret")
    res = client.get("/debug/data-sources")
    assert res.status_code == 401, "debug endpoint must 401 without an admin token"
    res = client.get(
        "/debug/data-sources",
        headers={"x-admin-token": "topsecret"},
    )
    assert res.status_code == 200, "debug endpoint must answer admins"
    res = client.get(
        "/debug/data-sources",
        headers={"authorization": "Bearer topsecret"},
    )
    assert res.status_code == 200, "Bearer admin auth must also pass"


def test_debug_endpoint_hidden_when_disabled(monkeypatch):
    monkeypatch.setenv("XIRA_ENABLE_DEBUG", "false")
    res = client.get("/debug/data-sources")
    assert res.status_code == 404, "disabled debug endpoint must stay 404"


def test_rescore_never_publishes_without_admin(monkeypatch):
    from app.routers.assets import publisher as pub
    from app.routers.assets import ai_engine

    monkeypatch.setattr(pub, "enabled", True)
    monkeypatch.setattr(pub, "update_attestation", lambda **kw: {"tx_hash": "x", "explorer_url": "y"})
    monkeypatch.setattr(pub, "read_latest", lambda token: None)
    monkeypatch.setattr(os, "getenv", lambda k, d=None: {
        "XIRA_DEVIATION_THRESHOLD": "3",
        "XIRA_ADMIN_TOKEN": "topsecret",
    }.get(k, d))
    monkeypatch.setattr(ai_engine, "analyze", lambda **kw: __import__("app.models", fromlist=["AttestationResponse"]).AttestationResponse(
        symbol="NVDAx", risk_score=88, risk_level="HIGH", confidence=80, factors=[],
        explanation="t", anomaly=False, anomaly_reason="", evidence_hash="0x" + "ef" * 32,
        timestamp=1_700_000_000, model_version="v1.0.0", data_source="live",
        data_freshness_ms=0,
    ))
    res = client.post("/api/assets/NVDAx/rescore")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Publish idempotency (ledger)
# ---------------------------------------------------------------------------


def test_ledger_prevents_duplicate_attestations(tmp_path):
    db = HistoryDB(tmp_path / "idem.db")
    h = "0x" + "ab" * 32

    first = db.record_publish_attempt("NVDAx", 60, 80, h, "v1.0.0")
    assert first["status"] == "pending"

    second = db.record_publish_attempt("NVDAx", 60, 80, h, "v1.0.0")
    assert second["id"] == first["id"]
    assert second["status"] == "pending"

    db.mark_publish_result("NVDAx", h, "v1.0.0", "confirmed", tx_hash="0xtx")
    third = db.record_publish_attempt("NVDAx", 60, 80, h, "v1.0.0")
    assert third["status"] == "confirmed"
    assert third["tx_hash"] == "0xtx"

    db.mark_publish_result("NVDAx", h, "v1.0.0", "failed")
    retried = db.record_publish_attempt("NVDAx", 60, 80, h, "v1.0.0")
    assert retried["status"] == "pending", "failed attempts must re-arm for retry"


def test_ledger_replaces_oldest_pending_when_new_evidence_publishes(tmp_path):
    db = HistoryDB(tmp_path / "repl.db")
    old = "0x" + "aa" * 32
    new = "0x" + "bb" * 32

    db.record_publish_attempt("NVDAx", 60, 80, old, "v1.0.0")
    db.record_publish_attempt("NVDAx", 75, 85, new, "v1.0.0")
    db.mark_publish_result("NVDAx", new, "v1.0.0", "confirmed", tx_hash="0xnew", replaced=True)

    assert db.get_publish_attempt(1)["status"] == "replaced"
    assert db.get_publish_attempt(2)["status"] == "confirmed"


def test_scheduler_skips_attestation_already_in_ledger(monkeypatch, tmp_path):
    from app.services import scheduler as sched
    from app.models import AttestationResponse

    db = HistoryDB(tmp_path / "sched.db")
    monkeypatch.setattr(sched, "history_db", db)

    attested_hash = "0x" + "cd" * 32
    chain_hash = "0x" + "ab" * 32

    calls = {"batch": []}
    monkeypatch.setattr(sched.publisher, "enabled", True)
    monkeypatch.setattr(sched.publisher, "read_latest", lambda token: {
        "score": 60, "confidence": 80, "evidence_hash": chain_hash,
        "timestamp": 1_700_000_000, "model_version": "v1.0.0",
        "anomaly": False, "anomaly_reason": "",
    })
    monkeypatch.setattr(sched.publisher, "publish_batch", lambda entries: calls["batch"].append(entries) or {
        "sent": 0, "published": 0, "failed": 0, "txs": [], "fallbacks": 0,
        "succeeded": set(), "tx_by_token": {},
    })

    def fake_analyze(**kw):
        # NVDAx differs from chain (80 vs 60, fresh hash); every other
        # symbol matches the chain hash so only NVDAx reaches the ledger.
        fresh = kw["symbol"] == "NVDAx"
        return AttestationResponse(
            symbol=kw["symbol"],
            risk_score=80 if fresh else 60,
            risk_level="HIGH" if fresh else "MODERATE",
            confidence=80,
            factors=[],
            explanation="t",
            anomaly=False,
            anomaly_reason="",
            evidence_hash=attested_hash if fresh else chain_hash,
            timestamp=1_700_000_000,
            model_version="v1.0.0",
            data_source="live",
            data_freshness_ms=0,
        )

    monkeypatch.setattr(sched, "ai_engine", type("AI", (), {"analyze": staticmethod(fake_analyze)})())

    class FakeFetcher:
        def fetch_all_prices(self, tickers, force=False, **kw):
            return {t: None for t in tickers}, {}

        def fetch_all_sentiments(self, tickers, prices, **kw):
            return {t: 0.5 for t in tickers}, {}

    monkeypatch.setattr(sched, "data_fetcher", FakeFetcher())

    # Crash-recovery scenario: tx broadcast but receipt never observed —
    # the ledger holds a pending attempt WITH a tx hash for NVDAx's evidence.
    db.record_publish_attempt("NVDAx", 80, 80, attested_hash, "v1.0.0")
    db.mark_publish_result("NVDAx", attested_hash, "v1.0.0", "pending", tx_hash="0xpending")

    passes_before = sched._diag["pass_count"]
    sched._run_pass()
    assert sched._diag["pass_count"] == passes_before + 1
    assert calls["batch"] == [], "ledger-seen attestation must not be broadcast again"


# ---------------------------------------------------------------------------
# Startup chain gates
# ---------------------------------------------------------------------------


def test_wrong_chain_id_fails_startup(monkeypatch):
    from app.services.startup_checks import run_startup_checks, StartupCheckError

    monkeypatch.setenv("XIRA_EXPECTED_CHAIN_ID", "196")

    class FailingPub:
        enabled = True
        chain_id = 1  # wrong chain; production expects X Layer Mainnet
        account = None
        contract_address = ""
        rpc_url = "https://rpc.xlayer.tech"
        min_signer_balance_wei = 5 * 10**16

        def signer_balance_wei(self):
            return 10**18

    with pytest.raises(StartupCheckError, match="Chain mismatch"):
        run_startup_checks(FailingPub())


def test_startup_passes_when_checks_align(monkeypatch):
    from app.services.startup_checks import run_startup_checks

    monkeypatch.setenv("XIRA_EXPECTED_CHAIN_ID", "196")
    monkeypatch.delenv("XIRA_EXPECTED_SIGNER", raising=False)
    monkeypatch.delenv("XIRA_EXPECTED_OWNER", raising=False)

    class GoodPub:
        enabled = False  # dev mode: gates are skipped, no crash
        chain_id = None
        account = None
        contract_address = ""
        min_signer_balance_wei = 5 * 10**16
        w3 = None
        contract = None

        def signer_balance_wei(self):
            return None

    assert run_startup_checks(GoodPub()) == []


def test_owner_gate_catches_mismatch(monkeypatch):
    from app.services.startup_checks import run_startup_checks, StartupCheckError

    monkeypatch.setenv("XIRA_EXPECTED_OWNER", "0x1111111111111111111111111111111111111111")

    class OwnerFn:
        class OwnerFunction:
            def call(self):
                return "0x9999999999999999999999999999999999999999"  # != expected

        def owner(self):
            return OwnerFn.OwnerFunction()

    class Eth:
        @staticmethod
        def get_code(addr):
            return b"\x60\x60"

    class W3:
        eth = Eth()

    class Contract:
        functions = OwnerFn()

    class Account:
        address = "0x2222222222222222222222222222222222222222"

    class Pub:
        enabled = True
        chain_id = 196
        contract_address = "0x3333333333333333333333333333333333333333"
        account = Account()
        contract = Contract()
        w3 = W3()
        min_signer_balance_wei = 5 * 10**16

        def signer_balance_wei(self):
            return 10**18

    with pytest.raises(StartupCheckError, match="Contract owner"):
        run_startup_checks(Pub())


# ---------------------------------------------------------------------------
# Rate-limit keying: X-Forwarded-For spoof resistance
# ---------------------------------------------------------------------------


def _make_request(peer: str, xff: str | None = None) -> Request:
    headers = {}
    if xff:
        headers[b"x-forwarded-for"] = xff.encode()
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(k, v) for k, v in headers.items()],
        "client": (peer, 12345),
    }
    return Request(scope)


def test_client_ip_ignores_xff_without_trusted_proxies(monkeypatch):
    import app.services.rate_limit as rl

    monkeypatch.setattr(rl, "TRUSTED_PROXIES", [])
    req = _make_request(peer="1.2.3.4", xff="9.9.9.9")
    assert rl.client_ip(req) == "1.2.3.4", "untrusted XFF must be ignored"


def test_client_ip_honors_xff_from_trusted_proxy(monkeypatch):
    import ipaddress
    import app.services.rate_limit as rl

    monkeypatch.setattr(rl, "TRUSTED_PROXIES", [ipaddress.ip_network("10.0.0.0/8")])
    req = _make_request(peer="10.0.0.5", xff="9.9.9.9, 8.8.8.8")
    assert rl.client_ip(req) == "8.8.8.8", "trusted-proxy XFF uses the rightmost entry"


def test_xff_spoof_cannot_rotate_rate_limit_buckets(monkeypatch):
    import app.services.rate_limit as rl

    monkeypatch.setattr(rl, "TRUSTED_PROXIES", [])
    key_a = f"{rl.client_ip(_make_request('5.5.5.5', xff='1.1.1.1'))}:route"
    key_b = f"{rl.client_ip(_make_request('5.5.5.5', xff='2.2.2.2'))}:route"
    assert key_a == key_b, "attacker-supplied XFF must not create fresh buckets"
