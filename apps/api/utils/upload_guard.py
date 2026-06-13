"""
upload_guard.py — Durcissement des uploads Excel (T1.5 du PLAN_ACTION_CARBONCO).

Contrôles AVANT openpyxl :
  - taille max 15 Mo
  - magic bytes xlsx (`PK\\x03\\x04` — un .xlsx est un ZIP)
  - garde anti zip-bomb : nombre de feuilles, taille décompressée, ratio de
    décompression.

Lève une HTTPException (413/400) en cas de violation.
"""

from __future__ import annotations

import io
import zipfile

from fastapi import HTTPException

MAX_UPLOAD_BYTES = 15 * 1024 * 1024          # 15 Mo
MAX_SHEETS = 60                               # nombre de feuilles
MAX_UNCOMPRESSED_BYTES = 300 * 1024 * 1024    # ~ garde-fou « 2 M cellules »
MAX_DECOMPRESS_RATIO = 100                     # ratio décompressé / compressé
_RATIO_FLOOR_BYTES = 50 * 1024 * 1024          # le ratio n'est jugé qu'au-delà de ce seuil

XLSX_MAGIC = b"PK\x03\x04"


def check_upload_bytes(contents: bytes, filename: str | None = None) -> None:
    """Valide un upload Excel brut. Lève HTTPException si non conforme."""
    size = len(contents)
    if size == 0:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux ({size // 1024 // 1024} Mo). Maximum {MAX_UPLOAD_BYTES // 1024 // 1024} Mo.",
        )
    if contents[:4] != XLSX_MAGIC:
        raise HTTPException(
            status_code=400,
            detail="Fichier non reconnu comme .xlsx (signature ZIP absente).",
        )

    try:
        zf = zipfile.ZipFile(io.BytesIO(contents))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Archive xlsx corrompue.") from exc

    total_uncompressed = 0
    total_compressed = 0
    sheets = 0
    for info in zf.infolist():
        total_uncompressed += info.file_size
        total_compressed += info.compress_size
        if info.filename.startswith("xl/worksheets/") and info.filename.endswith(".xml"):
            sheets += 1

    if sheets > MAX_SHEETS:
        raise HTTPException(status_code=400, detail=f"Trop de feuilles ({sheets} > {MAX_SHEETS}).")
    if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
        raise HTTPException(status_code=400, detail="Contenu décompressé trop volumineux (zip-bomb suspectée).")
    if (
        total_compressed > 0
        and total_uncompressed > _RATIO_FLOOR_BYTES
        and total_uncompressed / total_compressed > MAX_DECOMPRESS_RATIO
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Ratio de décompression suspect ({total_uncompressed / total_compressed:.0f}× > {MAX_DECOMPRESS_RATIO}×).",
        )
