import logging
import os

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db.migrations import run_migrations
from middleware.rate_limit import RateLimitMiddleware
from middleware.request_logger import RequestLoggerMiddleware
from routers import (
    admin,
    alerts,
    audit,
    auth,
    carbon,
    clients,
    copilot,
    creditrisk,
    cyber,
    dashboard,
    dpp,
    entreprise,
    esg,
    excel,
    export,
    facts,
    factors,
    finance,
    health,
    history,
    ingest,
    pilier2,
    report,
    reviews,
    strategic_mapping,
    verify,
    vsme,
)

logger = logging.getLogger(__name__)

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

# Exécuter les migrations DDL au démarrage (idempotent, no-op si /tmp mode)
@app.on_event("startup")
async def startup_event() -> None:
    run_migrations()

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

# ---------------------------------------------------------------------------
# Request logger — logs JSON structurés par requête
# ---------------------------------------------------------------------------
# Ajouté en PREMIER dans le code → exécuté en DERNIER au retour de réponse
# (Starlette inverse l'ordre), donc il capture la vraie durée totale et le
# vrai status final (y compris les 429 émis par RateLimitMiddleware et les
# 500 levés par les handlers).
app.add_middleware(RequestLoggerMiddleware)

# ---------------------------------------------------------------------------
# Rate limiting — in-memory token bucket par route sensible
# ---------------------------------------------------------------------------
# Ajouté AVANT CORS : Starlette exécute les middlewares dans l'ordre inverse
# d'ajout, donc ce middleware s'exécute APRÈS CORS à la requête entrante,
# et AVANT CORS au retour → les réponses 429 passent par CORS et reçoivent
# bien les headers Access-Control-Allow-* (sinon le frontend voit un échec
# CORS opaque au lieu du 429 lisible).
# Désactivable via RATE_LIMIT_DISABLED=1 (tests intégration).
app.add_middleware(RateLimitMiddleware)

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
app.include_router(auth.router, prefix="/auth", tags=["auth"])
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
app.include_router(ingest.router, tags=["ingest"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(history.router, prefix="/history", tags=["history"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(dpp.router, prefix="/dpp", tags=["dpp"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(factors.router, prefix="/factors", tags=["factors"])
app.include_router(facts.router, prefix="/facts", tags=["facts"])
app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(verify.router, prefix="/verify", tags=["verify (public)"])
app.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
app.include_router(strategic_mapping.router, prefix="/strategic-mapping", tags=["strategic-mapping"])
