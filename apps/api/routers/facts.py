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
import re
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from db.database import db_available, get_db
from routers.auth import get_current_user, require_admin, require_analyst
from services import evidence_service, facts_service
from services.auth_service import AuthUser
from services.storage.base import StorageError
from utils.evidence_guard import check_evidence_bytes

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")

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


@router.post("/replay")
async def replay_facts(user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
    """Recalcule la vue matérialisée facts_current (refresh). Réservé admin — spec §5."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")
    facts_service.refresh_facts_current()
    return {"ok": True, "company_id": user.company_id}


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


# ── Pièces justificatives par datapoint (T2.1) ───────────────────────────────


@router.post("/{code}/evidence")
async def attach_evidence_endpoint(
    code: str,
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_analyst),
) -> dict[str, Any]:
    """Attache une pièce (PDF/PNG/JPG, 5 Mo max) à un datapoint via un event chaîné."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")

    data = await file.read()
    ext, content_type = check_evidence_bytes(data, file.filename)
    try:
        return evidence_service.attach_evidence(
            company_id=user.company_id,
            code=code,
            data=data,
            filename=file.filename or f"piece.{ext}",
            ext=ext,
            content_type=content_type,
            uploaded_by=user.email,
        )
    except evidence_service.EvidenceError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(400, detail=str(exc)) from exc


@router.get("/{code}/evidence")
async def list_evidence_endpoint(
    code: str,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Liste les pièces actives d'un datapoint (URL signée expirante 15 min)."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")
    return {
        "code": code,
        "company_id": user.company_id,
        "evidence": evidence_service.list_evidence(company_id=user.company_id, code=code),
    }


@router.get("/{code}/evidence/{sha256}/download")
async def download_evidence_endpoint(
    code: str,
    sha256: str,
    user: AuthUser = Depends(get_current_user),
) -> Response:
    """Télécharge une pièce (proxy authentifié — jamais d'URL de stockage directe)."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")
    if not _SHA256_RE.match(sha256):
        raise HTTPException(400, detail="SHA-256 invalide (64 caractères hexadécimaux attendus).")
    try:
        data, content_type = evidence_service.get_evidence_file(
            company_id=user.company_id, code=code, sha256=sha256,
        )
    except (evidence_service.EvidenceError, StorageError) as exc:
        raise HTTPException(404, detail=str(exc)) from exc
    return Response(content=data, media_type=content_type)


@router.delete("/{code}/evidence/{sha256}")
async def revoke_evidence_endpoint(
    code: str,
    sha256: str,
    user: AuthUser = Depends(require_analyst),
) -> dict[str, Any]:
    """Révoque une pièce (event chaîné). Le fichier reste adressé par son hash."""
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")
    if not _SHA256_RE.match(sha256):
        raise HTTPException(400, detail="SHA-256 invalide (64 caractères hexadécimaux attendus).")
    try:
        return evidence_service.revoke_evidence(
            company_id=user.company_id, code=code, sha256=sha256, revoked_by=user.email,
        )
    except evidence_service.EvidenceError as exc:
        raise HTTPException(404, detail=str(exc)) from exc
