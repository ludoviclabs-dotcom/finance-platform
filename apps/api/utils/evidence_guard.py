"""
evidence_guard.py — Durcissement des uploads de pièces justificatives (T2.1).

Une pièce justificative est un PDF, PNG ou JPEG de 5 Mo maximum. Contrôles AVANT
tout stockage : taille, et type réel via magic bytes (on ne fait pas confiance à
l'extension ni au Content-Type déclaré). Retourne l'extension canonique et le
type MIME détecté ; lève une HTTPException (400/413) en cas de violation.
"""

from __future__ import annotations

from fastapi import HTTPException

# Aligné sur services.storage.base.MAX_OBJECT_BYTES (5 Mo).
MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

# (magic bytes, extension canonique, type MIME)
_SIGNATURES: list[tuple[bytes, str, str]] = [
    (b"%PDF-", "pdf", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
]


def check_evidence_bytes(contents: bytes, filename: str | None = None) -> tuple[str, str]:
    """Valide une pièce justificative brute.

    Retourne (extension, type_mime). Lève HTTPException si non conforme.
    """
    size = len(contents)
    if size == 0:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    if size > MAX_EVIDENCE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Pièce trop volumineuse ({size // 1024 // 1024} Mo). "
                f"Maximum {MAX_EVIDENCE_BYTES // 1024 // 1024} Mo."
            ),
        )
    for magic, ext, mime in _SIGNATURES:
        if contents.startswith(magic):
            return ext, mime
    raise HTTPException(
        status_code=400,
        detail="Type de pièce non supporté — formats acceptés : PDF, PNG, JPEG.",
    )
