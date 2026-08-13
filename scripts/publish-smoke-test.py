#!/usr/bin/env python3
"""Live publish smoke test: signs one real attestation on X Layer testnet
using the same publisher code the backend uses. Prints tx hash + explorer
link and verifies the attestation read-back.

Usage:
  python scripts/publish-smoke-test.py <symbol> <token_address> <private_key> <contract_address>
"""
import json
import sys
import time
import urllib.request

API_URL = "https://xira-api-production.up.railway.app"

symbol, token_address, private_key, contract_address = sys.argv[1:5]

with urllib.request.urlopen(f"{API_URL}/api/attestations/{symbol}", timeout=20) as resp:
    att = json.load(resp)

print(f"Current API attestation for {symbol}: score={att['risk_score']} "
      f"confidence={att['confidence']} evidence={att['evidence_hash'][:18]}...")

sys.path.insert(0, "backend")
from app.services.publisher import OnchainPublisher

pub = OnchainPublisher(contract_address=contract_address, private_key=private_key)
print(f"Publisher: enabled={pub.enabled} chain_id={pub.chain_id} signer={pub.account.address}")

tx = pub.update_attestation(
    token_address=token_address,
    score=att["risk_score"],
    confidence=att["confidence"],
    evidence_hash_hex=att["evidence_hash"],
    model_version=att["model_version"],
    anomaly=att["anomaly"],
    anomaly_reason=att["anomaly_reason"],
)

if not tx:
    print("FAILED: no tx returned")
    print(f"last_error: {pub.last_tx_error}")
    sys.exit(1)

print(f"OK: tx={tx['tx_hash']}")
print(f"Explorer: {tx['explorer_url']}")

time.sleep(5)
latest = pub.read_latest(token_address)
print(f"Read-back: score={latest['score']} confidence={latest['confidence']} "
      f"evidence={latest['evidence_hash'][:18]}... ts={latest['timestamp']}")
ok = latest and latest["score"] == att["risk_score"] and latest["evidence_hash"].replace("0x", "") == att["evidence_hash"]
print("VERIFIED on-chain" if ok else "MISMATCH on-chain read-back")
sys.exit(0 if ok else 1)
