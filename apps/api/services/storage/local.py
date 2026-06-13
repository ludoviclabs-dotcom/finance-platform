"""
storage/local.py — Backend de stockage local (dev). URL signées HMAC servies par
routers/files.py (GET /files/{key}?exp=&sig=).
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from pathlib import Path

from .base import MAX_OBJECT_BYTES, StorageError


class LocalStorage:
    def __init__(self, root: str | None = None, secret: str | None = None):
        self.root = Path(root or os.environ.get("STORAGE_LOCAL_PATH", ".data/storage")).resolve()
        self.secret = (secret or os.environ.get("SIGNED_URL_SECRET", "dev-signing-secret")).encode()

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        # Anti path-traversal : la clé résolue doit rester sous root.
        if os.path.commonpath([str(p), str(self.root)]) != str(self.root):
            raise StorageError("Clé hors du périmètre de stockage.")
        return p

    def put(self, key: str, data: bytes, content_type: str | None = None) -> str:
        if len(data) > MAX_OBJECT_BYTES:
            raise StorageError(f"Pièce trop volumineuse ({len(data)} o > {MAX_OBJECT_BYTES} o).")
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        p = self._path(key)
        if not p.exists():
            raise StorageError(f"Objet introuvable : {key}")
        return p.read_bytes()

    def delete(self, key: str) -> None:
        p = self._path(key)
        if p.exists():
            p.unlink()

    def _sign(self, key: str, exp: int) -> str:
        return hmac.new(self.secret, f"{key}:{exp}".encode(), hashlib.sha256).hexdigest()

    def signed_url(self, key: str, expires: int = 900) -> str:
        exp = int(time.time()) + expires
        return f"/files/{key}?exp={exp}&sig={self._sign(key, exp)}"

    def verify(self, key: str, exp: int, sig: str) -> bool:
        if int(exp) < int(time.time()):
            return False
        return hmac.compare_digest(self._sign(key, int(exp)), sig)
