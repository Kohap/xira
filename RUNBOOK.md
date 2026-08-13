# XIRA Operator Runbook

Operational guide for running the XIRA backend (FastAPI on Railway) and its
on-chain publisher on X Layer testnet.

## Architecture at a glance

- `backend/` FastAPI app deployed on Railway (`xira-api` project, `xira-api`
  service) with a persistent volume `xira-data` mounted at `/data`.
- Scheduler loop (`app/services/scheduler.py`) runs every
  `XIRA_HEARTBEAT_MINUTES` (default 30) and publishes attestations on-chain
  when the risk score deviates by `XIRA_DEVIATION_THRESHOLD` (default 3) or
  the evidence hash is new.
- Publisher (`app/services/publisher.py`) signs txs with `PRIVATE_KEY` to
  `XIRA_CONTRACT_ADDRESS` on X Layer testnet. Without both, it runs off-chain
  (health reports `enabled: false`).
- Telegram ops alerts (`app/services/telegram_notifier.py`) fire on health
  flag transitions; deduped by flag per `XIRA_ALERT_COOLDOWN_S` (default
  1800s).

## Health endpoint

`GET https://xira-api-production.up.railway.app/api/assets/health`

Key fields:

| Field | Meaning |
| --- | --- |
| `publisher.enabled` | Contract + key configured, RPC reachable |
| `publisher.chain_id` | 1952 = X Layer testnet |
| `publisher.publishes` | Successful tx count this process lifetime |
| `publisher.last_publish_at` / `last_attempt_at` | Epoch seconds |
| `publisher.consecutive_failures` | Tx failures since last success |
| `publisher.errors_24h` | Last 20 failures within 24h |
| `scheduler.last_pass_at` | Epoch of last scheduler pass |
| `scheduler_stalled` | No pass for > 2 heartbeats after the first pass |
| `publish_failing` | Enabled + `consecutive_failures >= 2` |
| `publish_stale` | Enabled, attempted, never succeeded |

## Alerts

Alerts fire on transitions (healthy -> unhealthy), not continuously:

- **Scheduler stalled** — no pass for 2+ heartbeats. The loop only exits on
  a process restart or an unhandled crash; check `railway logs` for a trace.
- **On-chain publishing failing** — repeated tx failures. See rescue below.
- **Publisher never succeeded** — enabled but zero successful publishes.
- **Risk alerts** — per asset, when the factor model flags an anomaly or the
  score crosses a user threshold (`/api/alerts/thresholds`). Latched per
  symbol, so a sustained condition alerts once and re-arms when it clears.

Manual test: `curl -X POST .../api/alerts/ops/test` (rate-limited, dormant
unless `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set).

## Rescue: publishing failures

1. Read the last error: `publisher.last_error` and `publisher.errors_24h` on
   the health endpoint.
2. **Insufficient funds** — top up the signer (address in `publisher.signer`)
   with X Layer testnet XPL. Re-publish happens automatically on the next
   scheduler pass.
3. **RPC issues** — swap `XLAYER_RPC_URL` to another X Layer testnet RPC;
   verify with `curl -X POST -H "Content-Type: application/json" -d
   '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' <rpc>`.
4. **Nonce races** — the publisher retries automatically
   (`XIRA_MAX_NONCE_RETRIES`, default 3). Persistent "nonce too low" with
   multiple instances means two publishers share the same key; keep a single
   replica.
5. **Stuck stale flag** — after a successful publish the flags clear on the
   next pass. If they persist, restart the service.

## Deploying

Railway does NOT auto-deploy from GitHub. Push the code, then from the
**repo root** (the Dockerfile context is the repo root, not `backend/`):

```bash
railway up --service xira-api --environment production
```

Watch it come up (healthcheck `/api/assets/health`, up to 300s timeout):
`railway logs`.

Env changes also trigger a redeploy:

```bash
railway variables --set "KEY=value"
```

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `USE_LIVE_DATA` | `true` (prod) | Finnhub + news vs simulated data |
| `MODEL_VERSION` | `v1.0.0` | Attested model version |
| `XIRA_CONTRACT_ADDRESS` | — | Attestation contract |
| `PRIVATE_KEY` | — | Deployer key; never commit it |
| `XLAYER_RPC_URL` | `https://testrpc.xlayer.tech` | |
| `XIRA_HEARTBEAT_MINUTES` | `30` | Scheduler cadence |
| `XIRA_DEVIATION_THRESHOLD` | `3` | Score delta that triggers a publish |
| `XIRA_FIRST_PASS_DELAY_S` | `60` | Warmup before first pass |
| `XIRA_MAX_NONCE_RETRIES` | `3` | Nonce-race retries per tx |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | — | Ops alerts |
| `XIRA_ALERT_COOLDOWN_S` | `1800` | Per-flag alert cooldown |
| `XIRA_ENABLE_DEBUG` | `false` | Enables `/debug/data-sources` |
| `XIRA_ADMIN_TOKEN` | — | Admin endpoints (issue/revoke API keys) |
| `XIRA_REQUIRE_API_KEY` | `false` | When `true`, non-frontend callers need an `X-API-Key` header |

## API keys for integrators

Issued keys are stored as SHA-256 hashes with a display prefix (the
plaintext is shown once at issuance). The keys themselves are not secrets
persisted in the codebase or the DB.

- Issue: `POST /api/admin/keys` with `{"name": "..."}` and
  `X-Admin-Token: <admin token>` (or `Authorization: Bearer <admin token>`).
- List: `GET /api/admin/keys` (hashes never returned).
- Revoke: `DELETE /api/admin/keys/{prefix}`.
- Use: integrators send `X-API-Key: <key>` on every request. Keyless
  requests are accepted until `XIRA_REQUIRE_API_KEY=true`; even then the
  xira.surf frontend origins are exempt.
- Always open, key or not: `/`, `/docs`, `/redoc`, `/openapi.json`,
  `/api/assets/health`, `/api/alerts/ops/test`, the `/mcp` agent surface,
  and `/api/admin/*` (which has its own admin-token auth).

## Secret rotation

Status ledger (last check 2026-08-13):

| Secret | Status |
| --- | --- |
| Contract deployer key | **Rotated.** Live contract `0xaa5f62…45d0` and the older `0x64288cc…2AE` are both owned by the current signer `0x0CE306…ED3c0`, which is also an authorized updater. The leaked Render-era key no longer controls anything; `scripts/rotate-key.sh` is a completed reference. |
| `FINNHUB_API_KEY` | **Rotated 2026-08-13.** New key live (board 15/15 Finnhub). Revoke the old key in the Finnhub dashboard. |
| `TELEGRAM_BOT_TOKEN` | **Rotated 2026-08-13.** New token live (`/api/alerts/ops/test` returns `sent`). Revoke the old token via BotFather `/revoke`. |

Procedure for any future rotation:

1. Generate the replacement in the provider dashboard (Finnhub
   dashboard / BotFather).
2. Push it to Railway **without touching shell history or chat**:
   `printf '%s' 'NEWVALUE' | railway variable set --stdin <VAR>`.
   Railway restarts the service with the new value.
3. Verify live: Finnhub → `curl -H "Origin: https://www.xira.surf" .../api/assets/all`
   shows `finnhub` for all 15 assets; Telegram → `POST /api/alerts/ops/test`
   returns `{"ok": true, "detail": "sent"}`.
4. Revoke the old value in the provider dashboard.

Log hygiene: `httpx` logging is pinned to WARNING and upstream auth uses
headers (`X-Finnhub-Token`), so keys no longer appear in log streams. Any
secret that was ever visible in logs, CI output, or terminal scrollback
should be rotated once — that is why the entries above were replaced.

## Database

SQLite lives on the `xira-data` volume at `/data/xira_history.db`. A fresh
volume is healed on startup: `backfill_published_from_chain()` imports
existing on-chain attestations as published records.

## Asset universe (v2: 2026-08-13)

The backend is now catalog-driven; the hardcoded 15-asset list is gone.

- `catalogs/asset_catalog.json` — single source of truth. 65 xStocks listed
  on OKX as `X…-USDT`, ranked by 24h USDT volume; **50 enabled**, 15 kept as
  a listed-but-idle tail. Every entry carries its X Layer mainnet token
  address, verified on-chain via `symbol()` (issuer naming: `NVDAx`).
- `catalogs/asset_catalog.deploy.json` — flat arrays consumed by
  `contracts/script/DeployV2.s.sol` (same 50, same order).
- Regenerate: `python scripts/build_catalog.py --limit 50` (pulls OKX
  instruments + tickers and the Backed/xStocks registry, then verifies each
  address against `rpc.xlayer.tech`). Both files are committed and diffable.
- Removed from the old catalog (not tradable on OKX): `BAx`, `JPMx`, `XOMx`.
  Note `BAx` was registered on-chain with a placeholder address — historical
  entries only; do not re-enable.

### Hybrid data feeds

- Quotes/OHLCV: Yahoo chart API (`XIRA_QUOTE_PROVIDER=yahoo`, no key; real
  volume + 52w range). `finnhub` keeps the old path; `mock` forces mock.
- News/sentiment: Finnhub free tier, rotated `XIRA_NEWS_PER_PASS` (default
  15) assets per scheduler pass; the rest use the price-priority proxy.
  This keeps 50-asset passes under the 60 req/min free limit.
- Publishing: `publish_batch` chunks pending attestations into
  `batchUpdateAttestations` txs (`XIRA_BATCH_CHUNK`, default 12 → ~4-5 txs
  per full pass at 50 assets; ~$0.001 ETH-equivalent gas on testnet).
  Chunk failure falls back to per-asset txs so one bad asset can't block
  a pass. Per-asset 60s write cooldown is enforced on-chain.

### Mainnet checklist (not yet done)

1. Decision gates: premium/managed data decision, cold-wallet custody of
   owner key (hot updater key stays on Railway), OKB funding, deploy approval.
2. Deploy hardened contract (pause + registered-assets-only + 60s cooldown
   + `unregisterAsset`) to chain 196:
   `PRIVATE_KEY=… forge script script/DeployV2.s.sol:DeployV2
   --rpc-url https://rpc.xlayer.tech --broadcast`
   (reads 50 assets from the catalog; dry-run first).
3. Set `XIRA_CHAIN_LABEL=xlayer`, `XIRA_EXPLORER_BASE=…/xlayer`,
   `XIRA_RPC_FALLBACK=https://xlayerrpc.okx.com`, then redeploy the backend.
4. Fund signer ≥ 0.5 OKB; low-balance alert fires below
   `XIRA_MIN_SIGNER_BALANCE_OKB` (default 0.05).
5. Run `python scripts/recompute_score.py --max-age-min 25`; exit 0 = chain
   matches live recomputation (hash-level).

## Frontend

Vercel auto-deploys from `main` (xira.surf). No manual steps; a push is a
deploy.
