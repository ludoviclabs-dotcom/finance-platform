"""
tests/test_water_intelligence_legal_contracts.py — statuts et références
juridiques (P16, Wave E, commit E2).

AUCUNE base requise, AUCUN réseau.

Deux reliquats signalés par la Wave D sont soldés ici :

1. `WaterLegalStatus` ne savait pas dire `repealed`, ce qui forçait une
   conversion destructive vers `out_of_scope` ;
2. `WaterLegalRecord.source` exigeait une `WaterSourceReference`, conçue pour
   une release de jeu de données — donc une empreinte, une clé de release et
   une licence de données fabriquées pour un texte de loi.

| Exigence | Classe de test |
|---|---|
| `repealed` conservé de bout en bout | `TestRepealedSurvives` |
| aucune conversion destructive | `TestNoDestructiveConversion` |
| aucune release / empreinte juridique fabriquée | `TestNoFakeDatasetReference` |
| parité Python / TypeScript | `TestPythonTypeScriptParity` |
| fixture migrée de façon versionnée | `TestFixtureMigration` |
| aucune conclusion juridique nouvelle | `TestNoNewLegalFact` |
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from models.water_intelligence import (
    OfficialLegalReference,
    WaterLegalRecord,
    WaterSourceReference,
)
from services.water_intelligence.regulatory_registry import (
    CURRENT_RULES,
    HumanReview,
    OfficialSource,
    RegulatoryRule,
    TranspositionState,
    current_registry,
    to_public_legal_status,
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONTRACTS_TS = (
    _REPO_ROOT / "apps" / "carbon" / "lib" / "water-intelligence" / "contracts.ts"
)
_FIXTURE = (
    _REPO_ROOT
    / "docs"
    / "carbonco"
    / "water-intelligence"
    / "contracts"
    / "FIXTURE_MANIFEST.json"
)

SOURCE = OfficialSource(
    publisher="Éditeur de test",
    reference="TEST-001",
    url="https://example.invalid/texte",
    retrieved_on=date(2026, 1, 1),
    verified_by="Réviseur de test",
)
REVIEW = HumanReview(
    reviewed_by="Réviseur de test",
    reviewed_on=date(2026, 1, 2),
    scope_note="Revue de test, texte fictif.",
)


def _rule(**overrides: object) -> RegulatoryRule:
    base: dict[str, object] = {
        "rule_id": "TEST",
        "text_version": "v1",
        "jurisdiction": "EU",
        "instrument_kind": "directive",
        "title": "Texte de test",
        "text_reference": "TEST-001",
        "legal_status": "repealed",
        "source": SOURCE,
        "human_review": REVIEW,
    }
    base.update(overrides)
    return RegulatoryRule(**base)  # type: ignore[arg-type]


class TestRepealedSurvives:
    """Un texte abrogé reste abrogé, du registre au contrat public."""

    def test_public_vocabulary_knows_repealed(self) -> None:
        record = WaterLegalRecord(
            record_id="r",
            jurisdiction="EU",
            reference_text="Texte fictif",
            version="v1",
            legal_status="repealed",
            source=OfficialLegalReference(),
            reviewed_on=date(2026, 1, 1),
            reviewed_by="Réviseur",
        )
        assert record.legal_status == "repealed"

    def test_conversion_preserves_repealed(self) -> None:
        assert to_public_legal_status(_rule()) == "repealed"

    def test_a_voluntary_framework_is_still_voluntary_even_if_repealed(self) -> None:
        """L'ordre des règles de conversion reste explicite et testé."""
        rule = _rule(
            instrument_kind="voluntary_framework",
            transposition=TranspositionState(status="not_applicable"),
        )
        assert to_public_legal_status(rule) == "voluntary"


class TestNoDestructiveConversion:
    """« Abrogé » et « hors champ » ne sont pas interchangeables."""

    def test_repealed_is_never_converted_to_out_of_scope(self) -> None:
        assert to_public_legal_status(_rule()) != "out_of_scope"

    def test_the_converter_contains_no_repealed_to_out_of_scope_mapping(self) -> None:
        """Garde-fou de code : la conversion ne doit pas revenir par mégarde."""
        module = (
            Path(__file__).resolve().parents[1]
            / "services"
            / "water_intelligence"
            / "regulatory_registry.py"
        ).read_text(encoding="utf-8")
        body = module[module.index("def to_public_legal_status") :]
        body = body[: body.index("\n# ---")] if "\n# ---" in body else body
        # Dans le corps de la fonction, `repealed` ne doit jamais rendre
        # `out_of_scope`. On vérifie qu'aucune ligne ne les associe.
        for line in body.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            assert not ("repealed" in stripped and "out_of_scope" in stripped)

    def test_out_of_scope_still_exists_for_its_own_meaning(self) -> None:
        """`out_of_scope` reste valide — pour un texte en vigueur hors champ."""
        record = WaterLegalRecord(
            record_id="r",
            jurisdiction="EU",
            reference_text="Texte fictif",
            version="v1",
            legal_status="out_of_scope",
            source=OfficialLegalReference(),
            reviewed_on=date(2026, 1, 1),
            reviewed_by="Réviseur",
        )
        assert record.legal_status == "out_of_scope"


class TestNoFakeDatasetReference:
    """Un texte de loi n'a ni release, ni empreinte, ni licence de données."""

    def test_legal_record_no_longer_accepts_a_dataset_reference(self) -> None:
        dataset_reference = {
            "source_code": "X",
            "release_key": "y",
            "checksum_sha256": "0" * 64,
            "retrieved_at": "2026-01-01",
            "methodology_version": "1.0.0",
            "license": {
                "allow_ingest": True,
                "allow_store": True,
                "allow_display": True,
                "allow_derived_use": True,
                "reasons": [],
                "warnings": [],
            },
        }
        with pytest.raises(ValidationError):
            WaterLegalRecord.model_validate(
                {
                    "record_id": "r",
                    "jurisdiction": "EU",
                    "reference_text": "T",
                    "version": "v1",
                    "legal_status": "unknown",
                    "source": dataset_reference,
                    "reviewed_on": "2026-01-01",
                    "reviewed_by": "R",
                }
            )

    def test_the_two_contracts_share_no_field(self) -> None:
        legal = set(OfficialLegalReference.model_fields)
        dataset = set(WaterSourceReference.model_fields)
        shared = legal & dataset
        # `retrieved_on` / `retrieved_at` sont volontairement nommés
        # différemment : la date de relevé d'un texte n'est pas la date de
        # récupération d'un jeu de données.
        assert shared == set(), f"champs partagés inattendus : {shared}"

    def test_every_field_may_stay_unfilled(self) -> None:
        """Une référence incomplète est un état légitime, pas une erreur."""
        reference = OfficialLegalReference()
        assert reference.official_url is None
        assert reference.official_source_kind == "unknown"
        assert reference.is_verified is False

    def test_a_url_without_a_retrieval_date_is_not_verified(self) -> None:
        reference = OfficialLegalReference(official_url="https://example.invalid/x")
        assert reference.is_verified is False

    def test_a_url_and_a_date_make_it_verified(self) -> None:
        reference = OfficialLegalReference(
            official_url="https://example.invalid/x", retrieved_on=date(2026, 1, 1)
        )
        assert reference.is_verified is True

    def test_a_non_https_url_is_refused(self) -> None:
        with pytest.raises(ValidationError, match="https"):
            OfficialLegalReference(official_url="http://example.invalid/x")


class TestPythonTypeScriptParity:
    """Les deux vocabulaires évoluent dans le même commit, ou pas du tout."""

    def _ts_enum(self, name: str) -> list[str]:
        source = _CONTRACTS_TS.read_text(encoding="utf-8")
        block = source[source.index(f"export const {name} = z.enum([") :]
        block = block[: block.index("]);")]
        return re.findall(r'"([a-z_]+)"', block)

    def test_legal_status_vocabularies_match(self) -> None:
        from typing import get_args

        from models.water_intelligence import WaterLegalStatus

        assert sorted(self._ts_enum("WaterLegalStatusEnum")) == sorted(
            get_args(WaterLegalStatus)
        )

    def test_official_source_kind_vocabularies_match(self) -> None:
        from typing import get_args

        from models.water_intelligence import OfficialSourceKind

        assert sorted(self._ts_enum("OfficialSourceKindEnum")) == sorted(
            get_args(OfficialSourceKind)
        )

    def test_official_legal_reference_fields_match(self) -> None:
        source = _CONTRACTS_TS.read_text(encoding="utf-8")
        block = source[source.index("export const OfficialLegalReferenceSchema = z.object({") :]
        block = block[: block.index("});")]
        ts_fields = set(re.findall(r"^\s{2}([a-z_]+):", block, flags=re.MULTILINE))
        assert ts_fields == set(OfficialLegalReference.model_fields)


class TestFixtureMigration:
    """La fixture gelée a migré de façon EXPLICITE et versionnée."""

    def test_manifest_version_was_bumped(self) -> None:
        data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
        assert data["manifest_version"] == "1.1.0", (
            "un changement incompatible de schéma doit être versionné, pas "
            "appliqué en silence."
        )

    def test_fixture_legal_record_carries_no_fabricated_checksum(self) -> None:
        data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
        for record in data["legal_records"]:
            assert "checksum_sha256" not in record["source"]
            assert "release_key" not in record["source"]
            assert "license" not in record["source"]

    def test_fixture_still_validates_against_the_contract(self) -> None:
        from models.water_intelligence import WaterIntelligenceManifest

        WaterIntelligenceManifest.model_validate(
            json.loads(_FIXTURE.read_text(encoding="utf-8"))
        )


class TestNoNewLegalFact:
    """E2 corrige des contrats. Il n'instruit aucun texte."""

    def test_no_rule_became_verified(self) -> None:
        assert all(not rule.is_verified for rule in CURRENT_RULES)

    def test_every_rule_still_evaluates_to_unknown(self) -> None:
        for entry in current_registry().canonical_document()["rules"]:  # type: ignore[index]
            assert entry["legal_status"] == "unknown"
            assert entry["public_legal_status"] == "unknown"

    def test_no_official_url_was_filled(self) -> None:
        for rule in CURRENT_RULES:
            assert rule.source is None
            assert rule.human_review is None
