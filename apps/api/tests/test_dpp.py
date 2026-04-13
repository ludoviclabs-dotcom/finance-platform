"""Tests CRUD DPP produits."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestDppList:
    def test_list_unauthenticated_ok(self, client: TestClient) -> None:
        """List is accessible without token (company_id defaults to 1)."""
        resp = client.get("/dpp/products")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_with_token(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get("/dpp/products", headers=auth(analyst_token))
        assert resp.status_code == 200


class TestDppCrud:
    @pytest.fixture(autouse=True)
    def created_id(self, client: TestClient, analyst_token: str) -> int:
        """Create one product and return its id. Deleted after test."""
        resp = client.post(
            "/dpp/products",
            json={
                "name": "Test Produit CI",
                "sku": "CI-001",
                "sector": "Textiles & vêtements",
                "pcf_kgco2e": 1.5,
                "recyclability_pct": 80.0,
                "lifespan_years": 3.0,
                "espr_status": "pending",
            },
            headers=auth(analyst_token),
        )
        assert resp.status_code == 201
        self._id = resp.json()["id"]
        yield self._id
        client.delete(f"/dpp/products/{self._id}", headers=auth(analyst_token))

    def test_create_returns_product(self, client: TestClient) -> None:
        resp = client.get(f"/dpp/products/{self._id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Produit CI"
        assert data["sku"] == "CI-001"
        assert data["pcf_kgco2e"] == pytest.approx(1.5)

    def test_patch_product(self, client: TestClient, analyst_token: str) -> None:
        resp = client.patch(
            f"/dpp/products/{self._id}",
            json={"espr_status": "eligible", "pcf_kgco2e": 2.0},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["espr_status"] == "eligible"
        assert data["pcf_kgco2e"] == pytest.approx(2.0)

    def test_delete_product(self, client: TestClient, analyst_token: str) -> None:
        # Create a second product to delete in this test
        resp = client.post(
            "/dpp/products",
            json={"name": "Produit à supprimer", "espr_status": "pending"},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 201
        pid = resp.json()["id"]
        del_resp = client.delete(f"/dpp/products/{pid}", headers=auth(analyst_token))
        assert del_resp.status_code == 204
        get_resp = client.get(f"/dpp/products/{pid}")
        assert get_resp.status_code == 404

    def test_viewer_cannot_create(self, client: TestClient, viewer_token: str) -> None:
        resp = client.post(
            "/dpp/products",
            json={"name": "Forbidden Product"},
            headers=auth(viewer_token),
        )
        assert resp.status_code == 403

    def test_invalid_espr_status(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/dpp/products",
            json={"name": "Bad Status", "espr_status": "invalid_value"},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 400

    def test_get_nonexistent_product(self, client: TestClient) -> None:
        resp = client.get("/dpp/products/999999")
        assert resp.status_code == 404
