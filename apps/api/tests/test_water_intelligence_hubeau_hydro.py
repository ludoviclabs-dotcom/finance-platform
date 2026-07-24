"""
test_water_intelligence_hubeau_hydro.py — hydrométrie et piézométrie (P07).

AUCUNE base requise, AUCUN réseau : les pages sont des dictionnaires en
mémoire, le transport du pipeline est `FakeTransport`.

Couvre les dix cas exigés par le MACRO-PROMPT B — station inconnue, valeur
absente, unité, date, pagination, fraîcheur, couverture, licence, checksum,
idempotence — plus la séparation stricte des grandeurs, l'absence de toute
interpolation, et l'usage du `PeriodResolver` livré en Wave A.
"""

from __future__ import annotations

import ast
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import WaterLicenseDecision, WaterSourceReference
from services.intelligence.adapters.base import AdapterError
from services.water_intelligence.connectors import hubeau_hydro as hydro
from services.water_intelligence.pipeline import (
    PipelineDataUnavailableError,
    derive_observations,
    run_pipeline,
)
from services.water_intelligence.pipeline_transport import FakeTransport, ScriptedPage

CONNECTOR_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "connectors" / "hubeau_hydro.py"
)

HYDRO_RELEASE = "hubeau-hydrometrie-2026-01-fixture"
PIEZO_RELEASE = "hubeau-piezometrie-2026-01-fixture"

ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
BLOCKED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False
)


def hydro_config(**overrides) -> hydro.HubeauHydroReleaseConfig:
    params = dict(
        release_key=HYDRO_RELEASE,
        retrieved_at=date(2026, 2, 1),
        window_start=date(2026, 1, 1),
        window_end=date(2026, 1, 3),
        kind="hydrometrie",
        is_fixture=True,
    )
    params.update(overrides)
    return hydro.HubeauHydroReleaseConfig(**params)


def piezo_config(**overrides) -> hydro.HubeauHydroReleaseConfig:
    params = dict(
        release_key=PIEZO_RELEASE,
        retrieved_at=date(2026, 2, 1),
        window_start=date(2026, 1, 1),
        window_end=date(2026, 1, 3),
        kind="piezometrie",
        is_fixture=True,
    )
    params.update(overrides)
    return hydro.HubeauHydroReleaseConfig(**params)


def hydro_page(*records) -> dict:
    return {"count": len(records), "data": list(records)}


def hydro_record(*, station="FIX-STATION-001", grandeur="Q", day="2026-01-01", value=1200.0):
    return {
        "code_station": station,
        "grandeur_hydro_elab": grandeur,
        "date_obs_elab": day,
        "resultat_obs_elab": value,
    }


def piezo_record(*, station="FIX-BSS-0001", day="2026-01-01", niveau=112.5, profondeur=3.4):
    """Forme réelle d'un enregistrement `chroniques` : les deux champs de
    grandeur sont TOUJOURS présents ; c'est leur VALEUR qui peut être nulle.
    Un champ absent est un problème de schéma, une valeur nulle est une
    absence de mesure — deux cas distincts, testés séparément."""
    return {
        "code_bss": station,
        "date_mesure": day,
        "niveau_nappe_eau": niveau,
        "profondeur_nappe": profondeur,
    }


HYDRO_PAGES = [
    hydro_page(
        hydro_record(day="2026-01-01", value=1200.0),
        hydro_record(day="2026-01-02", value=None),
        hydro_record(day="2026-01-03", value=1500.0),
        hydro_record(grandeur="H", day="2026-01-01", value=850.0),
    )
]

PIEZO_PAGES = [
    hydro_page(
        piezo_record(day="2026-01-01", niveau=112.5, profondeur=3.4),
        piezo_record(day="2026-01-02", niveau=None, profondeur=None),
    )
]


# ---------------------------------------------------------------------------
# Identité de release
# ---------------------------------------------------------------------------


class TestReleaseIdentity:
    def test_source_codes_match_the_catalogue(self) -> None:
        assert hydro.HYDROMETRIE_SOURCE_CODE == "HUBEAU_HYDROMETRIE"
        assert hydro.PIEZOMETRIE_SOURCE_CODE == "HUBEAU_ADES"

    def test_empty_release_key_is_refused(self) -> None:
        with pytest.raises(hydro.HubeauReleaseError, match="obligatoire"):
            hydro_config(release_key="   ")

    @pytest.mark.parametrize("moving", ["latest", "current", "head", "LATEST"])
    def test_moving_release_key_is_refused(self, moving: str) -> None:
        with pytest.raises(hydro.HubeauReleaseError, match="reproductible"):
            hydro_config(release_key=moving)

    def test_inverted_window_is_refused(self) -> None:
        with pytest.raises(hydro.HubeauReleaseError, match="fenêtre invalide"):
            hydro_config(window_start=date(2026, 2, 1), window_end=date(2026, 1, 1))

    def test_unknown_kind_is_refused(self) -> None:
        with pytest.raises(hydro.HubeauSchemaError, match="type de source"):
            hydro_config(kind="thermometrie")

    def test_identifier_field_differs_between_the_two_sources(self) -> None:
        assert hydro_config().identifier_field == "code_station"
        assert piezo_config().identifier_field == "code_bss"


# ---------------------------------------------------------------------------
# Unités — jamais converties silencieusement
# ---------------------------------------------------------------------------


class TestUnits:
    def test_hydrometric_native_units_are_verified_ones(self) -> None:
        """Documentation officielle : « mm pour les hauteurs d'eau », « l/s
        pour les débits ». Convertir en silence serait une erreur d'échelle."""
        assert hydro.HYDRO_QUANTITIES["Q"] == ("debit", "l/s")
        assert hydro.HYDRO_QUANTITIES["H"] == ("hauteur", "mm")

    def test_piezometric_units_are_verified_ones(self) -> None:
        assert hydro.PIEZO_QUANTITIES["niveau_nappe_eau"] == ("niveau_nappe", "m NGF")
        assert hydro.PIEZO_QUANTITIES["profondeur_nappe"] == ("profondeur_nappe", "m")

    def test_unit_travels_with_every_draft(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        drafts = hydro.drafts_from_measurements(parsed.measurements, hydro_config())

        by_metric = {d.metric_code: d.unit for d in drafts}
        assert by_metric["hubeau.hydrometrie.debit"] == "l/s"
        assert by_metric["hubeau.hydrometrie.hauteur"] == "mm"

    def test_no_conversion_is_applied_to_the_value(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        debits = [m.value for m in parsed.measurements if m.quantity == "debit" and m.has_value()]
        assert debits == [1200.0, 1500.0]  # l/s bruts, jamais divisés par 1000

    def test_aggregate_refuses_incompatible_units(self) -> None:
        measurements = [
            hydro.HubeauMeasurement("S1", "debit", "l/s", 10.0, date(2026, 1, 1)),
            hydro.HubeauMeasurement("S1", "debit", "m3/s", 0.01, date(2026, 1, 2)),
        ]

        with pytest.raises(hydro.HubeauSchemaError, match="unités incompatibles"):
            hydro.aggregate_by_station(measurements)

    def test_unknown_hydro_quantity_is_refused(self) -> None:
        page = hydro_page(hydro_record(grandeur="X"))

        with pytest.raises(hydro.HubeauSchemaError, match="hors vocabulaire"):
            hydro.parse_hydrometrie_pages([page], config=hydro_config())


# ---------------------------------------------------------------------------
# Grandeurs séparées
# ---------------------------------------------------------------------------


class TestQuantitiesStaySeparate:
    def test_flow_and_height_are_distinct_metrics(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        assert {m.quantity for m in parsed.measurements} == {"debit", "hauteur"}
        assert hydro.metric_code("hydrometrie", "debit") != hydro.metric_code(
            "hydrometrie", "hauteur"
        )

    def test_level_and_depth_are_distinct_metrics(self) -> None:
        """Niveau NGF et profondeur varient en sens OPPOSÉ : les confondre
        inverserait la lecture du risque."""
        parsed = hydro.parse_piezometrie_pages(PIEZO_PAGES, config=piezo_config())

        assert {m.quantity for m in parsed.measurements} == {"niveau_nappe", "profondeur_nappe"}

    def test_aggregate_never_mixes_quantities(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        aggregates = hydro.aggregate_by_station(parsed.measurements)

        assert {(a.station_id, a.quantity) for a in aggregates} == {
            ("FIX-STATION-001", "debit"), ("FIX-STATION-001", "hauteur"),
        }

    def test_hydro_and_piezo_namespaces_are_disjoint(self) -> None:
        assert hydro.metric_code("hydrometrie", "debit").startswith("hubeau.hydrometrie.")
        assert hydro.metric_code("piezometrie", "niveau_nappe").startswith("hubeau.piezometrie.")


# ---------------------------------------------------------------------------
# Valeur absente — jamais zéro, jamais interpolée
# ---------------------------------------------------------------------------


class TestMissingValues:
    def test_absent_value_is_none_not_zero(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        absent = [m for m in parsed.measurements if not m.has_value()]
        assert len(absent) == 1
        assert absent[0].value is None
        assert parsed.values_absent == 1

    def test_absent_value_produces_no_draft(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        drafts = hydro.drafts_from_measurements(parsed.measurements, hydro_config())

        assert not [d for d in drafts if d.numeric_value is None]
        assert len(drafts) == 3  # 2 débits valués + 1 hauteur

    def test_missing_value_is_never_interpolated(self) -> None:
        """Le 2 janvier est absent : aucune observation ne doit apparaître à
        cette date, ni valeur reportée depuis le 1er."""
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        drafts = hydro.drafts_from_measurements(parsed.measurements, hydro_config())

        days = {d.metadata["observed_on"] for d in drafts if d.metric_code.endswith("debit")}
        assert days == {"2026-01-01", "2026-01-03"}

    def test_zero_is_a_real_value(self) -> None:
        page = hydro_page(hydro_record(value=0))

        parsed = hydro.parse_hydrometrie_pages([page], config=hydro_config())

        assert parsed.measurements[0].value == 0.0
        assert parsed.values_present == 1
        assert parsed.values_absent == 0

    def test_absence_is_reported_as_a_warning(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        assert any("jamais interpolées" in w for w in parsed.warnings)

    def test_latest_measurement_skips_empty_points(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        latest = hydro.latest_measurement(
            parsed.measurements, station_id="FIX-STATION-001", quantity="debit"
        )

        assert latest is not None
        assert latest.observed_on == date(2026, 1, 3)
        assert latest.value == 1500.0

    def test_latest_measurement_is_none_when_nothing_is_valued(self) -> None:
        page = hydro_page(hydro_record(value=None))
        parsed = hydro.parse_hydrometrie_pages([page], config=hydro_config())

        assert hydro.latest_measurement(
            parsed.measurements, station_id="FIX-STATION-001", quantity="debit"
        ) is None


# ---------------------------------------------------------------------------
# Dates et schéma
# ---------------------------------------------------------------------------


class TestSchemaAndDates:
    def test_missing_station_identifier_is_refused(self) -> None:
        page = hydro_page({"grandeur_hydro_elab": "Q", "date_obs_elab": "2026-01-01", "resultat_obs_elab": 1.0})

        with pytest.raises(hydro.HubeauSchemaError, match="code_station"):
            hydro.parse_hydrometrie_pages([page], config=hydro_config())

    def test_missing_bss_identifier_is_refused(self) -> None:
        page = hydro_page({"date_mesure": "2026-01-01", "niveau_nappe_eau": 1.0})

        with pytest.raises(hydro.HubeauSchemaError, match="code_bss"):
            hydro.parse_piezometrie_pages([page], config=piezo_config())

    def test_missing_date_is_refused(self) -> None:
        page = hydro_page(hydro_record(day=None))

        with pytest.raises(hydro.HubeauSchemaError, match="date absente"):
            hydro.parse_hydrometrie_pages([page], config=hydro_config())

    def test_unreadable_date_is_refused(self) -> None:
        page = hydro_page(hydro_record(day="hier"))

        with pytest.raises(hydro.HubeauSchemaError, match="date illisible"):
            hydro.parse_hydrometrie_pages([page], config=hydro_config())

    def test_iso_timestamp_is_accepted(self) -> None:
        page = hydro_page(hydro_record(day="2026-01-05T06:00:00Z"))

        parsed = hydro.parse_hydrometrie_pages([page], config=hydro_config())

        assert parsed.measurements[0].observed_on == date(2026, 1, 5)

    def test_unreadable_value_is_refused(self) -> None:
        page = hydro_page(hydro_record(value="beaucoup"))

        with pytest.raises(hydro.HubeauSchemaError, match="illisible"):
            hydro.parse_hydrometrie_pages([page], config=hydro_config())

    def test_page_without_data_array_is_refused(self) -> None:
        with pytest.raises(hydro.HubeauSchemaError, match="tableau `data`"):
            hydro.parse_hydrometrie_pages([{"count": 0}], config=hydro_config())

    def test_empty_collection_is_refused(self) -> None:
        with pytest.raises(hydro.HubeauReleaseError, match="collecte vide"):
            hydro.parse_hydrometrie_pages([hydro_page()], config=hydro_config())

    def test_piezometric_record_without_quantity_is_refused(self) -> None:
        page = hydro_page({"code_bss": "FIX-BSS-0001", "date_mesure": "2026-01-01"})

        with pytest.raises(hydro.HubeauSchemaError, match="aucune grandeur"):
            hydro.parse_piezometrie_pages([page], config=piezo_config())


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class TestPagination:
    def test_multiple_pages_are_concatenated(self) -> None:
        pages = [
            hydro_page(hydro_record(day="2026-01-01", value=1.0)),
            hydro_page(hydro_record(day="2026-01-02", value=2.0)),
        ]

        parsed = hydro.parse_hydrometrie_pages(pages, config=hydro_config())

        assert parsed.records_total == 2
        assert parsed.observed_days == (date(2026, 1, 1), date(2026, 1, 2))

    def test_checksum_covers_every_page(self) -> None:
        one = hydro.parse_hydrometrie_pages(
            [hydro_page(hydro_record(day="2026-01-01"))], config=hydro_config()
        )
        two = hydro.parse_hydrometrie_pages(
            [hydro_page(hydro_record(day="2026-01-01")), hydro_page(hydro_record(day="2026-01-02"))],
            config=hydro_config(),
        )

        assert one.input_checksum != two.input_checksum


# ---------------------------------------------------------------------------
# Couverture et fraîcheur
# ---------------------------------------------------------------------------


class TestCoverageAndFreshness:
    def test_coverage_is_separate_from_the_value(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        debit = next(
            a for a in hydro.aggregate_by_station(parsed.measurements) if a.quantity == "debit"
        )

        assert debit.days_total == 3
        assert debit.days_with_value == 2
        assert debit.coverage_pct == pytest.approx(66.6667, abs=1e-3)
        assert debit.minimum == 1200.0 and debit.maximum == 1500.0

    def test_aggregate_mean_uses_only_present_values(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        debit = next(
            a for a in hydro.aggregate_by_station(parsed.measurements) if a.quantity == "debit"
        )

        assert debit.mean == pytest.approx(1350.0)  # (1200+1500)/2, l'absence non comptée

    def test_aggregate_is_independent_of_input_order(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        forward = hydro.aggregate_by_station(parsed.measurements)
        backward = hydro.aggregate_by_station(list(reversed(parsed.measurements)))

        assert forward == backward

    def test_freshness_window_is_carried_by_every_draft(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        drafts = hydro.drafts_from_measurements(parsed.measurements, hydro_config())

        assert all(d.metadata["window_start"] == "2026-01-01" for d in drafts)
        assert all(d.metadata["window_end"] == "2026-01-03" for d in drafts)

    def test_aggregate_exposes_its_own_first_and_last_day(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        debit = next(
            a for a in hydro.aggregate_by_station(parsed.measurements) if a.quantity == "debit"
        )

        assert (debit.first_day, debit.last_day) == (date(2026, 1, 1), date(2026, 1, 3))


# ---------------------------------------------------------------------------
# Déterminisme et idempotence
# ---------------------------------------------------------------------------


class TestDeterminism:
    def test_same_pages_give_the_same_checksum(self) -> None:
        first = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        second = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        assert first.input_checksum == second.input_checksum
        assert first.measurements == second.measurements

    def test_drafts_are_idempotent(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())

        assert hydro.drafts_from_measurements(
            parsed.measurements, hydro_config()
        ) == hydro.drafts_from_measurements(parsed.measurements, hydro_config())


# ---------------------------------------------------------------------------
# PeriodResolver livré par la Wave A
# ---------------------------------------------------------------------------


class TestPeriodResolver:
    def test_resolver_reads_the_structured_observation_day(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        draft = hydro.drafts_from_measurements(parsed.measurements, hydro_config())[0]

        assert hydro.build_period_resolver()(draft) == (date(2026, 1, 1), date(2026, 1, 1))

    def test_resolver_error_type_matches_the_derive_contract(self) -> None:
        assert issubclass(hydro.HubeauPeriodUnavailableError, PipelineDataUnavailableError)
        assert not issubclass(hydro.HubeauPeriodUnavailableError, AdapterError)

    def test_missing_day_is_refused_by_the_resolver(self) -> None:
        from services.intelligence.adapters.base import ObservationDraft

        draft = ObservationDraft(
            subject_type="hubeau_hydrometrie_station",
            subject_key="S1",
            metric_code="hubeau.hydrometrie.debit",
            numeric_value=1.0,
            metadata={},
        )

        with pytest.raises(PipelineDataUnavailableError, match="observed_on"):
            hydro.build_period_resolver()(draft)

    def test_metric_code_never_carries_a_date(self) -> None:
        """Le contournement Wave A par `metric_code` est caduc : la période
        vit exclusivement dans period_start/period_end."""
        code = hydro.metric_code("hydrometrie", "debit")

        assert code == "hubeau.hydrometrie.debit"
        assert "2026" not in code

    def test_two_days_share_a_metric_code_but_keep_distinct_periods(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        drafts = [
            d for d in hydro.drafts_from_measurements(parsed.measurements, hydro_config())
            if d.metric_code.endswith("debit")
        ]
        assert len({d.metric_code for d in drafts}) == 1

        result = derive_observations(
            drafts,
            source=_source_reference(hydro_config(), ALLOWED),
            method=hydro.METHOD,
            geography_resolver=hydro.build_geography_resolver(parsed.station_ids),
            period_resolver=hydro.build_period_resolver(),
        )

        assert not result.errors
        periods = {(c["period_start"], c["period_end"]) for c in result.candidates}
        assert periods == {
            (date(2026, 1, 1), date(2026, 1, 1)),
            (date(2026, 1, 3), date(2026, 1, 3)),
        }


# ---------------------------------------------------------------------------
# Géographie
# ---------------------------------------------------------------------------


class TestGeography:
    def test_resolver_uses_the_official_identifier(self) -> None:
        geography = hydro.build_geography_resolver(["FIX-STATION-001"])("FIX-STATION-001")

        assert geography.scope == "france"
        assert geography.code == "FIX-STATION-001"
        assert geography.label == "FIX-STATION-001"

    def test_unknown_station_is_refused(self) -> None:
        resolver = hydro.build_geography_resolver(["FIX-STATION-001"])

        with pytest.raises(hydro.HubeauGeographyUnavailableError, match="station inconnue"):
            resolver("FIX-STATION-999")

    def test_geography_error_type_matches_the_derive_contract(self) -> None:
        assert issubclass(hydro.HubeauGeographyUnavailableError, PipelineDataUnavailableError)
        assert not issubclass(hydro.HubeauGeographyUnavailableError, AdapterError)


# ---------------------------------------------------------------------------
# Intégration pipeline P03 et licence
# ---------------------------------------------------------------------------


def _source_reference(config, decision) -> WaterSourceReference:
    return WaterSourceReference(
        source_code=config.source_code,
        release_key=config.release_key,
        checksum_sha256="d" * 64,
        retrieved_at=config.retrieved_at,
        observed_period_start=config.window_start,
        observed_period_end=config.window_end,
        methodology_version=hydro.METHOD.version,
        license=decision,
        attribution="Source : Hub'Eau (fixture de test)",
    )


def run_hydro_pipeline(*, license_decision, pages=None, config=None, geography_resolver=None):
    config = config or hydro_config()
    pages = pages if pages is not None else HYDRO_PAGES
    parsed = None
    try:
        parser = (
            hydro.parse_hydrometrie_pages
            if config.kind == "hydrometrie"
            else hydro.parse_piezometrie_pages
        )
        parsed = parser(pages, config=config)
    except hydro.HubeauHydroError:
        parsed = None
    station_ids = parsed.station_ids if parsed else []

    content = json.dumps(pages[0]).encode("utf-8")
    transport = FakeTransport({None: ScriptedPage(content=content, has_next_page=False)})

    return run_pipeline(
        source_code=config.source_code,
        release_key=config.release_key,
        transport=transport,
        normalizer=hydro.build_normalizer(config),
        source=_source_reference(config, license_decision or BLOCKED),
        method=hydro.METHOD,
        geography_resolver=geography_resolver or hydro.build_geography_resolver(station_ids),
        period_resolver=hydro.build_period_resolver(),
        max_pages=1,
        decoder=hydro.PAGE_DECODER,
        license_decision=license_decision,
        clock=lambda: datetime(2026, 2, 2, tzinfo=timezone.utc),
    )


class TestPipelineIntegration:
    def test_full_dry_run(self) -> None:
        report = run_hydro_pipeline(license_decision=ALLOWED)

        assert report.succeeded
        assert report.dry_run is True
        assert report.steps_executed == [
            "plan", "fetch", "parse", "normalize", "derive", "validate", "publish",
        ]
        assert report.records_read == 3

    def test_source_code_must_exist_in_the_catalogue(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        content = json.dumps(HYDRO_PAGES[0]).encode("utf-8")
        transport = FakeTransport({None: ScriptedPage(content=content, has_next_page=False)})

        report = run_pipeline(
            source_code="HUBEAU_ABSENT_DU_CATALOGUE",
            release_key=HYDRO_RELEASE,
            transport=transport,
            normalizer=hydro.build_normalizer(hydro_config()),
            source=_source_reference(hydro_config(), ALLOWED),
            method=hydro.METHOD,
            geography_resolver=hydro.build_geography_resolver(parsed.station_ids),
            period_resolver=hydro.build_period_resolver(),
            max_pages=1,
            decoder=hydro.PAGE_DECODER,
            license_decision=ALLOWED,
            clock=lambda: datetime(2026, 2, 2, tzinfo=timezone.utc),
        )

        assert not report.succeeded
        assert report.steps_failed == ["plan"]

    def test_invalid_schema_fails_cleanly_at_normalize(self) -> None:
        broken = [hydro_page({"grandeur_hydro_elab": "Q", "date_obs_elab": "2026-01-01"})]

        report = run_hydro_pipeline(license_decision=ALLOWED, pages=broken)

        assert not report.succeeded
        assert report.steps_failed == ["normalize"]
        assert "derive" not in report.steps_executed

    def test_unknown_station_fails_cleanly_at_derive(self) -> None:
        report = run_hydro_pipeline(
            license_decision=ALLOWED, geography_resolver=hydro.build_geography_resolver([])
        )

        assert not report.succeeded
        assert report.steps_failed == ["derive"]
        assert all("géographie non résolue" in e for e in report.errors)

    def test_error_hierarchy_is_compatible_with_adapter_error(self) -> None:
        assert issubclass(hydro.HubeauHydroError, AdapterError)
        assert issubclass(hydro.HubeauSchemaError, AdapterError)
        assert issubclass(hydro.HubeauReleaseError, AdapterError)

    def test_piezometrie_runs_through_the_pipeline(self) -> None:
        report = run_hydro_pipeline(
            license_decision=ALLOWED, pages=PIEZO_PAGES, config=piezo_config()
        )

        assert report.succeeded
        assert report.records_read == 2  # niveau + profondeur du 1er janvier


class TestLicenceGate:
    def test_allowed_licence_publishes_values(self) -> None:
        report = run_hydro_pipeline(license_decision=ALLOWED)

        assert report.records_publishable == 3

    def test_blocked_licence_withholds_every_value(self) -> None:
        report = run_hydro_pipeline(license_decision=BLOCKED)

        assert report.succeeded
        assert report.records_publishable == 0

    def test_unknown_licence_withholds_every_value(self) -> None:
        report = run_hydro_pipeline(license_decision=None)

        assert report.records_publishable == 0
        assert any("licence inconnue" in w for w in report.warnings)

    def test_connector_never_decides_the_licence(self) -> None:
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")

        assert "WaterLicenseDecision" not in source
        assert "allow_display" not in source


class TestDataStatus:
    def test_default_status_is_observed(self) -> None:
        """Contrairement au WEI+ (modélisé), l'hydrométrie est une mesure
        instrumentale : `observed` est le statut honnête."""
        assert hydro.DEFAULT_DATA_STATUS == "observed"

    def test_fixture_is_labelled_as_such(self) -> None:
        parsed = hydro.parse_hydrometrie_pages(HYDRO_PAGES, config=hydro_config())
        drafts = hydro.drafts_from_measurements(parsed.measurements, hydro_config(is_fixture=True))

        assert {d.data_status for d in drafts} == {"fixture"}


# ---------------------------------------------------------------------------
# Absence de réseau / de base
# ---------------------------------------------------------------------------


class TestNoNetworkNoDatabase:
    @staticmethod
    def _imported_roots(path: Path) -> set[str]:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots.add(node.module.split(".")[0])
        return roots

    def test_connector_imports_no_network_or_database_module(self) -> None:
        forbidden = {
            "requests", "httpx", "urllib", "urllib3", "socket", "aiohttp",
            "db", "psycopg", "psycopg2", "pandas",
        }
        assert not (self._imported_roots(CONNECTOR_MODULE) & forbidden)

    def test_connector_uses_no_implicit_clock(self) -> None:
        tree = ast.parse(CONNECTOR_MODULE.read_text(encoding="utf-8"))

        clock_calls = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in {"now", "utcnow", "today"}
        ]

        assert not clock_calls, f"horloge implicite : {clock_calls}"

    def test_connector_issues_no_sql(self) -> None:
        lowered = CONNECTOR_MODULE.read_text(encoding="utf-8").lower()

        assert "insert into" not in lowered
        assert "delete from" not in lowered
