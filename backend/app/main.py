from __future__ import annotations
import asyncio, os, logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import assets, attestations, alerts, mcp, keys
from app.services import scheduler as scheduler_service
from app.services.auth import admin_authorized, require_admin
from app.services.startup_checks import run_startup_checks

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("xira")

# httpx logs full request URLs at INFO, which would print the Finnhub API key
# and the Telegram bot token (both travel in URLs) into the log stream.
logging.getLogger("httpx").setLevel(logging.WARNING)

_scheduler_task: asyncio.Task | None = None

# Explicit, known frontend origins only. Wildcard CORS combined with
# credentials is invalid and over-permissive for a public API.
ALLOWED_ORIGINS = [
    "https://www.xira.surf",
    "https://xira.surf",
    "http://localhost:3000",
    "http://localhost:8000",
]


def _build_endpoints() -> dict:
    live = os.getenv("USE_LIVE_DATA", "false").lower() == "true"
    return {
        "assets_all": "/api/assets/all",
        "asset_detail": "/api/assets/{symbol}",
        "asset_stats": "/api/assets/stats",
        "alerts": "/api/alerts",
        "attestation": "/api/attestations/{symbol}",
        "attestation_history": "/api/attestations/{symbol}/history",
        "health": "/api/assets/health",
        "mcp": "/mcp",
        "docs": "/docs",
        "live_data": live,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    live = os.getenv("USE_LIVE_DATA", "false").lower() == "true"
    mode = "LIVE (Yahoo quotes + Finnhub news)" if live else "MOCK (simulated data)"
    logger.info(f"XIRA backend starting | Mode: {mode}")
    logger.info(f"Model: {os.getenv('MODEL_VERSION', 'v1.1.0')}")

    # Mainnet gates: wrong chain, phantom contract, mismatched signer or
    # owner are fatal. Balance warnings are surfaced but not fatal.
    from app.services.publisher import publisher as pub
    from app.services.startup_checks import StartupCheckError

    try:
        run_startup_checks(pub)
    except StartupCheckError as e:
        logger.critical(f"Startup gate failed: {e}")
        raise RuntimeError(str(e)) from e

    from app.services.data_fetcher import get_tracked_assets
    assets = get_tracked_assets()
    logger.info(f"Tracking {len(assets)} assets: {[a['symbol'] for a in assets]}")

    global _scheduler_task
    _scheduler_task = asyncio.create_task(scheduler_service.scheduler_loop())

    yield

    if _scheduler_task:
        _scheduler_task.cancel()
    logger.info("XIRA backend shutting down.")


app = FastAPI(
    title="XIRA: X-Layer Intelligence & Risk Analytics",
    description="AI-powered risk intelligence and signals for tokenized equities on X Layer.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "PUT", "POST", "DELETE"],
    allow_headers=["Content-Type", "x-api-key", "x-admin-token", "authorization"],
)

app.include_router(assets.router)
app.include_router(attestations.router)
app.include_router(alerts.router)
app.include_router(mcp.router)
app.include_router(keys.router)


# Endpoints that stay fully open (no API key, no admin token). Everything
# else follows the rules below; GETs on the read prefixes are public by
# design, every mutating route requires admin auth (X-Admin-Token /
# Authorization: Bearer).
PUBLIC_EXACT_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/assets/health",
}

# Read-only surfaces the dashboard consumes without credentials. The route
# handlers themselves guarantee no writes; the middleware never allows a
# mutating method on these prefixes.
PUBLIC_GET_PREFIXES = (
    "/api/assets",
    "/api/alerts",
    "/api/attestations",
)

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _is_public_read(path: str, method: str) -> bool:
    if path in PUBLIC_EXACT_PATHS:
        return True
    if method == "GET":
        return any(path.startswith(p) for p in PUBLIC_GET_PREFIXES)
    return False


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    """Auth gate. Never uses Origin/Referer — a forged header cannot bypass.

    - OPTIONS: CORS preflight, open.
    - Public reads (allowlist above): open keyless.
    - Mutating routes (POST/PUT/PATCH/DELETE): admin token required.
    - Everything else (admin surfaces, MCP): valid X-API-Key required when
      XIRA_REQUIRE_API_KEY=true; admin token also accepted.
    """
    method = request.method
    path = request.url.path

    if method == "OPTIONS" or _is_public_read(path, method):
        return await call_next(request)

    # /mcp transports read-only tools over POST; it is key-gated below, not
    # admin-gated (agents hold API keys, not admin tokens).
    is_mcp = path == "/mcp"

    if method in MUTATING_METHODS and not is_mcp:
        if not admin_authorized(request):
            return JSONResponse({"detail": "Admin token required."}, status_code=401)
        return await call_next(request)

    supplied = request.headers.get("x-api-key", "")
    if supplied:
        from app.services.api_keys import api_keys

        if api_keys.validate(supplied):
            return await call_next(request)
        return JSONResponse({"detail": "Invalid API key."}, status_code=401)

    if admin_authorized(request):
        return await call_next(request)

    enforce = os.getenv("XIRA_REQUIRE_API_KEY", "false").lower() == "true"
    if enforce:
        return JSONResponse({"detail": "Missing API key."}, status_code=401)
    return await call_next(request)


@app.get("/")
async def root():
    return {
        "name": "XIRA",
        "full_name": "X-Layer Intelligence & Risk Analytics",
        "version": os.getenv("MODEL_VERSION", "v1.1.0"),
        "endpoints": _build_endpoints(),
    }


@app.get("/debug/data-sources")
async def debug_data_sources(request: Request):
    """Diagnostic endpoint to show data source status and errors.

    Gated behind XIRA_ENABLE_DEBUG *and* admin auth, so even with debug
    enabled the cache internals are never public.
    """
    if os.getenv("XIRA_ENABLE_DEBUG", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found.")
    require_admin(request)
    import sys
    import time
    from app.services.data_fetcher import _price_cache, CACHE_TTL, data_fetcher
    
    cache_status = {}
    for ticker, (data, timestamp) in _price_cache.items():
        age = time.time() - timestamp
        cache_status[ticker] = {
            "source": data.source,
            "age_seconds": round(age, 1),
            "price": data.price,
            "cached": age < CACHE_TTL,
        }
    
    return {
        "use_live_data": data_fetcher.use_live,
        "cache_ttl": CACHE_TTL,
        "cached_tickers": list(_price_cache.keys()),
        "cache_details": cache_status,
        "env_vars": {
            "USE_LIVE_DATA": os.getenv("USE_LIVE_DATA"),
            "PYTHON_VERSION": sys.version,
        }
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    # reload stays off: a reload-on-file-change server restarts the
    # scheduler task and can re-broadcast in-flight attestations.
    uvicorn.run("app.main:app", host=host, port=port)
