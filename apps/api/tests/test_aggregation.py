"""Tests pour le service d'agrégation et le modèle ConsolidatedSnapshot.

Vérifie :
  - build_consolidated_snapshot() retourne un ConsolidatedSnapshot valide
  - Les KPIs sont None (pas de données en CI, pas de snapshot en cache)
  - La santé des domaines reflète l'absence de cache
  - Les deltas sont tous None sans historique
  - Les helpers _extract_carbon, _extract_vsme, _extract_esg, _extract_finance
    retournent les bons KPIs sur des données synthétiques
"""

from __future__ import annotations

from services.aggregation_service import (
    ConsolidatedSnapshot,
    DeltaKpis,
    _extract_carbon,
    _extract_esg,
    _extract_finance,
    _extract_vsme,
    build_consolidated_snapshot,
)

# ---------------------------------------------------------------------------
# Données synthétiques
# ---------------------------------------------------------------------------

_CARBON_RAW = {
    "carbon": {
        "scope1Tco2e": 100.0,
        "scope2LbTco2e": 50.0,
        "scope3Tco2e": 300.0,
        "totalS123Tco2e": 450.0,
        "intensityRevenueTco2ePerMEur": 42.0,
        "intensityFteTco2ePerFte": 3.5,
    },
    "taxonomy": {"turnoverAlignedPct": 22.0, "capexAlignedPct": 35.0},
    "energy": {"renewableSharePct": 55.0},
    "sbti": {"targetReductionS12Pct": 42.0},
    "cbam": {"estimatedCostEur": 12000.0},
    "company": {"name": "TestCorp", "reportingYear": 2024, "fte": 250},
}

_VSME_RAW = {
    "completude": {"scorePct": 78.0, "indicateursCompletes": 39, "totalIndicateurs": 50, "statut": "Avancé"},
    "social": {"effectifTotal": 252, "ltir": 2.1, "ecartSalaireHf": 8.5, "pctFemmesMgmt": 41.0},
    "profile": {"raisonSociale": "TestCorp", "etp": 250, "caNet": 12000},
}

_ESG_RAW = {
    "scores": {"scoreGlobal": 72.0, "scoreE": 68.0, "scoreS": 75.0, "scoreG": 73.0, "statut": "Bon"},
    "materialite": {"enjeuxMateriels": 8},
}

_FINANCE_RAW = {
    "financeClimat": {"expositionTotaleEur": 500000.0, "greenCapexPct": 38.0, "statutAlignementParis": "Aligné"},
    "sfdrPai": {"pai1_totalGes": 450.0},
}


# ---------------------------------------------------------------------------
# Tests des helpers d'extraction
# ---------------------------------------------------------------------------


class TestExtractCarbon:
    def test_scope_values(self) -> None:
        kpis = _extract_carbon(_CARBON_RAW)
        assert kpis.scope1Tco2e == 100.0
        assert kpis.scope2LbTco2e == 50.0
        assert kpis.scope3Tco2e == 300.0
        assert kpis.totalS123Tco2e == 450.0

    def test_taxonomy(self) -> None:
        kpis = _extract_carbon(_CARBON_RAW)
        assert kpis.turnoverAlignedPct == 22.0
        assert kpis.capexAlignedPct == 35.0

    def test_empty_raw(self) -> None:
        kpis = _extract_carbon({})
        assert kpis.scope1Tco2e is None
        assert kpis.totalS123Tco2e is None


class TestExtractVsme:
    def test_completude(self) -> None:
        kpis = _extract_vsme(_VSME_RAW)
        assert kpis.scorePct == 78.0
        assert kpis.indicateursCompletes == 39
        assert kpis.statut == "Avancé"

    def test_social(self) -> None:
        kpis = _extract_vsme(_VSME_RAW)
        assert kpis.effectifTotal == 252
        assert kpis.ltir == 2.1

    def test_empty_raw(self) -> None:
        kpis = _extract_vsme({})
        assert kpis.scorePct is None
        assert kpis.effectifTotal is None


class TestExtractEsg:
    def test_scores(self) -> None:
        kpis = _extract_esg(_ESG_RAW)
        assert kpis.scoreGlobal == 72.0
        assert kpis.scoreE == 68.0
        assert kpis.enjeuxMateriels == 8

    def test_statut(self) -> None:
        kpis = _extract_esg(_ESG_RAW)
        assert kpis.statut == "Bon"

    def test_empty_raw(self) -> None:
        kpis = _extract_esg({})
        assert kpis.scoreGlobal is None


class TestExtractFinance:
    def test_exposition(self) -> None:
        kpis = _extract_finance(_FINANCE_RAW)
        assert kpis.expositionTotaleEur == 500000.0
        assert kpis.greenCapexPct == 38.0

    def test_statut_paris(self) -> None:
        kpis = _extract_finance(_FINANCE_RAW)
        assert kpis.statutAlignementParis == "Aligné"

    def test_empty_raw(self) -> None:
        kpis = _extract_finance({})
        assert kpis.expositionTotaleEur is None


# ---------------------------------------------------------------------------
# Tests de build_consolidated_snapshot (sans cache en CI)
# ---------------------------------------------------------------------------


class TestBuildConsolidatedSnapshot:
    def test_returns_consolidated_snapshot(self) -> None:
        snap = build_consolidated_snapshot(company_id=1)
        assert isinstance(snap, ConsolidatedSnapshot)

    def test_generated_at_is_set(self) -> None:
        snap = build_consolidated_snapshot(company_id=1)
        assert snap.generatedAt
        assert "T" in snap.generatedAt  # format ISO

    def test_health_has_all_domains(self) -> None:
        snap = build_consolidated_snapshot(company_id=1)
        for domain in ("carbon", "vsme", "esg", "finance"):
            assert domain in snap.health

    def test_no_cache_means_unavailable(self) -> None:
        snap = build_consolidated_snapshot(company_id=999)  # ID inexistant
        for domain in ("carbon", "vsme", "esg", "finance"):
            assert not snap.health[domain].available

    def test_kpis_none_without_cache(self) -> None:
        snap = build_consolidated_snapshot(company_id=999)
        assert snap.carbon.totalS123Tco2e is None
        assert snap.esg.scoreGlobal is None
        assert snap.vsme.scorePct is None
        assert snap.finance.greenCapexPct is None

    def test_deltas_empty_without_history(self) -> None:
        snap = build_consolidated_snapshot(company_id=999)
        assert isinstance(snap.deltas, DeltaKpis)
        assert snap.deltas.totalS123Tco2e is None
        assert snap.deltas.scoreGlobal is None

    def test_raw_fields_none_without_cache(self) -> None:
        snap = build_consolidated_snapshot(company_id=999)
        assert snap.rawCarbon is None
        assert snap.rawVsme is None
        assert snap.rawEsg is None
        assert snap.rawFinance is None
