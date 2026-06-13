"""
routers/fec.py — T4.3 : import FEC → screening Scope 3 monétaire.

  POST /fec/upload     — parse + screen un FEC → screening `pending` (analyste)
  GET  /fec/{id}       — résultat du screening
  POST /fec/{id}/emit  — valide et émet les facts Scope 3 (analyste) [gate]

RIEN n'est émis à l'upload : seul /emit (validation humaine) écrit dans la chaîne.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from db.database import db_available
from routers.auth import get_current_user, require_analyst
from services import fec_parser, fec_screening_service
from services.auth_service import AuthUser

router = APIRouter()

MAX_FEC_BYTES = 16 * 1024 * 1024  # aligné sur MAX_BODY_SIZE


@router.post("/upload")
async def upload_fec(file: UploadFile = File(...), user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    data = await file.read()
    if not data:
        raise HTTPException(400, detail="Fichier vide.")
    if len(data) > MAX_FEC_BYTES:
        raise HTTPException(413, detail=f"FEC trop volumineux (max {MAX_FEC_BYTES // 1024 // 1024} Mo).")
    try:
        parsed = fec_parser.parse_fec(data)
    except fec_parser.FecError as exc:
        raise HTTPException(400, detail=str(exc)) from exc

    result = fec_screening_service.screen(parsed["rows"])
    if not db_available():
        # Pas de persistance possible : on renvoie le screening sans l'enregistrer.
        return {"persisted": False, "filename": file.filename, "parsed": {k: parsed[k] for k in parsed if k != "rows"},
                "screening": result}
    created = fec_screening_service.create_screening(
        company_id=user.company_id, filename=file.filename or "fec.txt", parsed=parsed, result=result,
    )
    return {
        "persisted": True, "id": created["id"], "status": "pending",
        "filename": file.filename, "parsed": {k: parsed[k] for k in parsed if k != "rows"},
        "screening": result,
    }


@router.get("/{screening_id}")
def get_fec_screening(screening_id: int, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    screening = fec_screening_service.get_screening(company_id=user.company_id, screening_id=screening_id)
    if screening is None:
        raise HTTPException(404, detail="Screening introuvable.")
    return screening


@router.post("/{screening_id}/emit")
def emit_fec_facts(screening_id: int, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    try:
        return fec_screening_service.emit_facts(
            company_id=user.company_id, screening_id=screening_id, user_email=user.email,
        )
    except fec_screening_service.ScreeningError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
