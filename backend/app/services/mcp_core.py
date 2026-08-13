"""
XIRA MCP protocol core — transport-agnostic Model Context Protocol server.

Implements the MCP JSON-RPC layer (initialize, tools/list, tools/call) on
top of the XIRA REST API. Zero external dependencies: the HTTP fetcher
uses only the standard library, so the same core powers both the local
stdio server (mcp_server/server.py) and the hosted streamable-HTTP
endpoint (/mcp) inside the FastAPI backend.

Transports inject a fetcher: callable(path: str) -> dict that resolves a
REST path against the XIRA API. The stdio transport and the FastAPI router
each build their own fetcher against the live backend.
"""

from __future__ import annotations
import json
import urllib.request
import urllib.error
from typing import Any, Callable, Dict, List, Optional

REQUEST_TIMEOUT = 120

SERVER_PROTOCOL_VERSION = "2024-11-05"
SUPPORTED_PROTOCOL_VERSIONS = {"2024-11-05", "2025-03-26", "2025-06-18"}

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


class MCPError(Exception):
    """JSON-RPC error carrying an MCP error code."""

    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


Fetcher = Callable[[str], Dict[str, Any]]


def api_get(base_url: str, path: str) -> Optional[dict]:
    """Fetch a REST path from the XIRA API. Returns a dict, or a
    {"error": ...} dict when the API is unreachable or malformed."""
    try:
        req = urllib.request.Request(
            f"{base_url}{path}", headers={"Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        return {"error": f"API unreachable: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def _tools_result_for(payload: Any) -> Dict[str, Any]:
    """Wrap a tool payload in the MCP content-block result shape."""
    return {
        "content": [{"type": "text", "text": json.dumps(payload, default=str)}],
    }


def _handle_get_all_assets(fetcher: Fetcher) -> Dict[str, Any]:
    data = fetcher("/api/assets/all")
    if not data or "error" in data:
        raise MCPError(-32000, data.get("error", "Failed to fetch assets") if data else "No data")

    if "assets" in data:
        for a in data["assets"]:
            a.pop("evidence_hash", None)

    return _tools_result_for({
        "summary": data.get("summary", ""),
        "asset_count": len(data.get("assets", [])),
        "data_source": data.get("data_source", "unknown"),
        "assets": data.get("assets", []),
    })


def _handle_get_asset_risk(fetcher: Fetcher, symbol: str) -> Dict[str, Any]:
    data = fetcher(f"/api/attestations/{symbol}")
    if not data:
        raise MCPError(-32001, f"Asset '{symbol}' not found or API error")
    if "error" in data:
        raise MCPError(-32001, data["error"])

    return _tools_result_for({
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


def _handle_get_asset_history(fetcher: Fetcher, symbol: str, limit: int = 10) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 50))
    data = fetcher(f"/api/attestations/{symbol}/history?limit={limit}")
    if not data:
        raise MCPError(-32002, f"History for '{symbol}' not found")
    if "error" in data:
        raise MCPError(-32002, data["error"])

    simplified = []
    for h in data.get("history", []):
        simplified.append({
            "timestamp": h.get("timestamp"),
            "risk_score": h.get("risk_score"),
            "risk_level": h.get("risk_level"),
            "confidence": h.get("confidence"),
            "anomaly": h.get("anomaly"),
        })

    return _tools_result_for({
        "symbol": data.get("symbol", symbol),
        "history": simplified,
        "count": len(simplified),
    })


def _handle_get_health(fetcher: Fetcher) -> Dict[str, Any]:
    data = fetcher("/api/assets/health")
    if not data or "error" in data:
        raise MCPError(-32003, "Health check failed")
    return _tools_result_for(data)


def _handle_get_alerts(fetcher: Fetcher) -> Dict[str, Any]:
    data = fetcher("/api/alerts")
    if not data or "error" in data:
        raise MCPError(-32004, data.get("error", "Failed to fetch alerts") if data else "No data")

    return _tools_result_for({
        "generated_at": data.get("generated_at"),
        "total_alerts": data.get("total_alerts", 0),
        "data_source": data.get("data_source", "unknown"),
        "alerts": data.get("alerts", []),
    })


def _handle_get_market_stats(fetcher: Fetcher) -> Dict[str, Any]:
    data = fetcher("/api/assets/stats")
    if not data or "error" in data:
        raise MCPError(-32005, data.get("error", "Failed to fetch stats") if data else "No data")
    return _tools_result_for(data)


def handle_initialize(params: dict) -> Dict[str, Any]:
    requested = params.get("protocolVersion", "")
    version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else SERVER_PROTOCOL_VERSION
    return {
        "protocolVersion": version,
        "serverInfo": MCP_SERVER_INFO,
        "capabilities": {
            "tools": {"listChanged": False},
        },
    }


def handle_tools_list() -> Dict[str, Any]:
    return {"tools": MCP_TOOLS}


def handle_tools_call(params: dict, fetcher: Fetcher) -> Dict[str, Any]:
    name = params.get("name", "")
    arguments = params.get("arguments", {})

    if name == "xira_get_all_assets":
        return _handle_get_all_assets(fetcher)
    if name == "xira_get_asset_risk":
        symbol = arguments.get("symbol", "")
        if not symbol:
            raise MCPError(-32602, "Missing required parameter: symbol")
        return _handle_get_asset_risk(fetcher, symbol)
    if name == "xira_get_asset_history":
        symbol = arguments.get("symbol", "")
        if not symbol:
            raise MCPError(-32602, "Missing required parameter: symbol")
        return _handle_get_asset_history(fetcher, symbol, arguments.get("limit", 10))
    if name == "xira_get_health":
        return _handle_get_health(fetcher)
    if name == "xira_get_alerts":
        return _handle_get_alerts(fetcher)
    if name == "xira_get_market_stats":
        return _handle_get_market_stats(fetcher)
    raise MCPError(-32601, f"Unknown tool: {name}")


def handle_message(method: str, params: dict, fetcher: Fetcher) -> Dict[str, Any]:
    """Dispatch one JSON-RPC method. Raises MCPError on protocol errors."""
    if method == "initialize":
        return handle_initialize(params)
    if method == "tools/list":
        return handle_tools_list()
    if method == "tools/call":
        return handle_tools_call(params, fetcher)
    if method in ("initialized", "notifications/initialized", "ping"):
        return {}
    raise MCPError(-32601, f"Method not found: {method}")


def make_http_fetcher(base_url: str) -> Fetcher:
    """Build a fetcher that resolves REST paths over HTTP against base_url."""
    base = base_url.rstrip("/")
    return lambda path: api_get(base, path)