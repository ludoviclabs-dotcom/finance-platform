"""
routers/questionnaire.py — T5.5 : export « réponses prêtes » questionnaires.

  GET  /questionnaire/catalogs  — questionnaires disponibles + nb de questions
  POST /questionnaire/export    — CSV des réponses (?questionnaire=cdp|ecovadis)
"""

from __future__ import annotations

import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from routers.auth import get_current_user
from services import questionnaire_service
from services.auth_service import AuthUser

router = APIRouter()


@router.get("/catalogs")
def list_catalogs(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return questionnaire_service.catalogs()


@router.post("/export")
def export_csv(questionnaire: str | None = None,
               user: AuthUser = Depends(get_current_user)) -> StreamingResponse:
    valid = {c["key"] for c in questionnaire_service.catalogs()["questionnaires"]}
    if questionnaire and questionnaire not in valid:
        raise HTTPException(400, detail=f"Questionnaire invalide. Valeurs : {sorted(valid)}")
    rows = questionnaire_service.build_answers(user.company_id, questionnaire=questionnaire)
    csv_bytes = questionnaire_service.build_csv(rows)
    name = f"reponses-{questionnaire or 'tous'}.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
