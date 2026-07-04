"""
materialite.py — Endpoints matrice double matérialité (Phase 4 + T7.4).

Endpoints :
  GET  /materialite/presets                    — 5 secteurs préremplis + labels enjeux
  GET  /materialite/positions                  — positions sauvegardées (drag & drop)
  POST /materialite/positions                  — sauvegarder positions + justifications
  POST /materialite/score                      — scorer (règle ESRS 1 : impact OU financier)
  GET  /materialite/assessments                — évaluations archivées (versioning annuel)
  POST /materialite/assessments                — figer l'évaluation courante (immuable)
  GET  /materialite/assessments/{id}           — détail d'une évaluation archivée
  POST /materialite/assessments/{id}/export    — ZIP auditable (PDF + manifest, /verify)
"""

from __future__ import annotations

import io
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from db.database import db_available, get_db
from db.tenant import get_company_id
from routers.auth import require_analyst
from services import materialite_export
from services.auth_service import AuthUser
from services.materialite_service import (
    AssessmentCreate,
    AssessmentOut,
    AssessmentSummary,
    IssuePosition,
    MaterialiteScoreResponse,
    SavePositionsRequest,
    SectorPresetsResponse,
    compute_score,
    create_assessment,
    get_assessment,
    get_sector_presets,
    list_assessments,
    load_positions,
    save_positions,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _company_name(company_id: int) -> str:
    name = "Organisation"
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
                    row = cur.fetchone()
                    if row and row.get("name"):
                        name = row["name"]
        except Exception:
            pass
    return name


@router.get("/presets", response_model=SectorPresetsResponse)
def get_presets() -> SectorPresetsResponse:
    """Retourne les 5 secteurs avec positions ESRS préremplies."""
    return get_sector_presets()


@router.get("/positions", response_model=list[IssuePosition])
def get_positions(company_id: int = Depends(get_company_id)) -> list[IssuePosition]:
    """Retourne les positions personnalisées sauvegardées (drag & drop)."""
    return load_positions(company_id)


@router.post("/positions", status_code=204)
def post_positions(
    payload: SavePositionsRequest,
    user: AuthUser = Depends(require_analyst),
) -> None:
    """Sauvegarde les positions personnalisées (drag & drop sur la matrice 2D)."""
    save_positions(payload.positions, user.company_id)


@router.post("/score", response_model=MaterialiteScoreResponse)
def post_score(
    payload: SavePositionsRequest,
    company_id: int = Depends(get_company_id),
) -> MaterialiteScoreResponse:
    """
    Calcule le score de matérialité et génère le narratif.
    Si positions est vide, utilise le preset du secteur fourni.
    """
    return compute_score(payload.positions, sector=payload.sector)


# ---------------------------------------------------------------------------
# T7.4 — Évaluations archivées (versioning) + export auditable
# ---------------------------------------------------------------------------

@router.get("/assessments", response_model=list[AssessmentSummary])
def get_assessments(company_id: int = Depends(get_company_id)) -> list[AssessmentSummary]:
    """Historique des évaluations archivées (les auditeurs demandent la révision annuelle)."""
    return list_assessments(company_id)


@router.post("/assessments", response_model=AssessmentOut, status_code=201)
def post_assessment(
    payload: AssessmentCreate,
    user: AuthUser = Depends(require_analyst),
) -> AssessmentOut:
    """Fige l'évaluation courante en version immuable (positions + scoring snapshotés)."""
    return create_assessment(payload, user.company_id, user.email)


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment_detail(
    assessment_id: int,
    company_id: int = Depends(get_company_id),
) -> AssessmentOut:
    assessment = get_assessment(assessment_id, company_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    return assessment


@router.post("/assessments/{assessment_id}/export")
def post_assessment_export(
    assessment_id: int,
    user: AuthUser = Depends(require_analyst),
) -> StreamingResponse:
    """ZIP auditable de l'évaluation : PDF (règle ESRS 1, deux dimensions,
    justifications, standards à couvrir) + manifest vérifiable sur /verify."""
    assessment = get_assessment(assessment_id, user.company_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    result = materialite_export.build_materialite_export(
        assessment, company_id=user.company_id, company_name=_company_name(user.company_id),
    )
    return StreamingResponse(
        io.BytesIO(result["zip_bytes"]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Package-Hash": result["package_hash"],
            "X-Manifest-Hash": result["manifest_hash"],
        },
    )
