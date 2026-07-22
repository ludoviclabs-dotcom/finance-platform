"""
test_startup_migrations.py — garde des migrations DDL au démarrage.

Contexte : le runtime Python de Vercel INVOQUE les events lifespan/startup ASGI
(constaté sur @vercel/python 6.51.1). Le hook de démarrage tentait un CREATE
TABLE au cold start et échouait sur « permission denied for schema public »
(capturé, non fatal, mais bruyant et contraire au principe « DB Migrate est le
seul chemin d'écriture schéma »).

Contrat testé (sans DB réelle) :
  1. Vercel (prod)     → run_migrations JAMAIS appelée (même avec opt-in).
  2. Vercel (preview)  → run_migrations JAMAIS appelée (même avec opt-in).
  3. Production        → run_migrations JAMAIS appelée (même avec opt-in).
  4. Local sans opt-in → run_migrations JAMAIS appelée (désactivé par défaut).
  5. Local + opt-in    → run_migrations PEUT être appelée.
  6. /health reste disponible et aucune requête HTTP normale ne déclenche de DDL.
"""

from __future__ import annotations

import pytest

import main


@pytest.fixture
def spy(monkeypatch):
    """Remplace main.run_migrations par un espion (aucune I/O réelle)."""
    calls: list[int] = []
    monkeypatch.setattr(main, "run_migrations", lambda: calls.append(1))
    return calls


def _local_clean(monkeypatch) -> None:
    """Environnement local neutre : ni Vercel, ni production, ni opt-in."""
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.delenv("RUN_STARTUP_MIGRATIONS", raising=False)
    monkeypatch.setenv("ENV", "development")


def test_vercel_production_never_runs(monkeypatch, spy):
    _local_clean(monkeypatch)
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("RUN_STARTUP_MIGRATIONS", "1")  # opt-in ignoré sur Vercel
    main._maybe_run_startup_migrations()
    assert spy == [], "Vercel production ne doit JAMAIS migrer au démarrage"


def test_vercel_preview_never_runs(monkeypatch, spy):
    _local_clean(monkeypatch)
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("VERCEL_ENV", "preview")
    monkeypatch.setenv("RUN_STARTUP_MIGRATIONS", "1")  # opt-in ignoré sur Vercel
    main._maybe_run_startup_migrations()
    assert spy == [], "Vercel preview ne doit JAMAIS migrer au démarrage"


def test_production_config_never_runs(monkeypatch, spy):
    _local_clean(monkeypatch)
    monkeypatch.setenv("ENV", "production")  # prod hors Vercel (ex. GH Actions)
    monkeypatch.setenv("RUN_STARTUP_MIGRATIONS", "1")  # opt-in ignoré en prod
    main._maybe_run_startup_migrations()
    assert spy == [], "La production ne doit JAMAIS migrer au démarrage"


def test_local_without_optin_never_runs(monkeypatch, spy):
    _local_clean(monkeypatch)  # pas d'opt-in
    main._maybe_run_startup_migrations()
    assert spy == [], "Sans opt-in, les migrations de démarrage sont désactivées"


def test_local_with_optin_runs(monkeypatch, spy):
    _local_clean(monkeypatch)
    monkeypatch.setenv("RUN_STARTUP_MIGRATIONS", "1")  # opt-in local explicite
    main._maybe_run_startup_migrations()
    assert spy == [1], "Local + opt-in explicite → migrations autorisées"


def test_disabled_path_logs_sober_info(monkeypatch, spy, caplog):
    """Le no-op est tracé en info sobre, jamais en error/warning."""
    import logging

    _local_clean(monkeypatch)
    with caplog.at_level(logging.INFO, logger="main"):
        main._maybe_run_startup_migrations()
    assert spy == []
    assert any(
        "Startup migrations disabled; use DB Migrate workflow" in r.message
        for r in caplog.records
    )
    assert all(r.levelno < logging.WARNING for r in caplog.records)


def test_health_available_and_no_ddl_on_request(monkeypatch, spy, client):
    """/health répond 200 et aucune requête HTTP normale ne déclenche de DDL."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    # L'espion est installé APRÈS le startup de la session : une requête normale
    # ne doit toucher aucun run_migrations (ensure_schema_mw retiré, PR-02C).
    assert spy == [], "aucune migration DDL déclenchée par une requête HTTP normale"


def test_no_ddl_on_normal_openapi_request(monkeypatch, spy, client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert spy == [], "aucun run_migrations sur une requête applicative normale"
