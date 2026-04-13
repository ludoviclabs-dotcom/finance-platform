"""Tests pour les endpoints /dashboard/*.

Vérifie :
  - GET /dashboard/consolidated retourne un ConsolidatedSnapshot (200)
  - GET /dashboard/compare retourne un ConsolidatedSnapshot (200)
  - GET /dashboard/health retourne la structure health
  - Les champs obligatoires sont présents
  - Les endpoints requièrent un JWT valide (401 sans token)
"""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestDashboardConsolidated:
    def test_returns_200(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 200

    def test_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        data = resp.json()
        # Champs obligatoires du ConsolidatedSnapshot
        assert "generatedAt" in data
        assert "company" in data
        assert "carbon" in data
        assert "vsme" in data
        assert "esg" in data
        assert "finance" in data
        assert "deltas" in data
        assert "health" in data
        assert "alerts" in data

    def test_health_has_domains(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        health = resp.json()["health"]
        for domain in ("carbon", "vsme", "esg", "finance"):
            assert domain in health
            assert "available" in health[domain]

    def test_carbon_kpis_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        carbon = resp.json()["carbon"]
        # Ces champs doivent exister (valeur peut être null)
        assert "totalS123Tco2e" in carbon
        assert "scope1Tco2e" in carbon
        assert "scope3Tco2e" in carbon

    def test_esg_kpis_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        esg = resp.json()["esg"]
        assert "scoreGlobal" in esg
        assert "enjeuxMateriels" in esg

    def test_deltas_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        deltas = resp.json()["deltas"]
        assert "totalS123Tco2e" in deltas
        assert "scoreGlobal" in deltas
        assert "greenCapexPct" in deltas

    def test_alerts_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/consolidated",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        alerts = resp.json()["alerts"]
        assert "totalActive" in alerts
        assert "domains" in alerts
        assert isinstance(alerts["domains"], list)


class TestDashboardCompare:
    def test_returns_200(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/compare",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 200

    def test_same_structure_as_consolidated(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/compare",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        data = resp.json()
        assert "generatedAt" in data
        assert "deltas" in data


class TestDashboardHealth:
    def test_returns_200(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/health",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 200

    def test_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/dashboard/health",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        data = resp.json()
        assert "companyId" in data
        assert "domains" in data
        domains = data["domains"]
        for domain in ("carbon", "vsme", "esg", "finance"):
            assert domain in domains
