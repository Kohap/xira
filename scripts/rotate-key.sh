#!/usr/bin/env bash
set -euo pipefail

# Transfers XIRA contract ownership and updater authorization on X Layer Mainnet.
# Use only during a planned key-rotation window. Prefer moving owner() to a
# Safe/multisig and keeping the hot wallet as an authorized updater.

CONTRACT="${XIRA_CONTRACT_ADDRESS:-}"
RPC="${XLAYER_RPC_URL:-https://rpc.xlayer.tech}"
NEW_OWNER="${XIRA_NEW_OWNER:-}"

if [ -z "$CONTRACT" ]; then
  echo "ERROR: set XIRA_CONTRACT_ADDRESS."
  exit 1
fi
if [ -z "$NEW_OWNER" ]; then
  echo "ERROR: set XIRA_NEW_OWNER."
  exit 1
fi
if [ -z "${OLD_PRIVATE_KEY:-}" ]; then
  echo "ERROR: set OLD_PRIVATE_KEY."
  exit 1
fi
if [ "${XIRA_CONFIRM_OWNER_ROTATION:-}" != "rotate-owner" ]; then
  echo "Refusing to rotate ownership without explicit confirmation."
  echo "Run with XIRA_CONFIRM_OWNER_ROTATION=rotate-owner after checking addresses."
  exit 1
fi

echo "Contract:  $CONTRACT"
echo "RPC:       $RPC"
echo "Old owner: $(cast call "$CONTRACT" 'owner()(address)' --rpc-url "$RPC")"
echo "New owner: $NEW_OWNER"
echo ""

echo "Authorizing new updater..."
cast send "$CONTRACT" \
  "setAuthorizedUpdater(address,bool)" "$NEW_OWNER" "true" \
  --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'tx: {tx[\"transactionHash\"]}')"

echo "Transferring ownership..."
cast send "$CONTRACT" \
  "transferOwnership(address)" "$NEW_OWNER" \
  --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'tx: {tx[\"transactionHash\"]}')"

OWNER=$(cast call "$CONTRACT" "owner()(address)" --rpc-url "$RPC")
UPDATER=$(cast call "$CONTRACT" "authorizedUpdaters(address)(bool)" "$NEW_OWNER" --rpc-url "$RPC")

echo ""
echo "owner   = $OWNER"
echo "updater = $UPDATER"
echo "Rotation complete. Update Railway PRIVATE_KEY only if the updater key changed."
