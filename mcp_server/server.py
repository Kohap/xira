#!/usr/bin/env python3
"""
XIRA MCP Server — Model Context Protocol for AI Agents (stdio transport)

Thin stdio wrapper over the shared protocol core
(backend/app/services/mcp_core.py). Exposes XIRA risk intelligence tools
to AI agents via MCP (JSON-RPC over stdio). Zero external dependencies.

Tools exposed:
  - xira_get_all_assets      → Risk scores for all 15 xStocks
  - xira_get_asset_risk      → Detailed attestation for one asset
  - xira_get_asset_history   → Historical scores for one asset
  - xira_get_health          → Backend health + config
  - xira_get_alerts          → Flagged anomaly alerts
  - xira_get_market_stats    → Market-level risk statistics

The same tools are also served over HTTP at https://<api>/mcp for hosted
MCP clients (streamable HTTP transport).

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
import os
import sys
from typing import Any, Optional

# Import the shared protocol core from the backend package. Only works in
# a repo checkout; the hosted /mcp endpoint runs the same core inside
# FastAPI, so this file stays a pure transport.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_REPO_ROOT, "backend"))

from app.services.mcp_core import (  # noqa: E402
    MCPError,
    handle_message,
    make_http_fetcher,
)

API_URL = os.environ.get("XIRA_API_URL", "https://xira-api-production.up.railway.app")
_fetcher = make_http_fetcher(API_URL)


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


def main():
    log_error(f"XIRA MCP Server starting | API: {API_URL}")

    while True:
        msg = read_msg()
        if msg is None:
            break

        method = msg.get("method", "")
        msg_id = msg.get("id")
        params = msg.get("params", {})

        try:
            result = handle_message(method, params, _fetcher)
            if msg_id is None:
                continue
            write_msg({"jsonrpc": "2.0", "id": msg_id, "result": result})
        except MCPError as e:
            write_msg({
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": e.code, "message": e.message},
            })
        except Exception as e:
            log_error(f"Handler error: {e}")
            write_msg({
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": -32603, "message": str(e)},
            })

    log_error("XIRA MCP Server shutting down")


if __name__ == "__main__":
    main()