# XIRA — Judge Demo Script

A ~4 minute walkthrough of the live product. Everything below works on the
deployed site (GitHub Pages) against the live backend (Render) and the XIRA
contract on X Layer Testnet (chain 1952).

---

## 1. Landing (30s)

Open the site. Front and center:

- **Live pill** — "LIVE ON X LAYER TESTNET · CHAIN 1952"
- **Live risk board** — top 8 markets as animated bars, with the risk curve
  flowing continuously and a scanning dot
- **Stat strip** — 15 markets tracked · 5 risk factors · 30-min cadence ·
  1 score = 1 attestation
- Ticker scrolls the full board across the top

Say: *"Every number on this page is a live attestation on X Layer."*

## 2. Live board / dashboard (60s)

Click **Live board** (header CTA).

- **Market pulse** — average risk, colored distribution bar, best/worst
- **Filters** — risk level chips, sector chips, alerts-only toggle
- **Grid ↔ Table** — switch to table: symbol, sector, score, Δ arrow,
  confidence bar, LIVE/SIMULATED source
- **Pin a market** (star) → it appears in the Watchlist row
- **Copy JSON** — one click exports the agent-ready payload

Say: *"Filter, sort, or export the exact payload an agent would consume."*

## 3. Asset page + share (45s)

Click any market, e.g. **NVDAx**.

- Score gauge, factor breakdown with reasons, risk history chart,
  on-chain verification (evidence hash + latest tx)
- **Copy score summary** — copies a compact attestation card

## 4. Verify a score (45s)

Header → **Verify** (or `/verify`).

- Pick a market; see **API vs On-chain** side by side:
  score, confidence, evidence hash, timestamp, anomaly flag
- Green **VERIFIED** badge when the API record matches the contract

Say: *"The score you see is the transaction anyone can check."*

## 5. Alert bell + thresholds (45s)

- Header **bell** shows anomaly count; open it for reasons + timestamps
- **Alerts page** — set a risk threshold per market (e.g. NVDAx ≥ 60);
  breached markets appear in the bell with "Above your threshold"

## 6. Agent-ready (30s)

Landing → **Give your agents a risk desk**: `xira_get_asset_risk`,
`xira_get_all_assets`, `xira_get_attestation_history` via the MCP server
(`mcp_server/server.py`).

---

## Key links

- Site: GitHub Pages (repo `Kohap/xira` → Actions → Deploy Frontend)
- API: `https://xira-gsb3.onrender.com/docs` (OpenAPI)
- Contract: `0x64288ccD936470f66D7035e824A9141C938C32AE` on
  [OKX X Layer testnet explorer](https://www.okx.com/web3/explorer/xlayer-test/address/0x64288ccD936470f66D7035e824A9141C938C32AE)
- MCP: `python3 mcp_server/server.py`

## Troubleshooting

- **Board shows "reconnecting"** → backend cold start (~30-60s); it retries
  automatically. Warm it with `curl https://xira-gsb3.onrender.com/api/assets/health`
- **Simulated tag on cards** → live data flag off in the backend env
  (`USE_LIVE_DATA=true`)
