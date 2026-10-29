import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .filters import Filters, parse_filters
from .queries import Warehouse

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
STATIC_DIR = Path(os.environ.get("STATIC_DIR", ROOT / "frontend" / "dist"))

app = FastAPI(title="Transport Analytics API", version="0.1.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)
wh = Warehouse(DATA_DIR / "warehouse.duckdb")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    return wh.meta()


@app.get("/api/stats")
def stats(f: Filters = Depends(parse_filters)):
    return wh.stats(f)


@app.get("/api/export")
def export(
    f: Filters = Depends(parse_filters),
    campi: str = Query(..., description="campi separati da virgola"),
    k: float = Query(100, ge=0, description="soglia minima di spostamenti per gruppo"),
    righe: bool = False,
):
    scelti = [c for c in campi.split(",") if c]
    if not scelti or any(c not in wh.CAMPI for c in scelti):
        raise HTTPException(400, "campi non validi")
    return wh.export(f, scelti, k, righe)


@app.get("/api/flows")
def flows(f: Filters = Depends(parse_filters), limit: int = Query(300, ge=10, le=3000)):
    return wh.flows(f, limit)


app.mount("/geo", StaticFiles(directory=DATA_DIR / "geo"), name="geo")
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
