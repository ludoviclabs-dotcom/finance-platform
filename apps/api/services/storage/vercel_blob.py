"""
storage/vercel_blob.py — Backend Vercel Blob via REST pur (httpx), SANS SDK
(aucune dépendance payante). Requiert BLOB_READ_WRITE_TOKEN.

API : https://vercel.com/docs/storage/vercel-blob — PUT renvoie {url, ...} ;
les URL Blob sont publiques (non devinables). Lève une erreur claire si quota/401.
"""

from __future__ import annotations

import os

import httpx

from .base import MAX_OBJECT_BYTES, StorageError

_BASE = "https://blob.vercel-storage.com"


class VercelBlobStorage:
    def __init__(self, token: str | None = None, timeout: float = 30.0):
        self.token = token or os.environ.get("BLOB_READ_WRITE_TOKEN")
        if not self.token:
            raise StorageError("BLOB_READ_WRITE_TOKEN manquant pour le backend vercel-blob.")
        # 30 s par défaut (uploads) ; la sonde /health passe 5 s pour ne pas
        # bloquer le monitoring si l'API Blob est dégradée.
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {"authorization": f"Bearer {self.token}"}

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        if len(data) > MAX_OBJECT_BYTES:
            raise StorageError(f"Pièce trop volumineuse ({len(data)} o > {MAX_OBJECT_BYTES} o).")
        headers = self._headers()
        if content_type:
            headers["content-type"] = content_type
        resp = httpx.put(
            f"{_BASE}/{key}", content=data, headers=headers,
            params={"addRandomSuffix": "0"}, timeout=self.timeout,
        )
        if resp.status_code == 401:
            raise StorageError("Vercel Blob : token invalide (401).")
        if resp.status_code == 403:
            raise StorageError("Vercel Blob : quota dépassé ou accès refusé (403).")
        if resp.status_code >= 400:
            raise StorageError(f"Vercel Blob put {resp.status_code} : {resp.text[:200]}")
        return resp.json().get("url", key)

    def get(self, key: str) -> bytes:
        # key est ici l'URL publique renvoyée par put(), ou une clé relative.
        url = key if key.startswith("http") else f"{_BASE}/{key}"
        resp = httpx.get(url, headers=self._headers(), timeout=self.timeout)
        if resp.status_code >= 400:
            raise StorageError(f"Vercel Blob get {resp.status_code} pour {key}.")
        return resp.content

    def delete(self, key: str) -> None:
        resp = httpx.post(
            f"{_BASE}/delete", headers=self._headers(),
            json={"urls": [key]}, timeout=self.timeout,
        )
        if resp.status_code >= 400:
            raise StorageError(f"Vercel Blob delete {resp.status_code} pour {key}.")

    def signed_url(self, key: str, expires: int = 900) -> str:
        # Les URL Blob sont déjà publiques et non devinables.
        return key if key.startswith("http") else f"{_BASE}/{key}"
