"""
routers/imports.py — T5.4 : adaptateurs d'import fichiers (AWS/GCP/Qonto).

  POST /imports/upload/{import_type}  — parse + screen un CSV → screening `pending`
  GET  /imports                       — liste des screenings (filtre ?type=)
  GET  /imports/{id}                  — détail d'un screening
  POST /imports/{id}/emit             — valide et émet les facts Scope 3 [gate]

RIEN n'est émis à l'upload : seul /emit (validation analyste) écrit dans la chaîne
(même garde que le FEC, T4.3). import_type ∈ aws | gcp | qonto.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from db.database import db_available
from routers.auth import get_current_user, require_analyst
from services import csv_import_parsers as parsers
from services import import_screening_service as iss
from services.auth_service import AuthUser

router = APIRouter()

MAX_IMPORT_BYTES = 16 * 1024 * 1024  # aligné sur MAX_BODY_SIZE

_PARSERS = {
    "aws": (parsers.aws_ccft_parse, iss.screen_aws_ccft),
    "gcp": (parsers.gcp_carbon_parse, iss.screen_gcp_carbon),
    "qonto": (parsers.qonto_parse, iss.screen_qonto),
}


@router.post("/upload/{import_type}")
async def upload_import(import_type: str, file: UploadFile = File(...),
                        user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    if import_type not in _PARSERS:
        raise HTTPException(400, detail=f"Type invalide. Valeurs : {sorted(_PARSERS)}")
    data = await file.read()
    if not data:
        raise HTTPException(400, detail="Fichier vide.")
    if len(data) > MAX_IMPORT_BYTES:
        raise HTTPException(413, detail=f"Fichier trop volumineux (max {MAX_IMPORT_BYTES // 1024 // 1024} Mo).")

    parse_fn, screen_fn = _PARSERS[import_type]
    try:
        parsed = parse_fn(data)
    except parsers.ImportParseError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    result = screen_fn(parsed["rows"])
    parsed_meta = {k: parsed[k] for k in parsed if k != "rows"}

    if not db_available():
        return {"persisted": False, "import_type": import_type, "filename": file.filename,
                "parsed": parsed_meta, "screening": result}
    created = iss.create_import_screening(
        company_id=user.company_id, import_type=import_type,
        filename=file.filename or f"{import_type}.csv", parsed=parsed_meta, result=result,
    )
    return {"persisted": True, "id": created["id"], "status": "pending",
            "import_type": import_type, "filename": file.filename,
            "parsed": parsed_meta, "screening": result}


@router.get("")
def list_imports(type: str | None = None, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"imports": iss.list_import_screenings(user.company_id, import_type=type)}


@router.get("/{screening_id}")
def get_import(screening_id: int, user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    screening = iss.get_import_screening(company_id=user.company_id, screening_id=screening_id)
    if screening is None:
        raise HTTPException(404, detail="Screening introuvable.")
    return screening


@router.post("/{screening_id}/emit")
def emit_import(screening_id: int, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    try:
        return iss.emit_import_facts(company_id=user.company_id, screening_id=screening_id,
                                     user_email=user.email)
    except iss.ImportScreeningError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
