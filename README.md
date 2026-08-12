# XIRA — X-Layer Intelligence & Risk Analytics

AI-powered risk intelligence and signals for tokenized equities (xStocks) on X Layer.

XIRA continuously analyzes 15 high-visibility xStocks, generates explainable multi-factor risk scores with short rationales, and publishes compact on-chain attestations so agents, DeFi protocols, and users can act on them in real time.

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     Data Layer                            │
│  yfinance (price/volume)  │  Sentiment signals           │
│  On-chain X Layer data    │  Market news proxies         │
└──────────────┬────────────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────────────┐
│                     AI Engine                             │
│  Multi-factor scoring (momentum, sentiment, volume,       │
│  liquidity) + explanation generation + anomaly detection   │
└──────────────┬────────────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────────────┐
│               Attestation Engine                          │
│  Evidence hashing → On-chain publisher contract           │
└──────────────┬────────────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────────────┐
│               On-Chain Layer (X Layer)                    │
│  XIRA.sol — stores latest attestation per asset           │
│  Verifiable by agents, protocols, composable in DeFi      │
└──────────────┬────────────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────────────┐
│               Interface Layer                             │
│  REST API (FastAPI)  │  Next.js Dashboard                 │
│  Agent-friendly JSON  │  MCP-ready endpoints              │
└───────────────────────────────────────────────────────────┘
```

## Project Structure

```
xira/
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/XIRA.sol        # Core attestation contract
│   ├── script/Deploy.s.sol # Deployment scripts
│   ├── test/XIRA.t.sol     # Tests
│   └── foundry.toml        # Foundry config
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── main.py         # API entry point
│   │   ├── models.py       # Pydantic models
│   │   ├── routers/
│   │   │   ├── assets.py   # /api/assets/* endpoints
│   │   │   └── attestations.py # /api/attestations/* endpoints
│   │   └── services/
│   │       ├── data_fetcher.py  # Price + sentiment ingestion
│   │       ├── ai_engine.py     # Multi-factor AI scoring
│   │       └── publisher.py     # On-chain publisher
│   └── requirements.txt
├── frontend/               # Next.js dashboard
│   ├── app/
│   │   ├── page.tsx        # Dashboard (all assets)
│   │   ├── layout.tsx      # Root layout
│   │   └── asset/[symbol]/ # Asset detail page
│   ├── components/
│   │   ├── ScoreCard.tsx   # Risk score card
│   │   └── FactorBreakdown.tsx # Charts + alerts
│   └── lib/
│       ├── api.ts          # API client
│       └── types.ts        # TypeScript types
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- An X Layer testnet RPC endpoint (or use the public one)

### 1. Smart Contracts

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

**Quick deploy:**
```bash
cd contracts
export PRIVATE_KEY=your_testnet_key
forge script script/DeployAll.s.sol --rpc-url https://testrpc.xlayer.tech --broadcast --legacy
```

**Oracle wallet:** `0x0CE306F2863a98e847F454dF74E93Ff1461ED3c0`

### 2. Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your RPC URL, private key, and contract address
# The backend works in OFF-CHAIN MODE without a wallet — scores are still generated

# Run the server
python -m app.main
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
# Dashboard at http://localhost:3000
```

---

## Tracked Assets

| Symbol  | Underlying | Sector             |
|---------|-----------|-------------------|
| NVDAx   | NVDA      | Technology         |
| TSLAx   | TSLA      | Consumer Cyclical  |
| AAPLx   | AAPL      | Technology         |
| MSFTx   | MSFT      | Technology         |
| GOOGLx  | GOOGL     | Communication      |
| AMZNx   | AMZN      | Consumer Cyclical  |
| METAx   | META      | Communication      |
| SPYx    | SPY       | ETF (S&P 500)      |
| QQQx    | QQQ       | ETF (Nasdaq-100)   |
| AMDx    | AMD       | Technology         |
| INTCx   | INTC      | Technology         |
| NFLXx   | NFLX      | Communication      |
| BAx     | BA        | Industrials        |
| JPMx    | JPM       | Financial          |
| XOMx    | XOM       | Energy             |

---

## Smart Contract API

### XIRA.sol — On-Chain Attestation Store

```solidity
struct Attestation {
    uint8 score;           // 0-100 risk score
    uint8 confidence;      // 0-100 confidence level
    bytes32 evidenceHash;  // SHA-256 of evidence payload
    uint64 timestamp;      // Unix timestamp
    string modelVersion;   // Model version string
    bool anomaly;          // Anomaly flag
    string anomalyReason;  // Anomaly explanation
}
```

**Functions:**
- `updateAttestation(asset, score, confidence, evidenceHash, modelVersion, anomaly, anomalyReason)` — Write latest attestation (authorized only)
- `batchUpdateAttestations(...)` — Write multiple attestations in one tx
- `getLatestAttestation(asset)` — Read full attestation struct
- `getScore(asset)` — Quick score read
- `getScoreBatch(assets[])` — Batch score read
- `registerAsset(tokenAddr, symbol)` — Register a new tracked asset

---

## REST API Endpoints

### `GET /api/assets/all`
Returns risk scores for all 15 tracked assets plus a market summary.

### `GET /api/assets/{symbol}`
Returns detail for a single asset: underlying, sector, token address, current
risk score, 24h price change, and the score delta vs the previous attestation.

### `GET /api/assets/stats`
Market-level statistics: average score, distribution across risk levels,
anomaly count, and best/worst scoring assets.

### `GET /api/alerts`
Returns all currently flagged anomaly alerts, sorted by risk score descending.

### `GET /api/attestations/{symbol}`
Returns detailed attestation for a single asset (runs AI analysis on demand, publishes on-chain).

### `GET /api/attestations/{symbol}/history?limit=10`
Returns last N attestations for an asset.

### `GET /api/assets/health`
Health check with model version and tracked asset count.

### `GET /api/assets/history/stats`
SQLite history database statistics (record count, oldest/newest records).

---

## Agent-Friendly Output Format

The `/api/assets/all` endpoint returns JSON consumable by AI agents and DeFi protocols:

```json
{
  "generated_at": 1723315200,
  "model_version": "v1.0.0",
  "summary": "Market outlook: Moderate risk. Average score 47/100 across 15 assets. 2 anomaly alerts active.",
  "assets": [
    {
      "symbol": "NVDAx",
      "risk_score": 42,
      "risk_level": "MODERATE",
      "confidence": 78,
      "factors": [
        {
          "name": "momentum",
          "label": "Momentum",
          "score": 55,
          "weight": 0.30,
          "description": "Neutral momentum: +1.23% 24h change."
        },
        {
          "name": "sentiment",
          "label": "Sentiment",
          "score": 48,
          "weight": 0.25,
          "description": "Mixed or neutral sentiment signals."
        },
        {
          "name": "volume_anomaly",
          "label": "Volume Anomaly",
          "score": 38,
          "weight": 0.25,
          "description": "Below-average volume: 0.35x average."
        },
        {
          "name": "liquidity_proxy",
          "label": "Liquidity Proxy",
          "score": 30,
          "weight": 0.20,
          "description": "Low dollar turnover. Moderate slippage risk."
        }
      ],
      "explanation": "NVDAx shows moderate risk (score 42/100). The underlying gained 1.2% in the last 24h. Key concern: liquidity proxy (30/100). Strength: momentum (55/100).",
      "anomaly": false,
      "anomaly_reason": "",
      "evidence_hash": "a1b2c3d4e5f6...",
      "timestamp": 1723315200,
      "model_version": "v1.0.0"
    }
  ]
}
```

---

## Multi-Factor Scoring Model

| Factor          | Weight | Description |
|-----------------|--------|-------------|
| Momentum        | 30%   | Short/long MA ratio, 52-week position, 24h change |
| Sentiment       | 25%   | News/market sentiment signal |
| Volume Anomaly  | 25%   | Current volume vs 20-day average |
| Liquidity Proxy | 20%   | Dollar turnover estimation |

Each factor scores 0-100. The weighted average produces the overall **Risk Score**. A score of 0 = very low risk, 100 = critical risk.

**Risk Levels:**
- 0–20: LOW (green)
- 21–40: MODERATE (yellow)
- 41–60: ELEVATED (orange)
- 61–80: HIGH (red)
- 81–100: CRITICAL (dark red)

---

## Configuration

### Backend `.env`

| Variable              | Default                          | Description |
|-----------------------|----------------------------------|-------------|
| `XLAYER_RPC_URL`      | `https://testrpc.xlayer.tech`    | X Layer testnet RPC |
| `XIRA_CONTRACT_ADDRESS` | `0x00...`                     | Deployed contract |
| `PRIVATE_KEY`         | (empty)                          | Deployer/updater key |
| `AI_MODE`             | `heuristic`                      | `heuristic` or `openai` |
| `OPENAI_API_KEY`      | (empty)                          | For LLM explanations |
| `MODEL_VERSION`       | `v1.0.0`                     | Model version tag |
| `PORT`                | `8000`                           | API port |

---

## Off-Chain Mode

The backend works **without** a wallet or contract address. Set `PRIVATE_KEY=` and `XIRA_CONTRACT_ADDRESS=0x00...` to run in off-chain mode. Scores, explanations, and history are still generated and served via the API. On-chain publishing is simply skipped.

---

## Demo Flow

1. Start the backend: `python -m app.main`
2. Start the frontend: `npm run dev`
3. Open `http://localhost:3000` — see the dashboard with all 15 assets
4. Click any asset card for detailed factor breakdown + history
5. Hit `http://localhost:8000/api/assets/all` for the agent-friendly JSON
6. Read attestations on-chain via the XIRA contract

---

## License

MIT
