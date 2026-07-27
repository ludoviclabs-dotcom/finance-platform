"""tests/test_water_intelligence_release_parity.py — la reconstruction est-elle
FIDÈLE ? (X4B-RECONSTRUCT §5)

Ces tests ne vérifient pas qu'un pipeline « tourne ». Ils vérifient qu'il
refuse de tourner quand une observation a été perdue, substituée, ou écrasée
par une projection qui ne sait pas la distinguer.

Le test le plus important du fichier est
`TestTheProjectionCannotBeTrusted::test_two_scopes_one_code_is_refused` : il
reproduit, sur des données construites pour ça, la perte silencieuse que la
table `observations` provoquerait sans ce garde-fou.
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
from services.water.staging_writer import PreparedObservation, PreparedRelease
from services.water_intelligence import release_parity as parity
from services.water_intelligence.observation_identity import (
    build_water_observation_identity,
    content_digest,
)
from services.water_intelligence.release_provenance import provenance_for

SOURCE = "HUBEAU_ADES"
ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
PROVENANCE = provenance_for(SOURCE, accessed_on=date(2026, 7, 26))


def _source_ref(**overrides) -> WaterSourceReference:
    base = dict(
        source_code=SOURCE,
        release_key="ades-x4b",
        checksum_sha256="e" * 64,
        retrieved_at=date(2026, 7, 26),
        observed_period_start=date(2024, 1, 1),
        observed_period_end=date(2024, 1, 31),
        methodology_version="1.0.0",
        license=ALLOWED,
        attribution=PROVENANCE.attribution,
        source_information_url=PROVENANCE.information_url,
        source_refresh_cadence=PROVENANCE.refresh_cadence,
        source_last_updated_on=PROVENANCE.last_updated_on,
    )
    base.update(overrides)
    return WaterSourceReference(**base)


def _observation(
    index: int,
    *,
    scope: str = "france",
    code: str | None = None,
    value: float | None = None,
    label: str | None = None,
    coverage: float | None = 100.0,
    unit: str = "m",
) -> WaterMetricObservation:
    geo_code = code if code is not None else f"D{index:03d}"
    return WaterMetricObservation(
        metric_code="water.groundwater_level",
        value=float(index) if value is None else value,
        unit=unit,
        geography=WaterGeographyRef(
            scope=scope, code=geo_code, label=label or f"Zone {geo_code}"
        ),
        period_start=date(2024, 1, 1),
        period_end=date(2024, 1, 1),
        method=MethodRef(code="CC-WI-ADES", version="1.0.0"),
        quality=WaterQualityMetadata(
            data_status="observed", coverage_pct=coverage, confidence=90
        ),
        source=_source_ref(),
        value_withheld=False,
    )


def _prepared(observations, *, subjects: list[str] | None = None) -> PreparedRelease:
    """Construit une `PreparedRelease` RÉELLE — même classe que le graveur.

    Pas un double : la parité lit `prepared.prepared[i].identity`, et un double
    laisserait passer un désalignement entre observation et identité.

    `subjects` permet de rattacher deux observations au MÊME sujet — la seule
    façon de reproduire une collision de projection, puisque `subject_key` fait
    partie de la clé.
    """
    release = PreparedRelease()
    release.provenance = PROVENANCE
    release.source_code = SOURCE
    release.release_key = "ades-x4b"
    for index, observation in enumerate(observations):
        subject_key = subjects[index] if subjects else f"station-{index:03d}"
        release.prepared.append(
            PreparedObservation(
                observation=observation,
                identity=build_water_observation_identity(
                    observation, subject_type="station", subject_key=subject_key
                ),
                content_digest=content_digest(observation),
                subject_type="station",
                subject_key=subject_key,
            )
        )
    return release


def _rows(release: PreparedRelease) -> list[dict]:
    """Ce que relirait un `SELECT` sur `observations` après écriture."""
    return [
        {
            "subject_type": item.subject_type,
            "subject_key": item.subject_key,
            "metric_code": item.observation.metric_code,
            "geography_code": item.observation.geography.code,
            "valid_from": datetime(
                *item.observation.period_start.timetuple()[:3], tzinfo=timezone.utc
            ),
            "valid_to": datetime(
                *item.observation.period_end.timetuple()[:3], tzinfo=timezone.utc
            ),
            "unit": item.observation.unit,
            "methodology_version": item.observation.method.version,
        }
        for item in release.prepared
    ]


class TestAFaithfulReleasePasses:
    def test_prepared_persisted_and_candidate_agree(self) -> None:
        release = _prepared([_observation(i) for i in range(4)])
        report = parity.check_release_parity(
            release,
            candidate_observations=release.observations,
            persisted_rows=_rows(release),
        )
        assert report.prepared_count == 4
        assert report.persisted_count == 4
        assert report.candidate_count == 4
        assert report.checked_persisted is True

    def test_an_unwritten_measurement_says_so_instead_of_claiming_success(self) -> None:
        """`--dry-run` ne vérifie rien côté base — le rapport le NOMME."""
        release = _prepared([_observation(i) for i in range(3)])
        report = parity.check_release_parity(
            release, candidate_observations=release.observations, persisted_rows=None
        )
        assert report.checked_persisted is False
        assert report.persisted_count == 0


class TestTheProjectionCannotBeTrusted:
    """Le cœur de la phase : ce que PostgreSQL ne sait pas distinguer."""

    def test_two_scopes_one_code_is_refused(self) -> None:
        """Même code géographique, deux niveaux de zoom.

        `WaterGeographyScope` vaut `world`, `europe` ou `france` : un même code
        national peut légitimement apparaître à deux niveaux (un agrégat
        français et sa reprise dans une vue européenne). La table
        `observations` ne porte pas `geography_scope` : les deux lignes
        auraient la même clé, et le graveur aurait compté la seconde comme une
        « réutilisation » de la première. Une observation perdue, zéro erreur.
        """
        release = _prepared(
            [
                _observation(1, scope="france", code="FR"),
                _observation(1, scope="europe", code="FR"),
            ],
            subjects=["national", "national"],
        )
        # Les deux identités sont bien DISTINCTES en amont…
        assert len(release.identities) == 2
        # …et pourtant indistinguables une fois projetées.
        with pytest.raises(parity.ParityViolation, match="même clé de projection"):
            parity.assert_projection_can_distinguish(release)

    def test_the_lost_fields_are_enumerated_not_hidden(self) -> None:
        release = _prepared([_observation(0)])
        report = parity.check_release_parity(
            release, candidate_observations=release.observations
        )
        lost = set(report.unverifiable_after_projection)
        assert {"geography.label", "quality.coverage_pct", "geography.scope"} <= lost
        assert "source.source_information_url" in lost

    def test_the_projection_key_matches_the_writer_s_own_key(self) -> None:
        """Vérifier sur une autre clé que celle du graveur ne vérifierait rien."""
        release = _prepared([_observation(7)])
        item = release.prepared[0]
        assert parity.projection_key_of_identity(item.identity) == (
            parity.projection_key_of_row(_rows(release)[0])
        )


class TestPersistedDivergenceStops:
    def test_a_missing_row_is_refused(self) -> None:
        release = _prepared([_observation(i) for i in range(3)])
        with pytest.raises(parity.ParityViolation, match="préparées non écrites"):
            parity.assert_persisted_parity(release, _rows(release)[:2])

    def test_an_unexpected_row_is_refused(self) -> None:
        release = _prepared([_observation(i) for i in range(2)])
        rows = _rows(release)
        rows.append({**rows[0], "subject_key": "station-999"})
        with pytest.raises(parity.ParityViolation, match="écrites non préparées"):
            parity.assert_persisted_parity(release, rows)

    def test_a_substitution_is_caught_although_the_counts_match(self) -> None:
        """Le motif que compter laisserait passer : autant, mais pas les mêmes."""
        release = _prepared([_observation(i) for i in range(3)])
        rows = _rows(release)
        rows[1] = {**rows[1], "subject_key": "station-imposteur"}
        assert len(rows) == len(release.observations)
        with pytest.raises(parity.ParityViolation):
            parity.assert_persisted_parity(release, rows)

    def test_a_diverging_unit_is_refused(self) -> None:
        release = _prepared([_observation(0)])
        rows = _rows(release)
        rows[0] = {**rows[0], "unit": "cm"}
        with pytest.raises(parity.ParityViolation, match="faits différents"):
            parity.assert_persisted_parity(release, rows)


class TestCandidateDivergenceStops:
    def test_an_observation_absent_from_the_candidate_is_refused(self) -> None:
        release = _prepared([_observation(i) for i in range(3)])
        with pytest.raises(parity.ParityViolation, match="absentes du candidat"):
            parity.assert_candidate_parity(release, release.observations[:2])

    def test_a_diverging_value_is_refused(self) -> None:
        release = _prepared([_observation(i) for i in range(2)])
        candidate = list(release.observations)
        candidate[0] = candidate[0].model_copy(update={"value": 999.0})
        with pytest.raises(parity.ParityViolation, match="value"):
            parity.assert_candidate_parity(release, candidate)

    def test_a_lost_geography_label_is_refused(self) -> None:
        """Le libellé ne survit pas à SQL — mais le candidat ne passe pas par SQL.

        S'il diverge ici, c'est qu'une reconstruction approximative s'est
        glissée dans le chemin.
        """
        release = _prepared([_observation(0, label="Hérault")])
        candidate = [
            release.observations[0].model_copy(
                update={
                    # Le libellé « reconstruit » depuis le code — exactement la
                    # déduction que §2 interdit.
                    "geography": WaterGeographyRef(
                        scope="france", code="D000", label="D000"
                    )
                }
            )
        ]
        with pytest.raises(parity.ParityViolation, match="geography_label"):
            parity.assert_candidate_parity(release, candidate)

    def test_a_lost_coverage_is_refused(self) -> None:
        release = _prepared([_observation(0, coverage=62.5)])
        candidate = [
            release.observations[0].model_copy(
                update={
                    "quality": WaterQualityMetadata(
                        data_status="observed", coverage_pct=None, confidence=90
                    )
                }
            )
        ]
        with pytest.raises(parity.ParityViolation, match="coverage_pct"):
            parity.assert_candidate_parity(release, candidate)

    def test_a_muted_provenance_is_refused(self) -> None:
        release = _prepared([_observation(0)])
        candidate = [
            release.observations[0].model_copy(
                update={"source": _source_ref(source_information_url=None)}
            )
        ]
        with pytest.raises(parity.ParityViolation, match="source_information_url"):
            parity.assert_candidate_parity(release, candidate)

    def test_observations_of_other_sources_are_ignored_not_counted(self) -> None:
        """Un candidat multi-sources ne fait pas échouer la parité d'une source."""
        release = _prepared([_observation(i) for i in range(2)])
        other = release.observations[0].model_copy(
            update={
                "source": _source_ref(
                    source_code="HUBEAU_BNPE_PRELEVEMENTS", release_key="bnpe-x4b"
                )
            }
        )
        report = parity.check_release_parity(
            release, candidate_observations=[*release.observations, other]
        )
        assert report.candidate_count == 2


class TestParityNeverRunsOnAnUnprovenReleased:
    def test_a_release_without_provenance_is_refused(self) -> None:
        release = _prepared([_observation(0)])
        release.provenance = None
        with pytest.raises(parity.ParityViolation, match="sans provenance"):
            parity.check_release_parity(
                release, candidate_observations=release.observations
            )


class TestTheReportCarriesNoRawData:
    def test_no_measured_value_leaks_into_the_report(self) -> None:
        """Un rapport de parité est publié comme artefact de run."""
        release = _prepared([_observation(0, value=123.456)])
        serialized = str(
            parity.check_release_parity(
                release, candidate_observations=release.observations
            ).as_mapping()
        )
        assert "123.456" not in serialized
