"""
copilot.py — Endpoints backend du copilote IA.

Endpoints :
  GET  /copilot/tools          — Bundle des outils typés (KPIs + santé)
  POST /copilot/rag-search     — Recherche sémantique dans le corpus ESRS
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from db.tenant import get_company_id
from services.copilot_tools import CopilotToolsBundle, build_copilot_tools_bundle
from services.esrs_corpus import search as esrs_search

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RagSearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500, description="Question ou mot-clé à rechercher")
    top_k: int = Field(default=5, ge=1, le=10)


class RagHit(BaseModel):
    id: str
    standard: str
    topic: str
    answer: str
    source_ref: str
    score: float


class RagSearchResponse(BaseModel):
    query: str
    hits: list[RagHit]
    total_corpus_size: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/tools", response_model=CopilotToolsBundle)
def get_copilot_tools(
    company_id: int = Depends(get_company_id),
) -> CopilotToolsBundle:
    """
    Retourne le bundle complet des outils typés pour alimenter le copilote IA.

    Inclut :
      - carbon  : Scopes 1/2/3, Taxonomie, Intensités, SBTi, CBAM
      - vsme    : Complétude, Social, Environnement PME
      - esg     : Scores E/S/G, Top 5 enjeux matériels
      - finance : Finance-Climat, SFDR PAI
      - alerts  : Règles actives + dernières alertes déclenchées
      - health  : Fraîcheur et disponibilité des caches
    """
    return build_copilot_tools_bundle(company_id)


@router.post("/rag-search", response_model=RagSearchResponse)
def rag_search(payload: RagSearchRequest) -> RagSearchResponse:
    """
    Recherche dans le corpus ESRS statique (60+ entrées).
    Retourne les extraits les plus pertinents avec leur référence de norme.

    Utilisé par le copilote IA pour citer des sources ESRS précises.
    Ne nécessite pas d'auth (données publiques, corpus normatif ESRS).
    """
    from services.esrs_corpus import CORPUS
    hits = esrs_search(payload.query, top_k=payload.top_k)
    return RagSearchResponse(
        query=payload.query,
        hits=[RagHit(**h) for h in hits],
        total_corpus_size=len(CORPUS),
    )
