"""Tests d'authentification — login, refresh, logout, RBAC."""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestLogin:
    def test_login_admin_ok(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/login",
            json={"email": "admin@carbonco.fr", "password": "Admin2024!"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "accessToken" in data
        assert data["user"]["role"] == "admin"
        assert "expiresAt" in data

    def test_login_analyst_ok(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/login",
            json={"email": "demo@carbonco.fr", "password": "CarbonCo2024!"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "analyst"

    def test_login_viewer_ok(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/login",
            json={"email": "viewer@carbonco.fr", "password": "Viewer2024!"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "viewer"

    def test_login_wrong_password(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/login",
            json={"email": "admin@carbonco.fr", "password": "wrong"},
        )
        assert resp.status_code == 401

    def test_login_unknown_email(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/login",
            json={"email": "nobody@unknown.fr", "password": "anything"},
        )
        assert resp.status_code == 401

    def test_login_case_insensitive_email(self, client: TestClient) -> None:
        resp = client.post(
            "/auth/login",
            json={"email": "ADMIN@CARBONCO.FR", "password": "Admin2024!"},
        )
        assert resp.status_code == 200


class TestMe:
    def test_me_with_valid_token(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "admin@carbonco.fr"

    def test_me_without_token(self, client: TestClient) -> None:
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token(self, client: TestClient) -> None:
        resp = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestRbac:
    def test_admin_endpoint_with_admin(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(
            "/admin/companies",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200

    def test_admin_endpoint_with_analyst(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/admin/companies",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 403

    def test_admin_endpoint_with_viewer(self, client: TestClient, viewer_token: str) -> None:
        resp = client.get(
            "/admin/companies",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        assert resp.status_code == 403
