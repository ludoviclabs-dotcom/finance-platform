"""
artifact_service.py — pièces brutes du noyau de preuve (PR-03).

Aucun nouvel uploader Blob : réutilise `services.storage.get_storage()`
(même `StorageAdapter` que T2.1 — local en dev, Vercel Blob privé en prod).
La clé de stockage est propre à ce module (`intelligence/{company}/{sha256}.
{ext}`), distincte de `evidence_key()` (T2.1, adressée par `fact_id`) — ce
noyau rattache une pièce à une release et/ou des observations, pas à un fact.

Pas d'endpoint d'upload public dans PR-03 (mission) : ce service est appelé
directement (tests, futurs adaptateurs), sans route HTTP dédiée pour l'instant.
"""

from __future__ import annotations

import hashlib
from typing import Any

from db.database import get_db
from models.intelligence import ArtifactResponse, ArtifactSensitivity
from services.storage import get_storage

# Isolation en profondeur (cf. docstring de source_service) : lecture propre au
# tenant OU globale.
_READ_SCOPE = "(company_id = %s OR company_id IS NULL)"


class ArtifactError(Exception):
    """Erreur métier des artefacts de preuve (introuvable, release hors périmètre…)."""


def _row_to_response(row: dict[str, Any]) -> ArtifactResponse:
    return ArtifactResponse(**row)


def _artifact_key(company_id: int, sha256: str, ext: str) -> str:
    return f"intelligence/{int(company_id)}/{sha256.lower()}.{ext.lstrip('.').lower() or 'bin'}"


def register_artifact(
    *,
    company_id: int,
    data: bytes,
    filename: str,
    mime_type: str,
    source_release_id: int | None = None,
    page_reference: str | None = None,
    table_reference: str | None = None,
    cell_reference: str | None = None,
    excerpt: str | None = None,
    sensitivity: ArtifactSensitivity = "internal",
    created_by: int | None = None,
) -> ArtifactResponse:
    """Stocke la pièce (content-addressed par SHA-256) puis enregistre ses
    métadonnées. Si `source_release_id` est fourni, vérifie qu'elle existe et
    est accessible à ce tenant (RLS sur la connexion `company_id`) — une
    pièce ne peut jamais être rattachée à une release d'un autre tenant."""
    sha256 = hashlib.sha256(data).hexdigest()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    key = _artifact_key(company_id, sha256, ext)
    stored_ref = get_storage().put(key, data, mime_type)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if source_release_id is not None:
                cur.execute(
                    f"SELECT id FROM source_releases WHERE id = %s AND {_READ_SCOPE}",
                    (source_release_id, company_id),
                )
                if cur.fetchone() is None:
                    raise ArtifactError(f"Release '{source_release_id}' introuvable ou hors périmètre.")
            cur.execute(
                """
                INSERT INTO evidence_artifacts
                    (company_id, source_release_id, blob_key, sha256, filename, mime_type,
                     size_bytes, page_reference, table_reference, cell_reference, excerpt,
                     sensitivity, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, source_release_id, stored_ref, sha256, filename, mime_type,
                    len(data), page_reference, table_reference, cell_reference, excerpt,
                    sensitivity, created_by,
                ),
            )
            row = cur.fetchone()
    return _row_to_response(row)


def get_artifact(*, company_id: int, artifact_id: int) -> ArtifactResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM evidence_artifacts WHERE id = %s AND {_READ_SCOPE}",
                (artifact_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise ArtifactError(f"Artefact '{artifact_id}' introuvable.")
    return _row_to_response(row)
