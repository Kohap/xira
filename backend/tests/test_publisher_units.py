from __future__ import annotations
import time
from app.services.publisher import (
    OnchainPublisher,
    MAX_GAS_PRICE_GWEI,
    BATCH_GAS_FALLBACK_CAP,
)
from web3 import Web3


def test_publisher_read_only_when_no_key():
    pub = OnchainPublisher(
        contract_address="0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E",
        private_key="",
    )
    assert pub.has_contract is True
    assert pub.enabled is False
    assert pub.account is None


def test_publisher_disabled_when_zero_address():
    pub = OnchainPublisher(
        contract_address="0x0000000000000000000000000000000000000000",
        private_key="",
    )
    assert pub.has_contract is False
    assert pub.enabled is False


def test_publisher_cooldown():
    pub = OnchainPublisher(
        contract_address="0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E",
        private_key="",
    )
    pub.min_interval_s = 60
    token = "0x1111111111111111111111111111111111111111"

    # No prior tx -> not in cooldown
    assert pub.in_cooldown(token) is False

    # Record a recent tx
    pub.last_tx_by_token[token] = {"timestamp": int(time.time()) - 10}
    assert pub.in_cooldown(token) is True

    # Record an older tx past interval
    pub.last_tx_by_token[token] = {"timestamp": int(time.time()) - 70}
    assert pub.in_cooldown(token) is False
