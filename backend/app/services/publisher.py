from __future__ import annotations
import os, logging, time
from typing import Optional

from web3 import Web3

logger = logging.getLogger(__name__)

XLAYER_TESTNET_RPC = "https://testrpc.xlayer.tech"
XLAYER_EXPLORER = "https://www.okx.com/web3/explorer/xlayer-test"

MAX_NONCE_RETRIES = int(os.getenv("XIRA_MAX_NONCE_RETRIES", "3"))


def _get_abi() -> list:
    return [
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
        self.rpc_url = rpc_url or os.getenv("XLAYER_RPC_URL", XLAYER_TESTNET_RPC)
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
        self.last_tx_error: Optional[str] = None
        self.publishes: int = 0
        self._init_web3()

    def _init_web3(self):
        if not self.enabled:
            logger.info("OnchainPublisher: off-chain mode (no contract or key configured).")
            return

        try:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if not self.w3.is_connected():
                logger.warning(f"RPC connection failed: {self.rpc_url}")
                self.enabled = False
                return

            self.chain_id = self.w3.eth.chain_id
            self.account = self.w3.eth.account.from_key(self.private_key)
            checksum = self.w3.to_checksum_address(self.contract_address)

            self.contract = self.w3.eth.contract(address=checksum, abi=_get_abi())

            logger.info(
                f"OnchainPublisher connected | Chain: {self.chain_id} "
                f"| Account: {self.account.address[:10]}... "
                f"| Contract: {self.contract_address[:10]}..."
            )
        except Exception as e:
            logger.warning(f"OnchainPublisher init failed: {e}. Running off-chain.")
            self.enabled = False

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
                    "gas": 300000,
                    "gasPrice": self.w3.eth.gas_price,
                    "chainId": self.chain_id,
                })

                signed = self.account.sign_transaction(tx)
                tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

                h = tx_hash.hex()
                explorer = f"{XLAYER_EXPLORER}/tx/{h}"
                logger.info(f"Attestation published: {h[:20]}... ({explorer})")
                self.publishes += 1

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
                self.last_tx_error = f"{type(e).__name__}: {e}"
                logger.error(f"Tx failed for {token_address}: {e}")
                return None

        self.last_tx_error = f"tx: exceeded {MAX_NONCE_RETRIES} nonce retries"
        return None

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
