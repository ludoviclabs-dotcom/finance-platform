"""Tests pour le module alertes — CRUD règles + évaluation."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


RULE_PAYLOAD = {
    "name": "Alerte Scope 1 élevé",
    "domain": "carbon",
    "field_path": "carbon.scope1Tco2e",
    "operator": "gt",
    "threshold": 500.0,
    "channel": "webhook",
    "destination": "https://hooks.example.com/carbonco",
    "is_active": True,
}


class TestAlertRulesCrud:
    @pytest.fixture(autouse=True)
    def rule_id(self, client: TestClient, analyst_token: str) -> int:
        resp = client.post("/alerts/rules", json=RULE_PAYLOAD, headers=auth(analyst_token))
        assert resp.status_code == 201
        self._rid = resp.json()["id"]
        yield self._rid
        client.delete(f"/alerts/rules/{self._rid}", headers=auth(analyst_token))

    def test_create_rule_fields(self, client: TestClient) -> None:
        resp = client.get("/alerts/rules")
        rules = resp.json()
        match = next((r for r in rules if r["id"] == self._rid), None)
        assert match is not None
        assert match["name"] == "Alerte Scope 1 élevé"
        assert match["operator"] == "gt"
        assert match["threshold"] == pytest.approx(500.0)

    def test_list_rules_accessible_without_token(self, client: TestClient) -> None:
        resp = client.get("/alerts/rules")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_patch_rule(self, client: TestClient, analyst_token: str) -> None:
        resp = client.patch(
            f"/alerts/rules/{self._rid}",
            json={"threshold": 1000.0, "is_active": False},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["threshold"] == pytest.approx(1000.0)
        assert data["is_active"] is False

    def test_viewer_cannot_create_rule(self, client: TestClient, viewer_token: str) -> None:
        resp = client.post("/alerts/rules", json=RULE_PAYLOAD, headers=auth(viewer_token))
        assert resp.status_code == 403

    def test_invalid_operator(self, client: TestClient, analyst_token: str) -> None:
        payload = {**RULE_PAYLOAD, "operator": "invalid"}
        resp = client.post("/alerts/rules", json=payload, headers=auth(analyst_token))
        assert resp.status_code == 400

    def test_invalid_domain(self, client: TestClient, analyst_token: str) -> None:
        payload = {**RULE_PAYLOAD, "domain": "unknown"}
        resp = client.post("/alerts/rules", json=payload, headers=auth(analyst_token))
        assert resp.status_code == 400

    def test_delete_nonexistent_rule(self, client: TestClient, analyst_token: str) -> None:
        resp = client.delete("/alerts/rules/999999", headers=auth(analyst_token))
        assert resp.status_code == 404


class TestAlertEvaluate:
    def test_evaluate_returns_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post("/alerts/evaluate", headers=auth(analyst_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "evaluated" in data
        assert "fired" in data
        assert "alerts" in data
        assert isinstance(data["alerts"], list)

    def test_evaluate_viewer_forbidden(self, client: TestClient, viewer_token: str) -> None:
        resp = client.post("/alerts/evaluate", headers=auth(viewer_token))
        assert resp.status_code == 403


class TestAlertHistory:
    def test_history_accessible(self, client: TestClient) -> None:
        resp = client.get("/alerts/history")
        assert resp.status_code == 200
        data = resp.json()
        assert "alerts" in data
        assert "total" in data


class TestAlertModes:
    def test_missing_mode_no_threshold(self, client: TestClient, analyst_token: str) -> None:
        payload = {"name": "Donnée manquante", "domain": "vsme",
                   "field_path": "vsme.energieMwh", "operator": "eq", "mode": "missing"}
        resp = client.post("/alerts/rules", json=payload, headers=auth(analyst_token))
        assert resp.status_code == 201
        client.delete(f"/alerts/rules/{resp.json()['id']}", headers=auth(analyst_token))

    def test_invalid_mode(self, client: TestClient, analyst_token: str) -> None:
        payload = {**RULE_PAYLOAD, "mode": "wat"}
        resp = client.post("/alerts/rules", json=payload, headers=auth(analyst_token))
        assert resp.status_code == 400


class TestNotifications:
    def test_list_requires_auth(self, client: TestClient) -> None:
        # Les notifications sont des données tenant : pas d'accès anonyme.
        assert client.get("/alerts/notifications").status_code in (401, 403)

    def test_list_authed(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get("/alerts/notifications", headers=auth(analyst_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "unread" in data and "notifications" in data

    def test_mutations_require_auth(self, client: TestClient) -> None:
        assert client.patch("/alerts/notifications/1").status_code in (401, 403)
        assert client.delete("/alerts/notifications/1").status_code in (401, 403)

    def test_mark_read_nonexistent(self, client: TestClient, analyst_token: str) -> None:
        assert client.patch("/alerts/notifications/999999", headers=auth(analyst_token)).status_code == 404

    def test_archive_nonexistent(self, client: TestClient, analyst_token: str) -> None:
        assert client.delete("/alerts/notifications/999999", headers=auth(analyst_token)).status_code == 404
