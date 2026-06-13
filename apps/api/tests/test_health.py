"""
test_health.py — T1.7 : /health enrichi (db/storage/worker/version/time).
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_shape(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("status", "service", "version", "time", "db", "storage", "worker"):
        assert key in body, f"clé {key} absente de /health"
    assert body["status"] == "ok"
    # En CI (mode /tmp), la DB n'est pas configurée.
    assert body["db"] == "not_configured"
    # Stockage local par défaut -> ok ; worker inline par défaut.
    assert body["storage"] == "ok"
    assert body["worker"] == "inline"
