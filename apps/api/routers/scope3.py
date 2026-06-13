"""
routers/scope3.py — T4.1 : 15 catégories Scope 3 GHG Protocol.

  GET /scope3/categories  — référentiel des 15 catégories (public)
  GET /scope3/breakdown   — répartition Scope 3 par catégorie de la company
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from routers.auth import get_current_user
from services import scope3_service
from services.auth_service import AuthUser

router = APIRouter()


@router.get("/categories")
def list_categories() -> dict[str, Any]:
    return {"standard": "GHG Protocol Scope 3", "categories": scope3_service.categories()}


@router.get("/breakdown")
def scope3_breakdown(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return scope3_service.breakdown(user.company_id)
