# XIRA Operator Runbook

Operational guide for the XIRA backend, publisher, frontend, and review-facing
health checks.

## Architecture at a glance

- `frontend/`: Next.js on Vercel at https://www.xira.surf.
- `backend/`: FastAPI on Railway at
  https://xira-api-production.up.railway.app.
- `contracts/`: XIRA attestation contract on X Layer Mainnet.
- Scheduler: runs every `XIRA_HEARTBEAT_MINUTES` minutes and publishes when a
  score moves by `XIRA_DEVIATION_THRESHOLD` or the evidence hash is new.
- Publisher: signs transactions with the configured updater key and writes to
  `XIRA_CONTRACT_ADDRESS`.
- Database: SQLite history stored on Railway's persistent `/data` volume.

## Production health endpoint

`GET https://xira-api-production.up.railway.app/api/assets/health`

Key fields:

| Field | Expected production meaning |
| --- | --- |
| `publisher.enabled` | Contract and key are configured, RPC reachable |
| `publisher.chain_id` | `196` = X Layer Mainnet |
| `publisher.rpc_url` | `https://rpc.xlayer.tech` |
| `publisher.signer` | Current oracle updater |
| `contract` | Mainnet XIRA contract |
| `scheduler.last_pass_at` | Epoch of last scheduler pass |
| `scheduler_stalled` | `false` in healthy production |
| `publish_failing` | `false` in healthy production |
| `publish_stale` | `false` in healthy production |

## Alerts

Alerts fire on transitions rather than continuously:

- Scheduler stalled.
- Onchain publishing failing.
- Publisher configured but never succeeded.
- Risk alerts when a model anomaly appears or an admin threshold is crossed.

Manual ops alert tests are admin-gated:

```bash
curl -X POST \
  -H "X-Admin-Token: $XIRA_ADMIN_TOKEN" \
  https://xira-api-production.up.railway.app/api/alerts/ops/test
```

## Rescue: publishing failures

1. Read `publisher.last_error` and `publisher.errors_24h` from health.
2. If the signer balance is low, top up `publisher.signer` with OKB on
   X Layer Mainnet.
3. If RPC is failing, verify the configured RPC:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     https://rpc.xlayer.tech
   ```
   The expected response is `0xc4`.
4. If nonce errors persist, make sure only one Railway replica publishes with
   the same key.
5. After a successful publish, health flags clear on the next scheduler pass.

## Environment variables

| Variable | Production value / notes |
| --- | --- |
| `USE_LIVE_DATA` | `true` |
| `MODEL_VERSION` | `v1.0.0` |
| `XLAYER_RPC_URL` | `https://rpc.xlayer.tech` |
| `XIRA_EXPLORER_BASE` | `https://www.okx.com/web3/explorer/xlayer` |
| `XIRA_CHAIN_LABEL` | `xlayer-mainnet` |
| `XIRA_CONTRACT_ADDRESS` | `0x22851e160aef3e3aeb373fd351a07ff7c65c9b57` |
| `PRIVATE_KEY` | Oracle updater key; never commit |
| `XIRA_EXPECTED_CHAIN_ID` | `196` |
| `XIRA_EXPECTED_SIGNER` | Expected updater address |
| `XIRA_EXPECTED_OWNER` | Expected contract owner |
| `XIRA_ADMIN_TOKEN` | Required for mutating API routes |
| `XIRA_API_URL` | Public Railway API base |
| `XIRA_DB_PATH` | `/data/xira_history.db` |
| `XIRA_HEARTBEAT_MINUTES` | `30` by default |
| `XIRA_DEVIATION_THRESHOLD` | `3` by default |
| `XIRA_REQUIRE_API_KEY` | `false` unless integrator keys are required |

## Mainnet trust note

The current contract owner and updater are the same EOA. For stronger
production posture, transfer `owner()` to a Safe/multisig and leave the hot key
as an authorized updater only. That preserves automation while removing
single-key admin control.

## Production review smoke checks

```bash
curl -s https://xira-api-production.up.railway.app/api/assets/health | jq .
curl -s https://xira-api-production.up.railway.app/api/assets/verify/CRCLx | jq .
curl -s https://www.xira.surf/sitemap.xml
```

Expected:

- frontend and API are live,
- chain ID is `196`,
- contract address is the X Layer Mainnet contract,
- verify endpoint returns `match.verified: true` for a recently published asset.
