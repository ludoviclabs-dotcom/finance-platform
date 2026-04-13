"""
dashboard.py — Endpoints du dashboard consolidé multi-domaine.

Endpoints :
  GET /dashboard/consolidated   — ConsolidatedSnapshot complet (cache + agrégation)
  GET /dashboard/compare        — Même snapshot + deltas T vs T-1 explicites
  GET /dashboard/health         — Santé des données par domaine uniquement
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from db.tenant import get_company_id
from services.aggregation_service import (
    ConsolidatedSnapshot,
    build_consolidated_snapshot,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /dashboard/consolidated
# ---------------------------------------------------------------------------


@router.get("/consolidated", response_model=ConsolidatedSnapshot)
def get_consolidated(
    company_id: int = Depends(get_company_id),
) -> ConsolidatedSnapshot:
    """
    Retourne le snapshot consolidé multi-domaine.

    - Agrège Carbon, VSME, ESG, Finance depuis le cache.
    - Ne relance pas les calculs — les domains manquants ont health.available=False.
    - Les données brutes (rawCarbon, rawVsme, …) sont incluses pour le copilote et le PDF.
    """
    return build_consolidated_snapshot(company_id)


# ---------------------------------------------------------------------------
# GET /dashboard/compare
# ---------------------------------------------------------------------------


@router.get("/compare", response_model=ConsolidatedSnapshot)
def get_compare(
    company_id: int = Depends(get_company_id),
) -> ConsolidatedSnapshot:
    """
    Identique à /consolidated mais met l'accent sur les deltas T vs T-1.

    Les deltas sont calculés depuis l'historique PostgreSQL (champ `deltas`).
    Si PostgreSQL n'est pas disponible, `deltas` contient uniquement des None.
    """
    return build_consolidated_snapshot(company_id)


# ---------------------------------------------------------------------------
# GET /dashboard/health
# ---------------------------------------------------------------------------


@router.get("/health")
def get_health(
    company_id: int = Depends(get_company_id),
) -> dict:
    """
    Retourne uniquement la santé des données par domaine.
    Appel léger, sans agrégation des KPIs.
    """
    from services.aggregation_service import _build_health
    from services.snapshot_cache import cache_status

    status = cache_status(company_id=company_id)
    health = _build_health(status)
    return {
        "companyId": company_id,
        "domains": {k: v.model_dump() for k, v in health.items()},
    }
