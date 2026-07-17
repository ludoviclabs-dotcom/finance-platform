"""
test_database_admin.py — PR-02C : sélection d'URL de get_admin_db() (unitaire, sans DB).

Teste uniquement `_admin_url()` (choix de la chaîne + repli loggé), pas
l'ouverture réelle d'une connexion (DB-gated, couvert par migration-tests en CI).
"""

from __future__ import annotations

import db.database as database


def test_admin_url_prefers_admin_when_set(monkeypatch):
    monkeypatch.setattr(database, "DATABASE_ADMIN_URL", "postgresql://admin@host/db")
    monkeypatch.setattr(database, "DATABASE_URL", "postgresql://app@host/db")
    assert database._admin_url() == "postgresql://admin@host/db"


def test_admin_url_falls_back_to_database_url_with_warning(monkeypatch, caplog):
    monkeypatch.setattr(database, "DATABASE_ADMIN_URL", None)
    monkeypatch.setattr(database, "DATABASE_URL", "postgresql://app@host/db")
    import logging

    with caplog.at_level(logging.WARNING):
        url = database._admin_url()
    assert url == "postgresql://app@host/db"
    assert any("DATABASE_ADMIN_URL" in r.message for r in caplog.records), (
        "le repli doit être explicitement loggé (jamais silencieux)"
    )


def test_admin_url_none_when_nothing_configured(monkeypatch):
    monkeypatch.setattr(database, "DATABASE_ADMIN_URL", None)
    monkeypatch.setattr(database, "DATABASE_URL", None)
    assert database._admin_url() is None
