from __future__ import annotations
import asyncio, os, logging

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.routers import assets, attestations, alerts
from app.services import scheduler as scheduler_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("xira")

_scheduler_task: asyncio.Task | None = None

# Explicit, known frontend origins only. Wildcard CORS combined with
# credentials is invalid and over-permissive for a public API.
ALLOWED_ORIGINS = [
    "https://www.xira.surf",
    "https://xira.surf",
    "https://kohap.github.io",
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
        "docs": "/docs",
        "live_data": live,
    }


app = FastAPI(
    title="XIRA: X-Layer Intelligence & Risk Analytics",
    description="AI-powered risk intelligence and signals for tokenized equities on X Layer.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "PUT"],
    allow_headers=["Content-Type"],
)

app.include_router(assets.router)
app.include_router(attestations.router)
app.include_router(alerts.router)


@app.on_event("startup")
async def startup():
    live = os.getenv("USE_LIVE_DATA", "false").lower() == "true"
    mode = "LIVE (Finnhub + news)" if live else "MOCK (simulated data)"
    logger.info(f"XIRA backend starting | Mode: {mode}")
    logger.info(f"Model: {os.getenv('MODEL_VERSION', 'v1.0.0')}")

    from app.services.data_fetcher import get_tracked_assets
    assets = get_tracked_assets()
    logger.info(f"Tracking {len(assets)} assets: {[a['symbol'] for a in assets]}")

    global _scheduler_task
    _scheduler_task = asyncio.create_task(scheduler_service.scheduler_loop())


@app.on_event("shutdown")
async def shutdown():
    global _scheduler_task
    if _scheduler_task:
        _scheduler_task.cancel()
    logger.info("XIRA backend shutting down.")


@app.get("/")
async def root():
    return {
        "name": "XIRA",
        "full_name": "X-Layer Intelligence & Risk Analytics",
        "version": os.getenv("MODEL_VERSION", "v1.0.0"),
        "endpoints": _build_endpoints(),
    }


@app.get("/debug/data-sources")
async def debug_data_sources():
    """Diagnostic endpoint to show data source status and errors.

    Gated behind XIRA_ENABLE_DEBUG to avoid leaking cache internals publicly.
    """
    if os.getenv("XIRA_ENABLE_DEBUG", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found.")
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
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
