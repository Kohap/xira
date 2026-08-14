# Railway Production Runbook

XIRA's FastAPI backend runs on Railway. The frontend is deployed separately on
Vercel at https://www.xira.surf.

## Production environment

Set these variables on the Railway production service:

```bash
railway variables --set "USE_LIVE_DATA=true"
railway variables --set "AI_MODE=heuristic"
railway variables --set "MODEL_VERSION=v1.0.0"
railway variables --set "XLAYER_RPC_URL=https://rpc.xlayer.tech"
railway variables --set "XIRA_EXPLORER_BASE=https://www.okx.com/web3/explorer/xlayer"
railway variables --set "XIRA_CHAIN_LABEL=xlayer-mainnet"
railway variables --set "XIRA_CONTRACT_ADDRESS=0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E"
railway variables --set "XIRA_EXPECTED_CHAIN_ID=196"
railway variables --set "XIRA_EXPECTED_SIGNER=0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0"
railway variables --set "XIRA_EXPECTED_OWNER=0x689F6C845598891207bD3E2274110101D6aBacDd"
railway variables --set "XIRA_DB_PATH=/data/xira_history.db"
railway variables --set "XIRA_API_URL=https://xira-api-production.up.railway.app"
railway variables --set "XIRA_ADMIN_TOKEN=<strong-random-token>"
railway variables --set "PRIVATE_KEY=<oracle-updater-private-key>"
```

`XIRA_EXPECTED_SIGNER` is the Railway hot updater EOA that signs attestations.
`XIRA_EXPECTED_OWNER` is the contract `owner()` — the 2-of-2 Safe proxy at
`0x689F…acdd` since the 2026-08-14 custody migration. The startup gate
refuses to boot if either mismatches.

Optional variables:

```bash
railway variables --set "FINNHUB_API_KEY=<key>"
railway variables --set "TELEGRAM_BOT_TOKEN=<token>"
railway variables --set "TELEGRAM_CHAT_ID=<chat-id>"
railway variables --set "XIRA_MIN_SIGNER_BALANCE_OKB=0.01"
```

Never commit private keys, API keys, admin tokens, or RPC URLs containing
provider secrets.

## Deploy

From the repository root:

```bash
railway up --service xira-api --environment production
```

The service uses `railway.json`, builds from `backend/Dockerfile`, starts
Uvicorn, mounts the persistent `/data` volume, and healthchecks
`/api/assets/health`.

## Verify after deploy

```bash
curl -s https://xira-api-production.up.railway.app/api/assets/health | jq .
curl -s https://xira-api-production.up.railway.app/api/assets/verify/CRCLx | jq .
```

Expected health signals:

- `status` is `ok`
- `publisher.enabled` is `true`
- `publisher.chain_id` is `196`
- `publisher.rpc_url` is `https://rpc.xlayer.tech`
- `contract` is `0xDe28a2EEc95E3E9Dae6311966Ce2d8B45Db3d41E`
- `publish_failing`, `publish_stale`, and `scheduler_stalled` are `false`

## Rollback

Redeploy the previous Railway deployment from the Railway dashboard or revert
the last commit and run `railway up` again. Do not point production back to an
old contract unless the matching frontend and docs are reverted in the same
release.
