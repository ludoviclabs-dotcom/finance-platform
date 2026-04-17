"""Tests Phase 4 — Fournisseurs, Matérialité, RAG ESRS."""

from __future__ import annotations

from fastapi.testclient import TestClient


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fournisseurs (demo mode)
# ---------------------------------------------------------------------------

class TestSuppliers:
    def test_list_suppliers_accessible(self, client: TestClient) -> None:
        resp = client.get("/suppliers")
        # Mode /tmp : GET sans auth → entreprise 1 par défaut (DEFAULT_COMPANY_ID)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 20  # 20 fournisseurs démo

    def test_scope3_summary(self, client: TestClient) -> None:
        resp = client.get("/suppliers/scope3")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_suppliers" in data
        assert "total_ghg_tco2e" in data
        assert "top20" in data
        assert data["total_suppliers"] >= 20

    def test_create_supplier_requires_auth(self, client: TestClient) -> None:
        resp = client.post(
            "/suppliers",
            json={"name": "Test Fournisseur"},
        )
        assert resp.status_code in (401, 403)

    def test_create_supplier_with_analyst(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/suppliers",
            json={
                "name": "Test Fournisseur CI",
                "contact_email": "test@ci.fr",
                "country": "France",
                "ghg_estimate_tco2e": 100.0,
            },
            headers=auth(analyst_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Fournisseur CI"
        assert data["status"] == "active"

    def test_get_supplier_detail(self, client: TestClient) -> None:
        resp = client.get("/suppliers/1")
        assert resp.status_code == 200
        data = resp.json()
        assert "name" in data

    def test_get_nonexistent_supplier(self, client: TestClient) -> None:
        resp = client.get("/suppliers/99999")
        assert resp.status_code == 404

    def test_create_token_requires_auth(self, client: TestClient) -> None:
        resp = client.post(
            "/suppliers/1/tokens",
            json={"campaign": "Test Campaign"},
        )
        assert resp.status_code in (401, 403)

    def test_create_token_with_analyst(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/suppliers/1/tokens",
            json={"campaign": "CI Campaign 2026", "expires_days": 7},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert len(data["token"]) == 64
        assert "url" in data
        assert data["campaign"] == "CI Campaign 2026"

    def test_public_questionnaire_token_invalid(self, client: TestClient) -> None:
        resp = client.get("/suppliers/public/q/deadbeefdeadbeefdeadbeef00000000")
        assert resp.status_code == 404

    def test_public_questionnaire_submit_invalid_token(self, client: TestClient) -> None:
        resp = client.post(
            "/suppliers/public/q/deadbeefdeadbeefdeadbeef00000000",
            json={"ghg_total_tco2e": 500.0, "methodology": "GHG Protocol"},
        )
        assert resp.status_code == 404

    def test_delete_supplier_requires_admin(self, client: TestClient, analyst_token: str) -> None:
        resp = client.delete("/suppliers/1", headers=auth(analyst_token))
        assert resp.status_code == 403

    def test_delete_supplier_with_admin(self, client: TestClient, admin_token: str) -> None:
        # Créer d'abord un fournisseur à supprimer
        create_resp = client.post(
            "/suppliers",
            json={"name": "À Supprimer"},
            headers=auth(admin_token),
        )
        assert create_resp.status_code == 201
        sup_id = create_resp.json()["id"]
        resp = client.delete(f"/suppliers/{sup_id}", headers=auth(admin_token))
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Matérialité
# ---------------------------------------------------------------------------

class TestMaterialite:
    def test_get_presets(self, client: TestClient) -> None:
        resp = client.get("/materialite/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert "sectors" in data
        assert len(data["sectors"]) == 5
        assert "tech" in data["sectors"]
        assert "industrie" in data["sectors"]
        assert "finance" in data["sectors"]
        assert "issues" in data

    def test_score_with_preset_sector(self, client: TestClient) -> None:
        resp = client.post(
            "/materialite/score",
            json={"positions": [], "sector": "tech"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "issues" in data
        assert data["total_issues"] > 0
        assert "score_moyen" in data
        assert 0 <= data["score_moyen"] <= 5
        assert "narrative" in data
        assert len(data["narrative"]) > 50
        assert data["sector"] == "tech"

    def test_score_with_custom_positions(self, client: TestClient) -> None:
        resp = client.post(
            "/materialite/score",
            json={
                "positions": [
                    {"code": "CC-1", "x": 4.0, "y": 4.5},
                    {"code": "WO-1", "x": 3.5, "y": 4.0},
                    {"code": "BC-1", "x": 2.0, "y": 2.0},
                ],
                "sector": None,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_issues"] == 3
        # CC-1 (4×4.5) et WO-1 (3.5×4) → score > 2.5 → matériels
        materiels = [i for i in data["issues"] if i["materiel"]]
        assert len(materiels) >= 2

    def test_save_positions_requires_auth(self, client: TestClient) -> None:
        resp = client.post(
            "/materialite/positions",
            json={"positions": [{"code": "CC-1", "x": 3.0, "y": 3.0}], "sector": "tech"},
        )
        assert resp.status_code in (401, 403)

    def test_save_positions_with_analyst(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/materialite/positions",
            json={"positions": [{"code": "CC-1", "x": 3.0, "y": 3.0}], "sector": "tech"},
            headers=auth(analyst_token),
        )
        assert resp.status_code == 204

    def test_get_positions(self, client: TestClient) -> None:
        resp = client.get("/materialite/positions")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# RAG ESRS
# ---------------------------------------------------------------------------

class TestRagEsrs:
    def test_rag_search_returns_hits(self, client: TestClient) -> None:
        resp = client.post(
            "/copilot/rag-search",
            json={"query": "scope 3 émissions fournisseurs chaîne valeur", "top_k": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "hits" in data
        assert isinstance(data["hits"], list)
        assert len(data["hits"]) > 0
        assert data["total_corpus_size"] >= 30  # au moins 30 entrées corpus

        hit = data["hits"][0]
        assert "standard" in hit
        assert "topic" in hit
        assert "answer" in hit
        assert "source_ref" in hit
        assert hit["score"] > 0

    def test_rag_search_esrs_e1(self, client: TestClient) -> None:
        resp = client.post(
            "/copilot/rag-search",
            json={"query": "plan de transition climatique SBTi objectifs 1.5°C"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["hits"]) > 0
        # Doit trouver une entrée ESRS E1
        standards = [h["standard"] for h in data["hits"]]
        assert any("E1" in s for s in standards)

    def test_rag_search_empty_query(self, client: TestClient) -> None:
        resp = client.post(
            "/copilot/rag-search",
            json={"query": "a"},  # trop court (< 3 chars)
        )
        assert resp.status_code == 422

    def test_rag_search_governance(self, client: TestClient) -> None:
        resp = client.post(
            "/copilot/rag-search",
            json={"query": "gouvernance corruption anti-corruption code conduite"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["hits"]) > 0
        # Doit trouver G1
        standards = [h["standard"] for h in data["hits"]]
        assert any("G1" in s for s in standards)

    def test_rag_search_taxonomie(self, client: TestClient) -> None:
        resp = client.post(
            "/copilot/rag-search",
            json={"query": "taxonomie UE aligné DNSH CapEx vert"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["hits"]) > 0
        topics = [h["topic"] for h in data["hits"]]
        assert any("Taxonomie" in t or "taxonomie" in t.lower() for t in topics)
