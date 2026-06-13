"""
storage — Stockage objet abstrait (T1.6). get_storage() résout le backend selon
STORAGE_BACKEND : local (défaut) | vercel-blob | r2 (différé — D4).
"""

from __future__ import annotations

import os

from .base import (
    MAX_OBJECT_BYTES,
    StorageAdapter,
    StorageError,
    evidence_key,
)
from .local import LocalStorage

__all__ = [
    "MAX_OBJECT_BYTES",
    "StorageAdapter",
    "StorageError",
    "evidence_key",
    "LocalStorage",
    "get_storage",
]


def get_storage() -> StorageAdapter:
    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend == "local":
        return LocalStorage()
    if backend == "vercel-blob":
        from .vercel_blob import VercelBlobStorage
        return VercelBlobStorage()
    if backend == "r2":
        raise NotImplementedError("Backend r2 — différé (décision D4).")
    raise StorageError(f"STORAGE_BACKEND inconnu : {backend}")
