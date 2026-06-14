"""
routers/diff.py — T5.5 : comparaison multi-exercices de snapshots.

  GET /diff/{domain}  — compare les deux dernières versions du snapshot (N vs N-1),
                        variations par poste + nouveaux/disparus + FE changés.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from routers.auth import get_current_user
from services import diff_service
from services.auth_service import AuthUser
from services.snapshot_cache import read_snapshot_versions

router = APIRouter()

VALID_DOMAINS = {"carbon", "vsme", "esg", "finance"}


@router.get("/{domain}")
def diff_domain(domain: str, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    if domain not in VALID_DOMAINS:
        raise HTTPException(400, detail=f"Domaine invalide. Valeurs : {sorted(VALID_DOMAINS)}")
    versions = read_snapshot_versions(domain, company_id=user.company_id, limit=2)
    if len(versions) < 2:
        return {"domain": domain, "available": False,
                "diff": diff_service.diff_snapshots({}, {})}
    # versions[0] = plus récent (après), versions[1] = précédent (avant)
    return {"domain": domain, "available": True,
            "diff": diff_service.diff_snapshots(versions[1], versions[0])}
