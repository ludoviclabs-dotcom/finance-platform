"""
routers/files.py — Service des pièces stockées en local via URL signée HMAC
(T1.6). GET /files/{key}?exp=&sig= — vérifie la signature et l'expiration.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from services.storage.base import StorageError
from services.storage.local import LocalStorage

router = APIRouter()


@router.get("/files/{key:path}")
async def serve_file(
    key: str,
    exp: int = Query(..., description="Horodatage d'expiration"),
    sig: str = Query(..., description="Signature HMAC"),
) -> Response:
    storage = LocalStorage()
    if not storage.verify(key, exp, sig):
        raise HTTPException(status_code=403, detail="URL signée invalide ou expirée.")
    try:
        data = storage.get(key)
    except StorageError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(content=data, media_type="application/octet-stream")
