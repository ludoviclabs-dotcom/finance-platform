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

# Suffixe de clé/URL — matche aussi bien une clé relative (local) qu'une URL
# Blob complète (vercel-blob : <host>/org/{cid}/evidence/{fid}/{sha}.{ext}),
# la partie org/... étant toujours en fin de chemin dans les deux cas.
_KEY_SUFFIX_RE = re.compile(r"org/(\d+)/evidence/(\d+)/([0-9a-f]{64})\.([A-Za-z0-9]{1,8})$")


def evidence_key(company_id: int, fact_id: int, sha256: str, ext: str) -> str:
    """Construit et valide une clé de pièce justificative."""
    clean_ext = ext.lstrip(".").lower()
    key = f"org/{int(company_id)}/evidence/{int(fact_id)}/{sha256.lower()}.{clean_ext}"
    if not _KEY_RE.match(key):
        raise StorageError(f"Clé de stockage invalide : {key}")
    return key


def parse_evidence_key(key: str) -> tuple[int, int, str, str] | None:
    """Extrait (company_id, fact_id, sha256, ext) d'une storage_key ou d'une URL Blob.

    Sert de garde-fou anti-IDOR au moment du téléchargement : la storage_key
    fait foi sur la company propriétaire, indépendamment du filtre déjà
    appliqué en amont (ex. get_trail). Retourne None si le format ne
    correspond pas (clé absente/corrompue → l'appelant doit refuser l'accès).
    """
    m = _KEY_SUFFIX_RE.search(key)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), m.group(3), m.group(4)


# Type MIME par extension — pièces justificatives (T2.1) : PDF/PNG/JPEG uniquement
# (cf. utils/evidence_guard.py). Source unique pour routers/files.py (backend
# local) et evidence_service.get_evidence_file() (repli si content_type absent).
MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


@runtime_checkable
class StorageAdapter(Protocol):
    def put(self, key: str, data: bytes, content_type: str | None = None) -> str: ...
    def get(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...
    def signed_url(self, key: str, expires: int = 900) -> str: ...
