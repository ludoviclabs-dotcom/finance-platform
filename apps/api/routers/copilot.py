"""
copilot.py — Endpoints backend du copilote IA.

Endpoints :
  GET /copilot/tools   — Bundle des outils typés (KPIs + santé) pour le copilote

Note : Le streaming LLM est géré directement par la route Next.js
(/app/api/copilot/route.ts) via le Vercel AI Gateway + claude-sonnet-4.6.
Ce router Python expose uniquement les outils de lecture des données grounded.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from db.tenant import get_company_id
from services.copilot_tools import CopilotToolsBundle, build_copilot_tools_bundle

logger = logging.getLogger(__name__)

router = APIRouter()


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

    Le frontend injecte ce bundle dans le system prompt du copilote
    pour un grounding sur les données réelles de l'entreprise.
    """
    return build_copilot_tools_bundle(company_id)
