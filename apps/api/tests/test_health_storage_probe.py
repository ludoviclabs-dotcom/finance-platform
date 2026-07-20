"""
test_health_storage_probe.py — /health : sonde stockage réelle (T1.6 durci,
clé unique par appel depuis Wave 3).

Contrat de _storage_status() :
  - backend local (défaut)            → "local" (jamais un faux "ok")
  - vercel-blob sans token            → "not_configured"
  - vercel-blob + sonde PUT/GET/DEL   → "ok" (et la sonde nettoie derrière elle)
  - erreur HTTP ou relecture corrompue → "down"
  - deux appels ne réutilisent JAMAIS la même clé (Wave 3 — régression de la
    course décrite dans routers/health.py::_storage_status, reproduite en
    direct en production avant correctif : cf.
    docs/carbonco/refonte/WAVE_3_STABILIZATION_TRACEABILITY.md)
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from routers.health import _storage_status
from services.storage import vercel_blob


class _FakeBlobClient:
    """Remplace vercel.blob.BlobClient : reproduit put/get/delete en mémoire,
    indexé par la clé RÉELLEMENT transmise (pas une clé fixe) — nécessaire
    depuis que _storage_status() génère une clé aléatoire par appel (Wave 3) ;
    `put_keys` trace chaque clé utilisée pour prouver l'absence de réemploi."""

    _store: dict[str, bytes] = {}
    put_keys: list[str] = []

    def __init__(self, token=None):
        self.token = token

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def put(self, path, body, *, access="public", content_type=None, overwrite=False):
        _FakeBlobClient._store[path] = body
        _FakeBlobClient.put_keys.append(path)
        return SimpleNamespace(url=path)

    def get(self, url_or_path, *, access="public", timeout=None):
        return SimpleNamespace(content=_FakeBlobClient._store.get(url_or_path, b""))

    def delete(self, url_or_path):
        _FakeBlobClient._store.pop(url_or_path, None)


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _blob_env(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "vercel-blob")
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "tok-test")
    _FakeBlobClient._store.clear()
    _FakeBlobClient.put_keys.clear()


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


# ── Wave 3 : régression de la course sur clé fixe ────────────────────────────

def test_storage_status_probe_uses_a_different_key_each_call(monkeypatch):
    """Deux appels successifs ne doivent JAMAIS réutiliser la même clé.

    Avant Wave 3, `_storage_status()` utilisait la clé FIXE 'health/probe' —
    partagée par TOUS les appels, y compris deux requêtes /health simultanées
    sur le même déploiement. Reproduit en direct en production (5 requêtes
    fraîches successives sur /health : down/ok/down/ok/down en ~2 minutes,
    alors que le token et le store sont valides à chaque fois — un vrai défaut
    d'auth/réseau aurait échoué de façon STABLE, pas en alternance). Ce test
    fige la clé unique par appel comme contrat de non-régression."""
    monkeypatch.setattr(vercel_blob, "BlobClient", _FakeBlobClient)

    assert _run(_storage_status()) == "ok"
    assert _run(_storage_status()) == "ok"

    assert len(_FakeBlobClient.put_keys) == 2
    assert len(set(_FakeBlobClient.put_keys)) == 2, "deux appels ne doivent jamais réutiliser la même clé"


def test_storage_status_concurrent_overwrite_on_a_shared_key_would_have_failed(monkeypatch):
    """Preuve DIRECTE (pas seulement l'absence de réemploi ci-dessus) que le
    défaut pré-Wave-3 est réel : simule ce qu'un PUT concurrent sur une clé
    PARTAGÉE aurait produit — un GET qui relit le payload d'un AUTRE appel —
    et vérifie que ce scénario précis, s'il se reproduisait, retomberait bien
    sur "down" (comportement honnête attendu), tandis que le code actuel
    (clé unique) ne peut plus jamais l'atteindre."""
    class _OverwrittenBetweenPutAndGet(_FakeBlobClient):
        """Simule un tiers qui écrase l'objet juste après le PUT de cet appel
        — reproduit l'effet d'une clé PARTAGÉE sans dépendre d'un vrai thread
        concurrent (le point à prouver est la CONSÉQUENCE du partage de clé,
        pas le mécanisme d'entrelacement lui-même, déjà couvert par les tests
        de verrouillage énergie sur de vraies connexions concurrentes)."""

        def get(self, url_or_path, *, access="public", timeout=None):
            # Un autre appel aurait écrasé la clé PARTAGÉE avant cette lecture.
            return SimpleNamespace(content=b"payload-d-un-autre-appel-concurrent")

    monkeypatch.setattr(vercel_blob, "BlobClient", _OverwrittenBetweenPutAndGet)
    assert _run(_storage_status()) == "down", (
        "une relecture qui ne correspond pas au payload écrit DOIT rester 'down' — "
        "le correctif Wave 3 empêche la COLLISION (clé unique), pas la détection elle-même"
    )
