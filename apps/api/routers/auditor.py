"""
routers/auditor.py — T2.2 : rôle « Auditeur invité » (lecture seule, par lien).

Endpoints admin (require_admin) :
  POST   /auditor/invite          — créer une invitation (retourne le token + lien)
  GET    /auditor/invites         — lister les invitations de la company
  DELETE /auditor/invite/{token}  — révoquer

Endpoints publics (NO AUTH — lien envoyé par email) :
  GET /auditor/public/{token}                 — vue lecture seule (KPIs + intégrité)
  GET /auditor/public/{token}/trail/{code}    — trail d'un datapoint
  GET /auditor/public/{token}/evidence/{code} — pièces justificatives d'un datapoint

Aucun endpoint d'écriture n'est exposé à l'auditeur : le token n'est pas un JWT,
il n'ouvre que des GET. Toute consultation est journalisée (audit_events).
"""

from __future__ import annotations

import io
import logging
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from routers.auth import require_admin
from services import auditor_service, evidence_service, export_package, facts_service
from services.auth_service import AuthUser
from services.storage import StorageError

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")

logger = logging.getLogger(__name__)
router = APIRouter()


class InviteCreate(BaseModel):
    email: str | None = Field(default=None, description="Email de l'auditeur (facultatif)")
    label: str | None = Field(default=None, description="Libellé interne (ex. cabinet)")
    expires_days: int = Field(default=30, ge=1, le=365)


def _resolve_or_error(token: str) -> dict:
    """Résout le token et applique les statuts (404 inconnu / 403 révoqué / 410 expiré)."""
    invite = auditor_service.resolve_invite(token)
    if not invite:
        raise HTTPException(404, detail="Lien auditeur invalide ou introuvable.")
    status = auditor_service.invite_status(invite)
    if status == "revoked":
        raise HTTPException(403, detail="Ce lien auditeur a été révoqué.")
    if status == "expired":
        raise HTTPException(410, detail="Ce lien auditeur a expiré.")
    return invite


# ── Admin ────────────────────────────────────────────────────────────────────

@router.post("/invite")
def create_invite_endpoint(
    payload: InviteCreate, user: AuthUser = Depends(require_admin),
) -> dict:
    try:
        invite = auditor_service.create_invite(
            company_id=user.company_id, email=payload.email, label=payload.label,
            created_by=user.email, expires_days=payload.expires_days,
        )
    except auditor_service.AuditorError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    base_url = os.environ.get("FRONTEND_URL", "https://carbon-snowy-nine.vercel.app")
    invite["link"] = f"{base_url}/audit/{invite['token']}"
    return invite


@router.get("/invites")
def list_invites_endpoint(user: AuthUser = Depends(require_admin)) -> dict:
    return {"company_id": user.company_id, "invites": auditor_service.list_invites(user.company_id)}


@router.delete("/invite/{token}")
def revoke_invite_endpoint(token: str, user: AuthUser = Depends(require_admin)) -> dict:
    ok = auditor_service.revoke_invite(company_id=user.company_id, token=token)
    if not ok:
        raise HTTPException(404, detail="Invitation introuvable ou déjà révoquée.")
    return {"revoked": True, "token": token}


# ── Public (lecture seule, no auth) ──────────────────────────────────────────

@router.get("/public/{token}")
def public_view(token: str) -> dict:
    invite = _resolve_or_error(token)
    auditor_service.record_access(token=token, company_id=invite["company_id"], source="view")
    view = auditor_service.audit_view(invite["company_id"])
    return {
        "company_name": invite.get("company_name"),
        "expires_at": invite.get("expires_at"),
        "label": invite.get("label"),
        "kpis": view["kpis"],
        "verify": view["verify"],
    }


@router.get("/public/{token}/trail/{code}")
def public_trail(token: str, code: str) -> dict:
    invite = _resolve_or_error(token)
    auditor_service.record_access(token=token, company_id=invite["company_id"], source=f"trail:{code}")
    events = facts_service.get_trail(code=code, company_id=invite["company_id"], limit=200)
    return {
        "code": code,
        "events": [
            {
                "id": e.id, "value": e.value, "unit": e.unit, "source_path": e.source_path,
                "computed_at": e.computed_at, "hash_prev": e.hash_prev, "hash_self": e.hash_self,
                "meta": e.meta,
            }
            for e in events
        ],
    }


@router.get("/public/{token}/evidence/{code}")
def public_evidence(token: str, code: str) -> dict:
    invite = _resolve_or_error(token)
    auditor_service.record_access(token=token, company_id=invite["company_id"], source=f"evidence:{code}")
    return {
        "code": code,
        "evidence": evidence_service.list_evidence(
            company_id=invite["company_id"],
            code=code,
            url_template=f"/auditor/public/{token}/evidence/{code}/{{sha256}}/download",
        ),
    }


@router.get("/public/{token}/evidence/{code}/{sha256}/download")
def public_evidence_download(token: str, code: str, sha256: str) -> Response:
    """Télécharge une pièce (proxy authentifié par le token d'invitation)."""
    if not _SHA256_RE.match(sha256):
        raise HTTPException(400, detail="SHA-256 invalide (64 caractères hexadécimaux attendus).")
    invite = _resolve_or_error(token)
    auditor_service.record_access(
        token=token, company_id=invite["company_id"], source=f"evidence-download:{code}",
    )
    try:
        data, content_type = evidence_service.get_evidence_file(
            company_id=invite["company_id"], code=code, sha256=sha256,
        )
    except (evidence_service.EvidenceError, StorageError) as exc:
        raise HTTPException(404, detail=str(exc)) from exc
    return Response(content=data, media_type=content_type)


@router.get("/public/{token}/pack")
def public_pack(token: str) -> StreamingResponse:
    """Télécharge l'Evidence Pack ZIP de la company (lecture seule, T2.4)."""
    invite = _resolve_or_error(token)
    auditor_service.record_access(token=token, company_id=invite["company_id"], source="pack")
    pkg = export_package.build_package(
        company_id=invite["company_id"],
        company_name=invite.get("company_name") or "Organisation",
        domain="consolidated",
    )
    return StreamingResponse(
        io.BytesIO(pkg.zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{pkg.filename}"'},
    )
