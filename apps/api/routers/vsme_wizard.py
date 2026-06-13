"""
routers/vsme_wizard.py — T3.4 : parcours « VSME en 10 étapes ».

  POST /vsme/wizard/start     — démarre / réinitialise une session (admin/analyst)
  GET  /vsme/wizard/progress  — session courante (reprise)
  POST /vsme/wizard/save      — enregistre une étape (step + état partiel)
  POST /vsme/wizard/complete  — finalise (émet les facts en bulk)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routers.auth import get_current_user, require_analyst
from services import vsme_wizard_service as wiz
from services.auth_service import AuthUser

router = APIRouter()


class WizardStart(BaseModel):
    state: dict[str, Any] | None = None


class WizardSave(BaseModel):
    step: int = Field(..., ge=1, le=wiz.TOTAL_STEPS)
    state: dict[str, Any] | None = None


@router.post("/start")
def start(payload: WizardStart, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    try:
        return wiz.start_session(user.company_id, payload.state)
    except wiz.WizardError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


@router.get("/progress")
def progress(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    session = wiz.get_session(user.company_id)
    if session is None:
        return {"step": 0, "state": {}, "progress_pct": 0, "completed": False,
                "total_steps": wiz.TOTAL_STEPS, "steps": wiz.WIZARD_STEPS}
    return session


@router.post("/save")
def save(payload: WizardSave, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    try:
        return wiz.save_step(user.company_id, payload.step, payload.state)
    except wiz.WizardError as exc:
        raise HTTPException(400, detail=str(exc)) from exc


@router.post("/complete")
def complete(user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    try:
        return wiz.complete(user.company_id)
    except wiz.WizardError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
