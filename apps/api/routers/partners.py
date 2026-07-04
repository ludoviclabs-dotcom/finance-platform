"""
partners.py — T7.5 : programme partenaire experts-comptables (fondation).

Le canal cabinet est le premier point de contact ESG des PME françaises. Cette
brique couvre le PIPELINE de candidatures (page publique /partenaires) — l'espace
multi-dossiers cabinet lui-même exige une refonte du modèle d'accès (memberships
multi-organisations, switch de tenant, RLS) et reste `planifie` au registre.
Aucun stockage tiers (pas de Notion/Airtable) : Postgres + revue admin.

  POST /partners/apply         — candidature publique (validée, rate-limitée)
  GET  /partners/applications  — pipeline (admin)
  PATCH /partners/applications/{id} — changer le statut (admin)
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from db.database import db_available, get_db
from routers.auth import require_admin
from services.auth_service import AuthUser

logger = logging.getLogger(__name__)
router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")

VALID_STATUSES = {"new", "contacted", "accepted", "declined"}

# Fallback in-memory (mode /tmp)
_MEM_APPLICATIONS: list[dict[str, Any]] = []
_MEM_NEXT_ID = {"application": 1}


class PartnerApplyRequest(BaseModel):
    cabinet_name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    siret: str | None = Field(default=None)
    clients_estimate: str | None = Field(default=None, max_length=50)
    message: str | None = Field(default=None, max_length=4000)
    # Honeypot anti-bot : champ invisible côté UI — toute valeur → rejet silencieux
    website: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v.strip()):
            raise ValueError("Adresse e-mail invalide")
        return v.strip().lower()

    @field_validator("siret")
    @classmethod
    def _valid_siret(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        digits = re.sub(r"\s", "", v)
        if not re.fullmatch(r"\d{14}", digits):
            raise ValueError("Le SIRET doit comporter 14 chiffres")
        return digits


class PartnerApplicationOut(BaseModel):
    id: int
    cabinet_name: str
    siret: str | None
    contact_name: str | None
    email: str
    clients_estimate: str | None
    message: str | None
    status: str
    created_at: datetime


class ApplicationPatch(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Statut invalide. Valeurs : {sorted(VALID_STATUSES)}")
        return v


@router.post("/apply", status_code=201)
def partner_apply(payload: PartnerApplyRequest) -> dict[str, Any]:
    """Dépose une candidature partenaire (public, sans compte)."""
    if payload.website:  # honeypot rempli → bot ; on répond 201 sans persister
        return {"ok": True}

    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO partner_applications
                            (cabinet_name, siret, contact_name, email, clients_estimate, message)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        RETURNING id
                        """,
                        (payload.cabinet_name, payload.siret, payload.contact_name,
                         payload.email, payload.clients_estimate, payload.message),
                    )
                    app_id = cur.fetchone()["id"]
        except Exception as exc:
            logger.warning("partner_apply DB error: %s", exc)
            raise HTTPException(status_code=503, detail="Enregistrement momentanément indisponible") from exc
    else:
        app_id = _MEM_NEXT_ID["application"]
        _MEM_NEXT_ID["application"] += 1
        _MEM_APPLICATIONS.append({
            "id": app_id,
            "cabinet_name": payload.cabinet_name,
            "siret": payload.siret,
            "contact_name": payload.contact_name,
            "email": payload.email,
            "clients_estimate": payload.clients_estimate,
            "message": payload.message,
            "status": "new",
            "created_at": datetime.now(tz=timezone.utc),
        })

    # Notification e-mail optionnelle (EMAIL_ENABLED + PARTNER_NOTIFY_EMAIL)
    dest = os.environ.get("PARTNER_NOTIFY_EMAIL")
    if dest:
        from services.alerts_service import send_email
        send_email(
            dest,
            f"[CarbonCo] Candidature partenaire : {payload.cabinet_name}",
            f"Cabinet : {payload.cabinet_name}\nContact : {payload.contact_name or '—'} <{payload.email}>\n"
            f"SIRET : {payload.siret or '—'}\nDossiers visés : {payload.clients_estimate or '—'}\n\n"
            f"{payload.message or ''}",
        )

    return {"ok": True, "id": app_id}


@router.get("/applications", response_model=list[PartnerApplicationOut])
def list_applications(_: AuthUser = Depends(require_admin)) -> list[PartnerApplicationOut]:
    """Pipeline des candidatures (admin uniquement — donnée plateforme)."""
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM partner_applications ORDER BY created_at DESC LIMIT 500"
                    )
                    return [PartnerApplicationOut(**dict(r)) for r in cur.fetchall()]
        except Exception as exc:
            logger.warning("list_applications DB error: %s", exc)
            return []
    return [PartnerApplicationOut(**a) for a in reversed(_MEM_APPLICATIONS)]


@router.patch("/applications/{application_id}", response_model=PartnerApplicationOut)
def patch_application(
    application_id: int,
    payload: ApplicationPatch,
    _: AuthUser = Depends(require_admin),
) -> PartnerApplicationOut:
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE partner_applications SET status = %s WHERE id = %s RETURNING *",
                        (payload.status, application_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        raise HTTPException(status_code=404, detail="Candidature introuvable")
                    return PartnerApplicationOut(**dict(row))
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("patch_application DB error: %s", exc)
            raise HTTPException(status_code=503, detail="Mise à jour momentanément indisponible") from exc

    for a in _MEM_APPLICATIONS:
        if a["id"] == application_id:
            a["status"] = payload.status
            return PartnerApplicationOut(**a)
    raise HTTPException(status_code=404, detail="Candidature introuvable")
