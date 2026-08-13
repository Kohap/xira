#!/usr/bin/env python3
"""
XIRA Mock Agent Consumer

Simulates an AI agent or DeFi vault consuming XIRA risk attestations
and making automated decisions based on risk scores.

Usage:
  python scripts/mock_agent.py [--api-url https://xira-api-production.up.railway.app]
"""

import sys, os, json, time, argparse
from datetime import datetime
from typing import Optional
import urllib.request
import urllib.error

API_URL = "https://xira-api-production.up.railway.app"
RISK_THRESHOLDS = {
    "LOW": (0, 20),
    "MODERATE": (21, 40),
    "ELEVATED": (41, 60),
    "HIGH": (61, 80),
    "CRITICAL": (81, 100),
}

VAULT_CONFIG = {
    "max_risk_exposure": 60,
    "rebalance_on_anomaly": True,
    "high_confidence_threshold": 70,
}


def _request(url: str) -> urllib.request.Request:
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("XIRA_API_KEY", "")
    if api_key:
        headers["X-API-Key"] = api_key
    return urllib.request.Request(url, headers=headers)


def fetch_all_assets(api_url: str) -> Optional[dict]:
    try:
        url = f"{api_url}/api/assets/all"
        with urllib.request.urlopen(_request(url), timeout=120) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  [!] API fetch failed: {e}")
        return None


def fetch_attestation(api_url: str, symbol: str) -> Optional[dict]:
    try:
        url = f"{api_url}/api/attestations/{symbol}"
        with urllib.request.urlopen(_request(url), timeout=120) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  [!] Failed to fetch {symbol}: {e}")
        return None


def make_decision(asset: dict) -> dict:
    score = asset["risk_score"]
    confidence = asset["confidence"]
    anomaly = asset["anomaly"]
    symbol = asset["symbol"]
    factors = asset.get("factors", [])

    if anomaly and VAULT_CONFIG["rebalance_on_anomaly"]:
        action = "EXIT"
        reason = f"Anomaly detected: {asset.get('anomaly_reason', 'Unknown')}"
    elif score <= VAULT_CONFIG["max_risk_exposure"]:
        if confidence >= VAULT_CONFIG["high_confidence_threshold"]:
            action = "ENTER" if score <= 30 else "HOLD"
            reason = "Low risk + high confidence" if score <= 30 else "Acceptable risk"
        else:
            action = "REDUCE"
            reason = "Low confidence in assessment"
    else:
        action = "EXIT"
        reason = f"Risk score {score} exceeds max exposure {VAULT_CONFIG['max_risk_exposure']}"

    weakest = min(factors, key=lambda f: f["score"]) if factors else None

    return {
        "symbol": symbol,
        "action": action,
        "reason": reason,
        "risk_score": score,
        "confidence": confidence,
        "alert": anomaly,
        "weakest_factor": weakest["label"] if weakest else "N/A",
    }


def print_header():
    print()
    print("=" * 72)
    print("  XIRA  —  Mock Agent Consumer")
    print("  Simulating AI agent / DeFi vault decisions")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)


def print_portfolio_summary(decisions: list[dict]):
    actions = {"ENTER": 0, "HOLD": 0, "REDUCE": 0, "EXIT": 0}
    for d in decisions:
        actions[d["action"]] += 1

    print()
    print("── Portfolio Summary ──")
    for action, count in actions.items():
        bar = "█" * count
        icon = {"ENTER": "🟢", "HOLD": "🔵", "REDUCE": "🟠", "EXIT": "🔴"}[action]
        print(f"  {icon} {action:<7} {count:>2} assets  {bar}")
    print()


def print_decisions(decisions: list[dict]):
    print()
    print(f"  {'Symbol':<8} {'Action':<8} {'Score':<7} {'Conf':<6} {'Alert':<7}  Weakest Factor")
    print(f"  {'-'*8} {'-'*8} {'-'*7} {'-'*6} {'-'*7}  {'-'*20}")
    for d in decisions:
        alert_icon = "⚠️ " if d["alert"] else "   "
        score_color = (
            "\033[92m" if d["risk_score"] <= 20
            else "\033[93m" if d["risk_score"] <= 40
            else "\033[33m" if d["risk_score"] <= 60
            else "\033[91m" if d["risk_score"] <= 80
            else "\033[31m"
        )
        action_icon = {"ENTER": "🟢", "HOLD": "🔵", "REDUCE": "🟠", "EXIT": "🔴"}[d["action"]]
        print(
            f"  {action_icon} {d['symbol']:<7} {d['action']:<8} "
            f"{score_color}{d['risk_score']:>3}/100\033[0m  "
            f"{d['confidence']:>3}%   {alert_icon:<7}  {d['weakest_factor']}"
        )
    print()


def loop_mode(api_url: str, interval: int = 60):
    """Continuously poll and print decisions."""
    iteration = 0
    while True:
        iteration += 1
        print_header()
        print(f"  Iteration {iteration}  |  API: {api_url}")
        print(f"  Vault config: max_risk={VAULT_CONFIG['max_risk_exposure']}, "
              f"confidence_min={VAULT_CONFIG['high_confidence_threshold']}%")

        data = fetch_all_assets(api_url)
        if not data:
            print("  [!] Backend not available, retrying in 30s...")
            time.sleep(30)
            continue

        assets = data["assets"]
        print(f"  Fetched {len(assets)} assets  |  {data['summary'][:60]}...")

        decisions = [make_decision(a) for a in assets]
        decisions.sort(key=lambda d: d["risk_score"], reverse=True)

        print_portfolio_summary(decisions)
        print_decisions(decisions)

        print(f"\n  Next refresh in {interval}s...")
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="XIRA Mock Agent Consumer")
    parser.add_argument("--api-url", default=API_URL, help="XIRA API base URL")
    parser.add_argument("--interval", type=int, default=60, help="Poll interval in seconds")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--symbol", help="Fetch single asset attestation")
    args = parser.parse_args()

    if args.symbol:
        attestation = fetch_attestation(args.api_url, args.symbol)
        if attestation:
            decision = make_decision(attestation)
            print(json.dumps(decision, indent=2))
        return

    if args.once:
        print_header()
        data = fetch_all_assets(args.api_url)
        if data:
            decisions = [make_decision(a) for a in data["assets"]]
            decisions.sort(key=lambda d: d["risk_score"], reverse=True)
            print_portfolio_summary(decisions)
            print_decisions(decisions)
        return

    loop_mode(args.api_url, args.interval)


if __name__ == "__main__":
    main()
