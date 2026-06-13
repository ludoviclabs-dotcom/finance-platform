"""
routers/beges.py — T4.2 : export BEGES réglementaire v5 (France).

  GET  /beges/status  — totaux + ventilation 6×22 + éligibilité
  POST /beges/export  — génère et télécharge le ZIP (PDF + Excel)
"""

from __future__ import annotations

import io
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from db.database import db_available, get_db
from routers.auth import get_current_user, require_analyst
from services import beges_export
from services.auth_service import AuthUser

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
