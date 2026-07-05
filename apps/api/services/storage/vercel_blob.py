"""
storage/vercel_blob.py — Backend Vercel Blob via le SDK officiel `vercel`
(paquet PyPI "vercel", module vercel.blob). Requiert BLOB_READ_WRITE_TOKEN.

Le store Vercel de ce projet est configuré en accès "Private" : tout objet
est uploadé/lu avec access="private" (jamais "public", qui est refusé par un
store privé — HTTP 400 "Cannot use public access on a private store"). Les
URL renvoyées (<store-id>.private.blob.vercel-storage.com/...) exigent le
token en en-tête Authorization sur CHAQUE lecture — elles ne sont donc PAS
directement utilisables par un navigateur. Voir
https://vercel.com/docs/vercel-blob/private-storage.

Avant ce fichier, le backend appelait REST à la main en supposant un store
public (aucun access envoyé) : ça marche uniquement contre un store Public,
et échoue systématiquement (400) contre un store Private comme celui-ci.
"""

from __future__ import annotations

import os

from vercel.blob import BlobClient
from vercel.blob.errors import BlobError

from .base import MAX_OBJECT_BYTES, StorageError

_ACCESS = "private"


class VercelBlobStorage:
    def __init__(self, token: str | None = None, timeout: float = 30.0):
        self.token = token or os.environ.get("BLOB_READ_WRITE_TOKEN")
        if not self.token:
            raise StorageError("BLOB_READ_WRITE_TOKEN manquant pour le backend vercel-blob.")
        # NB : BlobClient() ne permet un timeout que sur get() (30 s par
        # défaut sinon). put()/delete() n'exposent pas ce paramètre côté SDK.
        # La sonde /health (5 s) borne donc l'appel dans son ensemble depuis
        # l'extérieur via asyncio.wait_for — voir routers/health.py.
        self.timeout = timeout

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        if len(data) > MAX_OBJECT_BYTES:
            raise StorageError(f"Pièce trop volumineuse ({len(data)} o > {MAX_OBJECT_BYTES} o).")
        try:
            with BlobClient(token=self.token) as client:
                result = client.put(
                    key, data,
                    access=_ACCESS,
                    content_type=content_type,
                    overwrite=True,
                )
            return result.url
        except BlobError as exc:
            raise StorageError(f"Vercel Blob put : {exc}") from exc

    def get(self, key: str) -> bytes:
        # key est ici l'URL renvoyée par put(), ou une clé relative.
        try:
            with BlobClient(token=self.token) as client:
                result = client.get(key, access=_ACCESS, timeout=self.timeout)
            return result.content
        except BlobError as exc:
            raise StorageError(f"Vercel Blob get pour {key} : {exc}") from exc

    def delete(self, key: str) -> None:
        try:
            with BlobClient(token=self.token) as client:
                client.delete(key)
        except BlobError as exc:
            raise StorageError(f"Vercel Blob delete pour {key} : {exc}") from exc

    def signed_url(self, key: str, expires: int = 900) -> str:
        # Store privé : cette URL exige le token en Authorization, un
        # navigateur ne peut donc pas la charger directement (contrairement
        # à un store Public). La renvoyer telle quelle tromperait l'appelant
        # (evidence_service.list_evidence) en lui faisant croire à un lien
        # utilisable. On échoue explicitement — list_evidence() traite déjà
        # ça en best-effort et renvoie url=None. Un routeur de téléchargement
        # authentifié (façon routers/files.py, mais avec vérif company_id)
        # reste à construire pour exposer ces pièces côté navigateur.
        raise StorageError(
            "signed_url indisponible en mode vercel-blob (store Private) : "
            "nécessite un endpoint serveur authentifié, pas une URL directe."
        )
