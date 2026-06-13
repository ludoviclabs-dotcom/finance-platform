"""
routers/vsme_mapping.py — T3.2 : complétude VSME + saisie guidée.

  GET  /vsme/mapping/status     — complétude par module + datapoints (statut/source)
  GET  /vsme/mapping/missing    — datapoints manquants (mandatory d'abord)
  POST /vsme/mapping/datapoint  — saisie guidée / « non applicable » (fact chaîné)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routers.auth import get_current_user, require_analyst
from services import vsme_mapping_service
from services.auth_service import AuthUser

router = APIRouter()


class DatapointEntry(BaseModel):
    code: str = Field(..., description="Code du datapoint VSME (ex. B6-1)")
    value: Any = Field(default=None, description="Valeur saisie (null si non applicable)")
    is_applicable: bool = Field(default=True)
    na_justification: str | None = Field(default=None, description="Requis si non applicable")


@router.get("/status")
def mapping_status(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return vsme_mapping_service.compute_mapping(user.company_id)


@router.get("/missing")
def mapping_missing(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"missing": vsme_mapping_service.list_missing(user.company_id)}


@router.post("/datapoint")
def save_datapoint(payload: DatapointEntry, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    try:
        return vsme_mapping_service.save_field_value(
            company_id=user.company_id, code=payload.code, value=payload.value,
            is_applicable=payload.is_applicable, na_justification=payload.na_justification,
            user_email=user.email,
        )
    except vsme_mapping_service.VsmeMappingError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
