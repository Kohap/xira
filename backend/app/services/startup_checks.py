from __future__ import annotations
import logging
import os

from web3 import Web3

logger = logging.getLogger(__name__)


class StartupCheckError(RuntimeError):
    """Raised when a hard startup gate fails; the API must not boot."""


def _env_checksum(name: str) -> str | None:
    raw = os.getenv(name, "")
    if not raw:
        return None
    return Web3.to_checksum_address(raw)


def verify_chain_id(publisher, expected: int | None) -> str | None:
    """The RPC must be the chain we intend to write to."""
    if expected is None or publisher.chain_id is None:
        return None
    if publisher.chain_id != expected:
        raise StartupCheckError(
            f"Chain mismatch: RPC reports {publisher.chain_id}, "
            f"expected {expected} (XIRA_EXPECTED_CHAIN_ID). Refusing to start."
        )
    return None


def verify_contract_bytecode(publisher) -> str | None:
    """The configured contract must have deployed code at the address."""
    if not publisher.enabled or not publisher.w3 or not publisher.contract_address:
        return None
    code = publisher.w3.eth.get_code(Web3.to_checksum_address(publisher.contract_address))
    if not code or code in (b"0x", "0x", b""):
        raise StartupCheckError(
            f"No bytecode at XIRA_CONTRACT_ADDRESS {publisher.contract_address}. "
            "Refusing to start with a phantom contract."
        )
    return None


def verify_signer(publisher, expected: str | None) -> str | None:
    """The local key must produce the expected signer address."""
    if expected is None or not publisher.enabled or publisher.account is None:
        return None
    actual = publisher.account.address
    if Web3.to_checksum_address(actual) != expected:
        raise StartupCheckError(
            f"Signer mismatch: local key derives {actual}, expected {expected} "
            "(XIRA_EXPECTED_SIGNER). Refusing to start."
        )
    return None


def verify_contract_owner(publisher, expected: str | None) -> str | None:
    """The on-chain owner must match the expected admin (Safe/multisig)."""
    if expected is None or not publisher.enabled or publisher.contract is None:
        return None
    try:
        actual = publisher.contract.functions.owner().call()
    except Exception as e:
        raise StartupCheckError(
            f"Could not read contract owner(): {e}. Refusing to start."
        ) from e
    if Web3.to_checksum_address(actual) != expected:
        raise StartupCheckError(
            f"Contract owner {actual} != expected {expected} (XIRA_EXPECTED_OWNER). "
            "Refusing to start: the deployer key must not outrank the admin."
        )
    return None


def verify_signer_balance(publisher) -> str | None:
    """Soft gate: low gas is fatal to publishing but not to booting.

    Emits a warning and lets health/telegram alerts carry the signal.
    """
    if not publisher.enabled or publisher.w3 is None:
        return None
    bal = publisher.signer_balance_wei()
    if bal is None:
        return "Signer balance could not be read; publishing will likely fail."
    min_wei = Web3.to_wei(publisher.min_signer_balance_okb, "ether")
    if bal < min_wei:
        okb = float(bal) / 1e18
        return (
            f"Signer {publisher.account.address[:10]}… is underfunded "
            f"({okb:.4f} OKB < {publisher.min_signer_balance_okb} OKB). "
            "Publishing will fail until funded."
        )
    return None


def run_startup_checks(publisher) -> list[str]:
    """Run all gates. Returns a list of failure reasons.

    Hard failures raise StartupCheckError immediately (main.py refuses to
    boot); soft failures (balance) are returned so callers can surface them
    in logs/health without blocking startup.
    """
    expected_chain = os.getenv("XIRA_EXPECTED_CHAIN_ID")
    expected_signer = _env_checksum("XIRA_EXPECTED_SIGNER")
    expected_owner = _env_checksum("XIRA_EXPECTED_OWNER")

    warnings: list[str] = []

    verify_chain_id(publisher, int(expected_chain) if expected_chain else None)
    verify_contract_bytecode(publisher)
    verify_signer(publisher, expected_signer)
    verify_contract_owner(publisher, expected_owner)

    balance_warn = verify_signer_balance(publisher)
    if balance_warn:
        warnings.append(balance_warn)
        logger.error(balance_warn)

    if not publisher.enabled:
        logger.info(
            "Startup checks: publisher disabled — chain/bytecode/signer/owner "
            "gates skipped (dev/off-chain mode)."
        )
    else:
        logger.info(
            "Startup checks passed "
            f"(chain={publisher.chain_id}, signer={publisher.account.address[:10]}…)."
        )
    return warnings
