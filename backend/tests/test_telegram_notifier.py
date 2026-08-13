import time

from app.services import telegram_notifier as notifier


def test_evaluate_alert_fires_on_transition_and_clears():
    notifier._active.clear()
    notifier._last_sent_at.clear()
    notifier.TELEGRAM_BOT_TOKEN = ""
    notifier.TELEGRAM_CHAT_ID = ""

    notifier.evaluate_alerts(True, False, False, {"last_pass_hint": "never"})
    assert notifier._active == {"scheduler_stalled"}

    notifier.evaluate_alerts(True, False, False, {"last_pass_hint": "never"})
    assert notifier._active == {"scheduler_stalled"}

    notifier.evaluate_alerts(False, False, False, {"last_pass_hint": "never"})
    assert notifier._active == set()


def test_notify_respects_cooldown():
    sent = []
    notifier.TELEGRAM_BOT_TOKEN = "tok"
    notifier.TELEGRAM_CHAT_ID = "chat"
    notifier._last_sent_at.clear()

    original = notifier.send_message
    notifier.send_message = lambda text: sent.append(text) or True
    try:
        assert notifier.notify("publish_failing", "t", ["l"]) is True
        assert notifier.notify("publish_failing", "t2", ["l2"]) is False
        assert len(sent) == 1
        assert "l" in sent[0]

        notifier._last_sent_at["publish_failing"] = time.time() - notifier.ALERT_COOLDOWN_S - 1
        assert notifier.notify("publish_failing", "t3", ["l3"]) is True
        assert len(sent) == 2
    finally:
        notifier.send_message = original
        notifier.TELEGRAM_BOT_TOKEN = ""
        notifier.TELEGRAM_CHAT_ID = ""

def test_risk_alert_latches_per_symbol():
    from types import SimpleNamespace

    from app.services.scheduler import _check_risk_alert

    notifier._active.clear()
    notifier._last_sent_at.clear()
    notifier.TELEGRAM_BOT_TOKEN = ""
    notifier.TELEGRAM_CHAT_ID = ""

    calm = SimpleNamespace(
        anomaly=False,
        anomaly_reason="",
        risk_score=30,
        confidence=80,
        risk_level=SimpleNamespace(value="MODERATE"),
    )
    tripped = SimpleNamespace(
        anomaly=True,
        anomaly_reason="Volume spike.",
        risk_score=88,
        confidence=80,
        risk_level=SimpleNamespace(value="CRITICAL"),
    )

    _check_risk_alert("NVDAx", calm, {})
    assert "risk:NVDAx" not in notifier._active

    _check_risk_alert("NVDAx", tripped, {})
    assert "risk:NVDAx" in notifier._active

    _check_risk_alert("NVDAx", calm, {})
    assert "risk:NVDAx" not in notifier._active

    # Threshold breach alone trips it, without an anomaly.
    _check_risk_alert("NVDAx", calm, {"NVDAx": {"enabled": True, "threshold": 25}})
    assert "risk:NVDAx" in notifier._active
