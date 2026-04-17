"""
materialite.py — Endpoints matrice double matérialité Phase 4.

Endpoints :
  GET  /materialite/presets           — 5 secteurs préremplis + labels enjeux
  GET  /materialite/positions         — positions sauvegardées (drag & drop)
  POST /materialite/positions         — sauvegarder les positions
  POST /materialite/score             — calculer le score + narratif
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from db.tenant import get_company_id
from routers.auth import require_analyst
from services.auth_service import AuthUser
from services.materialite_service import (
    IssuePosition,
    MaterialiteScoreResponse,
    SavePositionsRequest,
    SectorPresetsResponse,
    compute_score,
    get_sector_presets,
    load_positions,
    save_positions,
)

logger = logging.getLogger(__name__)
router = APIRouter()


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
