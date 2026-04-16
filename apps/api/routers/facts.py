"""
routers/facts.py — Provenance API : trail + verify par company.

Endpoints (tous nécessitent authentification + tenant context) :
  GET  /facts/{code}/trail   — historique d'un KPI pour la company courante
  GET  /facts/{code}         — dernière valeur connue (latest, depuis facts_current)
  GET  /facts/verify         — vérification de la chaîne hash complète de la company

RLS garantit que chaque requête ne retourne que les facts de la company de l'utilisateur.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db.database import db_available, get_db
from routers.auth import get_current_user
from services import facts_service
from services.auth_service import AuthUser

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic models ──────────────────────────────────────────────────────────

class FactEventResponse(BaseModel):
    id: int
    company_id: int
    code: str
    value: float | None
    unit: str
    ef_id: int | None
    source_path: str
    computed_at: datetime
    hash_prev: str | None
    hash_self: str
    meta: dict[str, Any] | None


class FactTrailResponse(BaseModel):
    code: str
    company_id: int
    events: list[FactEventResponse]
    total: int
    limit: int
    offset: int


class FactLatestResponse(BaseModel):
    code: str
    company_id: int
    value: float | None
    unit: str
    ef_id: int | None
    source_path: str
    computed_at: datetime
    hash_self: str


class ChainVerificationResponse(BaseModel):
    ok: bool
    broken_at: int | None
    checked: int
    company_id: int


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/verify", response_model=ChainVerificationResponse)
async def verify_chain_endpoint(
    user: AuthUser = Depends(get_current_user),
) -> ChainVerificationResponse:
    """Vérifie l'intégrité de la chaîne hash Merkle pour la company courante."""
    result = facts_service.verify_chain(company_id=user.company_id)
    return ChainVerificationResponse(
        ok=result.ok,
        broken_at=result.broken_at,
        checked=result.checked,
        company_id=user.company_id,
    )


@router.get("/{code}/trail", response_model=FactTrailResponse)
async def fact_trail(
    code: str,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> FactTrailResponse:
    """Retourne l'historique chronologique décroissant d'un KPI pour la company courante."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")

    events = facts_service.get_trail(
        code=code, company_id=user.company_id, limit=limit, offset=offset,
    )

    # Count total (utile pour pagination)
    total = 0
    try:
        with get_db(company_id=user.company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS c FROM facts_events WHERE company_id = %s AND code = %s",
                    (user.company_id, code),
                )
                row = cur.fetchone()
                total = row["c"] if row else 0
    except Exception as exc:
        logger.warning("count facts_events échoué: %s", exc)
        total = len(events)

    return FactTrailResponse(
        code=code,
        company_id=user.company_id,
        events=[
            FactEventResponse(
                id=e.id,
                company_id=e.company_id,
                code=e.code,
                value=e.value,
                unit=e.unit,
                ef_id=e.ef_id,
                source_path=e.source_path,
                computed_at=e.computed_at,
                hash_prev=e.hash_prev,
                hash_self=e.hash_self,
                meta=e.meta,
            )
            for e in events
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{code}", response_model=FactLatestResponse)
async def fact_latest(
    code: str,
    user: AuthUser = Depends(get_current_user),
) -> FactLatestResponse:
    """Dernière valeur connue d'un KPI (lecture rapide depuis facts_current)."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")

    with get_db(company_id=user.company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT company_id, code, value, unit, ef_id, source_path,
                       computed_at, hash_self
                FROM facts_current
                WHERE company_id = %s AND code = %s
                LIMIT 1
                """,
                (user.company_id, code),
            )
            row = cur.fetchone()

    if not row:
        # Fallback : lire directement depuis facts_events si la vue n'est pas rafraîchie
        events = facts_service.get_trail(code=code, company_id=user.company_id, limit=1)
        if not events:
            raise HTTPException(
                404,
                detail=f"Aucune valeur pour '{code}' — effectuez un ingest pour générer des facts",
            )
        e = events[0]
        return FactLatestResponse(
            code=e.code,
            company_id=e.company_id,
            value=e.value,
            unit=e.unit,
            ef_id=e.ef_id,
            source_path=e.source_path,
            computed_at=e.computed_at,
            hash_self=e.hash_self,
        )

    return FactLatestResponse(
        code=row["code"],
        company_id=row["company_id"],
        value=float(row["value"]) if row["value"] is not None else None,
        unit=row["unit"],
        ef_id=row["ef_id"],
        source_path=row["source_path"],
        computed_at=row["computed_at"],
        hash_self=row["hash_self"],
    )
