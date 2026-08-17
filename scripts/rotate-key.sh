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

OLD_ADDRESS=$(cast wallet address "$OLD_PRIVATE_KEY")
CURRENT_OWNER=$(cast call "$CONTRACT" 'owner()(address)' --rpc-url "$RPC")

echo "Contract:      $CONTRACT"
echo "RPC:           $RPC"
echo "Current owner: $CURRENT_OWNER"
echo "Old updater:   $OLD_ADDRESS"
echo "New owner:     $NEW_OWNER"
echo ""

echo "1. Authorizing new updater..."
cast send "$CONTRACT" \
  "setAuthorizedUpdater(address,bool)" "$NEW_OWNER" "true" \
  --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'tx: {tx[\"transactionHash\"]}')"

if [ "$OLD_ADDRESS" != "$NEW_OWNER" ]; then
  echo "2. Revoking old updater ($OLD_ADDRESS)..."
  cast send "$CONTRACT" \
    "setAuthorizedUpdater(address,bool)" "$OLD_ADDRESS" "false" \
    --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
    --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'tx: {tx[\"transactionHash\"]}')"
fi

echo "3. Starting two-step ownership transfer to $NEW_OWNER..."
cast send "$CONTRACT" \
  "transferOwnership(address)" "$NEW_OWNER" \
  --rpc-url "$RPC" --private-key "$OLD_PRIVATE_KEY" --legacy \
  --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'tx: {tx[\"transactionHash\"]}')"

if [ -n "${NEW_PRIVATE_KEY:-}" ]; then
  echo "4. Accepting ownership from new owner key..."
  cast send "$CONTRACT" \
    "acceptOwnership()" \
    --rpc-url "$RPC" --private-key "$NEW_PRIVATE_KEY" --legacy \
    --json 2>/dev/null | python3 -c "import sys,json; tx=json.load(sys.stdin); print(f'tx: {tx[\"transactionHash\"]}')"
else
  echo ""
  echo "ACTION REQUIRED: $NEW_OWNER is now pendingOwner."
  echo "The new owner must call acceptOwnership() to finalize ownership transfer."
fi

OWNER=$(cast call "$CONTRACT" "owner()(address)" --rpc-url "$RPC")
PENDING=$(cast call "$CONTRACT" "pendingOwner()(address)" --rpc-url "$RPC")
NEW_UPDATER_STATUS=$(cast call "$CONTRACT" "authorizedUpdaters(address)(bool)" "$NEW_OWNER" --rpc-url "$RPC")
OLD_UPDATER_STATUS=$(cast call "$CONTRACT" "authorizedUpdaters(address)(bool)" "$OLD_ADDRESS" --rpc-url "$RPC")

echo ""
echo "Contract state:"
echo "  owner                 = $OWNER"
echo "  pendingOwner          = $PENDING"
echo "  new updater ($NEW_OWNER) = $NEW_UPDATER_STATUS"
echo "  old updater ($OLD_ADDRESS) = $OLD_UPDATER_STATUS"
echo "Rotation script finished."
