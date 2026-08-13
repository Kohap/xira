from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.api_keys import api_keys
from app.services.auth import admin_authorized
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/admin/keys", tags=["admin"])


class KeyIssue(BaseModel):
    name: str


@router.post("")
async def issue_key(body: KeyIssue, request: Request):
    """Issue a new API key. Returns the plaintext once. Admin only."""
    enforce_rate_limit(request, "admin_keys_issue", limit=20)
    if not admin_authorized(request):
        raise HTTPException(status_code=401, detail="Admin token required.")
    if len(body.name) > 100:
        raise HTTPException(status_code=400, detail="Name too long.")
    return {"ok": True, **api_keys.issue(body.name)}


@router.get("")
async def list_keys(request: Request):
    """List issued keys (hashes never returned). Admin only."""
    enforce_rate_limit(request, "admin_keys_list", limit=60)
    if not admin_authorized(request):
        raise HTTPException(status_code=401, detail="Admin token required.")
    return {"ok": True, "keys": api_keys.list_keys()}


@router.delete("/{prefix}")
async def revoke_key(prefix: str, request: Request):
    """Revoke a key by its display prefix. Admin only."""
    enforce_rate_limit(request, "admin_keys_revoke", limit=20)
    if not admin_authorized(request):
        raise HTTPException(status_code=401, detail="Admin token required.")
    if not api_keys.revoke(prefix):
        raise HTTPException(status_code=404, detail="Key not found.")
    return {"ok": True, "revoked": prefix}
