# XIRA Product Review Packet

This file is the fastest way to review XIRA without reverse-engineering the
repository.

## Product summary

XIRA scores tokenized equities on X Layer. It turns market inputs into one
explainable 0-100 risk score, publishes meaningful changes as X Layer Mainnet
attestations, and exposes the same data through a dashboard, REST API, and MCP
tools for agents.

## Live links

| Surface | URL |
| --- | --- |
| App | https://www.xira.surf |
| Dashboard | https://www.xira.surf/dashboard |
| Verify tool | https://www.xira.surf/verify |
| API docs | https://xira-api-production.up.railway.app/docs |
| Health endpoint | https://xira-api-production.up.railway.app/api/assets/health |
| Contract | https://www.okx.com/web3/explorer/xlayer/address/0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E |

## Mainnet configuration

| Item | Value |
| --- | --- |
| Chain | X Layer Mainnet |
| Chain ID | `196` |
| RPC | `https://rpc.xlayer.tech` |
| Explorer | `https://www.okx.com/web3/explorer/xlayer` |
| Contract | `0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E` |
| Owner (Safe proxy) | `0x689F6C845598891207bD3E2274110101D6aBacDd` (2-of-2 multisig) |
| Current signer/updater | `0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0` |

The earlier contract `0x22851e160aef3e3aeb373fd351a07ff7c65c9b57` is **frozen
legacy** (attestation history remains readable; custody was migrated to the
Safe-owned contract above on 2026-08-14).

## What to inspect

- `frontend/app/dashboard/page.tsx`: live board, filters, heatmap, watchlist.
- `frontend/app/verify/page.tsx`: API vs contract verification.
- `backend/app/services/publisher.py`: mainnet publisher and read helpers.
- `backend/app/main.py`: CORS, public read allowlist, admin-gated writes.
- `contracts/src/XIRA.sol`: attestation storage, history ring, auth, pause.
- `catalogs/asset_catalog.json`: tracked xStock universe.

## Review checklist

- [ ] Frontend loads at https://www.xira.surf.
- [ ] Dashboard renders scores and does not show stale network copy.
- [ ] Footer and mobile menu link to the mainnet contract.
- [ ] API health reports `publisher.chain_id: 196`.
- [ ] Verify page returns a matching API/onchain score for a recently published symbol.
- [ ] Public `GET` endpoints are read-only.
- [ ] Mutating API routes require `X-Admin-Token`.
- [ ] No secrets are committed.
- [ ] Mainnet deployment docs use the same RPC, explorer, and contract.

## Security and trust assumptions

- The contract does not custody user funds. It stores risk attestations.
- Writes are restricted to the owner or authorized updater.
- Reads are public and free.
- The oracle/backend is centralized and signs the score it computes.
- Move `owner()` to a Safe/multisig before treating the system as production
  governance infrastructure.

## Local verification commands

```bash
cd frontend
npm ci
npm run lint
npm run build
```

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest
```

```bash
cd contracts
git submodule update --init --recursive
forge build
forge test
```

Live read-only checks:

```bash
curl -s https://xira-api-production.up.railway.app/api/assets/health | jq .
curl -s https://xira-api-production.up.railway.app/api/assets/verify/CRCLx | jq .
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  https://rpc.xlayer.tech
```
