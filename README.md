# XIRA — X-Layer Intelligence & Risk Analytics

<img src="https://www.xira.surf/icon.png" width="48" height="48" align="left" alt="XIRA">

**One verifiable risk number for every xStock — signed onchain.**

XIRA analyzes 50 xStocks, compresses momentum, volatility, sentiment, volume
anomaly and liquidity into a single explainable 0–100 risk score, and publishes
each meaningful change as an on-chain attestation on X Layer Mainnet. Agents,
protocols and humans read the same number, and can verify it without trusting
this site.

<br clear="both">

## Live

| | |
|---|---|
| **App** | [https://www.xira.surf](https://www.xira.surf) |
| **Risk board** | [https://www.xira.surf/dashboard](https://www.xira.surf/dashboard) |
| **API base** | [https://xira-api-production.up.railway.app](https://xira-api-production.up.railway.app) |
| **Docs** | [https://xira-api-production.up.railway.app/docs](https://xira-api-production.up.railway.app/docs) |
| **Verify a score** | [https://www.xira.surf/verify](https://www.xira.surf/verify) |
| **Oracle contract** | [`0x22851e160aef3e3aeb373fd351a07ff7c65c9b57`](https://www.okx.com/web3/explorer/xlayer/address/0x22851e160aef3e3aeb373fd351a07ff7c65c9b57) on OKX Explorer |
| **Source** | [github.com/Kohap/xira](https://github.com/Kohap/xira) |

## The build in 30 seconds

- **Frontend** — Next.js, statically hosted on GitHub Pages. Landing page,
  live risk board, per-asset factor breakdowns, anomaly alerts, a published
  vs on-chain verify tool, and docs.
- **Backend** — FastAPI on Railway. Pulls live quotes from Finnhub (with a
  deterministic simulator as fallback), scores 50 tracked markets with a
  transparent five-factor model, and serves the board over JSON.
- **On-chain** — Solidity attestation contract on X Layer Mainnet (Chain ID
  196). A heartbeat scheduler signs every meaningful score change
  (deviation threshold) as a transaction; `GET` endpoints are read-only and
  never spend gas.
- **Agents** — the same data is exposed as MCP tools
  (`xira_get_asset_risk`, `xira_get_all_assets`, `xira_get_attestation_history`),
  served both locally (`python mcp_server/server.py`) and as a hosted
  endpoint at `https://xira-api-production.up.railway.app/mcp` — point any
  MCP client straight at the URL, no local server needed.

Every score carries an `evidence_hash` (sha256 of score, confidence, factors
and data source). Match it against the on-chain record and the number proves
itself — no dashboard trust required.

## Architecture

```
Finnhub quotes + fallback simulator
        │
        ▼
AI engine ── five factors, weighted ──► 0–100 score + explanation
        │
        ▼
Attestation store (SQLite) ── scheduler (30 min, deviation threshold)
        │
        ▼
XIRA.sol on X Layer Mainnet ── evidence_hash, score, timestamp per asset
        │
        ▼
REST API (FastAPI)  ·  Next.js dashboard  ·  MCP tools for agents
```

## Project structure

```
xira/
├── contracts/              # Solidity attestation contract (Foundry)
│   ├── src/XIRA.sol
│   ├── script/DeployAll.s.sol
│   └── test/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── main.py         # Entry point + CORS
│   │   ├── models.py       # Pydantic models
│   │   ├── routers/        # /api/assets/*, /api/attestations/*
│   │   └── services/       # data_fetcher, ai_engine, publisher, scheduler
│   └── requirements.txt
├── frontend/               # Next.js site
│   ├── app/                # Landing, dashboard, asset/[symbol], verify,
│   │                       # alerts, docs, whitepaper, legal pages
│   ├── components/         # ScoreCard, RiskHeatmap, AlertBell, ...
│   └── lib/                # API client + types
└── README.md
```

## Quick start

### Prerequisites

- Node.js 18+ · Python 3.10+ · Foundry (for contracts)

### 1. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add RPC URL, contract address, key
python -m app.main            # http://localhost:8000 · /docs
```

The backend runs without a wallet in off-chain mode — scores and history
still work, on-chain publishing is skipped.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

### 3. Contracts

```bash
cd contracts
export PRIVATE_KEY=your_key
forge script script/DeployAll.s.sol --rpc-url https://rpc.xlayer.tech --broadcast --legacy
```

Oracle wallet: `0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0`

## Tracked assets

The tracked universe is catalog-driven — `catalogs/asset_catalog.json` lists
65 xStocks (50 enabled by default), each with its OKX spot pair, underlying,
token address and live 24h volume. Enable/disable an asset by flipping
`enabled` in the catalog and redeploying the backend.

## Scoring model

| Factor | Weight |
|---|---|
| Momentum | 25% |
| Volatility | 20% |
| Sentiment | 20% |
| Volume Anomaly | 20% |
| Liquidity Proxy | 15% |

Risk levels: 0–20 LOW · 21–40 MODERATE · 41–60 ELEVATED · 61–80 HIGH · 81–100 CRITICAL.

## REST API (highlights)

- `GET /api/assets/all` — the whole board: scores, factors, summary
- `GET /api/assets/{symbol}` — one asset's profile + score delta
- `GET /api/assets/stats` — market-level stats
- `GET /api/assets/verify/{symbol}` — published vs on-chain comparison
- `GET /api/assets/health` — version, chain, contract, live-data status
- `GET /api/attestations/{symbol}` — latest published attestation (read-only)
- `GET /api/attestations/{symbol}/history?limit=10` — score trail
- `GET /api/alerts` · `PUT /api/alerts/thresholds` — anomalies + thresholds

## License

MIT
