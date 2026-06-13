"""
routers/consolidation.py — T4.4 : périmètre & vue groupe.

  GET  /consolidation/perimeter — approche + entités du périmètre
  GET  /consolidation/group     — vue groupe consolidée (calculée, lecture seule)
  POST /consolidation/approach  — change l'approche (admin) + journalise
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routers.auth import get_current_user, require_admin
from services import consolidation_service as cons
from services.auth_service import AuthUser

router = APIRouter()


class ApproachUpdate(BaseModel):
    approach: str


@router.get("/perimeter")
def perimeter(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"approaches": cons.APPROACHES, **cons.get_perimeter(user.company_id)}


@router.get("/group")
def group(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return cons.group_view(user.company_id)


@router.post("/approach")
def set_approach(payload: ApproachUpdate, user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
    try:
        return cons.set_approach(company_id=user.company_id, approach=payload.approach, actor=user.email)
    except cons.ConsolidationError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
