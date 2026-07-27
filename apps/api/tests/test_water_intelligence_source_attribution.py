"""tests/test_water_intelligence_source_attribution.py — attribution canonique
par jeu de données, et la porte de provenance de l'assembleur (X4B-PREP).

Deux défauts sont verrouillés ici, tous deux trouvés en revue de la PR #172 :

1. **un libellé de plateforme servi pour trois jeux différents** — corrigé par
   une configuration par `source_code`, sans repli générique possible ;
2. **une source publiée sans provenance citable** — corrigée par une troisième
   barrière d'assemblage, qui écarte avec motif plutôt que de publier muet.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from models.water_intelligence import (
    MethodRef,
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterSourceReference,
)
from services.water_intelligence import source_attribution as sa
from services.water_intelligence.public_snapshot import (
    EXCLUSION_PROVENANCE_INCOMPLETE,
    assemble_public_snapshot,
)
from services.water_intelligence.publication_decisions import (
    PublicationDecision,
    PublicationDecisionRegistry,
)

CANDIDATES = ("HUBEAU_ADES", "HUBEAU_QUALITE_SURFACE", "HUBEAU_BNPE_PRELEVEMENTS")
#: Sources sans attribution canonique. `HUBEAU_HYDROMETRIE` n'y figure PLUS :
#: elle est ingérable, elle a une page officielle, et lui refuser une provenance
#: rendait le graveur dépendant d'un jugement de publication. Sa non-candidature
#: se lit dans `candidate_scopes` et le registre de décisions — pas ici.
UNATTRIBUTED = ("EEA_WEI_PLUS", "WRI_AQUEDUCT", "COPERNICUS_EDO")


class TestPerSourceAttribution:
    """Chaque source candidate reçoit SON libellé, jamais celui d'une autre."""

    @pytest.mark.parametrize("source_code", CANDIDATES)
    def test_every_candidate_has_a_canonical_configuration(self, source_code: str) -> None:
        config = sa.attribution_for(source_code)
        assert config.source_code == source_code
        assert config.information_url.startswith("https://hubeau.eaufrance.fr/page/")

    def test_the_three_labels_are_all_different(self) -> None:
        """Le défaut d'origine : un même libellé pour trois jeux distincts."""
        labels = {sa.attribution_label(c, accessed_on=date(2026, 7, 26)) for c in CANDIDATES}
        assert len(labels) == 3

    def test_the_three_information_urls_are_all_different(self) -> None:
        urls = {sa.information_url(c) for c in CANDIDATES}
        assert len(urls) == 3

    @pytest.mark.parametrize("source_code", CANDIDATES)
    def test_label_names_the_access_point_the_system_and_the_licence(
        self, source_code: str
    ) -> None:
        label = sa.attribution_label(source_code, accessed_on=date(2026, 7, 26))
        assert "Hub'Eau" in label
        assert "Licence Ouverte / Etalab 2.0" in label
        assert "Source officielle : https://" in label
        assert "Consultées le 2026-07-26" in label

    def test_ades_label_does_not_name_unrelated_publishers(self) -> None:
        """Un jeu piézométrique ADES n'est pas produit par le Service Central
        Vigicrues. C'est précisément ce que l'ancien libellé affirmait."""
        label = sa.attribution_label("HUBEAU_ADES", accessed_on=date(2026, 7, 26))
        assert "Vigicrues" not in label
        assert "SCV" not in label

    @pytest.mark.parametrize("source_code", UNATTRIBUTED)
    def test_unattributed_sources_have_no_configuration_and_never_fall_back(
        self, source_code: str
    ) -> None:
        """Aucun repli générique : une source hors périmètre LÈVE.

        Un repli reproduirait exactement le défaut écarté par X4A — un libellé
        plausible servi pour un jeu qu'il ne décrit pas.
        """
        with pytest.raises(sa.SourceAttributionError):
            sa.attribution_for(source_code)

    def test_consultation_date_is_required(self) -> None:
        with pytest.raises(sa.SourceAttributionError):
            sa.attribution_label("HUBEAU_ADES", accessed_on="")


class TestFreshnessIsNeverInvented:
    """Trois faits distincts, dont deux volontairement absents."""

    def test_bnpe_cadence_is_none_because_it_was_never_verified(self) -> None:
        """`None` = « non vérifiée », jamais « pas de mise à jour ».

        Aucune page officielle relevée n'énonce de cadence mensuelle pour la
        BNPE, et data.gouv.fr en déclare une annuelle. Écrire l'une ou l'autre
        sans relevé direct serait une fraîcheur inventée.
        """
        assert sa.refresh_cadence("HUBEAU_BNPE_PRELEVEMENTS") is None

    def test_verified_cadences_are_carried_verbatim(self) -> None:
        assert "quotidien" in sa.refresh_cadence("HUBEAU_ADES").lower()
        assert "continue" in sa.refresh_cadence("HUBEAU_QUALITE_SURFACE").lower()

    @pytest.mark.parametrize("source_code", CANDIDATES)
    def test_no_last_updated_date_is_ever_deduced(self, source_code: str) -> None:
        """Ni du checksum, ni de la période observée, ni de `retrieved_at`.

        Aucune n'a pu être relevée directement : le champ reste vide, et c'est
        la voie de l'URL officielle qui porte la conformité (§1.3 de
        X4A_ATTRIBUTION_AND_FRESHNESS.md).
        """
        assert sa.last_updated_on(source_code) is None

    @pytest.mark.parametrize("source_code", CANDIDATES)
    def test_information_url_is_a_stable_page_not_an_api_call(
        self, source_code: str
    ) -> None:
        """Une requête paramétrée ne décrit pas un jeu de données."""
        url = sa.information_url(source_code)
        assert "?" not in url
        assert "/api/" not in url


class TestConfigurationIsRefusedWhenMalformed:
    def test_api_call_url_is_refused_at_construction(self) -> None:
        with pytest.raises(sa.SourceAttributionError):
            sa.SourceAttribution(
                source_code="X",
                access_point="a",
                provenance="p",
                information_url="https://hubeau.eaufrance.fr/api/v1/x?size=1",
                refresh_cadence=None,
            )

    def test_non_https_url_is_refused(self) -> None:
        with pytest.raises(sa.SourceAttributionError):
            sa.SourceAttribution(
                source_code="X",
                access_point="a",
                provenance="p",
                information_url="ftp://example.invalid/x",
                refresh_cadence=None,
            )


# ---------------------------------------------------------------------------
# Troisième barrière d'assemblage — provenance citable
# ---------------------------------------------------------------------------

#: Horloge injectée — l'assembleur est sans horloge par contrat.
_FIXED_CLOCK = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)

CHECKSUM = "b" * 64
ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)


def _observation(*, information_url: str | None) -> WaterMetricObservation:
    return WaterMetricObservation(
        metric_code="hubeau.piezometrie.niveau_nappe",
        value=42.0,
        unit="m NGF",
        geography=WaterGeographyRef(scope="france", code="34", label="34"),
        period_start=date(2024, 1, 1),
        period_end=date(2024, 1, 1),
        method=MethodRef(code="CC-WI-HUBEAU-PIEZO-PASSTHROUGH", version="1.0.0"),
        quality=WaterQualityMetadata(data_status="observed", coverage_pct=100.0, confidence=90),
        source=WaterSourceReference(
            source_code="HUBEAU_ADES",
            release_key="r-x4b-prep",
            checksum_sha256=CHECKSUM,
            retrieved_at=date(2026, 7, 26),
            methodology_version="1.0.0",
            license=ALLOWED,
            attribution=sa.attribution_label("HUBEAU_ADES", accessed_on=date(2026, 7, 26)),
            source_information_url=information_url,
            source_refresh_cadence=sa.refresh_cadence("HUBEAU_ADES"),
            source_last_updated_on=sa.last_updated_on("HUBEAU_ADES"),
        ),
        value_withheld=False,
    )


def _signed_registry() -> PublicationDecisionRegistry:
    """Registre de TEST portant une signature — jamais le registre réel.

    `CURRENT_DECISIONS` reste intouché : les sept sources y demeurent
    `proposed`/`refused`, et un test qui le modifierait vaudrait approbation.
    """
    return PublicationDecisionRegistry(
        [
            PublicationDecision(
                source_code="HUBEAU_ADES",
                status="approved",
                reason="Signature FICTIVE, propre à ce test.",
                reviewed_by="test",
                reviewed_on=date(2026, 7, 27),
            )
        ]
    )


class TestProvenanceGate:
    def test_source_without_official_url_is_excluded_with_a_named_reason(self) -> None:
        """Écartée AVEC MOTIF — jamais publiée avec une provenance muette."""
        snapshot = assemble_public_snapshot(
            observations=[_observation(information_url=None)],
            registry=_signed_registry(),
            generated_at=_FIXED_CLOCK,
        )
        assert snapshot.included_source_codes == ()
        reasons = {e.source_code: e.reason for e in snapshot.exclusions}
        assert reasons["HUBEAU_ADES"] == EXCLUSION_PROVENANCE_INCOMPLETE

    def test_blank_url_is_treated_as_missing(self) -> None:
        snapshot = assemble_public_snapshot(
            observations=[_observation(information_url="   ")],
            registry=_signed_registry(),
            generated_at=_FIXED_CLOCK,
        )
        assert snapshot.included_source_codes == ()

    def test_source_with_official_url_passes_the_gate(self) -> None:
        snapshot = assemble_public_snapshot(
            observations=[
                _observation(information_url=sa.information_url("HUBEAU_ADES"))
            ],
            registry=_signed_registry(),
            generated_at=_FIXED_CLOCK,
        )
        assert snapshot.included_source_codes == ("HUBEAU_ADES",)

    def test_cadence_survives_the_assembly(self) -> None:
        """Le défaut que ce champ corrige : disparaître à la sérialisation SANS
        erreur, produisant un snapshot valide à fraîcheur muette."""
        snapshot = assemble_public_snapshot(
            observations=[
                _observation(information_url=sa.information_url("HUBEAU_ADES"))
            ],
            registry=_signed_registry(),
            generated_at=_FIXED_CLOCK,
        )
        serialized = snapshot.canonical_json()
        assert "source_refresh_cadence" in serialized
        assert "source_information_url" in serialized
        assert "quotidiennement" in serialized


class TestRealRegistryIsUntouched:
    def test_the_registry_carries_exactly_the_named_human_approvals(self) -> None:
        """Garde-fou : une signature s'écrit à deux endroits, ou elle échoue.

        Le contrôle portait sur « aucune source approuvée ». Il porte
        maintenant sur l'égalité entre le registre et la liste NOMMÉE des
        approbations humaines : basculer une source en `approved` sans nommer
        la même source dans `HUMAN_APPROVED_SOURCE_CODES` échoue ici. Une
        approbation ne peut pas être glissée au milieu d'un diff.
        """
        from services.water_intelligence.publication_decisions import (
            HUMAN_APPROVED_SOURCE_CODES,
            assert_human_approvals_unchanged,
            current_registry,
        )

        assert_human_approvals_unchanged()
        assert current_registry().approved_source_codes == HUMAN_APPROVED_SOURCE_CODES
        assert HUMAN_APPROVED_SOURCE_CODES == ("HUBEAU_BNPE_PRELEVEMENTS",)


class TestAttributionIsNotCandidacy:
    """Décrire un jeu n'est pas le proposer à la publication.

    Confondre les deux rendait le graveur dépendant d'un jugement de
    publication : `HUBEAU_HYDROMETRIE` est ingérable et n'a pas pu être gravée
    parce qu'elle n'avait pas d'attribution canonique — alors que sa
    non-candidature tient à une collision d'identité sous-journalière, qui n'a
    rien à voir avec sa provenance.
    """

    def test_hydrometrie_has_an_attribution(self) -> None:
        config = sa.attribution_for("HUBEAU_HYDROMETRIE")
        assert config.information_url.endswith("/api-hydrometrie")

    def test_hydrometrie_is_not_a_publication_candidate(self) -> None:
        from scripts.water_intelligence import candidate_scopes as cs

        for candidate in cs.CANDIDATES:
            assert "HUBEAU_HYDROMETRIE" not in candidate.source_codes

    def test_hydrometrie_is_not_approved_in_the_real_registry(self) -> None:
        from services.water_intelligence.publication_decisions import current_registry

        assert "HUBEAU_HYDROMETRIE" not in current_registry().approved_source_codes

    def test_hydrometrie_cadence_is_not_invented(self) -> None:
        """« Temps réel » décrit la donnée, pas la fréquence d'intégration."""
        assert sa.refresh_cadence("HUBEAU_HYDROMETRIE") is None
