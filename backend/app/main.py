from __future__ import annotations
import os, logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import assets, attestations

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("xira")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("XIRA backend starting up...")
    logger.info(f"Model version: {os.getenv('MODEL_VERSION', 'v1.0.0-mvp')}")
    assets_meta = __import__("app.services.data_fetcher", fromlist=["get_tracked_assets"]).get_tracked_assets()
    logger.info(f"Tracking {len(assets_meta)} assets: {[a['symbol'] for a in assets_meta]}")
    yield
    logger.info("XIRA backend shutting down.")


app = FastAPI(
    title="XIRA - X-Layer Intelligence & Risk Analytics",
    description="AI-powered risk intelligence and signals for tokenized equities on X Layer.",
    version="1.0.0-mvp",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router)
app.include_router(attestations.router)


@app.get("/")
async def root():
    return {
        "name": "XIRA",
        "full_name": "X-Layer Intelligence & Risk Analytics",
        "version": os.getenv("MODEL_VERSION", "v1.0.0-mvp"),
        "endpoints": {
            "assets_all": "/api/assets/all",
            "attestation": "/api/attestations/{symbol}",
            "attestation_history": "/api/attestations/{symbol}/history",
            "health": "/api/assets/health",
        },
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
