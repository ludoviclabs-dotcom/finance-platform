"""
routers/quality.py — T2.6 : indicateurs de preuve & qualité + score audit.

  GET /quality/indicators — couverture pièces, distribution qualité, score audit.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from routers.auth import get_current_user
from services import quality_service
from services.auth_service import AuthUser

router = APIRouter()


@router.get("/indicators")
def quality_indicators(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """Indicateurs de preuve & qualité de la company courante (alimente le score audit)."""
    return quality_service.compute_indicators(user.company_id)
