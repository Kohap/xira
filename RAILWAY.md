# Railway Migration Runbook

Gradual cutover of the XIRA backend from Render (`xira-gsb3.onrender.com`)
to Railway. The frontend stays on Vercel throughout; the API URL is switched
over only after the Railway service is verified healthy.

## Phase 0 — Prerequisites

1. Install the Railway CLI and log in:
   ```bash
   brew install railway   # or: curl -fsSL https://railway.app/install.sh | sh
   railway login
   ```
2. Create the project + service and set secrets. You must paste the real
   values (Render dashboard → your API service → Environment). Do **not**
   commit any of these:
   ```bash
   railway init            # run at repo root, pick a project name
   railway service create  # or let `railway up` create it
   railway variables set PRIVATE_KEY="<render-secret>"
   railway variables set FINNHUB_API_KEY="<render-secret>"
   railway variables set XLAYER_RPC_URL="https://testrpc.xlayer.tech"
   railway variables set XIRA_CONTRACT_ADDRESS="0xaa5f6215e947ffce2f46513a926af3239be545d0"
   railway variables set USE_LIVE_DATA="true"
   railway variables set AI_MODE="heuristic"
   railway variables set MODEL_VERSION="v1.0.0"
   railway variables set XIRA_DB_PATH="/data/xira_history.db"
   ```
   `railway.json` (repo root) wires the Docker build, the start command, the
   `/api/assets/health` healthcheck, and the `xira-data` volume mounted at
   `/data`. The volume is what makes `xira_history.db` survive redeploys —
   the thing Render's ephemeral disk can't do.

3. Deploy:
   ```bash
   railway up --detach
   ```
   Or push to a branch and let Railway deploy the commit automatically.

## Phase 1 — Shadow verify (Render still serves traffic)

1. Check the service is healthy on Railway:
   ```bash
   railway variables set   # copy the generated RAILWAY_PUBLIC_DOMAIN
   curl -s https://<railway-domain>/api/assets/health
   curl -s "https://<railway-domain>/api/assets/all" | head -c 300
   ```
   Confirm `"status":"ok"`, `"live_data":true`, `"tracked_assets":15`.
2. Verify the volume persisted: restart the service once
   (`railway up --detach` again or Deploy button) and confirm the DB file
   exists: `railway ssh` → `ls -la /data/`.
3. Compare board output with Render (same `generated_at`, scores within a
   few points — timestamps may differ by a board refresh).

## Phase 2 — Cut over the frontend

The frontend already honors `NEXT_PUBLIC_API_URL` (`frontend/lib/api.ts:19`).
Flip it on Vercel first so the change is reversible without a code deploy:

1. Vercel dashboard → xira.surf project → Settings → Environment Variables →
   `NEXT_PUBLIC_API_URL=https://<railway-domain>` for all environments.
2. Redeploy the frontend, load the site, verify the board/alerts/verify page.
3. Keep Render running for one board TTL (~15 min) as a rollback target.

## Phase 3 — Make Railway the default (code-level)

1. Update the fallback in `frontend/lib/api.ts`:
   ```ts
   process.env.NEXT_PUBLIC_API_URL || "https://<railway-domain>"
   ```
2. Update the same URL in `frontend/app/docs/page.tsx` and
   `mcp_server/claude_desktop_config.json`.
3. Add `xira-gsb3.onrender.com` to `ALLOWED_ORIGINS` removal is **not**
   needed (it stays for the old origin) — but keep `https://xira.surf`,
   `https://www.xira.surf`, `https://xira-tan.vercel.app` in the list.
   Drop the Render origin only after Render is decommissioned.

## Phase 4 — Decommission Render

1. Confirm Railway is healthy for 48h with a couple of redeploys
   (zero-downtime on Railway makes this safe).
2. Render dashboard → xira-api → Delete service. Remove the
   `xira-gsb3.onrender.com` entry from `ALLOWED_ORIGINS` (backend
   `main.py`) and any remaining docs references.

## Rollback (any phase)

1. Vercel: set `NEXT_PUBLIC_API_URL` back to `https://xira-gsb3.onrender.com`
   and redeploy.
2. Railway: `railway down` (or delete the service) — Render never stopped
   serving, so nothing else is needed.

## Notes

- The in-memory rate limiter (`rate_limit.py`) is per-instance; Railway's
  default single replica is equivalent to today's setup. If you later scale
  to multiple replicas, switch it to Railway's Redis plugin.
- The scheduler heartbeat still runs inside the API process (same as Render).
  A separate cron service is a later option.
- `XIRA_ADMIN_TOKEN` remains optional; without it `?fresh=true` is disabled
  (the safe default).
