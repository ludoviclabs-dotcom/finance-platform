"""
test_ensure_schema.py — déclencheur paresseux de migrations (fix Vercel serverless).

@vercel/python n'exécute pas les events lifespan ASGI → ensure_schema() est le
seul chemin fiable pour appliquer les migrations en prod. Contrat testé (mocké,
sans DB réelle) :
  - DB absente (mode /tmp)          → no-op, run_migrations JAMAIS appelée
  - sentinelle présente (schéma OK) → run_migrations JAMAIS appelée (court-circuit)
  - sentinelle absente (incomplet)  → run_migrations appelée UNE fois
  - garde process : 2e appel        → court-circuit, aucune I/O
  - échec transitoire               → flag remis à False (retry au cold start suivant)
"""

from __future__ import annotations

import contextlib

import pytest

from db import migrations as m


@pytest.fixture(autouse=True)
def _reset_flag():
    m._schema_ensured = False
    yield
    m._schema_ensured = False


class _Cur:
    def __init__(self, sentinel_present: bool):
        self._sentinel = sentinel_present

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        pass

    def fetchone(self):
        # to_regclass renvoie le nom (schéma présent) ou None (absent)
        return {"t": "public.partner_applications" if self._sentinel else None}


class _Conn:
    def __init__(self, sentinel_present: bool):
        self._sentinel = sentinel_present

    def cursor(self, *a, **k):
        return _Cur(self._sentinel)


def _fake_get_db(sentinel_present: bool):
    @contextlib.contextmanager
    def _cm(company_id=None):
        yield _Conn(sentinel_present)
    return _cm


def test_noop_when_db_unavailable(monkeypatch):
    calls = []
    monkeypatch.setattr(m, "db_available", lambda: False)
    monkeypatch.setattr(m, "run_migrations", lambda: calls.append(1))
    m.ensure_schema()
    assert calls == []


def test_skips_when_sentinel_present(monkeypatch):
    calls = []
    monkeypatch.setattr(m, "db_available", lambda: True)
    monkeypatch.setattr(m, "get_db", _fake_get_db(sentinel_present=True))
    monkeypatch.setattr(m, "run_migrations", lambda: calls.append(1))
    m.ensure_schema()
    assert calls == [], "sentinelle présente → run_migrations ne doit PAS tourner"


def test_runs_migrations_when_schema_incomplete(monkeypatch):
    calls = []
    monkeypatch.setattr(m, "db_available", lambda: True)
    monkeypatch.setattr(m, "get_db", _fake_get_db(sentinel_present=False))
    monkeypatch.setattr(m, "run_migrations", lambda: calls.append(1))
    m.ensure_schema()
    assert calls == [1], "sentinelle absente → run_migrations appelée une fois"


def test_process_guard_prevents_second_run(monkeypatch):
    calls = []
    monkeypatch.setattr(m, "db_available", lambda: True)
    monkeypatch.setattr(m, "get_db", _fake_get_db(sentinel_present=False))
    monkeypatch.setattr(m, "run_migrations", lambda: calls.append(1))
    m.ensure_schema()
    m.ensure_schema()  # 2e appel : flag déjà True
    assert calls == [1], "la garde process doit empêcher un 2e run"


def test_flag_reset_on_failure_allows_retry(monkeypatch):
    def boom():
        raise RuntimeError("Neon indisponible")

    monkeypatch.setattr(m, "db_available", lambda: True)
    monkeypatch.setattr(m, "get_db", _fake_get_db(sentinel_present=False))
    monkeypatch.setattr(m, "run_migrations", boom)
    m.ensure_schema()  # ne doit pas lever
    assert m._schema_ensured is False, "échec → flag remis à False pour retry"
