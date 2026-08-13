#!/usr/bin/env python3
"""Build the XIRA asset catalog from live exchange + issuer data.

Sources:
  - OKX public API: SPOT instruments + tickers (what is listed, 24h USDT volume)
  - Backed/xStocks public API: asset registry with per-chain (X Layer) addresses
  - On-chain verification: symbol() on X Layer mainnet for every address

Output: catalogs/asset_catalog.json (top-N by volume enabled, rest listed).

Usage:
    python scripts/build_catalog.py [--limit 50] [--rpc https://rpc.xlayer.tech]
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import socket
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone

OKX_INSTRUMENTS = "https://www.okx.com/api/v5/public/instruments?instType=SPOT"
OKX_TICKERS = "https://www.okx.com/api/v5/market/tickers?instType=SPOT"
BACKED_ASSETS = "https://api.backed.fi/api/v2/public/assets"
SYMBOL_SELECTOR = "0x95d89b41"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
ETF_TICKERS = {"SPY", "QQQ", "IWM", "EWY", "XLE", "SOXL", "TQQQ"}
_IP_OVERRIDES: dict[str, str] = {}


def _doh_resolve(host: str) -> list[str]:
    url = f"https://cloudflare-dns.com/dns-query?name={host}&type=A"
    req = urllib.request.Request(url, headers={**UA, "accept": "application/dns-json"})
    d = json.load(urllib.request.urlopen(req, timeout=15))
    return [a["data"] for a in d.get("Answer", []) if a.get("type") == 1]


class _Conn(http.client.HTTPSConnection):
    def connect(self):  # noqa: D102
        ip = _IP_OVERRIDES.get(self.host)
        self.sock = socket.create_connection((ip or self.host, self.port), timeout=30)
        self.sock = ssl.create_default_context().wrap_socket(self.sock, server_hostname=self.host)


class _Handler(urllib.request.HTTPSHandler):
    def https_open(self, req):  # noqa: D102
        return self.do_open(_Conn, req)


def _get_json(url: str, timeout: int = 30):
    host = urllib.parse.urlparse(url).hostname
    req = urllib.request.Request(url, headers=UA)
    try:
        if host in _IP_OVERRIDES:
            opener = urllib.request.build_opener(_Handler())
            with opener.open(req, timeout=timeout) as resp:
                return json.load(resp)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.URLError:
        if host in _IP_OVERRIDES or not host:
            raise
        ips = _doh_resolve(host)
        if not ips:
            raise
        _IP_OVERRIDES[host] = ips[0]
        opener = urllib.request.build_opener(_Handler())
        with opener.open(req, timeout=timeout) as resp:
            return json.load(resp)


def fetch_backed() -> dict[str, dict]:
    nodes, page = [], 0
    while True:
        d = _get_json(f"{BACKED_ASSETS}?page={page}")
        nodes += d.get("nodes", [])
        if not d.get("page", {}).get("hasNextPage"):
            break
        page += 1
        time.sleep(0.2)
    out = {}
    for n in nodes:
        deps = [
            dep
            for dep in n.get("deployments", [])
            if "xlayer" in dep.get("network", "").lower()
            or "x layer" in dep.get("network", "").lower()
        ]
        if deps and deps[0].get("address", "").startswith("0x"):
            out[n["underlyingSymbol"]] = {
                "symbol": n["symbol"],
                "name": n["name"],
                "address": deps[0]["address"],
                "exchange": ((n.get("trading") or {}).get("exchange") or {}).get("name", ""),
            }
    return out


def onchain_symbol(rpc: str, address: str) -> str:
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_call",
         "params": [{"to": address, "data": SYMBOL_SELECTOR}, "latest"]}
    ).encode()
    req = urllib.request.Request(rpc, data=body, headers={"Content-Type": "application/json"})
    res = json.load(urllib.request.urlopen(req, timeout=20)).get("result", "")
    if res.startswith("0x") and len(res) > 130:
        ln = int(res[66:130], 16)
        return bytes.fromhex(res[130 : 130 + ln * 2]).decode(errors="replace")
    return ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--rpc", default="https://rpc.xlayer.tech")
    ap.add_argument("--out", default="catalogs/asset_catalog.json")
    args = ap.parse_args()

    okx = _get_json(OKX_INSTRUMENTS)["data"]
    tickers = _get_json(OKX_TICKERS)["data"]
    vol = {t["instId"]: float(t.get("volCcy24h", 0) or 0) for t in tickers}
    backed = fetch_backed()

    rows = []
    for p in okx:
        iid = p["instId"]
        if not (iid.startswith("X") and iid.endswith("-USDT")):
            continue
        base = iid[1:].replace("-USDT", "")
        info = backed.get(base)
        if not info:
            continue
        rows.append(
            {
                "okx_pair": iid,
                "underlying": base,
                "symbol": info["symbol"],
                "name": info["name"],
                "token_address": info["address"],
                "sector": "ETF" if base in ETF_TICKERS else info["exchange"],
                "quote_asset": "USDT",
                "vol24h_usdt": vol.get(iid, 0),
            }
        )
    rows.sort(key=lambda r: -r["vol24h_usdt"])

    verified, failed = 0, []
    for r in rows:
        s = onchain_symbol(args.rpc, r["token_address"])
        if s == r["symbol"]:
            verified += 1
        else:
            failed.append((r["symbol"], s))

    catalog = {
        "version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "quote_asset": "USDT",
        "source": "OKX spot instruments + Backed/xStocks registry + X Layer mainnet symbol() check",
        "rpc": args.rpc,
        "listed_count": len(rows),
        "verified_onchain": verified,
        "assets": [
            {**r, "enabled": i < args.limit} for i, r in enumerate(rows)
        ],
    }
    with open(args.out, "w") as f:
        json.dump(catalog, f, indent=2)
        f.write("\n")

    deploy_artifact = {
        "source": args.out,
        "generated_at": catalog["generated_at"],
        "symbols": [a["symbol"] for a in catalog["assets"] if a.get("enabled")],
        "addresses": [a["token_address"] for a in catalog["assets"] if a.get("enabled")],
    }
    deploy_path = os.path.join(os.path.dirname(args.out), "asset_catalog.deploy.json")
    with open(deploy_path, "w") as f:
        json.dump(deploy_artifact, f, indent=2)
        f.write("\n")

    print(f"listed: {len(rows)} | verified on-chain: {verified} | enabled: {min(args.limit, len(rows))}")
    print(f"wrote {args.out}")
    if failed:
        print("verification failures:", failed)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
