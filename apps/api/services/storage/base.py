"""
storage/base.py — Interface de stockage objet abstraite (T1.6).

Backends : local (dev), vercel-blob (prod, REST sans SDK), r2 (différé — D4).
Pièces : 5 Mo max. Clés : org/{company_id}/evidence/{fact_id}/{sha256}.{ext}
"""

from __future__ import annotations

import re
from typing import Protocol, runtime_checkable

MAX_OBJECT_BYTES = 5 * 1024 * 1024  # 5 Mo


class StorageError(Exception):
    """Erreur de stockage (objet trop gros, clé invalide, backend en erreur…)."""


_KEY_RE = re.compile(r"^org/\d+/evidence/\d+/[0-9a-f]{64}\.[A-Za-z0-9]{1,8}$")


def evidence_key(company_id: int, fact_id: int, sha256: str, ext: str) -> str:
    """Construit et valide une clé de pièce justificative."""
    clean_ext = ext.lstrip(".").lower()
    key = f"org/{int(company_id)}/evidence/{int(fact_id)}/{sha256.lower()}.{clean_ext}"
    if not _KEY_RE.match(key):
        raise StorageError(f"Clé de stockage invalide : {key}")
    return key


@runtime_checkable
class StorageAdapter(Protocol):
    def put(self, key: str, data: bytes, content_type: str | None = None) -> str: ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...
    def signed_url(self, key: str, expires: int = 900) -> str: ...
