#!/usr/bin/env python3
"""
XIRA MCP Server — Model Context Protocol for AI Agents

Exposes XIRA risk intelligence tools to AI agents via MCP (JSON-RPC over stdio).
Zero external dependencies — pure Python 3.9+ standard library.

Tools exposed:
  - xira_get_all_assets      → Risk scores for all 15 xStocks
  - xira_get_asset_risk      → Detailed attestation for one asset
  - xira_get_asset_history   → Historical scores for one asset
  - xira_get_health          → Backend health + config

Usage:
  python mcp_server/server.py

Configure in Claude Desktop / Cursor / VS Code Copilot:
  {
    "mcpServers": {
      "XIRA": {
        "command": "python3",
        "args": ["/absolute/path/to/xira/mcp_server/server.py"]
      }
    }
  }
"""

from __future__ import annotations
import json
import sys
import os
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

API_URL = os.environ.get("XIRA_API_URL", "https://xira-gsb3.onrender.com")
REQUEST_TIMEOUT = 120

MCP_SERVER_INFO = {
    "name": "XIRA MCP Server",
    "version": "1.0.0",
}

MCP_TOOLS = [
    {
        "name": "xira_get_all_assets",
        "description": (
            "Get risk scores and attestations for all 15 tracked xStocks (NVDAx, TSLAx, "
            "AAPLx, MSFTx, GOOGLx, AMZNx, METAx, SPYx, QQQx, AMDx, INTCx, NFLXx, BAx, "
            "JPMx, XOMx). Returns risk scores, confidence levels, factor breakdowns, "
            "anomaly flags, and a market summary."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "xira_get_asset_risk",
        "description": (
            "Get detailed risk attestation for a single xStock. Returns risk score "
            "(0-100), confidence, 5 risk factor scores (momentum, volatility, "
            "sentiment, volume anomaly, liquidity), explanation, anomaly status, "
            "on-chain evidence hash, and the verification tx hash / explorer link."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "xStock symbol, e.g. NVDAx, TSLAx, AAPLx, SPYx",
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "xira_get_asset_history",
        "description": (
            "Get the last N risk scores for a single xStock. Useful for spotting "
            "trends, breakouts, or deteriorating conditions over time."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "xStock symbol, e.g. NVDAx",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of historical entries (default 10, max 50)",
                    "default": 10,
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "xira_get_health",
        "description": (
            "Check if the XIRA backend is online and what assets it tracks. "
            "Returns status, version, chain info, and tracked asset count."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "xira_get_alerts",
        "description": (
            "Get all currently flagged anomaly alerts across the tracked "
            "xStocks. Returns symbols, risk scores, anomaly reasons, and "
            "severity, sorted by risk score descending."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "xira_get_market_stats",
        "description": (
            "Get market-level risk statistics: average score, distribution "
            "across risk levels, anomaly count, and the best/worst scoring "
            "assets."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


def log_error(msg: str):
    print(json.dumps({"log": msg}), file=sys.stderr, flush=True)


def read_msg() -> Optional[dict]:
    try:
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line)
    except (json.JSONDecodeError, EOFError) as e:
        log_error(f"Failed to read message: {e}")
        return None


def write_msg(msg: dict):
    sys.stdout.write(json.dumps(msg, default=str) + "\n")
    sys.stdout.flush()


def send_response(request_id: Any, result: Any):
    write_msg({"jsonrpc": "2.0", "id": request_id, "result": result})


def send_error(request_id: Any, code: int, message: str):
    write_msg({
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    })


def api_get(path: str) -> Optional[dict]:
    try:
        url = f"{API_URL}{path}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        return {"error": f"API unreachable: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


# ── Tool handlers ──

def handle_get_all_assets(request_id: Any) -> None:
    data = api_get("/api/assets/all")
    if not data or "error" in data:
        send_error(request_id, -32000, data.get("error", "Failed to fetch assets") if data else "No data")
        return

    if "assets" in data:
        for a in data["assets"]:
            a.pop("evidence_hash", None)

    send_response(request_id, {
        "summary": data.get("summary", ""),
        "asset_count": len(data.get("assets", [])),
        "data_source": data.get("data_source", "unknown"),
        "assets": data.get("assets", []),
    })


def handle_get_asset_risk(request_id: Any, symbol: str) -> None:
    data = api_get(f"/api/attestations/{symbol}")
    if not data:
        send_error(request_id, -32001, f"Asset '{symbol}' not found or API error")
        return
    if "error" in data:
        send_error(request_id, -32001, data["error"])
        return

    send_response(request_id, {
        "symbol": data.get("symbol", symbol),
        "risk_score": data.get("risk_score"),
        "risk_level": data.get("risk_level"),
        "confidence": data.get("confidence"),
        "anomaly": data.get("anomaly"),
        "anomaly_reason": data.get("anomaly_reason", ""),
        "explanation": data.get("explanation", ""),
        "factors": data.get("factors", []),
        "data_source": data.get("data_source", "unknown"),
        "onchain": {
            "evidence_hash": data.get("evidence_hash", ""),
            "chain_tx": data.get("chain_tx"),
            "chain_explorer": data.get("chain_explorer"),
            "chain_block": data.get("chain_block"),
            "chain_id": data.get("chain_id"),
        },
        "timestamp": data.get("timestamp", 0),
    })


def handle_get_asset_history(request_id: Any, symbol: str, limit: int = 10) -> None:
    data = api_get(f"/api/attestations/{symbol}/history?limit={limit}")
    if not data:
        send_error(request_id, -32002, f"History for '{symbol}' not found")
        return
    if "error" in data:
        send_error(request_id, -32002, data["error"])
        return

    history = data.get("history", [])
    simplified = []
    for h in history:
        simplified.append({
            "timestamp": h.get("timestamp"),
            "risk_score": h.get("risk_score"),
            "risk_level": h.get("risk_level"),
            "confidence": h.get("confidence"),
            "anomaly": h.get("anomaly"),
        })

    send_response(request_id, {
        "symbol": data.get("symbol", symbol),
        "history": simplified,
        "count": len(simplified),
    })


def handle_get_health(request_id: Any) -> None:
    data = api_get("/api/assets/health")
    if not data or "error" in data:
        send_error(request_id, -32003, "Health check failed")
        return
    send_response(request_id, data)


def handle_get_alerts(request_id: Any) -> None:
    data = api_get("/api/alerts")
    if not data or "error" in data:
        send_error(request_id, -32004, data.get("error", "Failed to fetch alerts") if data else "No data")
        return

    send_response(request_id, {
        "generated_at": data.get("generated_at"),
        "total_alerts": data.get("total_alerts", 0),
        "data_source": data.get("data_source", "unknown"),
        "alerts": data.get("alerts", []),
    })


def handle_get_market_stats(request_id: Any) -> None:
    data = api_get("/api/assets/stats")
    if not data or "error" in data:
        send_error(request_id, -32005, data.get("error", "Failed to fetch stats") if data else "No data")
        return
    send_response(request_id, data)


# ── MCP lifecycle ──

def handle_initialize(request_id: Any, params: dict) -> None:
    client_info = params.get("clientInfo", {})
    log_error(f"MCP initialize from {client_info.get('name', 'unknown')} v{client_info.get('version', '?')}")

    send_response(request_id, {
        "protocolVersion": "2024-11-05",
        "serverInfo": MCP_SERVER_INFO,
        "capabilities": {
            "tools": {},
        },
    })


def handle_tools_list(request_id: Any) -> None:
    send_response(request_id, {"tools": MCP_TOOLS})


def handle_tools_call(request_id: Any, params: dict) -> None:
    tool_name = params.get("name", "")
    arguments = params.get("arguments", {})

    try:
        if tool_name == "xira_get_all_assets":
            handle_get_all_assets(request_id)
        elif tool_name == "xira_get_asset_risk":
            symbol = arguments.get("symbol", "")
            if not symbol:
                send_error(request_id, -32602, "Missing required parameter: symbol")
                return
            handle_get_asset_risk(request_id, symbol)
        elif tool_name == "xira_get_asset_history":
            symbol = arguments.get("symbol", "")
            limit = arguments.get("limit", 10)
            if not symbol:
                send_error(request_id, -32602, "Missing required parameter: symbol")
                return
            handle_get_asset_history(request_id, symbol, int(limit))
        elif tool_name == "xira_get_health":
            handle_get_health(request_id)
        elif tool_name == "xira_get_alerts":
            handle_get_alerts(request_id)
        elif tool_name == "xira_get_market_stats":
            handle_get_market_stats(request_id)
        else:
            send_error(request_id, -32601, f"Unknown tool: {tool_name}")
    except Exception as e:
        log_error(f"Tool call error: {e}")
        send_error(request_id, -32000, str(e))


def handle_initialized(_request_id: Any, _params: dict) -> None:
    pass


# ── Main loop ──

METHOD_MAP = {
    "initialize": handle_initialize,
    "initialized": lambda rid, p: None,
    "tools/list": lambda rid: handle_tools_list(rid),
    "tools/call": handle_tools_call,
    "notifications/initialized": lambda rid, p: None,
}


def main():
    log_error(f"XIRA MCP Server starting | API: {API_URL}")

    while True:
        msg = read_msg()
        if msg is None:
            break

        method = msg.get("method", "")
        msg_id = msg.get("id")
        params = msg.get("params", {})

        handler = METHOD_MAP.get(method)
        if handler is None:
            send_error(msg_id, -32601, f"Method not found: {method}")
            continue

        try:
            if method in ("tools/list",):
                handler(msg_id)
            else:
                handler(msg_id, params)
        except Exception as e:
            log_error(f"Handler error: {e}")
            send_error(msg_id, -32603, str(e))

    log_error("XIRA MCP Server shutting down")


if __name__ == "__main__":
    main()
