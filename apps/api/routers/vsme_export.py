"""
routers/vsme_export.py — T3.3 : génération du Rapport VSME (ZIP PDF + Excel).

  POST /vsme/report  — génère et télécharge le pack (PDF + annexe Excel +
                       manifest + CHECKSUMS), enregistré pour /verify.
"""

from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from db.database import db_available, get_db
from routers.auth import require_analyst
from services import vsme_export
from services.auth_service import AuthUser

router = APIRouter()


def _company_name(company_id: int) -> str:
    if not db_available():
        return "Organisation"
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
                row = cur.fetchone()
                return row["name"] if row and row.get("name") else "Organisation"
    except Exception:
        return "Organisation"


@router.post("")
def generate_vsme_report(user: AuthUser = Depends(require_analyst)) -> StreamingResponse:
    try:
        result = vsme_export.build_vsme_report(
            company_id=user.company_id, company_name=_company_name(user.company_id),
        )
    except vsme_export.VsmeExportError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    return StreamingResponse(
        io.BytesIO(result["zip_bytes"]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Package-Hash": result["package_hash"],
            "X-Manifest-Hash": result["manifest_hash"],
        },
    )
