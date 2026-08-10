from __future__ import annotations
import os, logging, time, json
from typing import Optional

from web3 import Web3

logger = logging.getLogger(__name__)


class OnchainPublisher:
    def __init__(
        self,
        rpc_url: str = "",
        contract_address: str = "",
        private_key: str = "",
    ):
        self.rpc_url = rpc_url or os.getenv("XLAYER_RPC_URL", "https://testnet.xlayer.tech")
        self.contract_address = contract_address or os.getenv("XIRA_CONTRACT_ADDRESS", "")
        self.private_key = private_key or os.getenv("PRIVATE_KEY", "")
        self.w3: Optional[Web3] = None
        self.contract = None
        self.account = None
        self.enabled = bool(self.contract_address and self.contract_address != "0x0000000000000000000000000000000000000000" and self.private_key)
        self._init_web3()

    def _init_web3(self):
        if not self.enabled:
            logger.info("OnchainPublisher: Running in off-chain mode (no contract config).")
            return

        try:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            try:
                from web3.middleware import ExtraDataToPOAMiddleware
                self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            except ImportError:
                try:
                    from web3.middleware import geth_poa_middleware
                    self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
                except ImportError:
                    pass

            if not self.w3.is_connected():
                logger.warning(f"Failed to connect to RPC: {self.rpc_url}")
                self.enabled = False
                return

            self.account = self.w3.eth.account.from_key(self.private_key)
            self.contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(self.contract_address),
                abi=self._get_abi(),
            )
            logger.info(f"OnchainPublisher connected. Account: {self.account.address}")
        except Exception as e:
            logger.warning(f"OnchainPublisher init failed: {e}. Running off-chain.")
            self.enabled = False

    @staticmethod
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
                "inputs": [
                    {"internalType": "address[]", "name": "assets", "type": "address[]"},
                    {"internalType": "uint8[]", "name": "scores", "type": "uint8[]"},
                    {"internalType": "uint8[]", "name": "confidences", "type": "uint8[]"},
                    {"internalType": "bytes32[]", "name": "evidenceHashes", "type": "bytes32[]"},
                    {"internalType": "string[]", "name": "modelVersions", "type": "string[]"},
                    {"internalType": "bool[]", "name": "anomalies", "type": "bool[]"},
                    {"internalType": "string[]", "name": "anomalyReasons", "type": "string[]"},
                ],
                "name": "batchUpdateAttestations",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function",
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "asset", "type": "address"},
                ],
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
        ]

    def update_attestation(
        self,
        token_address: str,
        score: int,
        confidence: int,
        evidence_hash_hex: str,
        model_version: str,
        anomaly: bool,
        anomaly_reason: str,
    ) -> Optional[str]:
        if not self.enabled or not self.contract:
            logger.info(f"Off-chain attestation for {token_address}: score={score}")
            return None

        try:
            evidence_bytes = bytes.fromhex(evidence_hash_hex)
            if len(evidence_bytes) != 32:
                evidence_bytes = bytes(32)

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
            })

            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            h = tx_hash.hex()
            logger.info(f"Tx confirmed: {h}")
            return h
        except Exception as e:
            logger.error(f"Transaction failed for {token_address}: {e}")
            return None

    def batch_update_attestations(self, assets: list) -> dict[str, Optional[str]]:
        results: dict[str, Optional[str]] = {}
        for asset in assets:
            tx_hash = self.update_attestation(
                token_address=asset.get("token_address", "0x0000000000000000000000000000000000000001"),
                score=asset["risk_score"],
                confidence=asset["confidence"],
                evidence_hash_hex=asset["evidence_hash"],
                model_version=asset["model_version"],
                anomaly=asset["anomaly"],
                anomaly_reason=asset.get("anomaly_reason", ""),
            )
            results[asset["symbol"]] = tx_hash
        return results


publisher = OnchainPublisher()
