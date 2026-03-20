import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, calculate, excel, report, clients

app = FastAPI(
    title="Finance Platform API",
    description="Backend API for the finance analysis platform",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS — dynamic origin validation
# ---------------------------------------------------------------------------
# 1. Explicit origins from env var (comma-separated), fallback to localhost
# 2. Any https://*.vercel.app origin is always accepted (preview deploys)
# ---------------------------------------------------------------------------
_default_origins = "http://localhost:3000,http://localhost:3001"
_explicit_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

# CORSMiddleware: explicit list + regex for all Vercel preview URLs.
# allow_origin_regex lets us keep allow_credentials=True (unlike origins=["*"]).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_explicit_origins,
    allow_origin_regex=r"^https://[a-z0-9\-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(calculate.router, prefix="/calculate", tags=["calculate"])
app.include_router(excel.router, prefix="/excel", tags=["excel"])
app.include_router(report.router, prefix="/report", tags=["report"])
app.include_router(clients.router, prefix="/clients", tags=["clients"])
