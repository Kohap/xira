from __future__ import annotations
import os, logging, time
from typing import Optional

from web3 import Web3

logger = logging.getLogger(__name__)

XLAYER_MAINNET_RPC = "https://rpc.xlayer.tech"
DEFAULT_EXPLORER_BASE = "https://www.okx.com/web3/explorer/xlayer"

MAX_NONCE_RETRIES = int(os.getenv("XIRA_MAX_NONCE_RETRIES", "3"))
MIN_SIGNER_BALANCE_OKB = float(os.getenv("XIRA_MIN_SIGNER_BALANCE_OKB", "0.05"))
BALANCE_CACHE_TTL_S = 60.0
BATCH_CHUNK = max(1, int(os.getenv("XIRA_BATCH_CHUNK", "12")))


def _get_abi() -> list:
    attestation_input = {
        "components": [
            {"internalType": "address", "name": "asset", "type": "address"},
            {"internalType": "uint8", "name": "score", "type": "uint8"},
            {"internalType": "uint8", "name": "confidence", "type": "uint8"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"internalType": "string", "name": "modelVersion", "type": "string"},
            {"internalType": "bool", "name": "anomaly", "type": "bool"},
            {"internalType": "string", "name": "anomalyReason", "type": "string"},
        ],
        "internalType": "struct XIRA.AttestationInput",
        "name": "inputs",
        "type": "tuple[]",
    }
    return [
        {
            "inputs": [attestation_input],
            "name": "batchUpdateAttestations",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function",
        },
        {
            "inputs": [
                {"internalType": "address", "name": "asset", "type": "address"},
                {"internalType": "uint8", "name": "score", "type": "uint8"},
                {"internalType": "uint8", "name": "confidence", "type": "uint8"},
                {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                {"internalType": "string", "name": "modelVersion", "type": "string"},
                {"internalType": "bool", "name": "anomaly", "type": "bool"},
                {"internalType": "string", "name": "anomalyReason", "type": "string"},
            ],
            "name": "updateAttestation",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function",
        },
        {
            "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
            "name": "getLatestAttestation",
            "outputs": [
                {"internalType": "uint8", "name": "score", "type": "uint8"},
                {"internalType": "uint8", "name": "confidence", "type": "uint8"},
                {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                {"internalType": "uint64", "name": "timestamp", "type": "uint64"},
                {"internalType": "string", "name": "modelVersion", "type": "string"},
                {"internalType": "bool", "name": "anomaly", "type": "bool"},
                {"internalType": "string", "name": "anomalyReason", "type": "string"},
            ],
            "stateMutability": "view",
            "type": "function",
        },
        {
            "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
            "name": "getScore",
            "outputs": [{"internalType": "uint8", "name": "score", "type": "uint8"}],
            "stateMutability": "view",
            "type": "function",
        },
        {
            "inputs": [],
            "name": "owner",
            "outputs": [{"internalType": "address", "name": "", "type": "address"}],
            "stateMutability": "view",
            "type": "function",
        },
        {
            "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
            "name": "getHistory",
            "outputs": [
                {
                    "components": [
                        {"internalType": "uint8", "name": "score", "type": "uint8"},
                        {"internalType": "uint8", "name": "confidence", "type": "uint8"},
                        {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                        {"internalType": "uint64", "name": "timestamp", "type": "uint64"},
                        {"internalType": "string", "name": "modelVersion", "type": "string"},
                        {"internalType": "bool", "name": "anomaly", "type": "bool"},
                        {"internalType": "string", "name": "anomalyReason", "type": "string"},
                    ],
                    "internalType": "struct XIRA.Attestation[]",
                    "name": "",
                    "type": "tuple[]",
                }
            ],
            "stateMutability": "view",
            "type": "function",
        },
    ]


class OnchainPublisher:
    def __init__(
        self,
        rpc_url: str = "",
        contract_address: str = "",
        private_key: str = "",
    ):
        self.rpc_url = rpc_url or os.getenv("XLAYER_RPC_URL", XLAYER_MAINNET_RPC)
        self.rpc_fallback = os.getenv("XIRA_RPC_FALLBACK", "")
        self.explorer_base = os.getenv(
            "XIRA_EXPLORER_BASE", DEFAULT_EXPLORER_BASE
        )
        self.chain_label = os.getenv("XIRA_CHAIN_LABEL", "xlayer-mainnet")
        self.contract_address = contract_address or os.getenv("XIRA_CONTRACT_ADDRESS", "")
        self.private_key = private_key or os.getenv("PRIVATE_KEY", "")
        self.w3: Optional[Web3] = None
        self.contract = None
        self.account = None
        self.enabled = bool(
            self.contract_address
            and self.contract_address != "0x0000000000000000000000000000000000000000"
            and self.private_key
        )
        self.chain_id: Optional[int] = None
        self.min_signer_balance_wei = Web3.to_wei(MIN_SIGNER_BALANCE_OKB, "ether")
        self._balance_cache: Optional[tuple[float, int]] = None
        self.last_tx_error: Optional[str] = None
        self.last_tx_by_token: dict[str, dict] = {}
        self.publishes: int = 0
        self.last_publish_at: Optional[float] = None
        self.last_attempt_at: Optional[float] = None
        self.consecutive_failures: int = 0
        self.error_history: list[dict] = []
        self._init_web3()

    def _init_web3(self):
        if not self.enabled:
            logger.info("OnchainPublisher: off-chain mode (no contract or key configured).")
            return

        urls = [self.rpc_url]
        if self.rpc_fallback and self.rpc_fallback != self.rpc_url:
            urls.append(self.rpc_fallback)

        for url in urls:
            try:
                w3 = Web3(Web3.HTTPProvider(url))
                if w3.is_connected():
                    self.w3 = w3
                    self.rpc_url = url
                    break
                logger.warning(f"RPC connection failed: {url}")
            except Exception as e:
                logger.warning(f"RPC init error for {url}: {e}")

        if self.w3 is None:
            logger.error("All RPC endpoints unreachable. Running off-chain.")
            self.enabled = False
            return

        try:
            self.chain_id = self.w3.eth.chain_id
            self.account = self.w3.eth.account.from_key(self.private_key)
            checksum = self.w3.to_checksum_address(self.contract_address)

            self.contract = self.w3.eth.contract(address=checksum, abi=_get_abi())

            logger.info(
                f"OnchainPublisher connected | Chain: {self.chain_id} ({self.chain_label}) "
                f"| RPC: {self.rpc_url} "
                f"| Account: {self.account.address[:10]}... "
                f"| Contract: {self.contract_address[:10]}..."
            )
        except Exception as e:
            logger.warning(f"OnchainPublisher init failed: {e}. Running off-chain.")
            self.enabled = False

    def signer_balance_wei(self) -> Optional[int]:
        """Signer native-token balance (wei), cached for BALANCE_CACHE_TTL_S."""
        if not self.enabled or not self.w3 or not self.account:
            return None
        now = time.time()
        if self._balance_cache and now - self._balance_cache[0] < BALANCE_CACHE_TTL_S:
            return self._balance_cache[1]
        try:
            bal = self.w3.eth.get_balance(self.account.address)
            self._balance_cache = (now, bal)
            return bal
        except Exception as e:
            logger.warning(f"Balance read failed: {e}")
            return self._balance_cache[1] if self._balance_cache else None

    def signer_balance_okb(self) -> Optional[float]:
        bal = self.signer_balance_wei()
        return None if bal is None else float(bal) / 1e18

    def _estimate_gas(
        self,
        token_address: str,
        score: int,
        confidence: int,
        evidence_bytes: bytes,
        model_version: str,
        anomaly: bool,
        anomaly_reason: str,
    ) -> int:
        try:
            return self.contract.functions.updateAttestation(
                self.w3.to_checksum_address(token_address),
                score,
                confidence,
                evidence_bytes,
                model_version,
                anomaly,
                anomaly_reason or "",
            ).estimate_gas({
                "from": self.account.address,
            })
        except Exception:
            return 300000

    def publish_batch(self, entries: list[dict]) -> dict:
        """Publish several attestations in chunked batchUpdateAttestations
        txs (gas-efficient at 50+ assets). Falls back to per-asset txs if a
        chunk reverts (e.g. an asset tripped the per-asset min interval)."""
        summary = {
            "sent": 0, "published": 0, "failed": 0, "txs": [],
            "fallbacks": 0, "succeeded": set(), "tx_by_token": {},
        }
        if not self.enabled or not self.contract or not self.w3 or not self.account:
            summary["failed"] = len(entries)
            return summary

        def _succeed(e, txinfo: dict | None = None):
            summary["published"] += 1
            summary["succeeded"].add(e["token_address"])
            if txinfo:
                summary["tx_by_token"][e["token_address"]] = txinfo

        for start in range(0, len(entries), BATCH_CHUNK):
            chunk = entries[start : start + BATCH_CHUNK]
            inputs = []
            for e in chunk:
                ev = bytes.fromhex(e["evidence_hash_hex"].replace("0x", ""))
                if len(ev) != 32:
                    ev = ev.ljust(32, b"\x00")[:32]
                inputs.append([
                    self.w3.to_checksum_address(e["token_address"]),
                    e["score"],
                    e["confidence"],
                    ev,
                    e["model_version"],
                    e["anomaly"],
                    e.get("anomaly_reason") or "",
                ])

            self.last_attempt_at = time.time()
            for attempt in range(MAX_NONCE_RETRIES):
                try:
                    tx = self.contract.functions.batchUpdateAttestations(inputs).build_transaction({
                        "from": self.account.address,
                        "nonce": self.w3.eth.get_transaction_count(self.account.address),
                        "gas": self._estimate_batch_gas(inputs),
                        "gasPrice": self.w3.eth.gas_price,
                        "chainId": self.chain_id,
                    })
                    signed = self.account.sign_transaction(tx)
                    tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
                    receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                    if receipt.get("status") != 1:
                        raise RuntimeError(f"batch tx reverted: {tx_hash.hex()}")
                    summary["sent"] += len(chunk)
                    txinfo = {
                        "tx_hash": tx_hash.hex(),
                        "explorer_url": f"{self.explorer_base}/tx/{tx_hash.hex()}",
                        "block": receipt.get("blockNumber", 0),
                        "entries": len(chunk),
                        "gas_used": receipt.get("gasUsed", 0),
                    }
                    for e in chunk:
                        _succeed(e, txinfo)
                    summary["txs"].append(txinfo)
                    self.publishes += 1
                    self.last_publish_at = time.time()
                    self.consecutive_failures = 0
                    for e in chunk:
                        self.last_tx_by_token[e["token_address"]] = txinfo
                    break
                except Exception as e:
                    err = f"{e}"
                    if "nonce too low" in err.lower() and attempt < MAX_NONCE_RETRIES - 1:
                        time.sleep(1.0 * (attempt + 1))
                        continue
                    if attempt < MAX_NONCE_RETRIES - 1:
                        time.sleep(1.0)
                        continue
                    # Last attempt failed: retry each entry individually so
                    # one bad asset doesn't block the whole pass.
                    summary["fallbacks"] += 1
                    for e in chunk:
                        tx = self.update_attestation(
                            token_address=e["token_address"],
                            score=e["score"],
                            confidence=e["confidence"],
                            evidence_hash_hex=e["evidence_hash_hex"],
                            model_version=e["model_version"],
                            anomaly=e["anomaly"],
                            anomaly_reason=e.get("anomaly_reason") or "",
                        )
                        if tx:
                            _succeed(e, {"tx_hash": tx["tx_hash"], "explorer_url": tx["explorer_url"]})
                        else:
                            summary["failed"] += 1
                    break
        return summary

    def _estimate_batch_gas(self, inputs: list) -> int:
        try:
            return self.contract.functions.batchUpdateAttestations(inputs).estimate_gas(
                {"from": self.account.address}
            )
        except Exception:
            return 300000 * max(1, len(inputs))

    def update_attestation(
        self,
        token_address: str,
        score: int,
        confidence: int,
        evidence_hash_hex: str,
        model_version: str,
        anomaly: bool,
        anomaly_reason: str,
    ) -> Optional[dict]:
        if not self.enabled or not self.contract or not self.w3 or not self.account:
            return None

        self.last_attempt_at = time.time()

        evidence_bytes = bytes.fromhex(evidence_hash_hex.replace("0x", ""))
        if len(evidence_bytes) != 32:
            evidence_bytes = evidence_bytes.ljust(32, b"\x00")[:32]

        for attempt in range(MAX_NONCE_RETRIES):
            try:
                tx = self.contract.functions.updateAttestation(
                    self.w3.to_checksum_address(token_address),
                    score,
                    confidence,
                    evidence_bytes,
                    model_version,
                    anomaly,
                    anomaly_reason or "",
                ).build_transaction({
                    "from": self.account.address,
                    "nonce": self.w3.eth.get_transaction_count(self.account.address),
                    "gas": self._estimate_gas(token_address, score, confidence, evidence_bytes, model_version, anomaly, anomaly_reason),
                    "gasPrice": self.w3.eth.gas_price,
                    "chainId": self.chain_id,
                })

                signed = self.account.sign_transaction(tx)
                tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

                if receipt is None or receipt.get("status") != 1:
                    logger.error(
                        f"Attestation tx reverted (status {receipt.get('status') if receipt else None}) "
                        f"for {token_address}. Not counting as published."
                    )
                    self._record_failure(f"tx reverted for {token_address}", token_address)
                    self.last_tx_error = f"tx reverted for {token_address}"
                    return None

                h = tx_hash.hex()
                explorer = f"{self.explorer_base}/tx/{h}"
                logger.info(f"Attestation published: {h[:20]}... ({explorer})")
                self.publishes += 1
                self.last_publish_at = time.time()
                self.consecutive_failures = 0
                self.last_tx_by_token[token_address] = {
                    "tx_hash": h,
                    "explorer_url": explorer,
                    "block": receipt.get("blockNumber", 0),
                    "timestamp": int(time.time()),
                }

                return {
                    "tx_hash": h,
                    "explorer_url": explorer,
                    "block": receipt.get("blockNumber", 0),
                    "gas_used": receipt.get("gasUsed", 0),
                }
            except Exception as e:
                err = f"{e}"
                # Another instance raced us to the same nonce. Re-fetch and retry.
                if "nonce too low" in err.lower() and attempt < MAX_NONCE_RETRIES - 1:
                    logger.warning(
                        f"Nonce race for {token_address} (nonce too low), retrying "
                        f"{attempt + 1}/{MAX_NONCE_RETRIES} with a fresh nonce."
                    )
                    time.sleep(1.0 * (attempt + 1))
                    continue
                self._record_failure(f"{type(e).__name__}: {e}", token_address)
                self.last_tx_error = f"{type(e).__name__}: {e}"
                logger.error(f"Tx failed for {token_address}: {e}")
                return None

        self._record_failure(f"exceeded {MAX_NONCE_RETRIES} nonce retries", token_address)
        self.last_tx_error = f"tx: exceeded {MAX_NONCE_RETRIES} nonce retries"
        return None

    def _record_failure(self, message: str, token_address: str) -> None:
        self.consecutive_failures += 1
        now = int(time.time())
        self.error_history.append({"ts": now, "token": token_address, "error": message})
        cutoff = now - 86400
        self.error_history = [
            e for e in self.error_history if e["ts"] >= cutoff
        ][-20:]

    def status(self) -> dict:
        """Runtime health snapshot for /health and external monitors."""
        bal_okb = self.signer_balance_okb()
        return {
            "enabled": self.enabled,
            "chain_id": self.chain_id,
            "chain_label": self.chain_label,
            "rpc_url": self.rpc_url,
            "signer": self.account.address if self.enabled and self.account else None,
            "signer_balance_okb": bal_okb,
            "signer_balance_min_okb": MIN_SIGNER_BALANCE_OKB,
            "signer_balance_low": bool(
                bal_okb is not None and bal_okb < MIN_SIGNER_BALANCE_OKB
            ),
            "publishes": self.publishes,
            "last_publish_at": self.last_publish_at,
            "last_attempt_at": self.last_attempt_at,
            "consecutive_failures": self.consecutive_failures,
            "last_error": self.last_tx_error,
            "errors_24h": self.error_history,
        }

    def last_tx(self, token_address: str) -> Optional[dict]:
        return self.last_tx_by_token.get(token_address)

    def read_latest(self, token_address: str) -> Optional[dict]:
        if not self.contract or not self.w3:
            return None
        try:
            result = self.contract.functions.getLatestAttestation(
                self.w3.to_checksum_address(token_address)
            ).call()
            return {
                "score": result[0],
                "confidence": result[1],
                "evidence_hash": "0x" + result[2].hex(),
                "timestamp": result[3],
                "model_version": result[4],
                "anomaly": result[5],
                "anomaly_reason": result[6],
            }
        except Exception as e:
            logger.warning(f"Read failed for {token_address}: {e}")
            return None

    def read_history(self, token_address: str, limit: int = 20) -> list[dict]:
        if not self.contract or not self.w3:
            return []
        try:
            result = self.contract.functions.getHistory(
                self.w3.to_checksum_address(token_address)
            ).call()
            entries = []
            for entry in result[-limit:]:
                entries.append({
                    "score": entry[0],
                    "confidence": entry[1],
                    "evidence_hash": "0x" + entry[2].hex(),
                    "timestamp": entry[3],
                    "model_version": entry[4],
                    "anomaly": entry[5],
                })
            return entries
        except Exception as e:
            logger.warning(f"History read failed for {token_address}: {e}")
            return []


publisher = OnchainPublisher()
