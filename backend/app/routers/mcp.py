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
import asyncio
import json
import os
import httpx
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from app.services.mcp_core import (
    MCPError,
    MCP_TOOLS,
    MCP_SERVER_INFO,
    SUPPORTED_PROTOCOL_VERSIONS,
    SERVER_PROTOCOL_VERSION,
    handle_message,
)
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/mcp", tags=["mcp"])

HTTPX_TIMEOUT = 30


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


def _make_httpx_fetcher(base_url: str):
    """Build a fetcher using httpx (supports async context)."""
    base = base_url.rstrip("/")

    def fetch(path: str) -> dict:
        # Internal Railway traffic arrives over http://, so follow the
        # LB's http→https redirect when resolving the public URL.
        with httpx.Client(timeout=HTTPX_TIMEOUT, follow_redirects=True) as client:
            try:
                resp = client.get(f"{base}{path}", headers={"Accept": "application/json"})
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                return {"error": str(e)}

    return fetch


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
    fetcher = _make_httpx_fetcher(base)

    # Run message processing in a threadpool so the blocking self-HTTP
    # calls inside tool handlers don't starve the event loop.
    def process_all():
        return [r for m in messages if (r := _process_message(m, fetcher)) is not None]

    responses = await asyncio.to_thread(process_all)

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