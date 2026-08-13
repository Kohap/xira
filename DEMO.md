# XIRA Product Demo

Use this script for a 3-5 minute product review. It matches the live production
state: Vercel frontend, Railway API, and X Layer Mainnet attestations.

## Live surfaces

- App: https://www.xira.surf
- Risk board: https://www.xira.surf/dashboard
- Verify flow: https://www.xira.surf/verify
- API docs: https://xira-api-production.up.railway.app/docs
- API health: https://xira-api-production.up.railway.app/api/assets/health
- Mainnet contract: https://www.okx.com/web3/explorer/xlayer/address/0x22851e160aef3e3aeb373fd351a07ff7c65c9b57

## Demo flow

1. Open the landing page and frame the product:
   XIRA turns xStock market data into one explainable risk score and publishes
   meaningful score changes as verifiable X Layer Mainnet attestations.

2. Open the live dashboard:
   show the market summary, risk distribution, risk heatmap, filters, table/grid
   switch, watchlist pins, and per-asset cards.

3. Open one asset detail page:
   show the score, factor breakdown, evidence hash, latest transaction, and
   stored onchain history.

4. Open the verify page:
   choose a symbol that has a recent publish, run verification, and show that
   API score, evidence hash, and timestamp match the contract.

5. Open API health:
   point out `chain_id: 196`, `rpc_url: https://rpc.xlayer.tech`, the mainnet
   contract address, scheduler status, signer balance, and publish status.

6. Open the repository:
   show `README.md`, `PRODUCT_REVIEW.md`, `contracts/src/XIRA.sol`,
   `backend/app/services/publisher.py`, and `frontend/app/dashboard/page.tsx`.

## Reviewer talking points

- The core model is deterministic and transparent: five factor scores produce a
  0-100 risk score.
- Public `GET` endpoints are read-only. Mutating routes require an admin token.
- The live frontend shows the contract and explorer links directly.
- Every attested score carries an evidence hash so reviewers can compare API data
  with the onchain record.
- The backend has fail-closed startup gates for expected chain, bytecode,
  signer, and owner when those environment variables are set.

## Known trust assumptions

- The current owner/updater is a single EOA. Move ownership to a Safe/multisig
  before holding significant production trust.
- The score is informational risk analytics, not financial advice.
- The API and scheduler are centralized services; the contract records what the
  oracle signed but does not independently calculate market risk.
