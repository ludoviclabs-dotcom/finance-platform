"""
test_health_storage_probe.py — /health : sonde stockage réelle (T1.6 durci).

Contrat de _storage_status() :
  - backend local (défaut)            → "local" (jamais un faux "ok")
  - vercel-blob sans token            → "not_configured"
  - vercel-blob + sonde PUT/GET/DEL   → "ok" (et la sonde nettoie derrière elle)
  - erreur HTTP ou relecture corrompue → "down"
"""

from __future__ import annotations

import pytest

from routers.health import _storage_status
from services.storage import vercel_blob

_PROBE_URL = "https://blob.vercel-storage.com/health/probe"


class _FakeResp:
    def __init__(self, status_code: int, payload: dict | None = None, content: bytes = b""):
        self.status_code = status_code
        self._payload = payload or {}
        self.content = content
        self.text = ""

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _blob_env(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "vercel-blob")
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "tok-test")


def test_storage_status_local(monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    assert _storage_status() == "local"


def test_storage_status_not_configured(monkeypatch):
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    assert _storage_status() == "not_configured"


def test_storage_status_probe_ok(monkeypatch):
    store: dict[str, bytes] = {}

    def fake_put(url, content=b"", headers=None, params=None, timeout=None):
        store[_PROBE_URL] = content
        return _FakeResp(200, {"url": _PROBE_URL})

    def fake_get(url, headers=None, timeout=None):
        return _FakeResp(200, content=store.get(_PROBE_URL, b""))

    def fake_post(url, headers=None, json=None, timeout=None):  # delete
        store.pop(_PROBE_URL, None)
        return _FakeResp(200)

    monkeypatch.setattr(vercel_blob.httpx, "put", fake_put)
    monkeypatch.setattr(vercel_blob.httpx, "get", fake_get)
    monkeypatch.setattr(vercel_blob.httpx, "post", fake_post)

    assert _storage_status() == "ok"
    assert store == {}  # la sonde a supprimé son objet


def test_storage_status_down_on_http_error(monkeypatch):
    monkeypatch.setattr(vercel_blob.httpx, "put", lambda *a, **k: _FakeResp(401))
    assert _storage_status() == "down"


def test_storage_status_down_on_corrupt_readback(monkeypatch):
    monkeypatch.setattr(
        vercel_blob.httpx, "put", lambda *a, **k: _FakeResp(200, {"url": _PROBE_URL})
    )
    monkeypatch.setattr(vercel_blob.httpx, "get", lambda *a, **k: _FakeResp(200, content=b"garbage"))
    monkeypatch.setattr(vercel_blob.httpx, "post", lambda *a, **k: _FakeResp(200))
    assert _storage_status() == "down"


def test_storage_status_down_on_exception(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("réseau coupé")

    monkeypatch.setattr(vercel_blob.httpx, "put", boom)
    assert _storage_status() == "down"
