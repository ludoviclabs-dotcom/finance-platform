"""Tests pour les outils du copilote IA.

Vérifie :
  - Chaque outil retourne un modèle typé cohérent
  - Sans cache (CI) : source.available=False, KPIs à None
  - build_copilot_tools_bundle() : bundle complet valide
  - GET /copilot/tools retourne un CopilotToolsBundle bien formé
"""

from __future__ import annotations

from fastapi.testclient import TestClient

# Données synthétiques injectées dans le cache /tmp pour les tests d'extraction
_CARBON_RAW = {
    "carbon": {"scope1Tco2e": 100.0, "totalS123Tco2e": 450.0, "intensityRevenueTco2ePerMEur": 42.0},
    "taxonomy": {"turnoverAlignedPct": 22.0},
    "energy": {"renewableSharePct": 55.0},
    "sbti": {"targetReductionS12Pct": 42.0, "baselineYear": 2019},
    "cbam": {"estimatedCostEur": 12000.0},
    "company": {"name": "TestCorp", "reportingYear": 2024},
}

_VSME_RAW = {
    "completude": {"scorePct": 78.0, "indicateursCompletes": 39, "totalIndicateurs": 50, "statut": "Avancé"},
    "social": {"effectifTotal": 252, "ltir": 2.1, "ecartSalaireHf": 8.5},
    "environnement": {"totalGesTco2e": 450.0, "energieMwh": 1200.0, "partEnrPct": 55.0},
    "profile": {"raisonSociale": "TestCorp"},
}

_ESG_RAW = {
    "scores": {"scoreGlobal": 72.0, "scoreE": 68.0, "scoreS": 75.0, "scoreG": 73.0, "statut": "Bon"},
    "materialite": {
        "enjeuxEvalues": 12, "enjeuxMateriels": 8,
        "enjeuxMaterielsE": 3, "enjeuxMaterielsS": 3, "enjeuxMaterielsG": 2,
        "issues": [
            {"code": "E1", "label": "Changement climatique", "categorie": "Environnement",
             "normeEsrs": "ESRS E1", "scoreImpactTotal": 8.5, "materiel": True},
        ],
    },
}

_FINANCE_RAW = {
    "financeClimat": {"expositionTotaleEur": 500000.0, "greenCapexPct": 38.0, "statutAlignementParis": "Aligné"},
    "sfdrPai": {"pai1_totalGes": 450.0, "pai12_ecartSalaireHf": 8.5},
}


# ---------------------------------------------------------------------------
# Tests unitaires des outils
# ---------------------------------------------------------------------------

class TestGetCarbonKpis:
    def test_no_cache_returns_unavailable(self) -> None:
        from services.copilot_tools import get_carbon_kpis
        result = get_carbon_kpis(company_id=999)
        assert not result.source.available
        assert result.totalS123Tco2e is None

    def test_source_has_domain(self) -> None:
        from services.copilot_tools import get_carbon_kpis
        result = get_carbon_kpis(company_id=999)
        assert result.source.domain == "carbon"


class TestGetVsmeKpis:
    def test_no_cache_returns_unavailable(self) -> None:
        from services.copilot_tools import get_vsme_kpis
        result = get_vsme_kpis(company_id=999)
        assert not result.source.available
        assert result.scorePct is None

    def test_source_domain(self) -> None:
        from services.copilot_tools import get_vsme_kpis
        result = get_vsme_kpis(company_id=999)
        assert result.source.domain == "vsme"


class TestGetEsgKpis:
    def test_no_cache_returns_unavailable(self) -> None:
        from services.copilot_tools import get_esg_kpis
        result = get_esg_kpis(company_id=999)
        assert not result.source.available
        assert result.scoreGlobal is None

    def test_top5_empty_without_cache(self) -> None:
        from services.copilot_tools import get_esg_kpis
        result = get_esg_kpis(company_id=999)
        assert result.top5Issues == []


class TestGetFinanceKpis:
    def test_no_cache_returns_unavailable(self) -> None:
        from services.copilot_tools import get_finance_kpis
        result = get_finance_kpis(company_id=999)
        assert not result.source.available
        assert result.greenCapexPct is None

    def test_source_domain(self) -> None:
        from services.copilot_tools import get_finance_kpis
        result = get_finance_kpis(company_id=999)
        assert result.source.domain == "finance"


class TestGetAlertStatus:
    def test_returns_structure(self) -> None:
        from services.copilot_tools import get_alert_status
        result = get_alert_status(company_id=999)
        assert isinstance(result.totalActive, int)
        assert isinstance(result.domains, list)
        assert isinstance(result.recentFired, list)

    def test_no_rules_for_unknown_company(self) -> None:
        from services.copilot_tools import get_alert_status
        result = get_alert_status(company_id=999)
        assert result.totalActive == 0


class TestGetDataHealth:
    def test_returns_all_domains(self) -> None:
        from services.copilot_tools import get_data_health
        result = get_data_health(company_id=999)
        for domain in ("carbon", "vsme", "esg", "finance"):
            assert domain in result.domains

    def test_no_cache_means_not_all_available(self) -> None:
        from services.copilot_tools import get_data_health
        result = get_data_health(company_id=999)
        assert not result.allAvailable

    def test_checked_at_is_set(self) -> None:
        from services.copilot_tools import get_data_health
        result = get_data_health(company_id=999)
        assert result.checkedAt
        assert "T" in result.checkedAt


class TestBuildCopilotToolsBundle:
    def test_returns_bundle(self) -> None:
        from services.copilot_tools import (
            CopilotToolsBundle,
            build_copilot_tools_bundle,
        )
        bundle = build_copilot_tools_bundle(company_id=1)
        assert isinstance(bundle, CopilotToolsBundle)

    def test_generated_at(self) -> None:
        from services.copilot_tools import build_copilot_tools_bundle
        bundle = build_copilot_tools_bundle(company_id=1)
        assert bundle.generatedAt
        assert "T" in bundle.generatedAt

    def test_all_tools_present(self) -> None:
        from services.copilot_tools import build_copilot_tools_bundle
        bundle = build_copilot_tools_bundle(company_id=1)
        assert bundle.carbon is not None
        assert bundle.vsme is not None
        assert bundle.esg is not None
        assert bundle.finance is not None
        assert bundle.alertStatus is not None
        assert bundle.dataHealth is not None


# ---------------------------------------------------------------------------
# Tests des endpoints HTTP
# ---------------------------------------------------------------------------

class TestCopilotToolsEndpoint:
    def test_returns_200(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/copilot/tools",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 200

    def test_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/copilot/tools",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        data = resp.json()
        assert "generatedAt" in data
        assert "carbon" in data
        assert "vsme" in data
        assert "esg" in data
        assert "finance" in data
        assert "alertStatus" in data
        assert "dataHealth" in data

    def test_carbon_has_source(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/copilot/tools",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        carbon = resp.json()["carbon"]
        assert "source" in carbon
        assert "available" in carbon["source"]
        assert "domain" in carbon["source"]
        assert carbon["source"]["domain"] == "carbon"

    def test_data_health_has_domains(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/copilot/tools",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        health = resp.json()["dataHealth"]
        assert "domains" in health
        for domain in ("carbon", "vsme", "esg", "finance"):
            assert domain in health["domains"]

    def test_alert_status_structure(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/copilot/tools",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        alerts = resp.json()["alertStatus"]
        assert "totalActive" in alerts
        assert "domains" in alerts
        assert "recentFired" in alerts
