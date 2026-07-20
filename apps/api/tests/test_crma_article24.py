"""
test_crma_article24.py — évaluations Article 24, revue humaine, actions
d'atténuation et rapport (PR-07).

DB-gated. Ce module vérifie surtout ce que le système REFUSE de faire :
approuver sans humain, recalculer un chiffre déjà approuvé, laisser croire
qu'un score CarbonCo est réglementaire, ou faire baisser un risque parce qu'une
action a été déclarée.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available
from models.crma import (
    Article24AssessmentCreate,
    ExposureCreate,
    MitigationActionCreate,
    StageObservationCreate,
)
from services.crma import article24_service, exposure_service, stage_service

from ._crma_fixtures import insert_supplier

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(
    not db_available(), reason="psycopg2/PostgreSQL non disponible"
)

_REVIEWER = 4242


def _seed_material(cid: int, material: str) -> None:
    """Socle minimal exploitable : deux étapes documentées + un fournisseur."""
    for stage, country, share in (
        ("extraction", "XA", 45.0),
        ("extraction", "XB", 35.0),
        ("refining", "XA", 92.0),
        ("refining", "XB", 8.0),
    ):
        stage_service.record_stage_observation(
            company_id=cid,
            payload=StageObservationCreate(
                material_id=material, stage_code=stage, country_code=country,
                share_pct=share, reference_year=2025, data_status="estimated",
            ),
        )
    supplier_id = insert_supplier(cid, f"Fournisseur {material}")
    exposure_service.create_exposure(
        company_id=cid,
        payload=ExposureCreate(
            material_id=material, supplier_id=supplier_id,
            share_of_supply_pct=90.0, stock_coverage_days=30.0, reference_year=2025,
        ),
    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestAssessmentLifecycle:
    def test_created_assessment_starts_as_draft_without_score(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id="test-a24-new", assessment_year=2026),
            prepared_by=_REVIEWER,
        )
        assert assessment.status == "draft"
        assert assessment.risk_score is None
        assert assessment.calculated_at is None
        # La méthode est estampillée dès la création.
        assert assessment.methodology_code == "CC-MATERIAL-EXPOSURE"
        assert assessment.methodology_version == "0.1.0"

    def test_duplicate_assessment_for_same_year_rejected(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        payload = Article24AssessmentCreate(material_id="test-a24-dup", assessment_year=2026)
        article24_service.create_assessment(company_id=cid_a, payload=payload)
        with pytest.raises(article24_service.Article24Error, match="existe déjà"):
            article24_service.create_assessment(company_id=cid_a, payload=payload)

    def test_recalculate_fills_score_but_never_approves(self, two_companies_crma):
        """Calculer n'est pas approuver — le statut reste `draft`."""
        cid_a, _ = two_companies_crma
        material = "test-a24-calc"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        recalculated = article24_service.recalculate(
            company_id=cid_a, assessment_id=assessment.id
        )
        assert recalculated.risk_score is not None
        assert recalculated.confidence is not None
        assert recalculated.calculated_at is not None
        assert recalculated.status == "draft"
        assert recalculated.approved_by is None

    def test_components_are_stored_separately_and_inspectable(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-a24-components"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        result = article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)

        codes = {c["code"] for c in result.components}
        assert "stage_concentration" in codes
        assert "supplier_dependency" in codes
        # Chaque composante garde sa valeur, son poids et sa justification.
        for component in result.components:
            assert "rationale" in component
            assert "available" in component
            if component["available"]:
                assert component["risk_value"] is not None
        # Les moteurs sont une VUE triée, pas un calcul supplémentaire.
        assert [d["contribution"] for d in result.drivers] == sorted(
            [d["contribution"] for d in result.drivers], reverse=True
        )

    def test_input_snapshot_makes_the_calculation_reproducible(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-a24-snapshot"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        result = article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)

        snapshot = result.input_snapshot
        assert snapshot["material_id"] == material
        assert snapshot["methodology"]["code"] == "CC-MATERIAL-EXPOSURE"
        assert snapshot["methodology"]["nominal_weights"]["stage_concentration"] == 0.30
        # Les concentrations sont conservées PAR ÉTAPE dans l'instantané.
        stages = {s["stage_code"] for s in snapshot["stage_concentrations"]}
        assert {"extraction", "refining"} <= stages

    def test_risk_and_confidence_are_two_columns(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-a24-two-cols"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        result = article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)
        assert 0 <= result.risk_score <= 100
        assert 0 <= result.confidence <= 100
        # Aucun « score net » nulle part.
        assert not hasattr(result, "net_score")


@_skip_no_db_url
@_skip_no_psycopg2
class TestHumanReviewGate:
    def test_approval_records_the_human_reviewer(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-a24-approve"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)
        approved = article24_service.review(
            company_id=cid_a, assessment_id=assessment.id, approve=True, reviewed_by=_REVIEWER
        )
        assert approved.status == "approved"
        assert approved.approved_by == _REVIEWER
        assert approved.approved_at is not None

    def test_approval_before_any_calculation_is_refused(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id="test-a24-early", assessment_year=2026),
        )
        with pytest.raises(article24_service.Article24Error, match="jamais calculée"):
            article24_service.review(
                company_id=cid_a, assessment_id=assessment.id,
                approve=True, reviewed_by=_REVIEWER,
            )

    def test_approved_assessment_cannot_be_silently_recalculated(self, two_companies_crma):
        """Un chiffre approuvé par un humain ne change pas sous ses pieds."""
        cid_a, _ = two_companies_crma
        material = "test-a24-frozen"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)
        article24_service.review(
            company_id=cid_a, assessment_id=assessment.id, approve=True, reviewed_by=_REVIEWER
        )
        with pytest.raises(article24_service.Article24Error, match="déjà approuvée"):
            article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)

    def test_rejection_returns_to_draft_and_clears_approval(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-a24-reject"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)
        rejected = article24_service.review(
            company_id=cid_a, assessment_id=assessment.id, approve=False, reviewed_by=_REVIEWER
        )
        assert rejected.status == "draft"
        assert rejected.approved_by is None
        assert rejected.approved_at is None

    def test_assessment_is_tenant_isolated(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id="test-a24-iso", assessment_year=2026),
        )
        with pytest.raises(article24_service.Article24Error, match="introuvable"):
            article24_service.get_assessment(company_id=cid_b, assessment_id=assessment.id)
        with pytest.raises(article24_service.Article24Error, match="introuvable"):
            article24_service.review(
                company_id=cid_b, assessment_id=assessment.id,
                approve=True, reviewed_by=_REVIEWER,
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestMitigationActions:
    def test_action_attached_to_assessment(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id="test-action-mat", assessment_year=2026),
        )
        action = article24_service.create_action(
            company_id=cid_a,
            payload=MitigationActionCreate(
                action_type="diversification", title="Qualifier un second raffineur",
                assessment_id=assessment.id, material_id="test-action-mat",
                target_stage_code="refining", expected_risk_reduction_pct=25.0,
            ),
        )
        assert action.assessment_id == assessment.id
        assert action.status == "planned"
        assert action.target_stage_code == "refining"

    def test_action_never_lowers_the_stored_risk_score(self, two_companies_crma):
        """`expected_risk_reduction_pct` est une INTENTION déclarée : le risque
        ne baisse que quand les données changent, jamais parce qu'on a promis."""
        cid_a, _ = two_companies_crma
        material = "test-action-noeffect"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        before = article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)

        article24_service.create_action(
            company_id=cid_a,
            payload=MitigationActionCreate(
                action_type="stockpiling", title="Constituer un stock stratégique",
                assessment_id=assessment.id, material_id=material,
                expected_risk_reduction_pct=90.0,
            ),
        )
        after = article24_service.recalculate(company_id=cid_a, assessment_id=assessment.id)
        assert after.risk_score == before.risk_score

    def test_action_on_foreign_assessment_is_refused(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id="test-action-iso", assessment_year=2026),
        )
        with pytest.raises(article24_service.Article24Error, match="introuvable"):
            article24_service.create_action(
                company_id=cid_b,
                payload=MitigationActionCreate(
                    action_type="other", title="Intrusion", assessment_id=assessment.id
                ),
            )

    def test_actions_are_tenant_isolated(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        article24_service.create_action(
            company_id=cid_a,
            payload=MitigationActionCreate(
                action_type="rd", title="Action confidentielle", material_id="test-action-isolated"
            ),
        )
        assert article24_service.list_actions(
            company_id=cid_b, material_id="test-action-isolated"
        ).total == 0


@_skip_no_db_url
@_skip_no_psycopg2
class TestArticle24Report:
    def _approved_report(self, cid: int, material: str):
        _seed_material(cid, material)
        assessment = article24_service.create_assessment(
            company_id=cid,
            payload=Article24AssessmentCreate(
                material_id=material, assessment_year=2026, regulation_version="CRMA-2024"
            ),
        )
        article24_service.recalculate(company_id=cid, assessment_id=assessment.id)
        article24_service.review(
            company_id=cid, assessment_id=assessment.id, approve=True, reviewed_by=_REVIEWER
        )
        article24_service.create_action(
            company_id=cid,
            payload=MitigationActionCreate(
                action_type="recycling", title="Filière de réemploi d'aimants",
                assessment_id=assessment.id, material_id=material,
            ),
        )
        return article24_service.build_report(company_id=cid, assessment_id=assessment.id)

    def test_report_assembles_every_section(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        report = self._approved_report(cid_a, "test-report-full")
        assert report.assessment.status == "approved"
        assert report.value_chain.stages_total == 8
        assert len(report.mitigation_actions) == 1
        assert report.exposures
        assert report.assessment_year == 2026

    def test_report_denies_official_eu_status_in_the_payload(self, two_companies_crma):
        """Un lecteur du JSON exporté, hors contexte applicatif, doit pouvoir
        constater que ce score n'est pas réglementaire."""
        cid_a, _ = two_companies_crma
        report = self._approved_report(cid_a, "test-report-disclaimer")
        assert report.is_official_eu_score is False
        assert "n'est PAS un score officiel" in report.disclaimer
        assert report.methodology_code == "CC-MATERIAL-EXPOSURE"
        assert report.methodology_version == "0.1.0"

    def test_report_keeps_concentration_per_stage(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        report = self._approved_report(cid_a, "test-report-stages")
        by_stage = {s.stage_code: s for s in report.value_chain.stages}
        # Extraction (deux pays) et raffinage (dominé) restent distincts.
        assert by_stage["extraction"].hhi_pct != by_stage["refining"].hhi_pct
        assert by_stage["refining"].top_country_code == "XA"

    def test_unapproved_report_warns_it_must_not_be_sent(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-report-draft"
        _seed_material(cid_a, material)
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(material_id=material, assessment_year=2026),
        )
        report = article24_service.build_report(company_id=cid_a, assessment_id=assessment.id)
        assert any("non approuvé" in w for w in report.warnings)
        assert any("jamais calculée" in w for w in report.warnings)

    def test_report_is_tenant_isolated(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        assessment = article24_service.create_assessment(
            company_id=cid_a,
            payload=Article24AssessmentCreate(
                material_id="test-report-iso", assessment_year=2026
            ),
        )
        with pytest.raises(article24_service.Article24Error, match="introuvable"):
            article24_service.build_report(company_id=cid_b, assessment_id=assessment.id)
