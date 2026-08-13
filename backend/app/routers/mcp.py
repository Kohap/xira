"""
XIRA MCP hosted endpoint — MCP Streamable HTTP transport (/mcp).

Serves the same MCP tools as the local stdio server, over HTTP, so agents
and MCP clients (Claude Desktop, Claude Code, Cursor, etc.) can point
straight at https://<api>/mcp without running anything themselves.

Transport notes (MCP 2025-06-18 streamable HTTP):
  - POST /mcp      → single JSON-RPC message or batch; responses are
                     application/json. Requests that carry only
                     notifications (no id) return 202 Accepted.
  - GET /mcp       → 405: this server never initiates messages, so there
                     is no SSE stream to subscribe to.
  - The endpoint is rate-limited per IP like the rest of the API.
"""

from __future__ import annotations
import json
import os
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from app.services.mcp_core import (
    MCPError,
    handle_message,
    make_http_fetcher,
)
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/mcp", tags=["mcp"])


def _error_response(msg_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _process_message(msg: Any, fetcher) -> dict | None:
    """Handle one JSON-RPC message. Returns a response dict, or None for
    notifications (messages without an id)."""
    if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
        return _error_response(None, -32600, "Invalid JSON-RPC request")

    method = msg.get("method")
    if not method:
        return _error_response(msg.get("id"), -32600, "Missing method")

    params = msg.get("params", {})
    msg_id = msg.get("id")

    try:
        result = handle_message(method, params, fetcher)
    except MCPError as e:
        return _error_response(msg_id, e.code, e.message)
    except Exception as e:  # noqa: BLE001 - surface unexpected failures to the client
        return _error_response(msg_id, -32603, str(e))

    if msg_id is None:
        return None
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


@router.post("")
async def mcp_post(request: Request):
    enforce_rate_limit(request, "mcp", limit=120)

    raw = await request.body()
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return JSONResponse(
            _error_response(None, -32700, "Parse error"),
            status_code=400,
        )

    is_batch = isinstance(payload, list)
    messages = payload if is_batch else [payload]

    base = os.getenv("XIRA_API_URL") or str(request.base_url).rstrip("/")
    fetcher = make_http_fetcher(base)
    responses = [r for m in messages if (r := _process_message(m, fetcher)) is not None]

    if not responses:
        return Response(status_code=202)
    if not is_batch:
        return JSONResponse(responses[0])
    return JSONResponse(responses)


@router.get("")
async def mcp_get():
    # Tools-only server: no server-initiated messages, so no SSE stream.
    return JSONResponse(
        {"error": "Method not allowed. Use POST /mcp with JSON-RPC."},
        status_code=405,
    )