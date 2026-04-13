"""
strategic_mapping.py — Endpoints Value Mapping ESG.

Endpoints :
  GET /strategic-mapping/adhesion-volontaire
      ?segment=pme|eti|grand_groupe|generic
      ?persona=dg|daf|investisseur|donneur_ordre|generic
      ?horizon=court_terme|moyen_terme|long_terme|generic
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from db.tenant import get_company_id
from models.strategic_mapping import (
    Horizon,
    Persona,
    Segment,
    StrategicMappingResponse,
)
from services.strategic_mapping_service import build_strategic_mapping

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/adhesion-volontaire", response_model=StrategicMappingResponse)
def get_adhesion_volontaire(
    segment: Segment = Query(default="generic"),
    persona: Persona = Query(default="generic"),
    horizon: Horizon = Query(default="generic"),
    company_id: int = Depends(get_company_id),
) -> StrategicMappingResponse:
    """
    Retourne le mapping stratégique complet de l'adhésion volontaire ESG.

    - Filtré par segment (pme / eti / grand_groupe) si spécifié.
    - Filtré par persona (dg / daf / investisseur / donneur_ordre) si spécifié.
    - Enrichi avec les KPIs réels de l'entreprise si snapshot disponible (groundedKpis).
    - Contenu 100% éditorial et déterministe — aucun appel LLM.
    """
    return build_strategic_mapping(
        company_id=company_id,
        segment=segment,
        persona=persona,
        horizon=horizon,
    )
