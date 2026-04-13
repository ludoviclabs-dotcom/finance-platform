"""Tests sanity pour les endpoints health, ingest/cache, et audit."""

from __future__ import annotations

from fastapi.testclient import TestClient


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestHealth:
    def test_health_ok(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok"


class TestCacheStatus:
    def test_cache_status_accessible(self, client: TestClient) -> None:
        resp = client.get("/ingest/status")
        assert resp.status_code == 200
        assert "domains" in resp.json()

    def test_cache_invalidate_requires_auth(self, client: TestClient) -> None:
        resp = client.delete("/ingest/cache")
        # Endpoint protégé par require_admin ou require_analyst
        assert resp.status_code in (401, 403)

    def test_cache_invalidate_with_admin(self, client: TestClient, admin_token: str) -> None:
        resp = client.delete("/ingest/cache", headers=auth(admin_token))
        # 200 ou 204 selon l'implémentation
        assert resp.status_code in (200, 204)


class TestAudit:
    def test_audit_list_accessible(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get("/audit/events", headers=auth(analyst_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert "total" in data

    def test_audit_log_event(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/audit/event",
            json={
                "type": "upload",
                "title": "Test upload CI",
                "status": "ok",
                "detail": "Fichier test.xlsx uploadé depuis les tests CI",
            },
            headers=auth(analyst_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Test upload CI"
        assert data["type"] == "upload"
