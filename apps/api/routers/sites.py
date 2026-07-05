"""routers/sites.py — Sites physiques (v1 minimaliste : list + create).

  GET  /sites — sites de la company
  POST /sites — créer un site (analyste)

Un site rattache les leviers MACC (actions.site_id) à une implantation réelle.
Pas de DELETE en v1 : la FK actions.site_id est ON DELETE SET NULL, mais la
suppression attendra un vrai besoin (et son UI de confirmation).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db.database import db_available
from routers.auth import get_current_user, require_analyst
from services import sites_service
from services.auth_service import AuthUser

router = APIRouter()


class SiteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    location: str | None = Field(None, max_length=300)
    naf_code: str | None = Field(None, max_length=20)
    activity_type: str | None = Field(None, max_length=100)


@router.get("")
def list_sites(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"sites": sites_service.list_sites(user.company_id)}


@router.post("", status_code=201)
def create_site(body: SiteCreate, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    if not db_available():
        raise HTTPException(503, "Base indisponible.")
    try:
        return sites_service.create_site(user.company_id, **body.model_dump())
    except sites_service.SiteError as exc:
        raise HTTPException(400, str(exc)) from exc
