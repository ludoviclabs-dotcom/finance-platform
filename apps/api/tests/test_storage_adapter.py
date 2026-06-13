"""
test_storage_adapter.py — T1.6 : StorageAdapter (local réel + vercel-blob mocké).
"""

from __future__ import annotations

import hashlib

import pytest

from services.storage import StorageError, evidence_key, get_storage
from services.storage.base import MAX_OBJECT_BYTES
from services.storage.local import LocalStorage

_SHA = hashlib.sha256(b"x").hexdigest()


# ── evidence_key ─────────────────────────────────────────────────────────────

def test_evidence_key_valid():
    key = evidence_key(1, 42, _SHA, "pdf")
    assert key == f"org/1/evidence/42/{_SHA}.pdf"


def test_evidence_key_invalid_sha():
    with pytest.raises(StorageError):
        evidence_key(1, 42, "tooshort", "pdf")


# ── LocalStorage ─────────────────────────────────────────────────────────────

def test_local_put_get_delete(tmp_path):
    s = LocalStorage(root=str(tmp_path), secret="test-secret")
    key = evidence_key(1, 1, _SHA, "txt")
    s.put(key, b"hello")
    assert s.get(key) == b"hello"
    s.delete(key)
    with pytest.raises(StorageError):
        s.get(key)


def test_local_signed_url_and_verify(tmp_path):
    s = LocalStorage(root=str(tmp_path), secret="test-secret")
    key = evidence_key(1, 2, _SHA, "txt")
    url = s.signed_url(key, expires=900)
    assert url.startswith(f"/files/{key}?exp=")
    # extraire exp + sig
    qs = url.split("?", 1)[1]
    params = dict(p.split("=", 1) for p in qs.split("&"))
    assert s.verify(key, int(params["exp"]), params["sig"]) is True
    # signature falsifiée
    assert s.verify(key, int(params["exp"]), "deadbeef") is False
    # expirée
    assert s.verify(key, 1, s._sign(key, 1)) is False


def test_local_rejects_oversize(tmp_path):
    s = LocalStorage(root=str(tmp_path), secret="x")
    key = evidence_key(1, 3, _SHA, "bin")
    with pytest.raises(StorageError):
        s.put(key, b"0" * (MAX_OBJECT_BYTES + 1))


# ── get_storage / backends ───────────────────────────────────────────────────

def test_get_storage_default_local(monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    assert isinstance(get_storage(), LocalStorage)


def test_get_storage_r2_not_implemented(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "r2")
    with pytest.raises(NotImplementedError):
        get_storage()


# ── VercelBlobStorage (mocké) ────────────────────────────────────────────────

class _FakeResp:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text
        self.content = b"blobdata"

    def json(self):
        return self._payload


def test_vercel_blob_put_ok(monkeypatch):
    from services.storage import vercel_blob

    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "tok")
    monkeypatch.setattr(
        vercel_blob.httpx, "put",
        lambda *a, **k: _FakeResp(200, {"url": "https://blob.vercel-storage.com/org/1/x.pdf"}),
    )
    s = vercel_blob.VercelBlobStorage()
    url = s.put(evidence_key(1, 9, _SHA, "pdf"), b"data", "application/pdf")
    assert url.startswith("https://blob.vercel-storage.com/")


def test_vercel_blob_401(monkeypatch):
    from services.storage import vercel_blob

    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "tok")
    monkeypatch.setattr(vercel_blob.httpx, "put", lambda *a, **k: _FakeResp(401, text="unauthorized"))
    s = vercel_blob.VercelBlobStorage()
    with pytest.raises(StorageError):
        s.put(evidence_key(1, 9, _SHA, "pdf"), b"data")


def test_vercel_blob_requires_token(monkeypatch):
    from services.storage import vercel_blob

    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    with pytest.raises(StorageError):
        vercel_blob.VercelBlobStorage()
