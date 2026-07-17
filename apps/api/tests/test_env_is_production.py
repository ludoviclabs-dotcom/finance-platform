"""
test_env_is_production.py — PR-02C : is_production() (unitaire, sans DB).

Vérifie le contrat fail-secure : VERCEL_ENV primaire, repli ENV, preview
compté comme prod.
"""

from __future__ import annotations

from utils.env import is_production


def test_vercel_env_production_is_prod(monkeypatch):
    monkeypatch.setenv("VERCEL_ENV", "production")
    assert is_production() is True


def test_vercel_env_preview_is_prod_fail_secure(monkeypatch):
    """Fail-secure : preview compte comme prod (cookie Secure, confirmations renforcées)."""
    monkeypatch.setenv("VERCEL_ENV", "preview")
    assert is_production() is True


def test_vercel_env_development_is_not_prod(monkeypatch):
    monkeypatch.setenv("VERCEL_ENV", "development")
    assert is_production() is False


def test_falls_back_to_env_when_no_vercel_env(monkeypatch):
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.setenv("ENV", "production")
    assert is_production() is True
    monkeypatch.setenv("ENV", "development")
    assert is_production() is False


def test_github_actions_style_env_production(monkeypatch):
    """Le workflow db-migrate.yml pose ENV=production (VERCEL_ENV absent en GH Actions)."""
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    monkeypatch.setenv("ENV", "production")
    assert is_production() is True
