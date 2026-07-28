"""
tests/test_water_v1_publication.py — la publication Water V1, exercée bout en
bout sans réseau.

## Ce que ces tests prouvent, et ce qu'ils ne peuvent pas prouver

Ils **prouvent** que trois observations BNPE conformes au périmètre signé
traversent l'assembleur public sous le registre RÉEL, produisent un document
sous budget, déterministe, sans donnée tenant et sans aucune autre source ; et
que chacune des divergences énumérées par l'autorisation humaine arrête bien la
publication.

Ils **ne prouvent pas** que l'acquisition réelle rendra ces trois
observations-là : Hub'Eau n'est pas joignable depuis l'environnement de test, et
`workflow_dispatch` relève de l'humain. C'est le rôle du workflow, et le rapport
de preuve qu'il produit est ce qui recoupera le checksum approuvé.

La distinction est volontaire et tenue : les observations ci-dessous sont
FABRIQUÉES pour exercer le chemin de publication, et aucune ne prétend être une
valeur BNPE. Elles portent d'ailleurs des identifiants d'ouvrage explicitement
fictifs.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import (
    MethodRef,
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterMetricObservation,
    WaterQualityMetadata,
    WaterSourceReference,
)
from scripts.water_intelligence import publish_water_v1 as pub
from scripts.water_intelligence.candidate_scopes import BNPE_MINIMAL_PILOT_V1
from services.water_intelligence.public_snapshot import (
    MAX_MANIFEST_BYTES_UNCOMPRESSED,
    assemble_public_snapshot,
)
from services.water_intelligence.public_snapshot_builder import (
    serialize_canonical_document,
)
from services.water_intelligence.publication_decisions import (
    EXCLUSION_OUTSIDE_AUTHORIZED_SCOPE,
    current_registry,
)

API_ROOT = Path(__file__).resolve().parents[1]

CLOCK = datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc)

#: Identifiants d'ouvrage FICTIFS — ils exercent le chemin, ils ne décrivent
#: aucun ouvrage réel. Un identifiant plausible rendrait un artefact de test
#: confondable avec une donnée publiée.
FAKE_OUVRAGES = ("TEST-OPR-A", "TEST-OPR-B", "TEST-OPR-C")


def _source(**overrides) -> WaterSourceReference:
    params = dict(
        source_code="HUBEAU_BNPE_PRELEVEMENTS",
        release_key="bnpe-minimal-pilot-v1",
        checksum_sha256="c" * 64,
        retrieved_at=date(2026, 7, 28),
        observed_period_start=date(2020, 1, 1),
        observed_period_end=date(2020, 12, 31),
        methodology_version="1.0.0",
        # Les quatre capacités RÉELLES du modèle, telles que
        # `license_policy.evaluate()` les rend. `allow_derived_use=False`
        # reprend `derived_use_allowed=false` du formulaire signé.
        license=WaterLicenseDecision(
            allow_ingest=True,
            allow_store=True,
            allow_display=True,
            allow_derived_use=False,
        ),
        attribution="Données issues de la BNPE (fixture de test).",
        source_information_url="https://hubeau.eaufrance.fr/page/api-prelevements-eau",
    )
    params.update(overrides)
    return WaterSourceReference(**params)


def _observation(
    ouvrage: str,
    volume: float,
    *,
    period_start: date = date(2020, 1, 1),
    period_end: date = date(2020, 12, 31),
    **overrides,
) -> WaterMetricObservation:
    params = dict(
        metric_code="water.withdrawal.volume",
        value=volume,
        unit="m3",
        geography=WaterGeographyRef(scope="france", code=ouvrage, label=ouvrage),
        period_start=period_start,
        period_end=period_end,
        method=MethodRef(code="CC-WI-HUBEAU-BNPE-PASSTHROUGH", version="1.0.0"),
        # `manual` est le statut RÉEL des prélèvements BNPE
        # (`WITHDRAWALS_DATA_STATUS`) : une donnée déclarée par un
        # exploitant, ni observée ni modélisée.
        quality=WaterQualityMetadata(data_status="manual"),
        source=_source(),
    )
    params.update(overrides)
    return WaterMetricObservation(**params)


def _three_in_scope() -> list[WaterMetricObservation]:
    return [
        _observation(FAKE_OUVRAGES[0], 12_500.0),
        _observation(FAKE_OUVRAGES[1], 3_200.0),
        _observation(FAKE_OUVRAGES[2], 48_900.0),
    ]


def _assemble(observations):
    return assemble_public_snapshot(
        observations=observations,
        generated_at=CLOCK,
        registry=current_registry(),
    )


# ---------------------------------------------------------------------------
# Le chemin nominal
# ---------------------------------------------------------------------------


class TestThreeObservationsReachThePublicSnapshot:
    def test_the_three_signed_observations_are_published(self) -> None:
        snapshot = _assemble(_three_in_scope())

        assert snapshot.is_empty is False
        assert snapshot.observation_count == pub.APPROVED_OBSERVATION_COUNT == 3
        assert snapshot.included_source_codes == ("HUBEAU_BNPE_PRELEVEMENTS",)

    def test_no_value_stays_withheld_after_the_licence_decision(self) -> None:
        """Le contrôle qu'exige l'autorisation : les trois valeurs sortent.

        `display_allowed = true` a été signé. Une valeur encore `value_withheld`
        après cette décision signifierait que la licence en base contredit la
        décision humaine — un désaccord qui doit se voir, pas se rattraper.
        """
        snapshot = _assemble(_three_in_scope())

        for observation in snapshot.manifest.observations:
            assert observation.value_withheld is False
            assert observation.value is not None

    def test_the_six_other_sources_are_excluded_with_a_named_reason(self) -> None:
        snapshot = _assemble(_three_in_scope())

        excluded = {e.source_code: e.reason for e in snapshot.exclusions}
        assert set(excluded) == {
            "HUBEAU_ADES",
            "HUBEAU_QUALITE_SURFACE",
            "HUBEAU_HYDROMETRIE",
            "EEA_WEI_PLUS",
            "WRI_AQUEDUCT",
            "COPERNICUS_EDO",
        }
        for reason in excluded.values():
            assert reason.strip()

    def test_the_snapshot_holds_no_other_source_observation(self) -> None:
        """Aucune OBSERVATION d'une autre source.

        Les six autres sources sont bien nommées dans le document — dans les
        exclusions et les décisions. C'est voulu : une source écartée sans
        mention donnerait une fausse impression d'exhaustivité. Ce qui ne doit
        pas s'y trouver, c'est une de leurs VALEURS.
        """
        snapshot = _assemble(_three_in_scope())

        sources = {o.source.source_code for o in snapshot.manifest.observations}
        assert sources == {"HUBEAU_BNPE_PRELEVEMENTS"}
        assert {s.source_code for s in snapshot.manifest.sources} == {
            "HUBEAU_BNPE_PRELEVEMENTS"
        }


# ---------------------------------------------------------------------------
# Le périmètre — le cœur de l'autorisation
# ---------------------------------------------------------------------------


class TestTheSignedScopeIsEnforced:
    def test_an_observation_from_another_year_is_dropped_with_its_own_reason(
        self,
    ) -> None:
        """2021 n'est pas couverte par une signature qui dit 2020."""
        snapshot = _assemble(
            _three_in_scope()
            + [
                _observation(
                    "TEST-OPR-D",
                    999.0,
                    period_start=date(2021, 1, 1),
                    period_end=date(2021, 12, 31),
                )
            ]
        )

        assert snapshot.observation_count == 3
        assert any(
            "HORS de la période autorisée" in warning for warning in snapshot.warnings
        )

    def test_a_source_entirely_out_of_period_becomes_a_named_exclusion(self) -> None:
        """Rien de la source ne survit : elle devient une exclusion motivée."""
        snapshot = _assemble(
            [
                _observation(
                    FAKE_OUVRAGES[0],
                    1.0,
                    period_start=date(2019, 1, 1),
                    period_end=date(2019, 12, 31),
                )
            ]
        )

        assert snapshot.observation_count == 0
        reasons = {e.source_code: e.reason for e in snapshot.exclusions}
        assert reasons["HUBEAU_BNPE_PRELEVEMENTS"] == EXCLUSION_OUTSIDE_AUTHORIZED_SCOPE

    def test_a_partially_out_of_scope_source_stays_included(self) -> None:
        """Trois observations dans le périmètre, une hors : la source est
        publiée, amputée — et l'avertissement le dit.

        La promouvoir en exclusion ferait lire « rien de cette source n'est
        publié » là où trois valeurs le sont.
        """
        snapshot = _assemble(
            _three_in_scope()
            + [
                _observation(
                    "TEST-OPR-D",
                    999.0,
                    period_start=date(2022, 1, 1),
                    period_end=date(2022, 12, 31),
                )
            ]
        )

        assert "HUBEAU_BNPE_PRELEVEMENTS" in snapshot.included_source_codes
        assert not any(
            e.source_code == "HUBEAU_BNPE_PRELEVEMENTS" for e in snapshot.exclusions
        )

    def test_the_acquisition_perimeter_is_checked_on_the_request(self) -> None:
        """Le territoire se vérifie sur la REQUÊTE, pas sur l'observation.

        Le code géographique d'une observation BNPE est un identifiant
        d'ouvrage ; le périmètre signé nomme une commune INSEE. Comparer les
        deux refuserait les trois observations approuvées elles-mêmes.
        """
        registry = current_registry()

        assert registry.matches_acquisition(
            "HUBEAU_BNPE_PRELEVEMENTS",
            geography_type="code_commune_insee",
            geography_code="34172",
        )
        # Le département n'est pas la commune.
        assert not registry.matches_acquisition(
            "HUBEAU_BNPE_PRELEVEMENTS",
            geography_type="code_departement",
            geography_code="34",
        )
        assert not registry.matches_acquisition(
            "HUBEAU_BNPE_PRELEVEMENTS",
            geography_type="code_commune_insee",
            geography_code="34173",
        )

    def test_the_pilot_scope_matches_the_signed_decision(self) -> None:
        """Le périmètre acquis et le périmètre signé sont le MÊME objet.

        Deux écritures du périmètre — une dans le registre, une dans les
        périmètres d'acquisition — divergeraient à la première correction de
        l'une des deux, et le document publié cesserait de correspondre au
        périmètre approuvé.
        """
        scope = current_registry().authorized_scope("HUBEAU_BNPE_PRELEVEMENTS")

        assert BNPE_MINIMAL_PILOT_V1.geography_type == scope.geography_type
        assert BNPE_MINIMAL_PILOT_V1.geography_code == scope.geography_code
        assert BNPE_MINIMAL_PILOT_V1.date_from == str(scope.period_start.year)
        assert BNPE_MINIMAL_PILOT_V1.date_to == str(scope.period_end.year)
        assert BNPE_MINIMAL_PILOT_V1.source_code == pub.PILOT_SOURCE_CODE
        # Pagination : une page de 200, dernière page devant être incomplète.
        assert BNPE_MINIMAL_PILOT_V1.page_size == 200
        assert BNPE_MINIMAL_PILOT_V1.max_pages == 1
        assert BNPE_MINIMAL_PILOT_V1.expects_incomplete_last_page is True


# ---------------------------------------------------------------------------
# Le document
# ---------------------------------------------------------------------------


class TestTheCanonicalDocument:
    def test_it_is_deterministic_to_the_byte(self) -> None:
        first = serialize_canonical_document(
            json.loads(_assemble(_three_in_scope()).canonical_json())
        )
        second = serialize_canonical_document(
            json.loads(_assemble(list(reversed(_three_in_scope()))).canonical_json())
        )

        assert first == second, (
            "l'ordre des observations en entrée change les octets : le document "
            "ne serait pas reproductible, et son ETag varierait sans changement "
            "de contenu."
        )

    def test_observations_differing_only_by_geography_are_ordered_totally(
        self,
    ) -> None:
        """Régression — la clé de tri était DÉGÉNÉRÉE pour cette forme-là.

        Elle valait `(source_code, metric_code, period_start)`. Trois ouvrages
        d'une même métrique sur une même année sont à égalité sur les trois
        champs : le tri de Python étant stable, l'ordre d'ENTRÉE survivait dans
        la sortie, et deux assemblages du même contenu produisaient deux ETag
        différents sans qu'aucune valeur n'ait changé.

        Aucun jeu antérieur n'avait cette forme — les fixtures existantes
        différaient toujours par la métrique ou la période — et c'est
        exactement la forme du pilote BNPE. Le défaut se serait manifesté à la
        première régénération du document publié.
        """
        observations = _three_in_scope()

        orders = [
            observations,
            list(reversed(observations)),
            [observations[1], observations[2], observations[0]],
        ]
        etags = {_assemble(order).etag() for order in orders}
        payloads = {_assemble(order).canonical_json() for order in orders}

        assert len(etags) == 1, f"trois ordres, {len(etags)} ETag distincts"
        assert len(payloads) == 1

    def test_the_etag_is_weak_and_content_addressed(self) -> None:
        snapshot = _assemble(_three_in_scope())

        assert snapshot.etag().startswith('W/"wi-')
        # Deux assemblages du même contenu : le même ETag.
        assert snapshot.etag() == _assemble(_three_in_scope()).etag()

    def test_the_etag_changes_when_a_value_changes(self) -> None:
        """Le cache ne peut être invalidé que par un changement réel."""
        base = _assemble(_three_in_scope())
        altered = _assemble(
            [
                _observation(FAKE_OUVRAGES[0], 12_501.0),
                _observation(FAKE_OUVRAGES[1], 3_200.0),
                _observation(FAKE_OUVRAGES[2], 48_900.0),
            ]
        )

        assert base.etag() != altered.etag()

    def test_it_stays_far_under_the_budget(self) -> None:
        snapshot = _assemble(_three_in_scope())
        document = serialize_canonical_document(json.loads(snapshot.canonical_json()))

        assert len(document) < MAX_MANIFEST_BYTES_UNCOMPRESSED
        assert snapshot.payload_bytes() < MAX_MANIFEST_BYTES_UNCOMPRESSED

    def test_it_carries_no_tenant_field(self) -> None:
        serialized = _assemble(_three_in_scope()).canonical_json()

        for field in ("company_id", "tenant_id", "site_id", "organisation_id", "user_id"):
            assert field not in serialized

    def test_it_carries_no_aggregate(self) -> None:
        """`derived_use_allowed = false` : aucun total, aucune moyenne.

        La couverture BNPE est partielle par construction. Un total communal
        calculé sur trois ouvrages présenterait une somme partielle comme le
        prélèvement de la commune.
        """
        serialized = _assemble(_three_in_scope()).canonical_json()

        for forbidden in ("total_volume", "average", "moyenne", "composite_score", "ranking"):
            assert forbidden not in serialized

    def test_the_decision_travels_with_its_scope_and_permissions(self) -> None:
        snapshot = _assemble(_three_in_scope())
        entry = next(
            d
            for d in snapshot.decisions
            if d["source_code"] == "HUBEAU_BNPE_PRELEVEMENTS"
        )

        assert entry["allows_publication"] is True
        assert entry["authorized_scope"]["geography_code"] == "34172"
        assert entry["permissions"] == {
            "display_allowed": True,
            "derived_use_allowed": False,
            "automated_access_allowed": True,
            "storage_allowed": True,
        }


# ---------------------------------------------------------------------------
# Les conditions d'arrêt
# ---------------------------------------------------------------------------


class TestEveryStopConditionActuallyStops:
    """Les neuf conditions de l'autorisation humaine, exercées une par une.

    Chacune LÈVE. Un contrôle qui se contente d'avertir n'a jamais empêché une
    publication.
    """

    class _Prepared:
        """Double minimal de `PreparedRelease` — seuls les champs lus."""

        def __init__(self, observations, **overrides):
            from services.water_intelligence.release_provenance import ReleaseProvenance

            self.observations = observations
            self.records_rejected = overrides.get("records_rejected", 0)
            self.units = overrides.get("units", ("m3",))
            self.geography_codes = overrides.get("geography_codes", FAKE_OUVRAGES)
            self.provenance = overrides.get(
                "provenance",
                ReleaseProvenance(
                    source_code="HUBEAU_BNPE_PRELEVEMENTS",
                    attribution="Données issues de la BNPE.",
                    stable_attribution="Données issues de la BNPE.",
                    information_url="https://hubeau.eaufrance.fr/page/api-prelevements-eau",
                    refresh_cadence=None,
                    last_updated_on=None,
                    license_code="ETALAB-2.0",
                    license_scope="platform",
                    accessed_on=date(2026, 7, 28),
                ),
            )

    def test_a_wrong_observation_count_stops_the_publication(self) -> None:
        with pytest.raises(pub.PublicationRefused, match="observations préparées"):
            pub._verify_prepared(self._Prepared(_three_in_scope()[:2]))

    def test_a_rejected_record_stops_the_publication(self) -> None:
        with pytest.raises(pub.PublicationRefused, match="rejeté"):
            pub._verify_prepared(
                self._Prepared(_three_in_scope(), records_rejected=1)
            )

    def test_an_unexpected_unit_stops_the_publication(self) -> None:
        """Aucune conversion n'est appliquée nulle part : une unité inattendue
        est un changement de contrat, pas un détail d'affichage."""
        with pytest.raises(pub.PublicationRefused, match="[Uu]nités"):
            pub._verify_prepared(self._Prepared(_three_in_scope(), units=("l",)))

    def test_a_missing_attribution_stops_the_publication(self) -> None:
        from services.water_intelligence.release_provenance import ReleaseProvenance

        provenance = ReleaseProvenance(
            source_code="HUBEAU_BNPE_PRELEVEMENTS",
            attribution="   ",
            stable_attribution="   ",
            information_url="https://hubeau.eaufrance.fr/page/api-prelevements-eau",
            refresh_cadence=None,
            last_updated_on=None,
            license_code="ETALAB-2.0",
            license_scope="platform",
            accessed_on=date(2026, 7, 28),
        )
        with pytest.raises(pub.PublicationRefused, match="[Aa]ttribution absente"):
            pub._verify_prepared(
                self._Prepared(_three_in_scope(), provenance=provenance)
            )

    def test_a_missing_official_url_stops_the_publication(self) -> None:
        """C'est la voie de conformité retenue par la signature du 2026-07-28.

        Sans URL, l'attribution ne satisfait pas la condition de paternité de
        la Licence Ouverte 2.0 — et le relevé de `source_last_updated_on`,
        seconde voie, n'a pas eu lieu.
        """
        from services.water_intelligence.release_provenance import ReleaseProvenance

        provenance = ReleaseProvenance(
            source_code="HUBEAU_BNPE_PRELEVEMENTS",
            attribution="Données issues de la BNPE.",
            stable_attribution="Données issues de la BNPE.",
            information_url="",
            refresh_cadence=None,
            last_updated_on=None,
            license_code="ETALAB-2.0",
            license_scope="platform",
            accessed_on=date(2026, 7, 28),
        )
        with pytest.raises(pub.PublicationRefused, match="URL officielle absente"):
            pub._verify_prepared(
                self._Prepared(_three_in_scope(), provenance=provenance)
            )

    def test_an_out_of_period_observation_stops_the_publication(self) -> None:
        observations = _three_in_scope()
        observations[0] = _observation(
            FAKE_OUVRAGES[0],
            1.0,
            period_start=date(2021, 1, 1),
            period_end=date(2021, 12, 31),
        )
        with pytest.raises(pub.PublicationRefused, match="hors période approuvée"):
            pub._verify_prepared(self._Prepared(observations))

    def test_an_empty_snapshot_stops_the_publication(self) -> None:
        with pytest.raises(pub.PublicationRefused, match="snapshot vide"):
            pub._verify_snapshot(_assemble([]))

    def test_a_second_source_stops_the_publication(self) -> None:
        """Une source de plus dans le snapshot est une source de plus publiée."""

        class _TwoSources:
            is_empty = False
            included_source_codes = ("HUBEAU_ADES", "HUBEAU_BNPE_PRELEVEMENTS")

        with pytest.raises(pub.PublicationRefused, match="[Ss]ources incluses"):
            pub._verify_snapshot(_TwoSources())

    def test_the_approved_checksum_is_written_in_full(self) -> None:
        """Le checksum approuvé est une constante, jamais un calcul.

        Le recalculer depuis le payload reçu ferait toujours correspondre le
        contrôle à ce qu'on vient de télécharger — c'est-à-dire ne contrôlerait
        rien.
        """
        assert pub.APPROVED_PAYLOAD_SHA256 == (
            "c9b8d10e9f1059fd49db51a45d6890ff1cebe546084eeac03d871742a74bd2e9"
        )
        assert len(pub.APPROVED_PAYLOAD_SHA256) == 64


# ---------------------------------------------------------------------------
# Les avertissements de couverture
# ---------------------------------------------------------------------------


class TestCoverageWarningsSurviveTheSignature:
    """Une signature n'annule pas un fait sur la source.

    Ces trois avertissements décrivent la BNPE elle-même : ils ne sont pas des
    réserves qu'une décision humaine lèverait.
    """

    def test_the_three_mandatory_warnings_are_carried_verbatim(self) -> None:
        assert pub.MANDATORY_WARNINGS == (
            "Les volumes exonérés de redevance peuvent être absents de cette source.",
            "Certains petits volumes peuvent ne pas être déclarés.",
            "Une absence de déclaration n'est JAMAIS un prélèvement nul.",
        )

    def test_an_absence_is_never_a_zero(self) -> None:
        """L'énoncé central de la couverture BNPE, écrit en toutes lettres."""
        assert any(
            "JAMAIS un prélèvement nul" in warning
            for warning in pub.MANDATORY_WARNINGS
        )


# ---------------------------------------------------------------------------
# Le document réellement écrit
# ---------------------------------------------------------------------------


def _prepared_double():
    """Double de `PreparedRelease` portant TOUS les champs que lit le publieur.

    Le double de `TestEveryStopConditionActuallyStops` n'en porte que la moitié
    — il exerce `_verify_prepared`, qui ne lit rien d'autre. Celui-ci exerce
    `_document()` et `_proof()`, qui lisent en plus la release, ses deux
    checksums et toute la provenance.
    """
    from services.water_intelligence.release_provenance import ReleaseProvenance

    class _Prepared:
        observations = _three_in_scope()
        records_rejected = 0
        units = ("m3",)
        geography_codes = FAKE_OUVRAGES
        release_key = "bnpe-minimal-pilot-v1"
        artifact_checksum = "a" * 64
        validation_report_checksum = "b" * 64
        provenance = ReleaseProvenance(
            source_code="HUBEAU_BNPE_PRELEVEMENTS",
            # L'attribution du DOUBLE s'annonce comme telle : si ce document de
            # test atteignait un jour une surface, il le dirait lui-même.
            attribution="Données issues de la BNPE (FIXTURE DE TEST).",
            stable_attribution="Données issues de la BNPE (FIXTURE DE TEST).",
            information_url="https://hubeau.eaufrance.fr/page/api-prelevements-eau",
            refresh_cadence=None,
            last_updated_on=None,
            license_code="ETALAB-2.0",
            license_scope="platform",
            accessed_on=date(2026, 7, 28),
        )

    return _Prepared


def _generated_document() -> dict:
    return pub._document(_assemble(_three_in_scope()), _prepared_double(), CLOCK)


class TestTheDocumentIsActuallyProduced:
    """`_document()` et `_proof()`, EXÉCUTÉS.

    Aucun test ne les appelait. Les contrôles de document portaient sur
    l'enveloppe de l'assembleur — `serialize_canonical_document(
    snapshot.canonical_json())` — c'est-à-dire sur tout SAUF le bloc `pilot`
    que `_document()` ajoute, et que la Phase D rend obligatoire.

    Ce bloc est aussi celui que le front valide par un `.parse()` qui casse le
    build. Une clé manquante ne se serait donc découverte qu'APRÈS le commit
    du workflow — sur un document déjà publié, après un appel réseau déjà
    consommé.
    """

    def test_the_pilot_block_carries_every_mandatory_metadata(self) -> None:
        pilot = _generated_document()["pilot"]
        assert pilot["option_key"] == "bnpe_minimal_pilot_v1"
        assert pilot["publication_mode"] == "table_first"
        assert pilot["geo_layers"] == "deferred"
        assert pilot["pilot_status"] == "limited_scope"
        assert pilot["observation_count"] == 3
        assert pilot["observed_period_start"] == "2020-01-01"
        assert pilot["observed_period_end"] == "2020-12-31"
        assert pilot["retrieved_at"] == "2026-07-28"
        # `None` ASSUMÉ, et vérifié comme tel : une cadence inventée serait un
        # fait sur la source que personne n'a relevé.
        assert pilot["source_refresh_cadence"] is None
        assert pilot["source_last_updated_on"] is None

    def test_the_document_announces_itself_as_generated(self) -> None:
        """Le discriminant que lit le miroir front, sans lequel `/water` rendrait
        l'état « non généré » sur un document généré."""
        assert _generated_document()["pilot_document_status"] == "generated"

    def test_the_document_carries_the_signed_scope_and_permissions(self) -> None:
        pilot = _generated_document()["pilot"]
        assert pilot["geography_type"] == "code_commune_insee"
        assert pilot["geography_code"] == "34172"
        assert pilot["reviewed_by"] == "ludoviclabs-dotcom"
        assert pilot["reviewed_on"] == "2026-07-28"
        # `derived_use_allowed = false` voyage jusqu'au document : c'est lui qui
        # interdit à la surface tout total, moyenne, classement ou score.
        assert pilot["permissions"]["derived_use_allowed"] is False
        assert pilot["permissions"]["display_allowed"] is True

    def test_the_three_warnings_travel_with_the_values(self) -> None:
        assert _generated_document()["pilot"]["coverage_warnings"] == list(
            pub.MANDATORY_WARNINGS
        )

    def test_the_document_stays_far_under_the_budget(self) -> None:
        payload = serialize_canonical_document(_generated_document())
        assert len(payload) < MAX_MANIFEST_BYTES_UNCOMPRESSED

    def test_the_proof_report_carries_no_raw_payload(self) -> None:
        """Le rapport de preuve porte des empreintes et des comptes.

        Un tableau `data` y ferait entrer des octets Hub'Eau bruts dans un
        artefact de run — ce que l'autorisation interdit sans réserve.
        """
        document = _generated_document()
        payload = serialize_canonical_document(document)
        proof = pub._proof(
            _assemble(_three_in_scope()), _prepared_double(), document, payload, CLOCK
        )
        assert proof["observation_count"] == 3
        assert proof["approved_payload_sha256"] == pub.APPROVED_PAYLOAD_SHA256
        assert proof["document_bytes"] == len(payload)
        assert proof["margin_bytes"] == MAX_MANIFEST_BYTES_UNCOMPRESSED - len(payload)
        assert proof["included_source_codes"] == ["HUBEAU_BNPE_PRELEVEMENTS"]
        assert "data" not in proof
        serialized = json.dumps(proof, ensure_ascii=False, default=str)
        for field in ("company_id", "tenant_id", "site_id"):
            assert field not in serialized


class TestThePythonDocumentSatisfiesTheTypeScriptContract:
    """Le document produit par Python, relu par le contrat du front.

    `PilotFileSchema.parse()` casse le build du front sur un document hors
    contrat — c'est délibéré, et c'est ce qui rend la dérive coûteuse au pire
    moment : le workflow committe le document AVANT que quoi que ce soit ne le
    valide côté TypeScript.

    L'échantillon versionné est donc verrouillé aux OCTETS sur la sortie de
    `_document()`. Un champ ajouté, renommé ou retypé côté Python fait échouer
    ce test ; un test Vitest parse le même fichier avec le schéma zod réel. Les
    deux langages regardent alors le même document, et aucun ne peut dériver
    sans que l'autre ne le dise.
    """

    #: Échantillon partagé. Ses valeurs sont FABRIQUÉES (ouvrages `TEST-OPR-*`,
    #: attribution qui s'annonce comme fixture) : il exerce un contrat, il ne
    #: prétend décrire aucun prélèvement.
    SAMPLE = (
        API_ROOT.parents[1]
        / "apps"
        / "carbon"
        / "tests"
        / "fixtures"
        / "pilot-document-sample.json"
    )

    #: Régénération explicite : `REGENERATE_PILOT_SAMPLE=1 python -m pytest
    #: tests/test_water_v1_publication.py -k byte_identical`. Le mécanisme est
    #: celui de `vitest -u` — jamais implicite, sinon un échantillon se
    #: réécrirait tout seul et ne verrouillerait plus rien.
    REGENERATE = "REGENERATE_PILOT_SAMPLE"

    def test_the_sample_is_byte_identical_to_what_the_publisher_produces(
        self,
    ) -> None:
        produced = serialize_canonical_document(_generated_document())
        if os.environ.get(self.REGENERATE) == "1":
            self.SAMPLE.parent.mkdir(parents=True, exist_ok=True)
            self.SAMPLE.write_bytes(produced)
        assert self.SAMPLE.exists(), (
            f"échantillon absent : {self.SAMPLE}. Le régénérer avec "
            f"`{self.REGENERATE}=1 python -m pytest "
            "tests/test_water_v1_publication.py -k byte_identical`."
        )
        assert self.SAMPLE.read_bytes() == produced, (
            "l'échantillon versionné a dérivé de la sortie de `_document()`.\n"
            f"Le régénérer (`{self.REGENERATE}=1 …`) plutôt qu'assouplir ce "
            "test : c'est lui qui prouve que le contrat TypeScript regarde le "
            "document RÉEL, et non une copie figée qui lui ressemblait."
        )

    def test_the_sample_announces_that_its_values_are_fabricated(self) -> None:
        """Un document d'apparence publiable, versionné, doit se dénoncer.

        Sans cela, un échantillon de contrat se confond avec un snapshot
        publié — pour un lecteur du dépôt comme pour un futur test.
        """
        content = self.SAMPLE.read_text(encoding="utf-8")
        assert "FIXTURE DE TEST" in content
        for fake in FAKE_OUVRAGES:
            assert fake in content
