"""
routers/factors.py — Catalogue ADEME emission_factors.

Endpoints :
  GET /factors?scope=&category=&version=&q=&limit=&offset=
  GET /factors/{ef_code}?version=
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from db.database import db_available, get_db
from models.factors import EmissionFactor, FactorListResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _row_to_factor(row: dict) -> EmissionFactor:
    return EmissionFactor(
        id=row["id"],
        ef_code=row["ef_code"],
        label=row["label"],
        scope=row["scope"],
        category=row["category"],
        factor_kgco2e=float(row["factor_kgco2e"]),
        unit=row["unit"],
        source=row["source"],
        version=row["version"],
        valid_from=row.get("valid_from"),
        valid_until=row.get("valid_until"),
        created_at=row["created_at"],
    )


@router.get("", response_model=FactorListResponse)
async def list_factors(
    scope: Annotated[int | None, Query(ge=1, le=3, description="Scope 1, 2 ou 3")] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    version: Annotated[str | None, Query(max_length=20)] = None,
    q: Annotated[str | None, Query(max_length=200, description="Recherche label/ef_code")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FactorListResponse:
    """Liste paginée des facteurs d'émission avec filtres optionnels."""
    if not db_available():
        raise HTTPException(503, detail="Base de données non disponible")

    conditions = []
    params: list = []

    if scope is not None:
        conditions.append(f"scope = %s")
        params.append(scope)
    if category:
        conditions.append("category = %s")
        params.append(category)
    if version:
        conditions.append("version = %s")
        params.append(version)
    if q:
        conditions.append("(label ILIKE %s OR ef_code ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like])

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) FROM emission_factors {where}",
                params,
            )
            total = cur.fetchone()[0]

            cur.execute(
                f"""
                SELECT id, ef_code, label, scope, category, factor_kgco2e,
                       unit, source, version, valid_from, valid_until, created_at
                FROM emission_factors
                {where}
                ORDER BY id
                LIMIT %s OFFSET %s
                """,
                [*params, limit, offset],
            )
            rows = cur.fetchall()

    items = [_row_to_factor(r) for r in rows]
    return FactorListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{ef_code}", response_model=EmissionFactor)
async def get_factor(
    ef_code: str,
    version: Annotated[str | None, Query(max_length=20)] = None,
) -> EmissionFactor:
    """Détail d'un facteur par ef_code (et version optionnelle)."""
    if not db_available():
        raise HTTPException(503, detail="Base de données non disponible")

    params: list = [ef_code]
    version_clause = ""
    if version:
        version_clause = "AND version = %s"
        params.append(version)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, ef_code, label, scope, category, factor_kgco2e,
                       unit, source, version, valid_from, valid_until, created_at
                FROM emission_factors
                WHERE ef_code = %s {version_clause}
                ORDER BY created_at DESC
                LIMIT 1
                """,
                params,
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(404, detail=f"Facteur '{ef_code}' introuvable")

    return _row_to_factor(row)
