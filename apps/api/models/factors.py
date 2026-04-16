"""
models/factors.py — Modèles Pydantic pour le catalogue emission_factors.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class EmissionFactor(BaseModel):
    id: int
    ef_code: str
    label: str
    scope: int | None = None
    category: str | None = None
    factor_kgco2e: float
    unit: str
    source: str
    version: str
    valid_from: date | None = None
    valid_until: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FactorQuery(BaseModel):
    scope: int | None = Field(None, ge=1, le=3, description="Scope 1, 2 ou 3")
    category: str | None = Field(None, description="Catégorie (energy, transport, ...)")
    version: str | None = Field(None, description="Version des facteurs ex: v2025.0")
    q: str | None = Field(None, description="Recherche plein texte sur label/ef_code")
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)


class FactorListResponse(BaseModel):
    items: list[EmissionFactor]
    total: int
    limit: int
    offset: int
