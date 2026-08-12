#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# XIRA Key Rotation — transfer contract ownership from the leaked
# key to the new oracle wallet on X Layer testnet (chain 1952).
#
# Run this once from the repo root. The old key must still hold
# testnet OKB. After rotation, the old key must never be used again.
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

CONTRACT="0x64288ccD936470f66D7035e824A9141C938C32AE"
RPC="https://testrpc.xlayer.tech"
NEW_OWNER="0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0"

# The old (leaked) key — only accepted via env to avoid committing it.
if [ -z "${OLD_PRIVATE_KEY:-}" ]; then
  echo "ERROR: set OLD_PRIVATE_KEY environment variable with the leaked key."
  echo "  export OLD_PRIVATE_KEY=0x10730..."
  exit 1
fi

echo "Contract: $CONTRACT"
echo "New owner: $NEW_OWNER"
echo ""

# 1. Transfer ownership
echo "⏳ transferOwnership($NEW_OWNER) …"
cast send "$CONTRACT" \
  "transferOwnership(address)" "$NEW_OWNER" \
  --rpc-url "$RPC" \
  --private-key "$OLD_PRIVATE_KEY" \
  --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'  tx: {tx[\"transactionHash\"]}')"

# 2. Verify ownership
NEW=$(cast call "$CONTRACT" "owner()(address)" --rpc-url "$RPC")
echo "  ✓ owner = $NEW"

# 3. Authorize the new owner as updater
echo "⏳ setAuthorizedUpdater($NEW_OWNER, true) …"
cast send "$CONTRACT" \
  "setAuthorizedUpdater(address,bool)" "$NEW_OWNER" "true" \
  --rpc-url "$RPC" \
  --private-key "$OLD_PRIVATE_KEY" \
  --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'  tx: {tx[\"transactionHash\"]}')"

UP=$(cast call "$CONTRACT" "authorizedUpdaters(address)(bool)" "$NEW_OWNER" --rpc-url "$RPC")
echo "  ✓ updater = $UP"

echo ""
echo "Rotation complete."
echo "Now set PRIVATE_KEY in the Render dashboard secret to the NEW key for $NEW_OWNER."
echo "The old key must never be used again."
