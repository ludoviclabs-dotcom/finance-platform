"""Tests pour les 3 templates PDF.

Vérifie :
  - generate_esg_synthesis_pdf() → bytes PDF valides
  - generate_csrd_pdf() → bytes PDF valides
  - generate_vsme_pdf() → bytes PDF valides
  - generate_pdf_by_template() → dispatcher correct
  - GET /report/templates → liste les 3 templates
  - POST /report/generate?domain=... → 200 avec PDF ou 422 sans snapshot
  - POST /report/generate?domain=unknown → 400
  - Les PDF générés avec données synthétiques dépassent 1 kB
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

# Données synthétiques minimales pour les tests de génération PDF
_CARBON = {
    "carbon": {
        "scope1Tco2e": 100.0,
        "scope2LbTco2e": 50.0,
        "scope3Tco2e": 300.0,
        "totalS123Tco2e": 450.0,
        "intensityRevenueTco2ePerMEur": 42.0,
    },
    "taxonomy": {"turnoverAlignedPct": 22.0, "capexAlignedPct": 35.0},
    "energy": {"renewableSharePct": 55.0, "consumptionMWh": 1200.0},
    "sbti": {"targetReductionS12Pct": 42.0, "baselineYear": 2019},
    "cbam": {"estimatedCostEur": 12000.0},
    "company": {"name": "TestCorp", "reportingYear": 2024},
    "generatedAt": "2024-12-01T00:00:00Z",
    "validation": {"warnings": []},
}

_VSME = {
    "completude": {"scorePct": 78.0, "indicateursCompletes": 39, "totalIndicateurs": 50, "statut": "Avancé"},
    "profile": {"raisonSociale": "TestCorp", "secteurNaf": "26.20", "etp": 250, "caNet": 12000, "anneeReporting": 2024},
    "environnement": {
        "scope1Tco2e": 100.0, "scope2LbTco2e": 50.0, "scope3Tco2e": 300.0,
        "totalGesTco2e": 450.0, "energieMwh": 1200.0, "partEnrPct": 55.0,
        "eauM3": 5000, "dechetsTonnes": 12.0, "valorisationDechetsPct": 72.0,
    },
    "social": {
        "effectifTotal": 252, "pctCdi": 88.0, "ltir": 2.1,
        "formationHEtp": 18.0, "ecartSalaireHf": 8.5, "pctFemmesMgmt": 41.0,
    },
    "gouvernance": {
        "antiCorruption": True, "formationEthique": True,
        "whistleblowing": True, "pctCaIndependants": 40.0,
    },
    "generatedAt": "2024-12-01T00:00:00Z",
    "warnings": [],
}

_ESG = {
    "scores": {"scoreGlobal": 72.0, "scoreE": 68.0, "scoreS": 75.0, "scoreG": 73.0, "statut": "Bon"},
    "materialite": {
        "enjeuxEvalues": 12, "enjeuxMateriels": 8,
        "enjeuxNonMateriels": 4, "enjeuxMaterielsE": 3,
        "enjeuxMaterielsS": 3, "enjeuxMaterielsG": 2,
        "issues": [
            {"code": "E1", "label": "Changement climatique", "categorie": "Environnement",
             "normeEsrs": "ESRS E1", "scoreImpactTotal": 8.5, "materiel": True},
            {"code": "S1", "label": "Effectifs propres", "categorie": "Social",
             "normeEsrs": "ESRS S1", "scoreImpactTotal": 7.2, "materiel": True},
        ],
    },
    "qcControls": [],
    "generatedAt": "2024-12-01T00:00:00Z",
    "warnings": [],
}


# ---------------------------------------------------------------------------
# Tests unitaires des générateurs PDF
# ---------------------------------------------------------------------------

class TestEsgSynthesisPdf:
    def test_returns_bytes(self) -> None:
        from services.pdf_service import generate_esg_synthesis_pdf
        result = generate_esg_synthesis_pdf(_CARBON, _VSME, _ESG)
        assert isinstance(result, bytes)
        assert len(result) > 1024  # PDF non-vide

    def test_starts_with_pdf_header(self) -> None:
        from services.pdf_service import generate_esg_synthesis_pdf
        result = generate_esg_synthesis_pdf(_CARBON, _VSME, _ESG)
        assert result[:4] == b"%PDF"

    def test_with_none_inputs(self) -> None:
        from services.pdf_service import generate_esg_synthesis_pdf
        # Doit générer sans erreur même sans données
        result = generate_esg_synthesis_pdf(None, None, None)
        assert isinstance(result, bytes)
        assert result[:4] == b"%PDF"

    def test_with_partial_data(self) -> None:
        from services.pdf_service import generate_esg_synthesis_pdf
        result = generate_esg_synthesis_pdf(_CARBON, None, None)
        assert isinstance(result, bytes)


class TestCsrdPdf:
    def test_returns_bytes(self) -> None:
        from services.pdf_service import generate_csrd_pdf
        result = generate_csrd_pdf(_CARBON, _VSME, _ESG)
        assert isinstance(result, bytes)
        assert len(result) > 1024

    def test_starts_with_pdf_header(self) -> None:
        from services.pdf_service import generate_csrd_pdf
        result = generate_csrd_pdf(_CARBON, _VSME, _ESG)
        assert result[:4] == b"%PDF"

    def test_with_none_inputs(self) -> None:
        from services.pdf_service import generate_csrd_pdf
        result = generate_csrd_pdf(None, None, None)
        assert isinstance(result, bytes)


class TestVsmePdf:
    def test_returns_bytes(self) -> None:
        from services.pdf_service import generate_vsme_pdf
        result = generate_vsme_pdf(_VSME)
        assert isinstance(result, bytes)
        assert len(result) > 1024

    def test_starts_with_pdf_header(self) -> None:
        from services.pdf_service import generate_vsme_pdf
        result = generate_vsme_pdf(_VSME)
        assert result[:4] == b"%PDF"

    def test_with_none_input(self) -> None:
        from services.pdf_service import generate_vsme_pdf
        result = generate_vsme_pdf(None)
        assert isinstance(result, bytes)


class TestPdfByTemplate:
    def test_dispatch_synthesis(self) -> None:
        from services.pdf_service import generate_pdf_by_template
        result = generate_pdf_by_template("esg-synthesis", _CARBON, _VSME, _ESG)
        assert result[:4] == b"%PDF"

    def test_dispatch_csrd(self) -> None:
        from services.pdf_service import generate_pdf_by_template
        result = generate_pdf_by_template("csrd", _CARBON, _VSME, _ESG)
        assert result[:4] == b"%PDF"

    def test_dispatch_vsme(self) -> None:
        from services.pdf_service import generate_pdf_by_template
        result = generate_pdf_by_template("vsme", _CARBON, _VSME, _ESG)
        assert result[:4] == b"%PDF"

    def test_unknown_template_raises(self) -> None:
        from services.pdf_service import generate_pdf_by_template
        with pytest.raises(ValueError, match="Template inconnu"):
            generate_pdf_by_template("unknown", None, None, None)


# ---------------------------------------------------------------------------
# Tests des endpoints HTTP
# ---------------------------------------------------------------------------

class TestReportTemplatesEndpoint:
    def test_list_templates(self, client: TestClient, analyst_token: str) -> None:
        resp = client.get(
            "/report/templates",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "templates" in data
        assert len(data["templates"]) == 3
        ids = [t["id"] for t in data["templates"]]
        assert "esg-synthesis" in ids
        assert "csrd" in ids
        assert "vsme" in ids


class TestReportGenerateEndpoint:
    def test_unknown_domain_returns_400(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/report/generate?domain=unknown",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code == 400

    def test_no_snapshot_returns_422(self, client: TestClient, analyst_token: str) -> None:
        # Sans snapshot en cache (CI mode /tmp, aucun ingest déclenché)
        # Le serveur retourne 422 (snapshot manquant) ou 200 si un snapshot est présent
        resp = client.post(
            "/report/generate?domain=esg-synthesis",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code in (200, 422)

    def test_vsme_no_snapshot_returns_422(self, client: TestClient, analyst_token: str) -> None:
        resp = client.post(
            "/report/generate?domain=vsme",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert resp.status_code in (200, 422)
