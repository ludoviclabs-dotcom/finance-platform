"""
routers/chain.py — T2.5 : badge de confiance + vérification manuelle.

  GET  /chain/status  — dernière vérification planifiée (badge dashboard)
  POST /chain/verify  — relance une vérification maintenant (admin)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from routers.auth import get_current_user, require_admin
from services import chain_monitor, facts_service
from services.auth_service import AuthUser

router = APIRouter()


@router.get("/status")
def chain_status(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """Badge de confiance : dernière vérification planifiée, sinon contrôle live."""
    latest = chain_monitor.latest_verification(user.company_id)
    if latest is not None:
        return {"scheduled": True, **latest}
    live = facts_service.verify_chain(user.company_id)
    return {
        "scheduled": False,
        "ok": live.ok,
        "broken_at": live.broken_at,
        "checked": live.checked,
        "verified_at": None,
    }


@router.post("/verify")
def chain_verify(user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
    """Relance une vérification de la chaîne maintenant et l'horodate (admin)."""
    return chain_monitor.run_verification(user.company_id)
