#!/usr/bin/env python3
"""Recompute attestations from live market data and compare against the
on-chain state. Verifies a third party can reproduce the published score
and evidence hash.

Usage:
    FINNHUB_API_KEY=... XIRA_CONTRACT_ADDRESS=... PRIVATE_KEY=... \
    python scripts/recompute_score.py [--max-age-min 25]

Exit code 0 = on-chain state matches a fresh recompute (or chain not yet
reached by the scheduler); 1 = drift detected or verification impossible.

Run from the repository root or anywhere; it locates the backend app itself.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", ".env"))
except Exception:
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-age-min", type=int, default=25,
                        help="Max age (min) of the on-chain attestation to accept as current. 0 = any age.")
    args = parser.parse_args()

    from app.models import AttestationResponse  # noqa: F401 (keeps pydantic warm)
    from app.services.data_fetcher import get_tracked_assets, data_fetcher
    from app.services.ai_engine import ai_engine
    from app.services.publisher import publisher

    if not publisher.has_contract:
        print("FAIL: publisher not enabled (XIRA_CONTRACT_ADDRESS missing or zero address).")
        return 1

    model_version = os.getenv("MODEL_VERSION", "v1.1.0")
    asset_map = {a["symbol"]: a for a in get_tracked_assets()}
    tickers = [a["underlying"] for a in get_tracked_assets()]
    by_ticker = {a["underlying"]: a for a in get_tracked_assets()}

    signer_addr = publisher.account.address if publisher.account else "none (read-only verification)"
    print(f"Chain       : {publisher.chain_label} (id {publisher.chain_id})")
    print(f"Contract    : {publisher.contract_address}")
    print(f"Signer      : {signer_addr}")
    print(f"Model ver   : {model_version}")

    prices, _ = data_fetcher.fetch_all_prices(tickers, force=True)
    sentiments, _ = data_fetcher.fetch_all_sentiments(tickers, prices)

    drift = 0
    failures = 0
    rows = []
    now = time.time()

    for ticker in tickers:
        asset = by_ticker[ticker]
        symbol = asset["symbol"]
        price_data = prices.get(ticker)
        sentiment = sentiments.get(ticker)
        status = "OK"
        notes = []
        local_score = "-"
        try:
            s_val = getattr(sentiment, "score", 0.0)
            result = ai_engine.analyze(
                symbol=symbol,
                price_data=price_data,
                sentiment=s_val,
                model_version=model_version,
            )
            local_score = result.risk_score
            chain = publisher.read_latest(asset["token_address"])
            if chain is None:
                failures += 1
                status = "NO-CHAIN"
                notes.append("on-chain read failed")
            else:
                chain_hash = chain["evidence_hash"].replace("0x", "").lower()
                local_hash = result.evidence_hash.lower()
                age_min = (now - chain["timestamp"]) / 60.0
                if chain_hash != local_hash:
                    drift += 1
                    status = "DRIFT"
                    notes.append(f"hash differs (chain {chain['score']} / local {result.risk_score})")
                elif chain["score"] != result.risk_score:
                    drift += 1
                    status = "DRIFT"
                    notes.append("hash matches but score differs (evidence construction changed?)")
                elif args.max_age_min > 0 and age_min > args.max_age_min:
                    status = "STALE"
                    notes.append(f"attestation {age_min:.0f} min old")
                else:
                    notes.append(f"verified {chain['score']}/100 age {age_min:.0f} min")
                if price_data is not None and price_data.source == "mock":
                    notes.append("simulated prices")
        except Exception as e:  # noqa: BLE001
            failures += 1
            status = "ERROR"
            notes.append(str(e)[:80])
        rows.append((symbol, local_score, status, "; ".join(notes)))

    print()
    print(f"{'symbol':<8} {'local':>5}  status    notes")
    print("-" * 78)
    for symbol, score, status, note in rows:
        print(f"{symbol:<8} {score:>5}  {status:<10} {note}")

    print()
    print(f"summary: {len(rows) - drift - failures} verified, {drift} drift, {failures} error/unreachable")
    if drift or failures:
        print("DRIFT DETECTED - investigate before relying on-chain.")
        return 1
    print(f"passed at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())