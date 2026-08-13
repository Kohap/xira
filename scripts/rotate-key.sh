#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# XIRA Key Rotation — transfer contract ownership from the leaked
# key to the new oracle wallet on X Layer mainnet (chain 196).
#
# Run this once from the repo root. The old key must still hold
# mainnet OKB (only for step 1). After rotation, the old key must
# never be used again.
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

CONTRACT="0x22851e160aef3e3aeb373fd351a07ff7c65c9b57"
RPC="https://rpc.xlayer.tech"
NEW_OWNER="0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0"

if [ -z "${OLD_PRIVATE_KEY:-}" ]; then
  echo "ERROR: set OLD_PRIVATE_KEY env var."
  echo "  export OLD_PRIVATE_KEY=0x..."
  exit 1
fi
if [ -z "${NEW_PRIVATE_KEY:-}" ]; then
  echo "ERROR: set NEW_PRIVATE_KEY env var."
  echo "  export NEW_PRIVATE_KEY=0x..."
  exit 1
fi

echo "Contract:  $CONTRACT"
echo "Old owner: $(cast call "$CONTRACT" 'owner()(address)' --rpc-url "$RPC")"
echo "New owner: $NEW_OWNER"
echo ""

# 1. Authorize the new owner as updater (old key still has authority)
echo "⏳ setAuthorizedUpdater($NEW_OWNER, true) via old key …"
cast send "$CONTRACT" \
  "setAuthorizedUpdater(address,bool)" "$NEW_OWNER" "true" \
  --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'  tx: {tx[\"transactionHash\"]}')"

# 2. Transfer ownership to the new address
echo "⏳ transferOwnership($NEW_OWNER) via old key …"
cast send "$CONTRACT" \
  "transferOwnership(address)" "$NEW_OWNER" \
  --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'  tx: {tx[\"transactionHash\"]}')"

# 3. Self-authorize as updater from the new key (belt-and-suspenders)
echo "⏳ setAuthorizedUpdater($NEW_OWNER, true) via new key …"
cast send "$CONTRACT" \
  "setAuthorizedUpdater(address,bool)" "$NEW_OWNER" "true" \
  --rpc-url "$RPC" --private-key "$NEW_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'  tx: {tx[\"transactionHash\"]}')"

# Verify
OWNER=$(cast call "$CONTRACT" "owner()(address)" --rpc-url "$RPC")
UP=$(cast call "$CONTRACT" "authorizedUpdaters(address)(bool)" "$NEW_OWNER" --rpc-url "$RPC")
echo ""
echo "  ✓ owner   = $OWNER"
echo "  ✓ updater = $UP"
echo ""
echo "Rotation complete. Set PRIVATE_KEY in the Railway secret."
