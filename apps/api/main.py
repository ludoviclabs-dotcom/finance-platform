import os

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import health, excel, report, clients, entreprise, cyber, pilier2, creditrisk, carbon, vsme, esg, finance

try:
    from routers import ma
except ImportError:
    ma = None

# ---------------------------------------------------------------------------
# Request body size limit (10 MB)
# ---------------------------------------------------------------------------
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB

app = FastAPI(
    title="Finance Platform API",
    description="Backend API for the finance analysis platform",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# Body size limiter — reject uploads > 10 MB before they hit route handlers
# ---------------------------------------------------------------------------
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": f"Request body too large. Maximum size is {MAX_BODY_SIZE // (1024 * 1024)} MB."},
        )
    return await call_next(request)

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

# CORSMiddleware: explicit list + regex scoped to our Vercel projects only.
# allow_origin_regex lets us keep allow_credentials=True (unlike origins=["*"]).
# Pattern matches: carbon-*, finance-platform-*, neural-* preview URLs.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_explicit_origins,
    allow_origin_regex=r"^https://(carbon|finance-platform|neural)[a-z0-9\-]*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
if ma is not None:
    app.include_router(ma.router, prefix="/ma", tags=["ma"])
app.include_router(excel.router, prefix="/excel", tags=["excel"])
app.include_router(report.router, prefix="/report", tags=["report"])
app.include_router(clients.router, prefix="/clients", tags=["clients"])
app.include_router(entreprise.router, prefix="/entreprise", tags=["entreprise"])
app.include_router(cyber.router, prefix="/cyber", tags=["cyber"])
app.include_router(pilier2.router, prefix="/pilier2", tags=["pilier2"])
app.include_router(creditrisk.router, prefix="/creditrisk", tags=["creditrisk"])
app.include_router(carbon.router, prefix="/carbon", tags=["carbon"])
app.include_router(vsme.router, prefix="/vsme", tags=["vsme"])
app.include_router(esg.router, prefix="/esg", tags=["esg"])
app.include_router(finance.router, prefix="/finance", tags=["finance"])
