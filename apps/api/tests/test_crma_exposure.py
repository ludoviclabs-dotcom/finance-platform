"""
test_crma_exposure.py — observations par étape, concentration, licence et
exposition tenant (PR-07).

DB-gated. Vérifie le CÂBLAGE des règles prouvées purement dans
`test_crma_scoring.py` : que la base, les services et le score se parlent sans
perdre en route la séparation des étapes, la séparation risque/confiance ni le
gating de licence.

Point le plus important du module :
`TestPerStageConcentrationIsNotMixed` prouve CONTRE UNE VRAIE BASE que
l'extraction n'est jamais fondue dans le raffinage.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest

from db.database import db_available
from models.crma import (
    ExposureCreate,
    MarketObservationCreate,
    StageObservationCreate,
)
from services.crma import exposure_service, stage_service

from ._crma_fixtures import (
    MATERIAL_ND,
    insert_bom_item,
    insert_material_mapping,
    insert_product,
    insert_source_with_license,
    insert_supplier,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(
    not db_available(), reason="psycopg2/PostgreSQL non disponible"
)


def _observe(cid: int, material: str, stage: str, country: str, share: float, **kw):
    return stage_service.record_stage_observation(
        company_id=cid,
        payload=StageObservationCreate(
            material_id=material, stage_code=stage, country_code=country,
            share_pct=share, reference_year=kw.get("year", 2025),
            data_status=kw.get("data_status", "estimated"),
            source_release_id=kw.get("source_release_id"),
        ),
    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestStageObservations:
    def test_observation_requires_a_known_stage(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        with pytest.raises(stage_service.StageObservationError, match="introuvable"):
            _observe(cid_a, "test-obs-mat", "etape-inventee", "XX", 50.0)

    def test_verified_observation_without_release_is_rejected(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        with pytest.raises(stage_service.StageObservationError, match="requiert une release"):
            _observe(cid_a, "test-obs-mat", "extraction", "XX", 50.0, data_status="verified")

    def test_reimport_is_idempotent_on_the_natural_key(self, two_companies_crma):
        """Ré-observer (matière, étape, pays, année) MET À JOUR au lieu de
        dupliquer — sinon un HHI compterait deux fois le même pays."""
        cid_a, _ = two_companies_crma
        first = _observe(cid_a, "test-idem", "extraction", "XX", 40.0)
        second = _observe(cid_a, "test-idem", "extraction", "XX", 55.0)
        assert first.id == second.id
        assert second.share_pct == 55.0
        listed = stage_service.list_stage_observations(
            company_id=cid_a, material_id="test-idem", stage_code="extraction"
        )
        assert listed.total == 1

    def test_same_country_at_two_stages_is_two_rows(self, two_companies_crma):
        """Un même pays peut peser à l'extraction ET au raffinage : ce sont deux
        faits distincts, jamais fusionnés."""
        cid_a, _ = two_companies_crma
        _observe(cid_a, "test-two-stages", "extraction", "XX", 30.0)
        _observe(cid_a, "test-two-stages", "refining", "XX", 90.0)
        listed = stage_service.list_stage_observations(
            company_id=cid_a, material_id="test-two-stages"
        )
        assert listed.total == 2
        assert {o.stage_code for o in listed.items} == {"extraction", "refining"}

    def test_observations_are_tenant_isolated(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        _observe(cid_a, "test-iso-obs", "extraction", "XX", 100.0)
        assert stage_service.list_stage_observations(
            company_id=cid_b, material_id="test-iso-obs"
        ).total == 0


@_skip_no_db_url
@_skip_no_psycopg2
class TestPerStageConcentrationIsNotMixed:
    """Le gate de la Phase 6, prouvé contre une vraie base."""

    def test_extraction_stays_separate_from_refining(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-chain-split"
        # Extraction diversifiée : 4 pays à 25 %.
        for country in ("XA", "XB", "XC", "XD"):
            _observe(cid_a, material, "extraction", country, 25.0)
        # Raffinage monopolistique : 1 pays à 100 %.
        _observe(cid_a, material, "refining", "XA", 100.0)

        chain = stage_service.get_value_chain(company_id=cid_a, material_id=material)
        by_stage = {s.stage_code: s for s in chain.stages}
        assert by_stage["extraction"].hhi_pct == 25.0
        assert by_stage["refining"].hhi_pct == 100.0
        # Aucune étape ne porte la moyenne des deux.
        assert all(s.hhi_pct != 62.5 for s in chain.stages if s.hhi_pct is not None)

    def test_value_chain_exposes_every_stage_even_empty(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-chain-holes"
        _observe(cid_a, material, "magnet", "XA", 80.0)
        chain = stage_service.get_value_chain(company_id=cid_a, material_id=material)
        assert chain.stages_total == 8
        assert chain.stages_with_data == 1
        empty = [s for s in chain.stages if s.country_count == 0]
        assert len(empty) == 7
        assert all(s.hhi_pct is None for s in empty)

    def test_score_component_names_the_worst_stage(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-chain-worst"
        for country in ("XA", "XB"):
            _observe(cid_a, material, "extraction", country, 50.0)
        _observe(cid_a, material, "refining", "XA", 100.0)

        score = exposure_service.compute_exposure_score(
            company_id=cid_a, material_id=material
        )
        comp = next(c for c in score.components if c.code == "stage_concentration")
        assert comp.stage_code == "refining"
        assert comp.risk_value == 100.0


@_skip_no_db_url
@_skip_no_psycopg2
class TestRiskAndConfidenceStaySeparate:
    def test_score_returns_two_independent_numbers(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-score-two"
        _observe(cid_a, material, "refining", "XA", 95.0)
        _observe(cid_a, material, "refining", "XB", 5.0)

        analysis = exposure_service.analyse_material(company_id=cid_a, material_id=material)
        score = analysis.data
        assert score.risk_score is not None
        assert score.confidence is not None
        # Les deux voyagent séparément jusque dans l'enveloppe analytique.
        assert analysis.meta.quality["confidence"] == score.confidence
        assert "risk_score" not in analysis.meta.quality

    def test_envelope_carries_versioned_method_and_estimated_status(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-score-meta"
        _observe(cid_a, material, "extraction", "XA", 70.0)

        analysis = exposure_service.analyse_material(company_id=cid_a, material_id=material)
        assert analysis.meta.method == {"code": "CC-MATERIAL-EXPOSURE", "version": "0.1.0"}
        # Un score est une DÉRIVATION : jamais 'verified'.
        assert analysis.meta.status == "estimated"

    def test_disclaimer_is_attached_to_every_result(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-score-disclaimer"
        _observe(cid_a, material, "extraction", "XA", 100.0)
        score = exposure_service.compute_exposure_score(company_id=cid_a, material_id=material)
        assert "n'est PAS un score officiel" in score.disclaimer


@_skip_no_db_url
@_skip_no_psycopg2
class TestLicenseGating:
    """`license_policy.evaluate` est éprouvée pour de vrai — aucun mock."""

    def test_price_is_withheld_when_display_not_allowed(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        _, release_id = insert_source_with_license(
            cid_a, "TEST-NO-DISPLAY", display_allowed=False
        )
        created = stage_service.record_market_observation(
            company_id=cid_a,
            payload=MarketObservationCreate(
                material_id="test-lic-a", metric_code="spot_price",
                source_release_id=release_id, observed_at=datetime.now(timezone.utc),
                numeric_value=123.45, unit="EUR/kg", currency="EUR",
            ),
        )
        # La valeur ne quitte PAS le serveur : pas seulement masquée à l'affichage.
        assert created.display_allowed is False
        assert created.value_withheld is True
        assert created.numeric_value is None
        assert created.unit is None
        assert created.license_reasons

    def test_price_is_returned_when_display_allowed(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        _, release_id = insert_source_with_license(cid_a, "TEST-DISPLAY-OK")
        created = stage_service.record_market_observation(
            company_id=cid_a,
            payload=MarketObservationCreate(
                material_id="test-lic-b", metric_code="spot_price",
                source_release_id=release_id, observed_at=datetime.now(timezone.utc),
                numeric_value=99.5, unit="EUR/kg",
            ),
        )
        assert created.display_allowed is True
        assert created.value_withheld is False
        assert created.numeric_value == 99.5

    def test_storage_refused_blocks_recording_entirely(self, two_companies_crma):
        """Si la licence interdit la conservation, on n'écrit rien du tout."""
        cid_a, _ = two_companies_crma
        _, release_id = insert_source_with_license(
            cid_a, "TEST-NO-STORE", storage_allowed=False
        )
        with pytest.raises(stage_service.StageObservationError, match="conservation"):
            stage_service.record_market_observation(
                company_id=cid_a,
                payload=MarketObservationCreate(
                    material_id="test-lic-c", metric_code="spot_price",
                    source_release_id=release_id, observed_at=datetime.now(timezone.utc),
                    numeric_value=10.0,
                ),
            )

    def test_unknown_release_is_refused(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        with pytest.raises(stage_service.StageObservationError, match="introuvable"):
            stage_service.record_market_observation(
                company_id=cid_a,
                payload=MarketObservationCreate(
                    material_id="test-lic-d", metric_code="spot_price",
                    source_release_id=999_999_999, observed_at=datetime.now(timezone.utc),
                ),
            )

    def test_derived_use_refused_lowers_confidence_not_risk(self, two_companies_crma):
        """Le cœur du contrat §8 : un droit dérivé refusé dégrade la CONFIANCE,
        jamais le risque."""
        cid_a, _ = two_companies_crma
        material = "test-lic-derived"
        _observe(cid_a, material, "refining", "XA", 90.0)
        _observe(cid_a, material, "refining", "XB", 10.0)

        before = exposure_service.compute_exposure_score(company_id=cid_a, material_id=material)

        _, release_id = insert_source_with_license(
            cid_a, "TEST-NO-DERIVED", derived_use_allowed=False
        )
        stage_service.record_market_observation(
            company_id=cid_a,
            payload=MarketObservationCreate(
                material_id=material, metric_code="spot_price",
                source_release_id=release_id, observed_at=datetime.now(timezone.utc),
                numeric_value=42.0,
            ),
        )
        after = exposure_service.compute_exposure_score(company_id=cid_a, material_id=material)

        assert after.risk_score == before.risk_score
        assert after.confidence < before.confidence
        assert any("licence" in w for w in after.warnings)

    def test_market_usability_counts_blocked_observations(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-lic-count"
        _, ok_release = insert_source_with_license(cid_a, "TEST-COUNT-OK")
        _, ko_release = insert_source_with_license(
            cid_a, "TEST-COUNT-KO", derived_use_allowed=False
        )
        for release_id in (ok_release, ko_release):
            stage_service.record_market_observation(
                company_id=cid_a,
                payload=MarketObservationCreate(
                    material_id=material, metric_code="spot_price",
                    source_release_id=release_id, observed_at=datetime.now(timezone.utc),
                    numeric_value=1.0,
                ),
            )
        total, blocked = stage_service.market_usability(company_id=cid_a, material_id=material)
        assert total == 2
        assert blocked == 1


@_skip_no_db_url
@_skip_no_psycopg2
class TestExposuresAndBomLinks:
    def test_exposure_links_to_bom_item_and_mapping(self, two_companies_crma):
        """Rattachement à la nomenclature PR-05A : c'est ce qui relie une
        matière critique à un composant réel du produit."""
        cid_a, _ = two_companies_crma
        product_id = insert_product(cid_a, "Produit CRMA lié")
        _, bom_item_id = insert_bom_item(cid_a, product_id)
        mapping_id = insert_material_mapping(cid_a, bom_item_id)
        supplier_id = insert_supplier(cid_a, "Fournisseur lié")

        exposure = exposure_service.create_exposure(
            company_id=cid_a,
            payload=ExposureCreate(
                material_id=MATERIAL_ND, stage_code="magnet",
                bom_item_id=bom_item_id, material_mapping_id=mapping_id,
                product_id=product_id, supplier_id=supplier_id,
                annual_mass_kg=1200.0, share_of_supply_pct=80.0,
                stock_coverage_days=45.0, reference_year=2025,
            ),
        )
        assert exposure.bom_item_id == bom_item_id
        assert exposure.material_mapping_id == mapping_id
        assert exposure.stock_coverage_days == 45.0

        fetched = exposure_service.get_exposure(company_id=cid_a, exposure_id=exposure.id)
        assert fetched.id == exposure.id

    def test_bom_item_of_another_tenant_is_refused(self, two_companies_crma):
        """Anti-IDOR : deviner un id ne suffit pas à s'accrocher au BOM d'autrui.
        Le message ne distingue pas « inexistant » de « hors périmètre »."""
        cid_a, cid_b = two_companies_crma
        product_id = insert_product(cid_a, "Produit privé")
        _, bom_item_id = insert_bom_item(cid_a, product_id, version="v-private")

        with pytest.raises(exposure_service.ExposureError, match="introuvable ou hors périmètre"):
            exposure_service.create_exposure(
                company_id=cid_b,
                payload=ExposureCreate(material_id=MATERIAL_ND, bom_item_id=bom_item_id),
            )

    def test_exposure_is_not_readable_across_tenants(self, two_companies_crma):
        cid_a, cid_b = two_companies_crma
        exposure = exposure_service.create_exposure(
            company_id=cid_a,
            payload=ExposureCreate(material_id="test-expo-isolated", annual_mass_kg=10.0),
        )
        with pytest.raises(exposure_service.ExposureError, match="introuvable"):
            exposure_service.get_exposure(company_id=cid_b, exposure_id=exposure.id)
        assert exposure_service.list_exposures(
            company_id=cid_b, material_id="test-expo-isolated"
        ).total == 0

    def test_supplier_concentration_feeds_the_score(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-supplier-hhi"
        _observe(cid_a, material, "extraction", "XA", 60.0)
        s1 = insert_supplier(cid_a, "Fournisseur unique")
        exposure_service.create_exposure(
            company_id=cid_a,
            payload=ExposureCreate(
                material_id=material, supplier_id=s1, share_of_supply_pct=100.0
            ),
        )
        score = exposure_service.compute_exposure_score(company_id=cid_a, material_id=material)
        comp = next(c for c in score.components if c.code == "supplier_dependency")
        assert comp.available is True
        assert comp.risk_value == 100.0  # fournisseur unique -> HHI maximal

    def test_lowest_stock_coverage_wins(self, two_companies_crma):
        """C'est le maillon le plus court qui détermine la rupture, pas la moyenne."""
        cid_a, _ = two_companies_crma
        material = "test-stock-min"
        _observe(cid_a, material, "extraction", "XA", 50.0)
        for days in (200.0, 20.0, 120.0):
            exposure_service.create_exposure(
                company_id=cid_a,
                payload=ExposureCreate(material_id=material, stock_coverage_days=days),
            )
        score = exposure_service.compute_exposure_score(company_id=cid_a, material_id=material)
        comp = next(c for c in score.components if c.code == "stock_coverage")
        assert comp.raw_value == 20.0


@_skip_no_db_url
@_skip_no_psycopg2
class TestEvidenceLinkage:
    def test_evidence_refs_expose_artifacts_not_urls(self, two_companies_crma):
        """Les preuves circulent par référence (artifact_id + release), jamais
        par URL directe (contrats §4)."""
        cid_a, _ = two_companies_crma
        material = "test-evidence"
        _, release_id = insert_source_with_license(cid_a, "TEST-EVIDENCE-SRC")
        _observe(
            cid_a, material, "extraction", "XA", 70.0,
            data_status="verified", source_release_id=release_id,
        )
        analysis = exposure_service.analyse_material(company_id=cid_a, material_id=material)
        # Aucune URL nulle part dans l'enveloppe de preuve.
        for ref in analysis.evidence:
            assert "url" not in ref
            assert "http" not in str(ref).lower()

    def test_verified_observation_carries_its_release(self, two_companies_crma):
        cid_a, _ = two_companies_crma
        material = "test-evidence-release"
        _, release_id = insert_source_with_license(cid_a, "TEST-EV-REL")
        obs = _observe(
            cid_a, material, "refining", "XA", 80.0,
            data_status="verified", source_release_id=release_id,
        )
        assert obs.data_status == "verified"
        assert obs.source_release_id == release_id
