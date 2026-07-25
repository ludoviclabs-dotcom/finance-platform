"""
tests/test_water_intelligence_source_status.py — état public des sources et
snapshot vide canonique (P16, Wave E, commit E1).

AUCUNE base requise, AUCUN réseau, AUCUNE horloge.

| Exigence | Classe de test |
|---|---|
| licence vérifiée ≠ publication autorisée | `TestTwoAxesNeverMerged` |
| cinq états publics distincts | `TestFiveStates` |
| granularité de licence explicite | `TestLicenseScope` |
| snapshot vide réel, pas une constante écrite à la main | `TestCanonicalSnapshot` |
| documents canoniques synchronisés avec leurs miroirs | `TestDocumentParity` |
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.water_intelligence.public_snapshot import canonical_empty_document
from services.water_intelligence.publication_decisions import current_registry
from services.water_intelligence.source_status import (
    CURRENT_SOURCE_STATUS,
    SourceStatus,
    SourceStatusError,
    public_source_document,
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONTRACTS = _REPO_ROOT / "docs" / "carbonco" / "water-intelligence" / "contracts"
_MIRRORS = _REPO_ROOT / "apps" / "carbon" / "lib" / "water-intelligence"

REGISTRY = current_registry()


class TestTwoAxesNeverMerged:
    """Identifier une licence permissive ne rend rien publiable."""

    def test_every_license_is_verified_and_nothing_is_publishable(self) -> None:
        document = public_source_document()
        assert document["license_verified_count"] == document["source_count"]
        assert document["publishable_count"] == 0

    def test_license_and_publication_are_separate_fields(self) -> None:
        for source in public_source_document()["sources"]:  # type: ignore[index]
            assert "license_verified" in source
            assert "state" in source
            # Aucun champ ne fusionne les deux axes en un « statut » unique.
            assert "status" not in source

    def test_every_source_says_what_is_missing_to_publish(self) -> None:
        for status in CURRENT_SOURCE_STATUS:
            assert status.blocking_reason.strip()


class TestFiveStates:
    """Trois refus qui n'ont pas la même cause ne s'affichent pas pareil."""

    def test_wri_is_publication_blocked_not_a_data_problem(self) -> None:
        wri = next(s for s in CURRENT_SOURCE_STATUS if s.source_code == "WRI_AQUEDUCT")
        assert wri.state(REGISTRY) == "publication_blocked"
        assert wri.license_verified is True
        assert "enregistrement" in wri.blocking_reason.lower()

    def test_copernicus_is_decoder_deferred_not_a_refusal(self) -> None:
        edo = next(s for s in CURRENT_SOURCE_STATUS if s.source_code == "COPERNICUS_EDO")
        assert edo.state(REGISTRY) == "decoder_deferred"
        assert edo.connector_status == "source_verified_decoder_deferred"

    def test_eea_and_hubeau_await_a_human_decision(self) -> None:
        pending = sorted(
            s.source_code for s in CURRENT_SOURCE_STATUS if s.state(REGISTRY) == "decision_pending"
        )
        assert pending == [
            "EEA_WEI_PLUS",
            "HUBEAU_ADES",
            "HUBEAU_BNPE_PRELEVEMENTS",
            "HUBEAU_HYDROMETRIE",
            "HUBEAU_QUALITE_SURFACE",
        ]

    def test_a_source_absent_from_the_registry_has_no_decision(self) -> None:
        orphan = SourceStatus(
            source_code="SOURCE_INCONNUE",
            label="Source de test",
            license_code=None,
            license_scope="unknown",
            license_verified_in=None,
            connector_status="source_verified",
            blocking_reason="Aucune décision enregistrée.",
        )
        assert orphan.state(REGISTRY) == "no_decision"


class TestLicenseScope:
    """« Vérifiée pour la plateforme » n'est pas « vérifiée pour ce jeu »."""

    def test_hubeau_licenses_are_verified_at_platform_level_only(self) -> None:
        for status in CURRENT_SOURCE_STATUS:
            if status.source_code.startswith("HUBEAU_"):
                assert status.license_scope == "platform"

    def test_european_sources_are_verified_at_dataset_level(self) -> None:
        for code in ("WRI_AQUEDUCT", "EEA_WEI_PLUS", "COPERNICUS_EDO"):
            status = next(s for s in CURRENT_SOURCE_STATUS if s.source_code == code)
            assert status.license_scope == "dataset"

    def test_an_unverified_license_cannot_carry_a_scope(self) -> None:
        with pytest.raises(SourceStatusError, match="granularité"):
            SourceStatus(
                source_code="X",
                label="X",
                license_code=None,
                license_scope="dataset",
                license_verified_in=None,
                connector_status="source_verified",
                blocking_reason="…",
            )

    def test_a_verified_license_must_declare_its_scope(self) -> None:
        with pytest.raises(SourceStatusError, match="granularité"):
            SourceStatus(
                source_code="X",
                label="X",
                license_code="CC-BY-4.0",
                license_scope="unknown",
                license_verified_in="Wave A",
                connector_status="source_verified",
                blocking_reason="…",
            )


class TestCanonicalSnapshot:
    """Le snapshot public est ASSEMBLÉ, pas écrit à la main."""

    def test_it_is_empty_and_says_so(self) -> None:
        document = canonical_empty_document()
        assert document["is_empty"] is True
        assert document["manifest"] is None
        assert document["coverage"]["observation_count"] == 0
        assert document["coverage"]["layer_count"] == 0

    def test_it_carries_the_seven_real_exclusions(self) -> None:
        document = canonical_empty_document()
        assert len(document["exclusions"]) == 7
        for exclusion in document["exclusions"]:
            assert exclusion["detail"].strip()

    def test_it_carries_no_assembly_date(self) -> None:
        """Un document versionné dans le dépôt ne peut pas porter une date
        d'assemblage réelle : elle serait fausse dès le lendemain."""
        assert canonical_empty_document()["generated_at"] == ""

    def test_it_is_deterministic(self) -> None:
        first = json.dumps(canonical_empty_document(), sort_keys=True, default=str)
        second = json.dumps(canonical_empty_document(), sort_keys=True, default=str)
        assert first == second

    def test_it_carries_no_tenant_field(self) -> None:
        serialised = json.dumps(canonical_empty_document(), default=str)
        for field in ("company_id", "tenant_id", "site_id", "user_id"):
            assert field not in serialised


class TestDocumentParity:
    """Cinq documents canoniques, cinq miroirs, aucune dérive possible."""

    PAIRS = (
        ("PUBLIC_SNAPSHOT_EMPTY.json", "public-snapshot-empty.json"),
        ("SOURCE_STATUS.json", "source-status.json"),
        ("REGULATORY_REGISTRY.json", "regulatory-registry.json"),
        ("MODULE_BRIDGES.json", "module-bridges.json"),
        ("FINANCIAL_ENGINE.json", "financial-engine.json"),
    )

    @pytest.mark.parametrize("canonical,mirror", PAIRS)
    def test_mirror_is_byte_identical(self, canonical: str, mirror: str) -> None:
        assert (_MIRRORS / mirror).read_text(encoding="utf-8") == (
            _CONTRACTS / canonical
        ).read_text(encoding="utf-8")

    @pytest.mark.parametrize("canonical,_mirror", PAIRS)
    def test_no_published_document_carries_a_tenant_field(
        self, canonical: str, _mirror: str
    ) -> None:
        raw = (_CONTRACTS / canonical).read_text(encoding="utf-8")
        for field in ("company_id", "tenant_id", "site_id", "user_id"):
            assert field not in raw

    def test_snapshot_document_matches_the_assembler(self) -> None:
        expected = (
            json.dumps(canonical_empty_document(), ensure_ascii=False, indent=2, sort_keys=True)
            + "\n"
        )
        assert (_CONTRACTS / "PUBLIC_SNAPSHOT_EMPTY.json").read_text(encoding="utf-8") == expected

    def test_source_status_document_matches_the_registry(self) -> None:
        expected = (
            json.dumps(public_source_document(), ensure_ascii=False, indent=2, sort_keys=True)
            + "\n"
        )
        assert (_CONTRACTS / "SOURCE_STATUS.json").read_text(encoding="utf-8") == expected

    def test_no_internal_prompt_code_leaks_into_public_copy(self) -> None:
        """Un lecteur public ne sait pas ce que « P13 » désigne.

        Les codes de prompt sont un vocabulaire de pilotage interne ; les
        laisser dans un texte destiné à la surface publique est une fuite de
        jargon, pas une information.
        """
        import re

        for canonical, _ in self.PAIRS:
            raw = (_CONTRACTS / canonical).read_text(encoding="utf-8")
            assert not re.search(r"\bP0[0-9]\b|\bP1[0-8]\b", raw), (
                f"{canonical} contient un code de prompt interne."
            )
