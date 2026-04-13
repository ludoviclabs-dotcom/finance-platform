"""
conftest.py — fixtures partagées pour les tests CarbonCo.

Stratégie :
  - Crée un TestClient FastAPI avec DATABASE_URL absent (mode /tmp JSON, sans PostgreSQL)
  - Aucune dépendance externe requise — les tests tournent en CI sans Neon
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Forcer le mode /tmp (pas de PostgreSQL en CI)
os.environ.setdefault("DATABASE_URL", "")

from main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Client de test synchrone FastAPI, réutilisé pour toute la session."""
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client: TestClient) -> str:
    """Token JWT admin pour les tests protégés."""
    resp = client.post(
        "/auth/login",
        json={"email": "admin@carbonco.fr", "password": "Admin2024!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


@pytest.fixture(scope="session")
def analyst_token(client: TestClient) -> str:
    """Token JWT analyst."""
    resp = client.post(
        "/auth/login",
        json={"email": "demo@carbonco.fr", "password": "CarbonCo2024!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


@pytest.fixture(scope="session")
def viewer_token(client: TestClient) -> str:
    """Token JWT viewer (lecture seule)."""
    resp = client.post(
        "/auth/login",
        json={"email": "viewer@carbonco.fr", "password": "Viewer2024!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]
