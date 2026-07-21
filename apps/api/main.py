import logging
import os

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db.migrations import run_migrations
from middleware.rate_limit import RateLimitMiddleware
from middleware.request_logger import RequestLoggerMiddleware
from routers import (
    actions,
    admin,
    ai_review,
    alerts,
    audit,
    auditor,
    auth,
    baselines,
    beges,
    carbon,
    chain,
    clients,
    consolidation,
    copilot,
    creditrisk,
    crma,
    cyber,
    dashboard,
    diff,
    dpp,
    energy,
    entreprise,
    esg,
    excel,
    export,
    factors,
    facts,
    fec,
    files,
    finance,
    health,
    history,
    imports,
    ingest,
    intelligence,
    iro,
    materialite,
    nature,
    partners,
    pilier2,
    procurement,
    products,
    quality,
    questionnaire,
    report,
    reviews,
    scope3,
    sites,
    strategic_mapping,
    suppliers,
    verify,
    vsme,
    vsme_datapoints,
    vsme_export,
    vsme_mapping,
    vsme_wizard,
    water,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sentry (T1.7) — no-op si SENTRY_DSN absent ou sentry_sdk non installé.
# release = SHA de commit pour relier les erreurs au déploiement.
# ---------------------------------------------------------------------------
_SENTRY_DSN = os.environ.get("SENTRY_DSN")
if _SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            release=os.environ.get("VERCEL_GIT_COMMIT_SHA") or os.environ.get("GITHUB_SHA"),
            traces_sample_rate=0.0,
        )
        logger.info("Sentry initialisé")
    except Exception as exc:  # pragma: no cover - dépend de l'environnement
        logger.warning("Sentry non initialisé : %s", exc)

try:
    from routers import ma
except ImportError:
    ma = None

# ---------------------------------------------------------------------------
# Request body size limit (16 MB — enveloppe multipart pour upload max 15 Mo, T1.5)
# ---------------------------------------------------------------------------
MAX_BODY_SIZE = 16 * 1024 * 1024  # 16 MB

app = FastAPI(
    title="Finance Platform API",
    description="Backend API for the finance analysis platform",
    version="0.1.0",
)

# Migrations DDL — startup event, confort dev local uniquement : fonctionne
# en local/uvicorn, jamais invoqué en prod (@vercel/python n'exécute pas les
# events lifespan ASGI). Le second déclencheur historique (ensure_schema_mw,
# middleware sur la 1re requête, seul chemin qui touchait réellement la prod)
# a été retiré (PR-02C-retrait) une fois le ledger schema_migrations baseliné
# en production : le workflow .github/workflows/db-migrate.yml est désormais
# le seul chemin d'écriture schéma. Voir docs/carbonco/MIGRATIONS_RUNBOOK.md
# et docs/carbonco/refonte/PR02C_RETIRE_ENSURE_SCHEMA_TRACEABILITY.md.
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
app.include_router(vsme_datapoints.router, prefix="/vsme/datapoints", tags=["vsme (T3.1)"])
app.include_router(vsme_mapping.router, prefix="/vsme/mapping", tags=["vsme (T3.2)"])
app.include_router(vsme_export.router, prefix="/vsme/report", tags=["vsme (T3.3)"])
app.include_router(vsme_wizard.router, prefix="/vsme/wizard", tags=["vsme (T3.4)"])
app.include_router(esg.router, prefix="/esg", tags=["esg"])
app.include_router(finance.router, prefix="/finance", tags=["finance"])
app.include_router(ingest.router, tags=["ingest"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(auditor.router, prefix="/auditor", tags=["auditor (T2.2)"])
app.include_router(history.router, prefix="/history", tags=["history"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(dpp.router, prefix="/dpp", tags=["dpp"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(factors.router, prefix="/factors", tags=["factors"])
app.include_router(facts.router, prefix="/facts", tags=["facts"])
app.include_router(chain.router, prefix="/chain", tags=["chain (T2.5)"])
app.include_router(quality.router, prefix="/quality", tags=["quality (T2.6)"])
app.include_router(scope3.router, prefix="/scope3", tags=["scope3 (T4.1)"])
app.include_router(beges.router, prefix="/beges", tags=["beges (T4.2)"])
app.include_router(fec.router, prefix="/fec", tags=["fec (T4.3)"])
app.include_router(consolidation.router, prefix="/consolidation", tags=["consolidation (T4.4)"])
app.include_router(baselines.router, prefix="/baselines", tags=["baselines (T4.5)"])
app.include_router(actions.router, prefix="/actions", tags=["actions (T5.1/T5.2)"])
app.include_router(sites.router, prefix="/sites", tags=["sites"])
app.include_router(imports.router, prefix="/imports", tags=["imports (T5.4)"])
app.include_router(diff.router, prefix="/diff", tags=["diff (T5.5)"])
app.include_router(questionnaire.router, prefix="/questionnaire", tags=["questionnaire (T5.5)"])
app.include_router(files.router, tags=["files"])
app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(verify.router, prefix="/verify", tags=["verify (public)"])
app.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
app.include_router(strategic_mapping.router, prefix="/strategic-mapping", tags=["strategic-mapping"])
app.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
app.include_router(materialite.router, prefix="/materialite", tags=["materialite"])
app.include_router(partners.router, prefix="/partners", tags=["partners (T7.5)"])
app.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence (PR-03)"])
app.include_router(procurement.router, prefix="/procurement", tags=["procurement (PR-05A)"])
app.include_router(products.router, prefix="/products", tags=["products (PR-05A)"])
app.include_router(energy.router, prefix="/energy", tags=["energy (PR-06A)"])
app.include_router(crma.router, prefix="/crma", tags=["crma (PR-07)"])
app.include_router(water.router, prefix="/water", tags=["water (PR-08)"])
app.include_router(nature.router, prefix="/nature", tags=["nature (PR-09)"])
app.include_router(iro.router, prefix="/iro", tags=["iro (PR-10)"])
app.include_router(ai_review.router, prefix="/ai", tags=["ai-review (PR-11)"])
