"""
strategic_mapping.py — Endpoints Value Mapping ESG.

Endpoints :
  GET /strategic-mapping/adhesion-volontaire
      ?segment=pme|eti|grand_groupe|generic
      ?persona=dg|daf|investisseur|donneur_ordre|generic
      ?horizon=court_terme|moyen_terme|long_terme|generic

  GET /strategic-mapping/adhesion-volontaire/export.xlsx
      Mêmes paramètres — retourne le classeur Excel en téléchargement.

  GET /strategic-mapping/adhesion-volontaire/export.pdf
      Mêmes paramètres — retourne le PDF board-ready en téléchargement.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from db.tenant import get_company_id
from models.strategic_mapping import (
    AiContextResponse,
    Horizon,
    Persona,
    Segment,
    StrategicMappingResponse,
)
from services.strategic_mapping_excel import build_strategic_mapping_xlsx
from services.strategic_mapping_pdf import build_strategic_mapping_pdf
from services.strategic_mapping_service import build_ai_context, build_strategic_mapping

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


@router.get("/adhesion-volontaire/export.xlsx")
def export_adhesion_volontaire_xlsx(
    segment: Segment = Query(default="generic"),
    persona: Persona = Query(default="generic"),
    horizon: Horizon = Query(default="generic"),
    company_id: int = Depends(get_company_id),
) -> Response:
    """
    Retourne le classeur Excel Value Mapping ESG (.xlsx) en téléchargement.

    Même contenu que l'endpoint JSON, filtré selon les mêmes paramètres.
    """
    data = build_strategic_mapping(
        company_id=company_id,
        segment=segment,
        persona=persona,
        horizon=horizon,
    )
    xlsx_bytes = build_strategic_mapping_xlsx(data)
    filename = f"value-mapping-esg-{segment}-{persona}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/adhesion-volontaire/export.pdf")
def export_adhesion_volontaire_pdf(
    segment: Segment = Query(default="generic"),
    persona: Persona = Query(default="generic"),
    horizon: Horizon = Query(default="generic"),
    company_id: int = Depends(get_company_id),
) -> Response:
    """
    Retourne le PDF board-ready Value Mapping ESG en téléchargement.

    Même contenu que l'endpoint JSON, filtré selon les mêmes paramètres.
    """
    data = build_strategic_mapping(
        company_id=company_id,
        segment=segment,
        persona=persona,
        horizon=horizon,
    )
    pdf_bytes = build_strategic_mapping_pdf(data)
    filename = f"value-mapping-esg-{segment}-{persona}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/adhesion-volontaire/ai-context", response_model=AiContextResponse)
def get_ai_context(
    segment: Segment = Query(default="generic"),
    persona: Persona = Query(default="generic"),
    horizon: Horizon = Query(default="generic"),
    company_id: int = Depends(get_company_id),
) -> AiContextResponse:
    """
    Retourne le contexte compact destiné au LLM pour la génération de variantes.

    - baseHeadline / baseSupporting : message exécutif du persona sélectionné
      (fallback sur persona "dg" si "generic").
    - allowedFacts : uniquement les gains financiers quantifiés (magnitude non-null)
      filtrés par segment et persona — seules données que le LLM est autorisé à citer.
    """
    data = build_strategic_mapping(
        company_id=company_id,
        segment=segment,
        persona=persona,
        horizon=horizon,
    )
    return build_ai_context(data=data, persona=persona)
