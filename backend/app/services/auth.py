from __future__ import annotations
import hmac
import os

from fastapi import HTTPException, Request


def admin_authorized(request: Request) -> bool:
    """Constant-time admin-token check shared by all mutating routes.

    Accepts X-Admin-Token or an `Authorization: Bearer <token>` header.
    Returns False when XIRA_ADMIN_TOKEN is unset (deployment misconfig),
    so the fail-closed default never trusts a missing secret.
    """
    expected = os.getenv("XIRA_ADMIN_TOKEN", "")
    if not expected:
        return False
    supplied = (
        request.headers.get("x-admin-token")
        or request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    )
    return bool(supplied and hmac.compare_digest(expected, supplied))


def require_admin(request: Request) -> None:
    """FastAPI dependency: 401 when the caller is not an admin."""
    if not admin_authorized(request):
        raise HTTPException(status_code=401, detail="Admin token required.")
