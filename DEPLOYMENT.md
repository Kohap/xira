# XIRA Smart Contract Deployment Guide

## Prerequisites

1. **Foundry installed**: `curl -L https://foundry.paradigm.xyz | bash`
2. **Wallet with testnet OKB**:
   - Address: `0x5368FB097E57F34020A8FAAA52a242eeF814f8AC`
   - Get testnet OKB from: https://www.okx.com/xlayer/faucet
   - You need approximately 0.01 OKB for deployment

## Deployment Steps

### Option 1: Using the Deploy Script (Recommended)

```bash
cd contracts

# Set your private key
export PRIVATE_KEY=10730a6827a0347c88b80f860f8d41a84b22109f6ebabaf07642a5d1b222f7b7

# Deploy and register all 15 assets
forge script script/DeployAll.s.sol \
  --rpc-url https://testrpc.xlayer.tech \
  --broadcast \
  --legacy
```

### Option 2: Manual Deployment

```bash
cd contracts

# Deploy the contract
export PRIVATE_KEY=10730a6827a0347c88b80f860f8d41a84b22109f6ebabaf07642a5d1b222f7b7
forge script script/Deploy.s.sol \
  --rpc-url https://testrpc.xlayer.tech \
  --broadcast

# Copy the contract address from the output

# Register assets manually (repeat for each asset)
cast send <CONTRACT_ADDRESS> \
  "registerAsset(address,string)" \
  0x1111111111111111111111111111111111111111 NVDAx \
  --rpc-url https://testrpc.xlayer.tech \
  --private-key $PRIVATE_KEY
```

## Post-Deployment

1. **Copy the contract address** from the deployment output
2. **Update backend configuration**:
   ```bash
   cd ../backend
   # Update .env
   XIRA_CONTRACT_ADDRESS=0x64288ccD936470f66D7035e824A9141C938C32AE
   PRIVATE_KEY=0x10730a6827a0347c88b80f860f8d41a84b22109f6ebabaf07642a5d1b222f7b7
   ```
3. **Restart the backend** to enable on-chain attestations
4. **Verify on explorer**: https://www.okx.com/web3/explorer/xlayer-test/address/0x64288ccD936470f66D7035e824A9141C938C32AE

## What Gets Deployed

- XIRA smart contract with attestation storage
- 15 xStocks registered (NVDAx, TSLAx, AAPLx, MSFTx, GOOGLx, AMZNx, METAx, SPYx, QQQx, AMDx, INTCx, NFLXx, BAx, JPMx, XOMx)
- Deployer authorized as updater
- All assets ready for on-chain attestation updates

## Troubleshooting

### "insufficient funds"
- Ensure the wallet has testnet OKB from the faucet

### "nonce too low"
- Clear Foundry cache: `forge clean`

### "RPC connection failed"
- Try alternative RPC: `https://rpc.xlayer-testnet.t.raas.gelato.cloud`

## Verification

After deployment, verify the contract:
```bash
# Check owner
cast call <CONTRACT_ADDRESS> "owner()" --rpc-url https://testrpc.xlayer.tech

# Check registered assets
cast call <CONTRACT_ADDRESS> "getAllTrackedSymbols()" --rpc-url https://testrpc.xlayer.tech
```
