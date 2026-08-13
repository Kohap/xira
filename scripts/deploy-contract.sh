#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   XIRA Contract Deployment               ║"
echo "  ║   X Layer Mainnet                        ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

if [ -z "${PRIVATE_KEY:-}" ]; then
    echo -e "${RED}ERROR: PRIVATE_KEY not set.${NC}"
    echo "  export PRIVATE_KEY=your_xlayer_mainnet_private_key"
    echo ""
    echo "  Fund the wallet with OKB on X Layer mainnet before deploying."
    exit 1
fi

echo "Building contracts..."
cd "$ROOT_DIR"
forge build --quiet

echo "Running tests..."
forge test --quiet && echo -e "${GREEN}All tests pass.${NC}"

echo ""
echo "Deploying to X Layer mainnet..."
echo "RPC: https://rpc.xlayer.tech"
echo ""

forge script script/DeployAll.s.sol \
    --rpc-url https://rpc.xlayer.tech \
    --broadcast \
    --legacy \
    --slow \
    2>&1 | grep -E "(Address:|Registered:|Authorized:|XIRA Contract:|Explorer:|===|Error)"

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Copy the XIRA contract address above and add it to backend/.env:"
echo "  XIRA_CONTRACT_ADDRESS=0x..."
