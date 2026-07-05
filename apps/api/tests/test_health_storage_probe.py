"""
test_health_storage_probe.py — /health : sonde stockage réelle (T1.6 durci).

Contrat de _storage_status() :
  - backend local (défaut)            → "local" (jamais un faux "ok")
  - vercel-blob sans token            → "not_configured"
  - vercel-blob + sonde PUT/GET/DEL   → "ok" (et la sonde nettoie derrière elle)
  - erreur HTTP ou relecture corrompue → "down"
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from routers.health import _storage_status
from services.storage import vercel_blob

_PROBE_URL = "https://store123.private.blob.vercel-storage.com/health/probe"


class _FakeBlobClient:
    """Remplace vercel.blob.BlobClient : reproduit put/get/delete en mémoire."""

    _store: dict[str, bytes] = {}

    def __init__(self, token=None):
        self.token = token

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def put(self, path, body, *, access="public", content_type=None, overwrite=False):
        _FakeBlobClient._store[_PROBE_URL] = body
        return SimpleNamespace(url=_PROBE_URL)

    def get(self, url_or_path, *, access="public", timeout=None):
        return SimpleNamespace(content=_FakeBlobClient._store.get(_PROBE_URL, b""))

    def delete(self, url_or_path):
        _FakeBlobClient._store.pop(_PROBE_URL, None)


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _blob_env(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "vercel-blob")
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "tok-test")
    _FakeBlobClient._store.clear()


def test_storage_status_local(monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    assert _run(_storage_status()) == "local"


def test_storage_status_not_configured(monkeypatch):
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    assert _run(_storage_status()) == "not_configured"


def test_storage_status_probe_ok(monkeypatch):
    monkeypatch.setattr(vercel_blob, "BlobClient", _FakeBlobClient)

    assert _run(_storage_status()) == "ok"
    assert _FakeBlobClient._store == {}  # la sonde a supprimé son objet


def test_storage_status_down_on_http_error(monkeypatch):
    class _Boom(_FakeBlobClient):
        def put(self, path, body, *, access="public", content_type=None, overwrite=False):
            raise vercel_blob.BlobError("token invalide (401)")

    monkeypatch.setattr(vercel_blob, "BlobClient", _Boom)
    assert _run(_storage_status()) == "down"


def test_storage_status_down_on_corrupt_readback(monkeypatch):
    class _Corrupt(_FakeBlobClient):
        def get(self, url_or_path, *, access="public", timeout=None):
            return SimpleNamespace(content=b"garbage")

    monkeypatch.setattr(vercel_blob, "BlobClient", _Corrupt)
    assert _run(_storage_status()) == "down"


def test_storage_status_down_on_exception(monkeypatch):
    class _Crash(_FakeBlobClient):
        def put(self, path, body, *, access="public", content_type=None, overwrite=False):
            raise RuntimeError("réseau coupé")

    monkeypatch.setattr(vercel_blob, "BlobClient", _Crash)
    assert _run(_storage_status()) == "down"
