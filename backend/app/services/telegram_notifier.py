from __future__ import annotations
import logging, os, time

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
ALERT_COOLDOWN_S = float(os.getenv("XIRA_ALERT_COOLDOWN_S", "1800"))
SEND_TIMEOUT = 10.0

_active: set[str] = set()
_last_sent_at: dict[str, float] = {}


def enabled() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)


def send_message(text: str) -> bool:
    """Send a plain-text message via the Telegram Bot API. No-op when unconfigured."""
    if not enabled():
        logger.info("Telegram notifier: not configured (TELEGRAM_BOT_TOKEN/CHAT_ID unset).")
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        resp = httpx.post(
            url,
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text},
            timeout=SEND_TIMEOUT,
        )
        ok = resp.status_code == 200 and resp.json().get("ok", False)
        if not ok:
            logger.warning(f"Telegram send failed: {resp.status_code} {resp.text[:200]}")
        return ok
    except Exception as e:
        logger.warning(f"Telegram send error: {e}")
        return False


def _cooldown_ok(key: str) -> bool:
    now = time.time()
    if key not in _last_sent_at:
        return True
    return (now - _last_sent_at[key]) >= ALERT_COOLDOWN_S


def notify(alert_type: str, title: str, lines: list[str]) -> bool:
    """Dedupe-aware alert: one message per alert_type per cooldown window."""
    if not enabled():
        return False
    if not _cooldown_ok(alert_type):
        logger.info(f"Alert '{alert_type}' suppressed (cooldown).")
        return False
    body = f"XIRA Ops Alert: {title}\n" + "\n".join(f"- {l}" for l in lines)
    ok = send_message(body)
    if ok:
        _last_sent_at[alert_type] = time.time()
    return ok


def _flagged(alert_type: str, flag: bool, title: str, lines: list[str]) -> None:
    """Fire on false->true transition; clear the latch when healthy again."""
    if flag:
        if alert_type not in _active:
            _active.add(alert_type)
            notify(alert_type, title, lines)
    elif alert_type in _active:
        _active.discard(alert_type)
        logger.info(f"Alert '{alert_type}' cleared (healthy again).")


def evaluate_alerts(scheduler_stalled: bool, publish_failing: bool, publish_stale: bool, context: dict) -> None:
    """Evaluate health flags and fire Telegram alerts on transitions.
    Mirrors the flag logic in /api/assets/health so both stay in sync."""
    _flagged(
        "scheduler_stalled",
        scheduler_stalled,
        "Scheduler stalled",
        [
            "No scheduler pass for more than 2 heartbeats.",
            f"Last pass: {context.get('last_pass_hint', 'unknown')}",
        ],
    )
    _flagged(
        "publish_failing",
        publish_failing,
        "On-chain publishing failing",
        [
            f"{context.get('consecutive_failures', 0)} consecutive tx failures.",
            f"Last error: {context.get('last_error', 'none') or 'none'}",
        ],
    )
    _flagged(
        "publish_stale",
        publish_stale,
        "Publisher never succeeded",
        [
            "Publisher enabled but no successful publish yet.",
            f"Signer: {context.get('signer', 'unknown')}",
        ],
    )
