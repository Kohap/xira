from __future__ import annotations
import ipaddress
import logging
import os
import threading
import time
from typing import Optional

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# Sliding-window rate limiter behind a pluggable backend. Single-instance
# deployments use the in-memory backend; multi-instance deployments point
# XIRA_REDIS_URL at a Redis instance and the app switches to the Redis
# backend. Public endpoints burn upstream quota (Finnhub free tier: 60
# req/min) on every board analysis, so unauthenticated visitors must be
# throttled.

_WINDOW_S = 60.0
_MAX_KEYS = 10_000
# When the key table fills up, evict the quietest entries down to this
# fraction instead of clearing everything (a full clear hands every client
# a fresh budget at once).
_EVICT_TO_FRACTION = 0.8


class InMemoryBackend:
    """Thread-safe per-process sliding-window limiter."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _evict(self) -> None:
        """Drop the least-recently-active keys until under the cap."""
        target = int(_MAX_KEYS * _EVICT_TO_FRACTION)
        oldest_first = sorted(self._hits.items(), key=lambda kv: kv[1][-1] if kv[1] else 0.0)
        for key, _ in oldest_first[: max(0, len(self._hits) - target)]:
            self._hits.pop(key, None)

    def allow(self, key: str, limit: int, window_s: float = _WINDOW_S) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) >= _MAX_KEYS:
                self._evict()
            queue = self._hits.setdefault(key, [])
            cutoff = now - window_s
            while queue and queue[0] < cutoff:
                queue.pop(0)
            if len(queue) >= limit:
                return False
            queue.append(now)
            return True


class RedisBackend:
    """Fixed-window counter limiter on Redis (INCR + EXPIRE).

    Degrades fail-open when Redis is unreachable so a cache outage does not
    take the API down; the failure is logged once.
    """

    def __init__(self, url: str) -> None:
        import redis  # optional dependency

        self._client = redis.Redis.from_url(url, socket_timeout=2)
        self._degraded = False
        # Startup ping: surface a dead Redis immediately.
        try:
            self._client.ping()
        except Exception as e:
            self._degraded = True
            logger.error(f"Redis rate-limit backend unreachable ({e}); falling back to in-memory.")

    def allow(self, key: str, limit: int, window_s: float = _WINDOW_S) -> bool:
        if self._degraded:
            return True
        try:
            pipe = self._client.pipeline()
            pipe.incr(key)
            pipe.expire(key, int(window_s), nx=True)
            count, _ = pipe.execute()
            return int(count) <= limit
        except Exception as e:
            if not self._degraded:
                self._degraded = True
                logger.error(f"Redis limiter error ({e}); rate limiting disabled temporarily.")
            return True


def _build_backend() -> InMemoryBackend | RedisBackend:
    mode = os.getenv("XIRA_RATE_LIMIT_BACKEND", "memory").lower()
    url = os.getenv("XIRA_REDIS_URL", "")
    if mode == "redis" and url:
        try:
            return RedisBackend(url)
        except Exception as e:
            logger.error(f"Redis backend init failed ({e}); using in-memory limiter.")
    return InMemoryBackend()


rate_limiter = _build_backend()


def _parse_cidrs(raw: str) -> list:
    nets = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            nets.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            logger.warning(f"Ignoring invalid trusted-proxy CIDR: {part}")
    return nets


TRUSTED_PROXIES = _parse_cidrs(os.getenv("XIRA_TRUSTED_PROXIES", ""))


def client_ip(request: Request) -> str:
    """Client IP for rate-limit keying behind Railway/proxy.

    X-Forwarded-For is honored ONLY when the direct peer is a configured
    trusted proxy (XIRA_TRUSTED_PROXIES, comma-separated CIDRs). The
    rightmost entry is used because the nearest trusted proxy appends the
    caller's address last. Client-supplied headers are otherwise ignored,
    so an attacker cannot rotate identities to drain the limiter or pin a
    victim's bucket.
    """
    peer = request.client.host if request.client else "unknown"
    header = request.headers.get("x-forwarded-for", "")
    if header and TRUSTED_PROXIES:
        try:
            if any(ipaddress.ip_address(peer) in net for net in TRUSTED_PROXIES):
                parts = [p.strip() for p in header.split(",") if p.strip()]
                if parts:
                    return parts[-1]
        except ValueError:
            pass
    return peer


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