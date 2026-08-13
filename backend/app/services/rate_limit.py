from __future__ import annotations
import time
import threading
from typing import Optional

from fastapi import HTTPException, Request

# In-memory sliding-window rate limiter. Sufficient for a single-instance
# deployment; swap for Redis-backed storage if the app ever runs multi-instance.
#
# Public endpoints burn upstream quota (Finnhub free tier: 60 req/min) on
# every board analysis, so unauthenticated visitors must be throttled.

_WINDOW_S = 60.0
_MAX_KEYS = 10_000


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_s: float = _WINDOW_S) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) >= _MAX_KEYS:
                self._hits.clear()
            queue = self._hits.setdefault(key, [])
            cutoff = now - window_s
            while queue and queue[0] < cutoff:
                queue.pop(0)
            if len(queue) >= limit:
                return False
            queue.append(now)
            return True


rate_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    """Client IP honoring reverse-proxy forwarding (Railway/Cloudflare).

    Trusts the LAST entry of x-forwarded-for: reverse proxies append the
    caller's address at the end, so a client-supplied header cannot spoof a
    fresh identity per request to bypass the limiter.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client:
        return request.client.host
    return "unknown"


def enforce_rate_limit(
    request: Request,
    route: str,
    limit: int,
    window_s: float = _WINDOW_S,
) -> None:
    """Reject the request with 429 when the per-IP budget for a route is spent."""
    key = f"{client_ip(request)}:{route}"
    if not rate_limiter.allow(key, limit, window_s):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a minute and try again.",
        )
