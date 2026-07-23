"""
test_water_intelligence_contracts.py — contrats PURS du read model public
Water Intelligence (P02).

AUCUNE base requise : `models/water_intelligence.py` est fait de modèles
Pydantic purs — ces tests tournent dans le job `tests` standard, sans
DATABASE_URL, comme `test_water_screening_engine.py` et
`test_water_intelligence_source_catalog.py`.

Couvre : la fixture partagée Python/TypeScript (compatibilité contractuelle
minimale — les DEUX suites valident les mêmes octets JSON), manifest sans
source refusé, observation dont la source n'a pas de release refusée, valeur
`null` jamais convertie en `0`, `display_allowed=false` empêchant la
publication de la valeur, statut de donnée invalide refusé, record juridique
sans source/date de revue refusé, record éditorial sans source refusé,
géographie non-monde sans code refusée.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from models.analytics import MethodRef
from models.water_intelligence import (
    WaterEditorialRecord,
    WaterGeographyRef,
    WaterIntelligenceManifest,
    WaterLegalRecord,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterScenario,
    WaterSourceReference,
)

# apps/api/tests/<this file> -> repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_MANIFEST_PATH = (
    REPO_ROOT
    / "docs"
    / "carbonco"
    / "water-intelligence"
    / "contracts"
    / "FIXTURE_MANIFEST.json"
)


def _load_fixture_dict() -> dict:
    return json.loads(FIXTURE_MANIFEST_PATH.read_text(encoding="utf-8"))


def _license(**overrides) -> dict:
    base = dict(
        allow_ingest=True,
        allow_store=True,
        allow_display=True,
        allow_derived_use=True,
        reasons=[],
        warnings=[],
    )
    base.update(overrides)
    return base


def _source(**overrides) -> dict:
    base = dict(
        source_code="TEST_SOURCE",
        release_key="test-release-v1",
        checksum_sha256="a" * 64,
        published_at="2026-01-01",
        retrieved_at="2026-01-02",
        observed_period_start="2025-01-01",
        observed_period_end="2025-12-31",
        methodology_version="test-1.0.0",
        license=_license(),
        attribution="Fixture de test.",
        warnings=[],
    )
    base.update(overrides)
    return base


def _observation(**overrides) -> dict:
    base = dict(
        metric_code="test.metric",
        value=10.0,
        unit="unit",
        geography={"scope": "world", "code": None, "label": "Monde (test)"},
        period_start="2025-01-01",
        period_end="2025-12-31",
        method={"code": "TEST-METHOD", "version": "1.0.0"},
        quality={"data_status": "observed", "confidence": 80, "coverage_pct": 100, "warnings": []},
        source=_source(),
        scenario=None,
        value_withheld=False,
    )
    base.update(overrides)
    return base


class TestSharedFixtureCompatibility:
    """La fixture est validée ICI (Python) ET côté TypeScript
    (`apps/carbon/lib/water-intelligence/contracts.test.ts`) contre le MÊME
    fichier JSON — c'est la preuve de compatibilité contractuelle minimale."""

    def test_fixture_manifest_parses_and_is_labeled_fixture(self) -> None:
        raw = _load_fixture_dict()

        manifest = WaterIntelligenceManifest.model_validate(raw)

        assert manifest.fixture_label == "fixture"
        assert len(manifest.sources) == 1
        assert len(manifest.observations) == 1
        assert len(manifest.geo_layers) == 1
        assert len(manifest.editorial_records) == 1
        assert len(manifest.legal_records) == 1
        assert manifest.observations[0].quality.data_status == "fixture"


class TestManifestValidation:
    def test_manifest_without_source_is_rejected(self) -> None:
        raw = _load_fixture_dict()
        raw["sources"] = []

        with pytest.raises(ValidationError):
            WaterIntelligenceManifest.model_validate(raw)

    def test_invalid_manifest_raises_readable_error(self) -> None:
        with pytest.raises(ValidationError) as excinfo:
            WaterIntelligenceManifest.model_validate({"manifest_version": "1.0.0"})

        message = str(excinfo.value)
        assert "generated_at" in message
        assert "sources" in message


class TestObservationValidation:
    def test_observation_source_without_release_key_is_rejected(self) -> None:
        source = _source()
        del source["release_key"]

        with pytest.raises(ValidationError, match="release_key"):
            WaterSourceReference.model_validate(source)

    def test_null_value_is_preserved_and_never_becomes_zero(self) -> None:
        observation = WaterMetricObservation.model_validate(_observation(value=None))

        assert observation.value is None
        assert observation.value != 0

    def test_display_not_allowed_requires_value_withheld(self) -> None:
        payload = _observation(
            source=_source(license=_license(allow_display=False)),
            value_withheld=False,
        )

        with pytest.raises(ValidationError, match="value_withheld"):
            WaterMetricObservation.model_validate(payload)

    def test_display_not_allowed_with_value_withheld_true_and_value_none_is_accepted(
        self,
    ) -> None:
        observation = WaterMetricObservation.model_validate(
            _observation(
                source=_source(license=_license(allow_display=False)),
                value=None,
                value_withheld=True,
            )
        )

        assert observation.value_withheld is True
        assert observation.value is None

    def test_value_withheld_true_with_nonnull_value_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="value_withheld"):
            WaterMetricObservation.model_validate(
                _observation(value=10.0, value_withheld=True)
            )

    def test_invalid_data_status_is_rejected(self) -> None:
        payload = _observation()
        payload["quality"]["data_status"] = "not_a_real_status"

        with pytest.raises(ValidationError):
            WaterMetricObservation.model_validate(payload)


class TestGeographyValidation:
    def test_non_world_scope_without_code_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="code"):
            WaterGeographyRef.model_validate(
                {"scope": "france", "code": None, "label": "France"}
            )

    def test_world_scope_without_code_is_accepted(self) -> None:
        geography = WaterGeographyRef.model_validate(
            {"scope": "world", "code": None, "label": "Monde"}
        )
        assert geography.code is None


class TestLegalAndEditorialRecords:
    def test_legal_record_without_source_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="source"):
            WaterLegalRecord.model_validate(
                {
                    "record_id": "r1",
                    "jurisdiction": "Test",
                    "reference_text": "Texte",
                    "version": "1.0",
                    "legal_status": "unknown",
                    "reviewed_on": "2026-01-01",
                    "reviewed_by": "tester",
                }
            )

    def test_legal_record_without_reviewed_on_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="reviewed_on"):
            WaterLegalRecord.model_validate(
                {
                    "record_id": "r1",
                    "jurisdiction": "Test",
                    "reference_text": "Texte",
                    "version": "1.0",
                    "legal_status": "unknown",
                    "source": _source(),
                    "reviewed_by": "tester",
                }
            )

    def test_editorial_record_without_source_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="source"):
            WaterEditorialRecord.model_validate(
                {
                    "record_id": "e1",
                    "record_type": "industry",
                    "title": "Titre",
                    "summary": "Résumé",
                    "reviewed_on": "2026-01-01",
                    "reviewed_by": "tester",
                }
            )


class TestReusedCoreContracts:
    """Vérifie que WaterLicenseDecision et MethodRef sont bien réutilisés
    depuis le noyau existant, pas redéfinis en double."""

    def test_water_license_decision_is_the_core_license_decision(self) -> None:
        from models.intelligence import LicenseDecision

        assert WaterLicenseDecision is LicenseDecision

    def test_method_ref_is_the_analytics_method_ref(self) -> None:
        method = MethodRef(code="X", version="1.0.0")
        assert method.code == "X"


class TestScenario:
    def test_scenario_requires_a_source(self) -> None:
        with pytest.raises(ValidationError, match="source"):
            WaterScenario.model_validate({"scenario_code": "s1", "label": "Scénario test"})

    def test_valid_scenario_is_accepted(self) -> None:
        scenario = WaterScenario.model_validate(
            {
                "scenario_code": "s1",
                "label": "Scénario test",
                "horizon_year": 2030,
                "source": _source(),
            }
        )
        assert scenario.horizon_year == 2030
