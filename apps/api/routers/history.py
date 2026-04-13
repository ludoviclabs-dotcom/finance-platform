"""
history.py — Endpoints d'historique des snapshots versionnés.

Disponible uniquement si PostgreSQL est configuré.
GET /history/{domain}         → liste des N dernières versions avec résumé KPI
GET /history/{domain}/{version_id} → snapshot complet d'une version donnée
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.database import db_available, get_db
from services.snapshot_cache import DEFAULT_COMPANY_ID, read_snapshot_history

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_DOMAINS = {"carbon", "vsme", "esg", "finance"}


class SnapshotHistoryEntry(BaseModel):
    id: int
    version: int
    generatedAt: str
    source: str
    summary: dict[str, Any]


class SnapshotHistoryResponse(BaseModel):
    domain: str
    available: bool
    entries: list[SnapshotHistoryEntry]


class SnapshotVersionDetail(BaseModel):
    id: int
    version: int
    domain: str
    generatedAt: str
    source: str
    data: dict[str, Any]


@router.get("/{domain}", response_model=SnapshotHistoryResponse)
async def get_history(
    domain: str,
    limit: int = Query(default=10, ge=1, le=50),
) -> SnapshotHistoryResponse:
    """Return the N most recent snapshot versions for a domain."""
    if domain not in VALID_DOMAINS:
        raise HTTPException(status_code=400, detail=f"Domaine invalide. Valeurs acceptées : {', '.join(sorted(VALID_DOMAINS))}")

    if not db_available():
        return SnapshotHistoryResponse(
            domain=domain,
            available=False,
            entries=[],
        )

    entries_raw = read_snapshot_history(domain, company_id=DEFAULT_COMPANY_ID, limit=limit)
    entries = [SnapshotHistoryEntry(**e) for e in entries_raw]

    return SnapshotHistoryResponse(
        domain=domain,
        available=True,
        entries=entries,
    )


@router.get("/{domain}/{entry_id}", response_model=SnapshotVersionDetail)
async def get_snapshot_version(
    domain: str,
    entry_id: int,
) -> SnapshotVersionDetail:
    """Return the full snapshot data for a specific historical version."""
    if domain not in VALID_DOMAINS:
        raise HTTPException(status_code=400, detail="Domaine invalide.")

    if not db_available():
        raise HTTPException(status_code=503, detail="Historique non disponible — PostgreSQL non configuré.")

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, version, domain, generated_at, source, data
                    FROM snapshots
                    WHERE id = %s AND company_id = %s AND domain = %s
                    """,
                    (entry_id, DEFAULT_COMPANY_ID, domain),
                )
                row = cur.fetchone()
    except Exception as exc:
        logger.error("Erreur lecture snapshot version %s : %s", entry_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not row:
        raise HTTPException(status_code=404, detail=f"Version {entry_id} introuvable pour le domaine {domain}.")

    data = row["data"]
    if isinstance(data, str):
        data = json.loads(data)

    return SnapshotVersionDetail(
        id=row["id"],
        version=row["version"],
        domain=row["domain"],
        generatedAt=row["generated_at"].isoformat() if hasattr(row["generated_at"], "isoformat") else str(row["generated_at"]),
        source=row["source"],
        data=data,
    )
