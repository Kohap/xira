# XIRA Mainnet Deployment Guide

This guide is for X Layer Mainnet only.

## Production constants

| Item | Value |
| --- | --- |
| Chain | X Layer Mainnet |
| Chain ID | `196` |
| RPC | `https://rpc.xlayer.tech` |
| Explorer | `https://www.okx.com/web3/explorer/xlayer` |
| Current contract | `0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E` |
| Current signer/updater | `0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0` |

## Secret hygiene

- Keep `PRIVATE_KEY`, `XIRA_ADMIN_TOKEN`, API keys, and provider-key RPC URLs out
  of git.
- Store production secrets only in Railway, Vercel, or a local ignored `.env`.
- If a key is ever committed, assume it is compromised, rotate immediately, and
  move funds/authority to a new key or Safe.

## Deploy contracts

Use Foundry from `contracts/`.

```bash
cd contracts
git submodule update --init --recursive
set -a && source .env.deploy && set +a
forge build
forge test
forge script script/DeployV2.s.sol \
  --rpc-url https://rpc.xlayer.tech \
  --broadcast \
  --legacy
```

`DeployV2.s.sol` reads `catalogs/asset_catalog.deploy.json`, registers the
catalog symbols, authorizes the deployer as updater, and sets a 60 second
per-asset write cooldown.

After deploy:

1. Copy the new contract address from the script output.
2. Verify bytecode and ownership:
   ```bash
   cast code <CONTRACT_ADDRESS> --rpc-url https://rpc.xlayer.tech
   cast call <CONTRACT_ADDRESS> "owner()(address)" --rpc-url https://rpc.xlayer.tech
   cast call <CONTRACT_ADDRESS> "getAllTrackedSymbols()(string[])" --rpc-url https://rpc.xlayer.tech
   ```
3. Set Railway `XIRA_CONTRACT_ADDRESS` to the new address.
4. Set frontend `NEXT_PUBLIC_CONTRACT_ADDRESS` to the same address.
5. Redeploy Railway and Vercel.
6. Open the contract in the explorer:
   `https://www.okx.com/web3/explorer/xlayer/address/<CONTRACT_ADDRESS>`.

## Deploy backend

See [`RAILWAY.md`](./RAILWAY.md). The required production gates are:

- `XIRA_EXPECTED_CHAIN_ID=196`
- `XIRA_EXPECTED_SIGNER=<expected updater>`
- `XIRA_EXPECTED_OWNER=<expected owner>`

These gates refuse startup if the service is pointed at the wrong chain,
phantom contract, wrong signer, or unexpected owner.

## Deploy frontend

The frontend is a Next.js app in `frontend/` and is deployed on Vercel.

Required production variables:

```bash
NEXT_PUBLIC_API_URL=https://xira-api-production.up.railway.app
NEXT_PUBLIC_CHAIN_ID=196
NEXT_PUBLIC_CHAIN_NAME=X Layer
NEXT_PUBLIC_CHAIN_LABEL=X Layer Mainnet
NEXT_PUBLIC_EXPLORER_URL=https://www.okx.com/web3/explorer/xlayer
NEXT_PUBLIC_CONTRACT_ADDRESS=0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E
```

Validate before release:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

## Post-release smoke checks

```bash
curl -s https://xira-api-production.up.railway.app/api/assets/health | jq .
curl -s https://xira-api-production.up.railway.app/api/assets/verify/CRCLx | jq .
```

Then open:

- https://www.xira.surf
- https://www.xira.surf/dashboard
- https://www.xira.surf/verify
- https://xira-api-production.up.railway.app/docs
