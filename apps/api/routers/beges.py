"""
routers/beges.py — T4.2 : export BEGES réglementaire v5 (France) + T7.2 : suivi
des dépôts et rappels de renouvellement.

  GET    /beges/status         — totaux + ventilation 6×22 + éligibilité
  POST   /beges/export         — génère et télécharge le ZIP (PDF + Excel)
  GET    /beges/filings        — historique des dépôts + statut d'échéance (+4 ans)
  POST   /beges/filings        — déclarer un dépôt (année, date, référence ADEME)
  DELETE /beges/filings/{id}   — supprimer un dépôt (admin)
  POST   /beges/reminders/run  — émettre les rappels d'échéance dus (cron quotidien)
"""

from __future__ import annotations

import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from db.database import db_available, get_db
from db.tenant import get_company_id
from routers.auth import (
    get_current_user,
    require_admin,
    require_analyst,
    require_cron_or_analyst,
)
from services import beges_export, beges_filings_service
from services.auth_service import AuthUser
from services.beges_filings_service import (
    BegesFilingCreate,
    BegesFilingOut,
    BegesSchedule,
)

router = APIRouter()


def _company_info(company_id: int) -> tuple[str, int | None, str]:
    name, fte, country = "Organisation", None, "FR"
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
                    row = cur.fetchone()
                    if row and row.get("name"):
                        name = row["name"]
        except Exception:
            pass
    try:
        from services.snapshot_cache import read_snapshot
        snap = read_snapshot("vsme", company_id=company_id)
        if snap:
            prof = snap.get("profile", {}) or {}
            fte = prof.get("etp")
            country = prof.get("pays") or "FR"
            try:
                fte = int(fte) if fte is not None else None
            except (TypeError, ValueError):
                fte = None
    except Exception:
        pass
    return name, fte, country


@router.get("/status")
def beges_status(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    _, fte, country = _company_info(user.company_id)
    totals = beges_export.read_scope_totals(user.company_id)
    return {
        "breakdown": beges_export.ventilate(totals),
        "eligibility": beges_export.eligibility(fte, country),
        "scope_totals": totals,
    }


@router.post("/export")
def beges_export_zip(user: AuthUser = Depends(require_analyst)) -> StreamingResponse:
    name, fte, country = _company_info(user.company_id)
    result = beges_export.build_beges_report(
        company_id=user.company_id, company_name=name, fte=fte, country=country,
    )
    return StreamingResponse(
        io.BytesIO(result["zip_bytes"]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Package-Hash": result["package_hash"],
            "X-Manifest-Hash": result["manifest_hash"],
        },
    )


# ---------------------------------------------------------------------------
# T7.2 — Suivi des dépôts et rappels de renouvellement
# ---------------------------------------------------------------------------

class BegesFilingsResponse(BegesSchedule):
    filings: list[BegesFilingOut] = []


@router.get("/filings", response_model=BegesFilingsResponse)
def beges_filings(company_id: int = Depends(get_company_id)) -> BegesFilingsResponse:
    """Historique des dépôts déclarés + statut d'échéance (+4 ans)."""
    schedule = beges_filings_service.get_schedule(company_id)
    filings = beges_filings_service.list_filings(company_id)
    return BegesFilingsResponse(**schedule.model_dump(), filings=filings)


@router.post("/filings", response_model=BegesFilingOut, status_code=201)
def beges_record_filing(
    payload: BegesFilingCreate,
    user: AuthUser = Depends(require_analyst),
) -> BegesFilingOut:
    """Déclare un dépôt BEGES (upsert par exercice — corrige une saisie antérieure)."""
    return beges_filings_service.record_filing(payload, user.company_id, user.email)


@router.delete("/filings/{filing_id}", status_code=204)
def beges_delete_filing(
    filing_id: int,
    user: AuthUser = Depends(require_admin),
) -> None:
    if not beges_filings_service.delete_filing(filing_id, user.company_id):
        raise HTTPException(status_code=404, detail="Dépôt introuvable")


@router.post("/reminders/run", dependencies=[Depends(require_cron_or_analyst)])
def beges_run_reminders() -> dict[str, Any]:
    """Émet les rappels d'échéance dus (paliers J-180 / J-30 / échéance atteinte).

    Appelé par le cron quotidien (CRON_SERVICE_TOKEN) — parcourt TOUTES les
    organisations ayant un dépôt enregistré. Idempotent au jour le jour : un
    palier déjà notifié ne l'est pas deux fois.
    """
    return beges_filings_service.run_reminders()
