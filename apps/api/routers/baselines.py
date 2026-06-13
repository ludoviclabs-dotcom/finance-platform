"""
routers/baselines.py — T4.5 : année de référence & recalcul.

  GET  /baselines                 — baselines de la company
  POST /baselines/freeze          — gèle une année (admin)
  GET  /baselines/{id}/vs-current — deltas vs référence
  POST /baselines/{id}/recalc     — recalcul motivé (admin)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routers.auth import get_current_user, require_admin
from services import baseline_service as bl
from services.auth_service import AuthUser

router = APIRouter()


class FreezeRequest(BaseModel):
    baseline_year: int = Field(..., ge=2015, le=2100)
    ef_version: str | None = None


class RecalcRequest(BaseModel):
    reason: str
    detail: str | None = None


@router.get("")
def list_baselines(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"reasons": bl.RECALC_REASONS, "baselines": bl.list_baselines(user.company_id)}


@router.post("/freeze")
def freeze(payload: FreezeRequest, user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
    try:
        return bl.freeze_baseline(company_id=user.company_id, baseline_year=payload.baseline_year, ef_version=payload.ef_version)
    except bl.BaselineError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


@router.get("/{baseline_id}/vs-current")
def vs_current(baseline_id: int, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    try:
        return bl.baseline_vs_current(company_id=user.company_id, baseline_id=baseline_id)
    except bl.BaselineError as exc:
        raise HTTPException(404, detail=str(exc)) from exc


@router.post("/{baseline_id}/recalc")
def recalc(baseline_id: int, payload: RecalcRequest, user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
    try:
        return bl.trigger_recalc(
            company_id=user.company_id, baseline_id=baseline_id,
            reason=payload.reason, detail=payload.detail, actor=user.email,
        )
    except bl.BaselineError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
