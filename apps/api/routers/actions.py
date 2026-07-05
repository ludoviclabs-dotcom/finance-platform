"""
routers/actions.py — T5.1 (MACC) + T5.2 (plan de transition).

  GET    /actions                 — liste des actions de réduction
  POST   /actions                 — créer une action (analyste)
  PATCH  /actions/{id}            — éditer les champs (analyste)
  POST   /actions/{id}/status     — changer le statut, journalisé (analyste)
  DELETE /actions/{id}            — supprimer (analyste)
  GET    /actions/{id}/events     — journal des changements de statut
  GET    /actions/macc            — courbe de coût d'abattement calculée
  GET    /actions/trajectory      — trajectoire projetée vs référence
  POST   /actions/macc.pdf        — export PDF de la MACC (analyste)
  POST   /actions/transition.pdf  — export PDF du plan de transition (analyste)
"""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db.database import db_available, get_db
from routers.auth import get_current_user, require_analyst
from services import actions_export, actions_service
from services.auth_service import AuthUser

router = APIRouter()


class ActionCreate(BaseModel):
    title: str
    description: str | None = None
    owner: str | None = None
    milestone: str | None = None
    capex: float | None = None
    reduction_tco2e: float | None = None
    lifespan_years: float | None = None
    target_code: str | None = None
    site_id: int | None = None  # NULL = entreprise entière (défaut historique)


class ActionPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    owner: str | None = None
    milestone: str | None = None
    capex: float | None = None
    reduction_tco2e: float | None = None
    lifespan_years: float | None = None
    target_code: str | None = None
    site_id: int | None = None


class StatusPatch(BaseModel):
    status: str


def _company_name(company_id: int) -> str:
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
                    row = cur.fetchone()
                    if row and row.get("name"):
                        return row["name"]
        except Exception:
            pass
    return "Organisation"


@router.get("")
def list_actions(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"actions": actions_service.list_actions(user.company_id)}


@router.post("", status_code=201)
def create_action(body: ActionCreate, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    if not db_available():
        raise HTTPException(503, "Base indisponible.")
    try:
        return actions_service.create_action(user.company_id, actor=user.email, **body.model_dump())
    except actions_service.ActionError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.patch("/{action_id}")
def patch_action(action_id: int, body: ActionPatch,
                 user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    if not db_available():
        raise HTTPException(503, "Base indisponible.")
    try:
        return actions_service.update_action(user.company_id, action_id, body.model_dump(exclude_none=True))
    except actions_service.ActionError as exc:
        raise HTTPException(404 if "introuvable" in str(exc) else 400, str(exc)) from exc


@router.post("/{action_id}/status")
def change_status(action_id: int, body: StatusPatch,
                  user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    if not db_available():
        raise HTTPException(503, "Base indisponible.")
    try:
        return actions_service.set_status(user.company_id, action_id, body.status, actor=user.email)
    except actions_service.ActionError as exc:
        raise HTTPException(404 if "introuvable" in str(exc) else 400, str(exc)) from exc


@router.delete("/{action_id}", status_code=204)
def delete_action(action_id: int, user: AuthUser = Depends(require_analyst)) -> None:
    if not actions_service.delete_action(user.company_id, action_id):
        raise HTTPException(404, "Action introuvable.")


@router.get("/{action_id}/events")
def action_events(action_id: int, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"events": actions_service.list_events(user.company_id, action_id)}


@router.get("/macc")
def macc(site_id: int | None = None,
         user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """MACC — entreprise entière par défaut, filtrable par site (?site_id=).

    La trajectoire (/trajectory) reste au niveau entreprise : la baseline vient
    de facts_current qui n'a pas de dimension site — filtrer les actions contre
    une baseline entreprise produirait une courbe trompeuse.
    """
    out = actions_service.build_macc(actions_service.list_actions(user.company_id, site_id=site_id))
    out["site_id"] = site_id  # écho du scope pour l'UI/exports
    return out


@router.get("/trajectory")
def trajectory(years: int = 5, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    baseline = actions_service.baseline_total(user.company_id)
    return actions_service.project_trajectory(baseline, actions_service.list_actions(user.company_id), years=years)


def _pdf_response(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/macc.pdf")
def macc_pdf(user: AuthUser = Depends(require_analyst)) -> StreamingResponse:
    actions = actions_service.list_actions(user.company_id)
    data = actions_export.build_macc_pdf(
        company_name=_company_name(user.company_id),
        macc=actions_service.build_macc(actions),
        generated_at=datetime.now(tz=timezone.utc).strftime("%d/%m/%Y"),
    )
    return _pdf_response(data, "macc.pdf")


@router.post("/transition.pdf")
def transition_pdf(user: AuthUser = Depends(require_analyst)) -> StreamingResponse:
    actions = actions_service.list_actions(user.company_id)
    baseline = actions_service.baseline_total(user.company_id)
    data = actions_export.build_transition_pdf(
        company_name=_company_name(user.company_id),
        actions=actions,
        trajectory=actions_service.project_trajectory(baseline, actions),
        generated_at=datetime.now(tz=timezone.utc).strftime("%d/%m/%Y"),
    )
    return _pdf_response(data, "plan-transition.pdf")
