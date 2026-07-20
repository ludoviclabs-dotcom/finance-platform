"""
test_procurement_scoring.py — profil fournisseur en 5 dimensions (PR-05B).

PUR (exécuté partout) : les cinq dimensions, leur INDÉPENDANCE, la distinction
risque / confiance / statut, l'absence de score agrégé, le traitement honnête de
l'absence de donnée.

DB-gated (CI `migration-tests`) : composition depuis la base, isolation tenant.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available
from models.procurement import SupplierScoreCard
from services.procurement import scoring

from ._procurement_fixtures import insert_supplier

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ═══════════════════════════════════════════════════════════════════════════
# PUR — les cinq dimensions
# ═══════════════════════════════════════════════════════════════════════════

class TestNoAggregateScore:
    """La garantie centrale : pas de score ESG unique, jamais."""

    def test_scorecard_model_has_no_aggregate_field(self):
        fields = set(SupplierScoreCard.model_fields)
        for forbidden in ("score", "total_score", "aggregate_score", "global_score", "rating"):
            assert forbidden not in fields, f"champ agrégé interdit : {forbidden}"

    def test_scorecard_declares_its_refusal_explicitly(self):
        card = SupplierScoreCard(supplier_id=1, supplier_name="X", dimensions=[])
        assert card.no_aggregate_score is True
        assert "non agrégées" in card.note

    def test_exactly_five_independent_dimensions(self):
        card = SupplierScoreCard(
            supplier_id=1, supplier_name="X",
            dimensions=[
                scoring.evidence_maturity(total_records=2, sourced_records=1, verified_records=1),
                scoring.ghg_data_quality(method_counts={"average_physical": 3}),
                scoring.supply_concentration(
                    supplier_spend=100.0, total_spend=400.0, supplier_count=4,
                ),
                scoring.location_exposure(
                    lines_total=4, lines_with_country=4, distinct_countries=1,
                    sites_total=0, sites_geocode_accepted=0,
                ),
                scoring.compliance_response(
                    invited=2, completed=1, answers_accepted=1, answers_pending=0,
                ),
            ],
        )
        assert len(card.dimensions) == 5
        assert len({d.code for d in card.dimensions}) == 5


class TestDimensionDirections:
    def test_each_dimension_states_how_to_read_it(self):
        """Sans `direction`, « 80 » se lit aussi bien comme excellent que comme
        très exposé selon la dimension."""
        assert scoring.evidence_maturity(
            total_records=1, sourced_records=1, verified_records=1,
        ).direction == "higher_is_better"
        assert scoring.supply_concentration(
            supplier_spend=50.0, total_spend=100.0, supplier_count=3,
        ).direction == "higher_is_riskier"
        assert scoring.location_exposure(
            lines_total=2, lines_with_country=0, distinct_countries=0,
            sites_total=0, sites_geocode_accepted=0,
        ).direction == "higher_is_riskier"
        assert scoring.compliance_response(
            invited=1, completed=1, answers_accepted=1, answers_pending=0,
        ).direction == "higher_is_better"


class TestMissingDataIsNotZero:
    """Un trou d'information n'est pas une mauvaise performance."""

    @pytest.mark.parametrize(
        "dimension",
        [
            scoring.evidence_maturity(total_records=0, sourced_records=0, verified_records=0),
            scoring.ghg_data_quality(method_counts={}),
            scoring.supply_concentration(
                supplier_spend=None, total_spend=None, supplier_count=0,
            ),
            scoring.location_exposure(
                lines_total=0, lines_with_country=0, distinct_countries=0,
                sites_total=0, sites_geocode_accepted=0,
            ),
            scoring.compliance_response(
                invited=0, completed=0, answers_accepted=0, answers_pending=0,
            ),
        ],
    )
    def test_absent_data_gives_none_not_zero(self, dimension):
        assert dimension.value is None, "l'absence de donnée ne vaut pas 0"
        assert dimension.confidence == 0.0
        assert dimension.warnings, "l'absence doit être signalée, pas silencieuse"


class TestEvidenceMaturityPure:
    def test_fully_sourced_and_verified_scores_max(self):
        dim = scoring.evidence_maturity(
            total_records=4, sourced_records=4, verified_records=4,
        )
        assert dim.value == 100.0
        assert not dim.warnings

    def test_unsourced_records_are_flagged(self):
        dim = scoring.evidence_maturity(
            total_records=4, sourced_records=1, verified_records=0,
        )
        assert dim.value == pytest.approx(15.0)  # 25 % × 0,6
        assert any("sans source" in w for w in dim.warnings)

    def test_confidence_grows_with_evidence_volume(self):
        few = scoring.evidence_maturity(total_records=1, sourced_records=1, verified_records=1)
        many = scoring.evidence_maturity(total_records=5, sourced_records=5, verified_records=5)
        assert many.confidence > few.confidence
        # Même valeur mesurée, confiances différentes : les deux axes sont bien
        # séparés (contrats §2).
        assert few.value == many.value


class TestGhgDataQualityPure:
    def test_verified_pcf_beats_spend_based(self):
        best = scoring.ghg_data_quality(method_counts={"supplier_pcf_verified": 10})
        worst = scoring.ghg_data_quality(method_counts={"spend_based_economic": 10})
        assert best.value > worst.value

    def test_unresolved_lines_are_warned_about(self):
        dim = scoring.ghg_data_quality(
            method_counts={"average_physical": 5, "unresolved": 5},
        )
        assert any("non résolue" in w for w in dim.warnings)

    def test_mostly_spend_based_triggers_collection_advice(self):
        dim = scoring.ghg_data_quality(
            method_counts={"spend_based_economic": 8, "average_physical": 2},
        )
        assert any("monétaire" in w for w in dim.warnings)

    def test_quality_reuses_the_engine_profiles(self):
        """La qualité affichée et celle utilisée dans le calcul viennent de la
        même table versionnée — elles ne peuvent pas diverger."""
        from services.calculations import procurement as engine

        dim = scoring.ghg_data_quality(method_counts={"supplier_pcf_verified": 1})
        expected = engine.METHOD_PROFILES["supplier_pcf_verified"].data_quality * 100
        assert dim.value == pytest.approx(expected)
        assert engine.METHODOLOGY_VERSION in dim.basis


class TestSupplyConcentrationPure:
    def test_share_of_spend_is_the_measure(self):
        dim = scoring.supply_concentration(
            supplier_spend=300.0, total_spend=1000.0, supplier_count=5,
        )
        assert dim.value == 30.0

    def test_high_dependency_is_warned(self):
        dim = scoring.supply_concentration(
            supplier_spend=800.0, total_spend=1000.0, supplier_count=5,
        )
        assert any("dépendance" in w for w in dim.warnings)

    def test_tiny_supplier_base_is_flagged_as_low_significance(self):
        dim = scoring.supply_concentration(
            supplier_spend=100.0, total_spend=100.0, supplier_count=1,
        )
        assert any("peu significative" in w for w in dim.warnings)


class TestLocationExposurePure:
    def test_unknown_origin_raises_exposure(self):
        known = scoring.location_exposure(
            lines_total=10, lines_with_country=10, distinct_countries=1,
            sites_total=0, sites_geocode_accepted=0,
        )
        unknown = scoring.location_exposure(
            lines_total=10, lines_with_country=0, distinct_countries=0,
            sites_total=0, sites_geocode_accepted=0,
        )
        assert unknown.value > known.value

    def test_no_normative_country_risk_is_applied(self):
        """Le module reste DESCRIPTIF : aucun score de risque pays (géopolitique,
        gouvernance) — ce serait un jugement opaque et hors périmètre."""
        dim = scoring.location_exposure(
            lines_total=5, lines_with_country=5, distinct_countries=2,
            sites_total=1, sites_geocode_accepted=1,
        )
        assert "Aucun score de risque pays normatif" in dim.basis
        assert "distinct_countries" in dim.inputs

    def test_ungeocoded_sites_are_flagged(self):
        dim = scoring.location_exposure(
            lines_total=5, lines_with_country=5, distinct_countries=1,
            sites_total=3, sites_geocode_accepted=1,
        )
        assert any("géolocalisation" in w for w in dim.warnings)


class TestComplianceResponsePure:
    def test_unreviewed_answer_does_not_count_as_compliant(self):
        """Le gate humain fait partie de la mesure : répondre ne suffit pas,
        la réponse doit avoir été revue."""
        reviewed = scoring.compliance_response(
            invited=1, completed=1, answers_accepted=1, answers_pending=0,
        )
        unreviewed = scoring.compliance_response(
            invited=1, completed=1, answers_accepted=0, answers_pending=1,
        )
        assert reviewed.value == 100.0
        assert unreviewed.value == 60.0
        assert any("attente de revue" in w for w in unreviewed.warnings)

    def test_silence_is_flagged(self):
        dim = scoring.compliance_response(
            invited=4, completed=1, answers_accepted=1, answers_pending=0,
        )
        assert any("sans réponse" in w for w in dim.warnings)


# ═══════════════════════════════════════════════════════════════════════════
# DB-gated
# ═══════════════════════════════════════════════════════════════════════════

@_skip_no_db_url
@_skip_no_psycopg2
class TestScoringDb:
    def test_scorecard_of_a_bare_supplier_is_honest(self, two_companies_proc):
        """Un fournisseur sans aucune donnée : cinq dimensions présentes, toutes
        à None avec leur avertissement — pas de zéros trompeurs."""
        cid_a, _ = two_companies_proc
        supplier = insert_supplier(cid_a, "Fournisseur Nu")
        card = scoring.get_supplier_scorecard(company_id=cid_a, supplier_id=supplier)

        assert card.supplier_id == supplier
        assert len(card.dimensions) == 5
        assert card.no_aggregate_score is True
        assert all(d.value is None for d in card.dimensions)
        assert all(d.warnings for d in card.dimensions)

    def test_unknown_supplier_is_refused(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        with pytest.raises(scoring.ScoringError, match="introuvable"):
            scoring.get_supplier_scorecard(company_id=cid_a, supplier_id=999_999)

    def test_tenant_b_cannot_score_tenant_a_supplier(self, two_companies_proc):
        """Isolation : 404-like, jamais une fuite d'existence (contrats §6)."""
        cid_a, cid_b = two_companies_proc
        supplier_a = insert_supplier(cid_a, "Fournisseur Privé")
        with pytest.raises(scoring.ScoringError, match="introuvable"):
            scoring.get_supplier_scorecard(company_id=cid_b, supplier_id=supplier_a)
