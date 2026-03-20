import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, calculate, excel, report, clients

app = FastAPI(
    title="Finance Platform API",
    description="Backend API for the finance analysis platform",
    version="0.1.0",
)

# CORS — read allowed origins from env, fallback to dev servers
_default_origins = "http://localhost:3000,http://localhost:3001"
allowed_origins = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
