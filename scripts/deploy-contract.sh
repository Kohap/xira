#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"
RPC_URL="${XLAYER_RPC_URL:-https://rpc.xlayer.tech}"
EXPLORER_BASE="${XIRA_EXPLORER_BASE:-https://www.okx.com/web3/explorer/xlayer}"

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY is not set."
  echo "Set it only in an ignored local env file or your hosting secret store."
  exit 1
fi

if [ "${XIRA_CONFIRM_MAINNET_DEPLOY:-}" != "deploy-mainnet" ]; then
  echo "Refusing to deploy to X Layer Mainnet without explicit confirmation."
  echo "Run with: XIRA_CONFIRM_MAINNET_DEPLOY=deploy-mainnet scripts/deploy-contract.sh"
  exit 1
fi

echo "XIRA contract deployment"
echo "Network: X Layer Mainnet"
echo "RPC:     $RPC_URL"
echo "Explorer: $EXPLORER_BASE"
echo ""

cd "$ROOT_DIR"

echo "Building contracts..."
forge build --quiet

echo "Running tests..."
forge test --quiet

echo "Deploying catalog-driven XIRA contract..."
forge script script/DeployV2.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --legacy \
  --slow \
  2>&1 | grep -E "(Address:|Registered:|Authorized:|XIRA V2 Contract:|Explorer:|===|Error)"

echo ""
echo "Deployment complete."
echo "Update Railway and Vercel with the new XIRA_CONTRACT_ADDRESS/NEXT_PUBLIC_CONTRACT_ADDRESS."
