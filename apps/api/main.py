from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, calculate, excel, report, clients

app = FastAPI(
    title="Finance Platform API",
    description="Backend API for the finance analysis platform",
    version="0.1.0",
)

# CORS — allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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
