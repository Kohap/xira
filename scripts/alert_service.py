#!/usr/bin/env python3
"""
XIRA Anomaly Alert Service

Monitors XIRA risk scores for anomaly alerts and sends webhook notifications.
Runs alongside the API backend or standalone against any XIRA API URL.

Supported webhooks: Discord, Slack, generic JSON webhook.
Also supports console-only mode (no webhook required).

Usage:
  python scripts/alert_service.py [--webhook-url YOUR_WEBHOOK_URL] [--interval 60]
"""

from __future__ import annotations
import os, sys, json, time, argparse
from datetime import datetime
from typing import Optional, Dict, List
import urllib.request
import urllib.error

API_URL = os.environ.get("XIRA_API_URL", "https://xira-gsb3.onrender.com")
WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "")
INTERVAL = int(os.environ.get("ALERT_INTERVAL", "60"))

ALERT_EMOJI = {
    "LOW": "\U0001F7E2",
    "MODERATE": "\U0001F7E1",
    "ELEVATED": "\U0001F7E0",
    "HIGH": "\U0001F534",
    "CRITICAL": "\U0001F480",
}

ALERT_COLOR = {
    "LOW": 3066993,
    "MODERATE": 16705372,
    "ELEVATED": 15105570,
    "HIGH": 15158332,
    "CRITICAL": 10038562,
}

_alert_cache: Dict[str, float] = {}


def api_get(path: str) -> Optional[dict]:
    try:
        url = f"{API_URL}{path}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  [!] API error: {e}", file=sys.stderr)
        return None


def format_ts(ts: int) -> str:
    return datetime.fromtimestamp(ts).strftime("%H:%M:%S")


def should_alert(symbol: str, score: int, anomaly: bool, severity_threshold: int = 60) -> bool:
    if anomaly:
        return True
    if score >= severity_threshold:
        last = _alert_cache.get(symbol, 0)
        if time.time() - last > 600:
            return True
    return False


def send_discord_webhook(webhook_url: str, assets: list[dict], summary: str) -> bool:
    anomalies = [a for a in assets if a.get("anomaly")]
    high_risk = [a for a in assets if a.get("risk_score", 0) >= 60 and not a.get("anomaly")]

    embeds = []
    for a in anomalies:
        level = a.get("risk_level", "UNKNOWN")
        embeds.append({
            "title": f"{ALERT_EMOJI.get(level, '⚠️')} Anomaly: {a['symbol']}",
            "description": a.get("explanation", ""),
            "color": ALERT_COLOR.get(level, 0),
            "fields": [
                {"name": "Risk Score", "value": f"{a.get('risk_score', '?')}/100", "inline": True},
                {"name": "Confidence", "value": f"{a.get('confidence', '?')}%", "inline": True},
                {"name": "Reason", "value": a.get("anomaly_reason", "No reason provided"), "inline": False},
            ],
            "timestamp": datetime.utcnow().isoformat(),
        })

    if high_risk and not anomalies:
        top = high_risk[:3]
        lines = "\n".join(
            f"{ALERT_EMOJI.get(a.get('risk_level',''),'')} **{a['symbol']}**: {a.get('risk_score','?')}/100 — {a.get('explanation','')[:80]}..."
            for a in top
        )
        embeds.append({
            "title": "Elevated Risk Alert",
            "description": f"**{len(high_risk)} assets** exceed risk threshold:\n\n{lines}",
            "color": 15105570,
            "timestamp": datetime.utcnow().isoformat(),
        })

    if not embeds:
        return False

    payload = {
        "username": "XIRA Risk Monitor",
        "avatar_url": "",
        "embeds": embeds[:10],
    }

    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 204
    except Exception as e:
        print(f"  [!] Webhook send failed: {e}", file=sys.stderr)
        return False


def send_slack_webhook(webhook_url: str, assets: list[dict], summary: str) -> bool:
    anomalies = [a for a in assets if a.get("anomaly")]
    high_risk = [a for a in assets if a.get("risk_score", 0) >= 60 and not a.get("anomaly")]
    if not anomalies and not high_risk:
        return False

    lines = []
    if anomalies:
        for a in anomalies:
            lines.append(
                f"{ALERT_EMOJI.get(a.get('risk_level', ''), ':warning:')} *{a['symbol']}* "
                f"score {a.get('risk_score', '?')}/100 ({a.get('risk_level', '?')}) — "
                f"{a.get('anomaly_reason') or a.get('explanation', '')}"
            )
    if high_risk and not anomalies:
        for a in high_risk[:5]:
            lines.append(
                f"{ALERT_EMOJI.get(a.get('risk_level', ''), ':fire:')} *{a['symbol']}* "
                f"score {a.get('risk_score', '?')}/100 — {a.get('explanation', '')[:120]}..."
            )

    if not lines:
        return False

    payload = {
        "text": summary or "XIRA risk alert",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "XIRA Risk Monitor" + (" — " + str(len(anomalies)) + " anomalies" if anomalies else "")},
            },
            {"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lines)}},
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"API: <{API_URL}/|XIRA dashboard> · {len(assets)} assets tracked · {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"}],
            },
        ],
    }

    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        print(f"  [!] Slack webhook send failed: {e}", file=sys.stderr)
        return False


def send_generic_webhook(webhook_url: str, assets: list[dict], summary: str) -> bool:
    anomalies = [a for a in assets if a.get("anomaly")]
    payload = {
        "source": "XIRA",
        "timestamp": datetime.utcnow().isoformat(),
        "summary": summary,
        "anomalies": [
            {
                "symbol": a["symbol"],
                "risk_score": a.get("risk_score"),
                "risk_level": a.get("risk_level"),
                "confidence": a.get("confidence"),
                "anomaly_reason": a.get("anomaly_reason"),
                "explanation": a.get("explanation", ""),
            }
            for a in anomalies
        ],
        "total_assets": len(assets),
    }

    if not anomalies:
        return False

    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        print(f"  [!] Webhook send failed: {e}", file=sys.stderr)
        return False


def print_console_alert(assets: list[dict], summary: str):
    anomalies = [a for a in assets if a.get("anomaly")]
    high_risk = [a for a in assets if a.get("risk_score", 0) >= 60 and not a.get("anomaly")]

    if anomalies:
        print(f"\n  ╔{'═'*50}╗")
        print(f"  ║  ANOMALY ALERT — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  ╠{'═'*50}╣")
        for a in anomalies:
            level = a.get("risk_level", "?")
            emoji = ALERT_EMOJI.get(level, "⚠️")
            print(f"  ║  {emoji} {a['symbol']}: score={a.get('risk_score','?')}/100 | {a.get('anomaly_reason','')}")
        print(f"  ╚{'═'*50}╝")

    if high_risk and not anomalies:
        print(f"\n  ┌{'─'*50}┐")
        print(f"  │  ELEVATED RISK — {len(high_risk)} assets above threshold")
        print(f"  ├{'─'*50}┤")
        for a in high_risk[:5]:
            level = a.get("risk_level", "?")
            emoji = ALERT_EMOJI.get(level, "⚠️")
            print(f"  │  {emoji} {a['symbol']}: {a.get('risk_score','?')}/100")
        print(f"  └{'─'*50}┘")

    if not anomalies and not high_risk:
        avg = sum(a.get("risk_score", 0) for a in assets) / max(len(assets), 1)
        print(f"\r  [{format_ts(int(time.time()))}] All clear — avg score {avg:.0f}/100  ", end="")


def send_webhook(webhook_url: str, assets: list[dict], summary: str) -> bool:
    url_lower = webhook_url.lower()
    if "discord" in url_lower and ("webhooks" in url_lower or "api/webhooks" in url_lower):
        return send_discord_webhook(webhook_url, assets, summary)
    if "slack" in url_lower and "hooks.slack" in url_lower:
        return send_slack_webhook(webhook_url, assets, summary)
    else:
        return send_generic_webhook(webhook_url, assets, summary)


def update_cache(assets: list[dict]):
    now = time.time()
    for a in assets:
        if a.get("anomaly") or a.get("risk_score", 0) >= 60:
            _alert_cache[a["symbol"]] = now


def run_loop(webhook_url: str = "", interval: int = 60):
    print(f"XIRA Alert Service starting")
    print(f"  API:   {API_URL}")
    print(f"  Hook:  {webhook_url or 'console-only mode'}")
    print(f"  Poll:  every {interval}s")
    print()

    iteration = 0
    while True:
        iteration += 1
        data = api_get("/api/assets/all")
        if not data:
            print(f"\n  [!] API down, retrying in 30s...")
            time.sleep(30)
            continue

        assets = data.get("assets", [])
        summary = data.get("summary", "")

        if webhook_url:
            sent = send_webhook(webhook_url, assets, summary)
            if sent:
                print(f"\n  [webhook sent] {datetime.now().strftime('%H:%M:%S')}")
            else:
                print_console_alert(assets, summary)
        else:
            print_console_alert(assets, summary)

        update_cache(assets)
        sys.stdout.flush()
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="XIRA Anomaly Alert Service")
    parser.add_argument("--api-url", default=API_URL, help="XIRA API base URL")
    parser.add_argument("--webhook-url", default=WEBHOOK_URL, help="Discord/Slack/Generic webhook URL")
    parser.add_argument("--interval", type=int, default=INTERVAL, help="Poll interval in seconds")
    parser.add_argument("--once", action="store_true", help="Check once and exit")
    parser.add_argument("--test-webhook", action="store_true", help="Send a test webhook message")
    args = parser.parse_args()

    if args.test_webhook and args.webhook_url:
        if "hooks.slack" in args.webhook_url.lower():
            test_payload = {"text": "✅ XIRA Alert Service is connected and ready."}
        else:
            test_payload = {
                "username": "XIRA Risk Monitor",
                "content": "✅ XIRA Alert Service is connected and ready.",
            }
        req = urllib.request.Request(
            args.webhook_url,
            data=json.dumps(test_payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"Webhook test: HTTP {resp.status}")
        return

    if args.once:
        data = api_get("/api/assets/all")
        if data:
            assets = data.get("assets", [])
            summary = data.get("summary", "")
            if args.webhook_url:
                if send_webhook(args.webhook_url, assets, summary):
                    print(f"  [webhook sent] {datetime.now().strftime('%H:%M:%S')}")
                else:
                    print("  [no alert conditions — webhook skipped]")
            print_console_alert(assets, summary)
        return

    run_loop(webhook_url=args.webhook_url, interval=args.interval)


if __name__ == "__main__":
    main()
