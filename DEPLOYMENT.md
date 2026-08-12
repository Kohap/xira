# XIRA Smart Contract Deployment Guide

## ⚠️ Secret hygiene & key rotation

The original oracle private key was committed to git history (`render.yaml`,
`contracts/.env.deploy`, `DEPLOYMENT.md`). It has been **fully rotated**:

| Role | Old address | New address |
|---|---|---|
| Contract owner + oracle signer | `0x5368FB…f8AC` (leaked) | `0x0CE306…D3c0` |

The new key must be set **only** in the Render dashboard secret `PRIVATE_KEY`
and in your local `backend/.env` — never in any committed file. If the key is
missing, the backend runs in off-chain mode (scores served, no on-chain txs).

To run the on-chain rotation:
```bash
scripts/rotate-key.sh
```

## Prerequisites

1. **Foundry installed**: `curl -L https://foundry.paradigm.xyz | bash`
2. **Wallet with testnet OKB**:
   - Oracle address: `0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0`
   - Fund via: https://www.okx.com/xlayer/faucet
   - You need approximately 0.01 OKB

## Deployment Steps

### Option 1: Using the Deploy Script (Recommended)

```bash
cd contracts

# Set your private key
export PRIVATE_KEY=

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
export PRIVATE_KEY=
forge script script/Deploy.s.sol \
  --rpc-url https://testrpc.xlayer.tech \
  --broadcast

# Copy the contract address from the output

# Register assets manually (repeat for each asset)
cast send <CONTRACT_ADDRESS> \
  "registerAsset(address,string)" \
  0xc845b2894dbddd03858fd2d643b4ef725fe0849d NVDAx \
  --rpc-url https://testrpc.xlayer.tech \
  --private-key $PRIVATE_KEY
```

> **Token keys:** attestations are keyed by the real X Layer xStock ERC-20 addresses
> (e.g. NVDAx `0xc845...0849d` — same address on every EVM chain). The backend
> `TRACKED_ASSETS` list holds the canonical keys; BAx has no published EVM address
> yet and keeps a placeholder key. `registerAsset` is legacy metadata only —
> `updateAttestation` accepts any address.

## Post-Deployment

1. **Copy the contract address** from the deployment output
2. **Update backend configuration**:
   ```bash
   cd ../backend
   # Update .env — or set the secret in the Render dashboard (recommended):
   XIRA_CONTRACT_ADDRESS=0x64288ccD936470f66D7035e824A9141C938C32AE
   PRIVATE_KEY=<set-from-secret>
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
