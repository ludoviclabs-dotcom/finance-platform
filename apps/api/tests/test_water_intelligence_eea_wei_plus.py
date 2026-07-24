"""
test_water_intelligence_eea_wei_plus.py — connecteur EEA / WISE / WEI+ (P06).

AUCUNE base requise, AUCUN réseau : le connecteur est pur (bibliothèque
standard + contrats P02) — vérifié explicitement ci-dessous par analyse des
imports, pas seulement promis. Ces tests tournent dans le job `tests`
standard, sans DATABASE_URL.

Couvre : identité de release vérifiée et refus d'un « latest » implicite,
schéma canonique valide/invalide, identifiant absent ou inconnu, doublons,
période absente / hors étendue publiée, unité incompatible, `null` distinct
de `0`, agrégat sans moyenne de ratios (pondération), comparatif temporel
borné, licence autorisée / bloquée / inconnue, attribution, checksum et
idempotence, descripteur de couche sans géométrie, intégration au pipeline
P03 en dry-run, et les deux frontières d'erreur du connecteur
(`WeiPlusError` → `AdapterError` en parse/normalize ;
`WeiPlusGeographyUnavailableError` → `PipelineDataUnavailableError` en
derive).

Depuis le commit de clôture Wave A (audit d'identité temporelle, cf.
`docs/carbonco/water-intelligence/handoffs/WAVE_A_EU_CONNECTORS.md` §5), la
saison n'est plus encodée dans `metric_code` : elle est portée par
`period_start`/`period_end`, résolus au stage `derive` via
`build_period_resolver()`. `TestPeriodResolver` couvre ce contrat
spécifiquement (bornes des 4 trimestres, année bissextile, trimestre/année
invalide ou absent, distinction stricte de deux trimestres d'une même
métrique, absence de tout parsing de libellé).
"""

from __future__ import annotations

import ast
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import WaterLicenseDecision, WaterSourceReference
from services.intelligence.adapters.base import AdapterError, ObservationDraft
from services.water_intelligence.connectors import eea_wei_plus as eea
from services.water_intelligence.pipeline import (
    PipelineDataUnavailableError,
    derive_observations,
    run_pipeline,
)
from services.water_intelligence.pipeline_transport import FakeTransport, ScriptedPage

FIXTURES = Path(__file__).resolve().parent / "fixtures"
VALID_FIXTURE = FIXTURES / "eea_wei_plus_subunit_fixture.csv"
UNKNOWN_COLUMN_FIXTURE = FIXTURES / "eea_wei_plus_unknown_column_fixture.csv"

CONNECTOR_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "connectors" / "eea_wei_plus.py"
)

# Valeur passée par variable (jamais `release_key="<litteral>"`) : le motif
# `<nom_de_champ> = "<valeur>"` déclenche le faux positif generic-api-key de
# gitleaks, déjà rencontré en P03/P05.
FIXTURE_RELEASE = "eea-wei-plus-subunit-2023-extrait-fixture"

ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
BLOCKED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def make_config(**overrides) -> eea.WeiPlusReleaseConfig:
    params = dict(
        release_key=FIXTURE_RELEASE,
        retrieved_at=date(2026, 2, 10),
        is_fixture=True,
    )
    params.update(overrides)
    return eea.WeiPlusReleaseConfig(**params)


def csv_of(*lines: str, header: str = "spatialUnitIdentifier,year,quarter,wei_plus_pct") -> str:
    return "\n".join((header, *lines)) + "\n"


# ---------------------------------------------------------------------------
# Identité de release — jamais de « latest » implicite
# ---------------------------------------------------------------------------


class TestReleaseIdentity:
    def test_verified_releases_are_pinned_by_code_edition_and_doi(self) -> None:
        subunit = eea.DATASET_RELEASES["subunit"]

        assert subunit.dataset_code == "eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00"
        assert subunit.edition == "01.00"
        assert subunit.doi == "10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba"
        assert subunit.published_at == date(2026, 1, 29)
        assert (subunit.coverage_start, subunit.coverage_end) == (
            date(2000, 1, 1),
            date(2023, 12, 31),
        )
        assert subunit.crs == "EPSG:3035"

    def test_both_verified_scales_are_available(self) -> None:
        assert set(eea.DATASET_RELEASES) == {"subunit", "riverbasin"}
        assert (
            eea.DATASET_RELEASES["riverbasin"].doi
            == "10.2909/f25b4715-d18b-4f87-b869-7e96fd385700"
        )

    def test_empty_release_key_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusReleaseError, match="obligatoire"):
            make_config(release_key="   ")

    @pytest.mark.parametrize("moving_target", ["latest", "current", "head", "LATEST"])
    def test_moving_release_key_is_refused(self, moving_target: str) -> None:
        with pytest.raises(eea.WeiPlusReleaseError, match="reproductible"):
            make_config(release_key=moving_target)

    def test_unverified_scale_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="inconnue"):
            make_config(scale="country")

    def test_attribution_carries_the_verified_facts(self) -> None:
        attribution = make_config().attribution()

        assert "European Environment Agency (EEA)" in attribution
        assert "CC-BY-4.0" in attribution
        assert "10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba" in attribution
        assert "edition 01.00" in attribution
        assert "2026-02-10" in attribution


# ---------------------------------------------------------------------------
# Schéma
# ---------------------------------------------------------------------------


class TestSchema:
    def test_valid_fixture_parses(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        assert result.rows_total == 6
        assert result.spatial_units == (
            "EEA-FIXTURE-SUBUNIT-001",
            "EEA-FIXTURE-SUBUNIT-002",
            "EEA-FIXTURE-SUBUNIT-003",
        )
        assert result.periods == ((2023, "Q1"), (2023, "Q3"))

    def test_unknown_column_is_refused(self) -> None:
        """Un libellé de bassin est une colonne hors schéma : refusée, jamais
        acceptée « au cas où » puis utilisée comme clé."""
        with pytest.raises(eea.WeiPlusSchemaError, match="hors schéma canonique"):
            eea.parse_wei_plus_csv(read(UNKNOWN_COLUMN_FIXTURE), config=make_config())

    def test_missing_required_column_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="obligatoire"):
            eea.parse_wei_plus_csv(
                "spatialUnitIdentifier,year,quarter\nX,2023,Q1\n", config=make_config()
            )

    def test_file_without_header_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="sans en-tête"):
            eea.parse_wei_plus_csv("", config=make_config())

    def test_empty_extract_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusReleaseError, match="extrait vide"):
            eea.parse_wei_plus_csv(csv_of(), config=make_config())

    def test_missing_identifier_is_refused_no_join_by_label(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="jointure"):
            eea.parse_wei_plus_csv(csv_of(",2023,Q1,12.5"), config=make_config())

    def test_duplicate_unit_period_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="doublon"):
            eea.parse_wei_plus_csv(
                csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q1,12.5",
                       "EEA-FIXTURE-SUBUNIT-001,2023,Q1,13.0"),
                config=make_config(),
            )

    def test_same_unit_different_quarter_is_not_a_duplicate(self) -> None:
        result = eea.parse_wei_plus_csv(
            csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q1,12.5",
                   "EEA-FIXTURE-SUBUNIT-001,2023,Q2,13.0"),
            config=make_config(),
        )

        assert result.rows_total == 2

    def test_unreadable_value_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="illisible"):
            eea.parse_wei_plus_csv(
                csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q1,beaucoup"), config=make_config()
            )


# ---------------------------------------------------------------------------
# Période et saison
# ---------------------------------------------------------------------------


class TestPeriodAndSeason:
    def test_missing_quarter_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="trimestre absent"):
            eea.parse_wei_plus_csv(
                csv_of("EEA-FIXTURE-SUBUNIT-001,2023,,12.5"), config=make_config()
            )

    def test_missing_year_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="année absente"):
            eea.parse_wei_plus_csv(
                csv_of("EEA-FIXTURE-SUBUNIT-001,,Q1,12.5"), config=make_config()
            )

    def test_unknown_quarter_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="hors vocabulaire"):
            eea.parse_wei_plus_csv(
                csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q5,12.5"), config=make_config()
            )

    @pytest.mark.parametrize("year", [1999, 2024])
    def test_year_outside_published_coverage_is_refused(self, year: int) -> None:
        """Publier une année hors de l'étendue de la release serait une
        période inventée."""
        with pytest.raises(eea.WeiPlusSchemaError, match="hors de l'étendue"):
            eea.parse_wei_plus_csv(
                csv_of(f"EEA-FIXTURE-SUBUNIT-001,{year},Q1,12.5"), config=make_config()
            )

    @pytest.mark.parametrize(
        ("quarter", "expected"),
        [
            ("Q1", (date(2023, 1, 1), date(2023, 3, 31))),
            ("Q2", (date(2023, 4, 1), date(2023, 6, 30))),
            ("Q3", (date(2023, 7, 1), date(2023, 9, 30))),
            ("Q4", (date(2023, 10, 1), date(2023, 12, 31))),
        ],
    )
    def test_quarter_bounds_follow_the_official_vocabulary(
        self, quarter: str, expected: tuple[date, date]
    ) -> None:
        assert eea.quarter_period(2023, quarter) == expected

    def test_season_is_carried_by_the_draft_metadata_not_the_metric_code(self) -> None:
        """Depuis le commit de clôture Wave A, `metric_code` est STABLE :
        deux trimestres de la même unité partagent le même code. La saison
        vit dans les métadonnées structurées du draft (`year`/`quarter`),
        lues par `build_period_resolver()` — voir `TestPeriodResolver`."""
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        drafts = eea._drafts_from_rows(result.rows, make_config())

        codes = {d.metric_code for d in drafts}
        assert "eea_wei_plus.subunit.value_pct" in codes
        assert "eea_wei_plus.subunit.q1.value_pct" not in codes
        assert "eea_wei_plus.subunit.q3.value_pct" not in codes

        q3 = next(
            d for d in drafts
            if d.metric_code == "eea_wei_plus.subunit.value_pct" and d.metadata["quarter"] == "Q3"
        )
        assert q3.observed_at == datetime(2023, 7, 1, tzinfo=timezone.utc)
        assert q3.metadata["year"] == 2023
        assert q3.metadata["period_start"] == "2023-07-01"
        assert q3.metadata["period_end"] == "2023-09-30"

    def test_quarters_are_never_flattened_into_one_annual_value(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        unit_001 = [r for r in result.rows if r.spatial_unit_id == "EEA-FIXTURE-SUBUNIT-001"]
        assert {r.quarter for r in unit_001} == {"Q1", "Q3"}
        assert {r.value_pct for r in unit_001} == {12.5, 44.75}


# ---------------------------------------------------------------------------
# PeriodResolver EEA (Wave A, commit de clôture) — `build_period_resolver()`.
# Audit d'identité temporelle complet :
# docs/carbonco/water-intelligence/handoffs/WAVE_A_EU_CONNECTORS.md §5.
# ---------------------------------------------------------------------------


def _draft(*, subject_key: str, metric_code: str, metadata: dict) -> ObservationDraft:
    """Construit un draft minimal pour exercer le résolveur de période
    directement, sans repasser par le parsing CSV."""
    return ObservationDraft(
        subject_type="eea_wei_plus_unit",
        subject_key=subject_key,
        metric_code=metric_code,
        numeric_value=1.0,
        geography_code=subject_key,
        observed_at=datetime(2023, 1, 1, tzinfo=timezone.utc),
        data_status="fixture",
        methodology_version=eea.METHOD.version,
        metadata=metadata,
    )


class TestPeriodResolver:
    @pytest.mark.parametrize(
        ("quarter", "expected"),
        [
            ("Q1", (date(2023, 1, 1), date(2023, 3, 31))),
            ("Q2", (date(2023, 4, 1), date(2023, 6, 30))),
            ("Q3", (date(2023, 7, 1), date(2023, 9, 30))),
            ("Q4", (date(2023, 10, 1), date(2023, 12, 31))),
        ],
    )
    def test_each_quarter_resolves_to_its_official_bounds(
        self, quarter: str, expected: tuple[date, date]
    ) -> None:
        resolver = eea.build_period_resolver()
        draft = _draft(
            subject_key="EEA-FIXTURE-SUBUNIT-001",
            metric_code="eea_wei_plus.subunit.value_pct",
            metadata={"year": 2023, "quarter": quarter},
        )

        assert resolver(draft) == expected

    def test_q1_bounds_are_unaffected_by_a_non_leap_year(self) -> None:
        resolver = eea.build_period_resolver()
        draft = _draft(
            subject_key="X", metric_code="m",
            metadata={"year": 2023, "quarter": "Q1"},  # 2023 : non bissextile
        )

        assert resolver(draft) == (date(2023, 1, 1), date(2023, 3, 31))

    def test_q1_bounds_are_unaffected_by_a_leap_year(self) -> None:
        """Février (le seul mois sensible au bissextile) n'est jamais un mois
        de fin de trimestre dans le vocabulaire WEI+ : les bornes Q1 restent
        1er janvier → 31 mars, année bissextile ou non — aucune arithmétique
        implicite sur les jours de février."""
        resolver = eea.build_period_resolver()
        draft = _draft(
            subject_key="X", metric_code="m",
            metadata={"year": 2024, "quarter": "Q1"},  # 2024 : bissextile
        )

        assert resolver(draft) == (date(2024, 1, 1), date(2024, 3, 31))

    def test_invalid_quarter_is_refused_via_pipeline_data_unavailable(self) -> None:
        resolver = eea.build_period_resolver()
        draft = _draft(
            subject_key="X", metric_code="m", metadata={"year": 2023, "quarter": "Q9"}
        )

        with pytest.raises(PipelineDataUnavailableError, match="trimestre"):
            resolver(draft)

    def test_period_start_never_exceeds_period_end(self) -> None:
        """Invariant vérifié pour chaque trimestre officiel — jamais de bornes
        inversées, quel que soit le résolveur branché."""
        resolver = eea.build_period_resolver()
        for quarter in eea.QUARTER_MONTHS:
            start, end = resolver(
                _draft(subject_key="X", metric_code="m", metadata={"year": 2023, "quarter": quarter})
            )
            assert start <= end

    def test_missing_year_is_refused_via_pipeline_data_unavailable(self) -> None:
        resolver = eea.build_period_resolver()
        draft = _draft(subject_key="X", metric_code="m", metadata={"quarter": "Q1"})

        with pytest.raises(PipelineDataUnavailableError, match="année"):
            resolver(draft)

    def test_missing_quarter_is_refused_via_pipeline_data_unavailable(self) -> None:
        resolver = eea.build_period_resolver()
        draft = _draft(subject_key="X", metric_code="m", metadata={"year": 2023})

        with pytest.raises(PipelineDataUnavailableError, match="trimestre"):
            resolver(draft)

    def test_non_integer_year_is_refused(self) -> None:
        """Une année textuelle (ex. `"2023"`) n'est jamais coercée en entier
        implicitement — le type structuré est exigé tel quel."""
        resolver = eea.build_period_resolver()
        draft = _draft(subject_key="X", metric_code="m", metadata={"year": "2023", "quarter": "Q1"})

        with pytest.raises(PipelineDataUnavailableError, match="année"):
            resolver(draft)

    def test_resolver_never_parses_the_subject_key_or_geography_code(self) -> None:
        """Le résolveur lit UNIQUEMENT les métadonnées structurées — un
        identifiant ou un code géographique qui ressemble à un trimestre ne
        doit avoir aucune influence sur la période résolue."""
        resolver = eea.build_period_resolver()
        draft = ObservationDraft(
            subject_type="eea_wei_plus_unit",
            subject_key="Q1-LOOKALIKE-2023-EEA-FIXTURE",
            metric_code="eea_wei_plus.subunit.value_pct",
            numeric_value=1.0,
            geography_code="Q4-2023-DOES-NOT-EXIST",
            observed_at=datetime(2023, 1, 1, tzinfo=timezone.utc),
            data_status="fixture",
            methodology_version=eea.METHOD.version,
            metadata={"year": 2023, "quarter": "Q3"},
        )

        assert resolver(draft) == (date(2023, 7, 1), date(2023, 9, 30))

    def test_two_quarters_of_the_same_metric_remain_distinct_after_derive(self) -> None:
        """Le cœur de la clôture Wave A : `metric_code` identique, périodes
        distinctes, AUCUNE des deux observations n'écrase l'autre."""
        config = make_config()
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=config)
        unit_001_values = [
            d for d in eea._drafts_from_rows(result.rows, config)
            if d.subject_key == "EEA-FIXTURE-SUBUNIT-001" and d.metric_code.endswith("value_pct")
        ]
        assert len(unit_001_values) == 2
        assert len({d.metric_code for d in unit_001_values}) == 1  # même metric_code

        derive_result = derive_observations(
            unit_001_values,
            source=_source_reference(config, license_decision=ALLOWED),
            method=eea.METHOD,
            geography_resolver=eea.build_geography_resolver(result.rows),
            period_resolver=eea.build_period_resolver(),
        )

        assert not derive_result.errors
        assert len(derive_result.candidates) == 2
        periods = {(c["period_start"], c["period_end"]) for c in derive_result.candidates}
        assert periods == {
            (date(2023, 1, 1), date(2023, 3, 31)),
            (date(2023, 7, 1), date(2023, 9, 30)),
        }
        values = {c["value"] for c in derive_result.candidates}
        assert values == {12.5, 44.75}

    def test_derive_is_idempotent_across_periods(self) -> None:
        """Rejouer `derive_observations` sur les mêmes drafts produit
        exactement les mêmes candidats — aucun trimestre n'en écrase un
        autre, aucun n'apparaît en double."""
        config = make_config()
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=config)
        drafts = eea._drafts_from_rows(result.rows, config)
        kwargs = dict(
            source=_source_reference(config, license_decision=ALLOWED),
            method=eea.METHOD,
            geography_resolver=eea.build_geography_resolver(result.rows),
            period_resolver=eea.build_period_resolver(),
        )

        first = derive_observations(drafts, **kwargs)
        second = derive_observations(drafts, **kwargs)

        assert first.candidates == second.candidates
        assert len(first.candidates) == len(drafts)

    def test_period_error_at_derive_produces_a_named_report_not_a_raw_exception(self) -> None:
        """Une erreur de résolution de période, propagée par `run_pipeline`,
        échoue proprement au stage `derive` — jamais une exception nue."""
        report = run_wei_pipeline(
            license_decision=ALLOWED,
            period_resolver=lambda draft: (_ for _ in ()).throw(
                PipelineDataUnavailableError("période simulée non résolue")
            ),
        )

        assert not report.succeeded
        assert report.steps_failed == ["derive"]
        assert any("période simulée non résolue" in e for e in report.errors)
        assert "validate" not in report.steps_executed
        assert "publish" not in report.steps_executed


# ---------------------------------------------------------------------------
# Unités
# ---------------------------------------------------------------------------


class TestUnits:
    def test_incompatible_unit_is_refused(self) -> None:
        with pytest.raises(eea.WeiPlusSchemaError, match="incompatible"):
            eea.parse_wei_plus_csv(
                csv_of(
                    "EEA-FIXTURE-SUBUNIT-001,2023,Q1,12.5,m3",
                    header="spatialUnitIdentifier,year,quarter,wei_plus_pct,unit",
                ),
                config=make_config(),
            )

    def test_expected_unit_is_accepted_and_carried(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        drafts = eea._drafts_from_rows(result.rows, make_config())

        assert {d.unit for d in drafts if d.numeric_value is not None} == {"%"}

    def test_unit_column_is_optional(self) -> None:
        result = eea.parse_wei_plus_csv(
            csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q1,12.5"), config=make_config()
        )

        assert result.rows_total == 1


# ---------------------------------------------------------------------------
# Valeur absente — jamais zéro, jamais « pas de stress »
# ---------------------------------------------------------------------------


class TestMissingValues:
    def test_blank_value_is_none_not_zero(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        absent = [r for r in result.rows if r.spatial_unit_id == "EEA-FIXTURE-SUBUNIT-003"]
        assert len(absent) == 2
        assert all(r.value_pct is None for r in absent)
        assert result.values_absent == 2
        assert result.values_present == 4

    def test_absent_value_has_no_stress_band(self) -> None:
        """Absent ≠ zéro, et surtout absent ≠ « sous le seuil de stress »."""
        assert eea.stress_band(None) is None

    def test_absent_value_produces_no_draft(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        drafts = eea._drafts_from_rows(result.rows, make_config())

        assert not [d for d in drafts if d.subject_key == "EEA-FIXTURE-SUBUNIT-003"]

    def test_absence_is_reported_as_a_warning(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        assert any("valeur(s) absente(s)" in w for w in result.warnings)

    def test_zero_is_a_real_value_not_an_absence(self) -> None:
        result = eea.parse_wei_plus_csv(
            csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q1,0"), config=make_config()
        )

        assert result.rows[0].value_pct == 0.0
        assert result.values_present == 1
        assert result.values_absent == 0


# ---------------------------------------------------------------------------
# Stress — seuils officiels, comparaison stricte
# ---------------------------------------------------------------------------


class TestStressBands:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            (0.0, eea.STRESS_BAND_BELOW),
            (20.0, eea.STRESS_BAND_BELOW),      # « above 20% » → 20 exclu
            (20.1, eea.STRESS_BAND_STRESS),
            (40.0, eea.STRESS_BAND_STRESS),     # « above 40% » → 40 exclu
            (40.1, eea.STRESS_BAND_SEVERE),
        ],
    )
    def test_bands_follow_the_official_thresholds(self, value: float, expected: str) -> None:
        assert eea.stress_band(value) == expected

    def test_band_draft_carries_its_thresholds_as_metadata(self) -> None:
        """Les seuils vivent dans les métadonnées de méthode, jamais figés
        dans une vue."""
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        drafts = eea._drafts_from_rows(result.rows, make_config())

        band = next(d for d in drafts if d.metric_code.endswith("stress_band"))
        assert band.metadata["stress_threshold_pct"] == 20.0
        assert band.metadata["severe_threshold_pct"] == 40.0
        assert band.metadata["threshold_comparison"] == "strictly_greater_than"

    def test_band_is_text_never_a_number_to_average(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        drafts = eea._drafts_from_rows(result.rows, make_config())

        bands = [d for d in drafts if d.metric_code.endswith("stress_band")]
        assert bands
        assert all(d.text_value is not None and d.numeric_value is None for d in bands)


# ---------------------------------------------------------------------------
# Agrégat — pondération : aucune moyenne de ratios
# ---------------------------------------------------------------------------


class TestAggregate:
    def test_aggregate_exposes_counts_and_coverage_only(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        aggregates = eea.aggregate_by_period(result.rows)

        assert [(a.year, a.quarter) for a in aggregates] == [(2023, "Q1"), (2023, "Q3")]
        q1 = aggregates[0]
        assert (q1.units_total, q1.units_with_value, q1.units_without_value) == (3, 2, 1)
        # 12.5 et 20.0 : aucune valeur STRICTEMENT au-dessus de 20.
        assert q1.units_above_stress_threshold == 0
        q3 = aggregates[1]
        assert (q3.units_above_stress_threshold, q3.units_above_severe_threshold) == (2, 1)

    def test_aggregate_never_exposes_a_mean_of_ratios(self) -> None:
        """Le WEI+ est un ratio : sans pondération par les volumes — que la
        release ne publie pas — aucune moyenne inter-bassins n'est calculable."""
        aggregate_fields = set(eea.WeiPlusPeriodAggregate.__dataclass_fields__)

        assert not [f for f in aggregate_fields if "mean" in f or "avg" in f or "average" in f]
        assert not hasattr(eea, "average_wei_plus")

    def test_coverage_is_separate_from_stress(self) -> None:
        """Couverture faible ≠ stress faible : deux dimensions distinctes."""
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        q1 = eea.aggregate_by_period(result.rows)[0]

        assert q1.coverage_pct == pytest.approx(66.6667, abs=1e-3)
        assert q1.units_without_value == 1

    def test_aggregate_is_independent_of_row_order(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        forward = eea.aggregate_by_period(result.rows)
        backward = eea.aggregate_by_period(list(reversed(result.rows)))

        assert forward == backward


# ---------------------------------------------------------------------------
# Comparatif temporel borné
# ---------------------------------------------------------------------------


class TestTemporalComparison:
    def test_comparison_is_expressed_in_percentage_points(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        comparisons = eea.compare_periods(
            result.rows, from_period=(2023, "Q1"), to_period=(2023, "Q3")
        )

        by_unit = {c.spatial_unit_id: c for c in comparisons}
        assert by_unit["EEA-FIXTURE-SUBUNIT-001"].delta_pct_points == pytest.approx(32.25)
        assert by_unit["EEA-FIXTURE-SUBUNIT-002"].delta_pct_points == pytest.approx(5.5)

    def test_absent_value_is_never_compared(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        comparisons = eea.compare_periods(
            result.rows, from_period=(2023, "Q1"), to_period=(2023, "Q3")
        )

        absent = next(c for c in comparisons if c.spatial_unit_id == "EEA-FIXTURE-SUBUNIT-003")
        assert absent.delta_pct_points is None

    def test_unbounded_history_is_refused(self) -> None:
        many = [
            f"EEA-FIXTURE-SUBUNIT-001,{2000 + offset},Q1,10.0"
            for offset in range(eea.MAX_COMPARISON_PERIODS + 1)
        ]
        result = eea.parse_wei_plus_csv(csv_of(*many), config=make_config())

        with pytest.raises(eea.WeiPlusBudgetError, match="périodes distinctes"):
            eea.bounded_periods(result.rows)

    def test_bounded_history_is_accepted(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        assert eea.bounded_periods(result.rows) == ((2023, "Q1"), (2023, "Q3"))


# ---------------------------------------------------------------------------
# Checksum et idempotence
# ---------------------------------------------------------------------------


class TestDeterminism:
    def test_same_bytes_give_the_same_checksum(self) -> None:
        text = read(VALID_FIXTURE)

        first = eea.parse_wei_plus_csv(text, config=make_config())
        second = eea.parse_wei_plus_csv(text, config=make_config())

        assert first.input_checksum == second.input_checksum
        assert first.rows == second.rows

    def test_different_bytes_give_a_different_checksum(self) -> None:
        base = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        other = eea.parse_wei_plus_csv(
            csv_of("EEA-FIXTURE-SUBUNIT-001,2023,Q1,12.5"), config=make_config()
        )

        assert base.input_checksum != other.input_checksum

    def test_drafts_are_idempotent(self) -> None:
        config = make_config()
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=config)

        assert eea._drafts_from_rows(result.rows, config) == eea._drafts_from_rows(
            result.rows, config
        )

    def test_pipeline_output_checksum_is_stable(self) -> None:
        first = run_wei_pipeline(license_decision=ALLOWED)
        second = run_wei_pipeline(license_decision=ALLOWED)

        assert first.output_checksum == second.output_checksum
        assert first.input_checksum == second.input_checksum


# ---------------------------------------------------------------------------
# Géographie
# ---------------------------------------------------------------------------


class TestGeography:
    def test_resolver_uses_the_official_identifier(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())

        geography = eea.build_geography_resolver(result.rows)("EEA-FIXTURE-SUBUNIT-001")

        assert geography.scope == "europe"
        assert geography.code == "EEA-FIXTURE-SUBUNIT-001"
        assert geography.label == "EEA-FIXTURE-SUBUNIT-001"

    def test_unknown_identifier_is_refused(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        resolver = eea.build_geography_resolver(result.rows)

        with pytest.raises(eea.WeiPlusGeographyUnavailableError, match="inconnue"):
            resolver("EEA-FIXTURE-SUBUNIT-999")

    def test_geography_error_matches_the_p03_derive_contract(self) -> None:
        assert issubclass(eea.WeiPlusGeographyUnavailableError, PipelineDataUnavailableError)
        assert not issubclass(eea.WeiPlusGeographyUnavailableError, AdapterError)


# ---------------------------------------------------------------------------
# Descripteur de couche — aucune géométrie dans Git
# ---------------------------------------------------------------------------


def _source_reference(
    config: eea.WeiPlusReleaseConfig, *, license_decision: WaterLicenseDecision
) -> WaterSourceReference:
    dataset = config.dataset
    return WaterSourceReference(
        source_code=eea.SOURCE_CODE,
        release_key=config.release_key,
        checksum_sha256="b" * 64,
        published_at=dataset.published_at,
        retrieved_at=config.retrieved_at,
        observed_period_start=dataset.coverage_start,
        observed_period_end=dataset.coverage_end,
        methodology_version=eea.METHOD.version,
        license=license_decision,
        attribution=config.attribution(),
    )


class TestLayerDescriptor:
    def test_descriptor_counts_features_without_carrying_geometry(self) -> None:
        config = make_config()
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=config)

        descriptor = eea.build_layer_descriptor(
            result, config=config, source=_source_reference(config, license_decision=ALLOWED)
        )

        assert descriptor.feature_count == 3
        assert descriptor.zoom_level == "europe"
        assert descriptor.boundary_format == "topojson"
        assert descriptor.payload_bytes_gzip is None

    def test_descriptor_refuses_to_exceed_the_layer_budget(self) -> None:
        config = make_config()
        rows = [
            eea.WeiPlusRow(
                spatial_unit_id=f"EEA-FIXTURE-SUBUNIT-{index:05d}",
                year=2023,
                quarter="Q1",
                value_pct=10.0,
            )
            for index in range(eea.MAX_LAYER_FEATURES + 1)
        ]
        oversized = eea.WeiPlusParseResult(rows=rows, rows_total=len(rows))

        with pytest.raises(eea.WeiPlusBudgetError, match="budget de couche"):
            eea.build_layer_descriptor(
                oversized,
                config=config,
                source=_source_reference(config, license_decision=ALLOWED),
            )

    def test_no_geometry_fixture_ships_in_the_repository(self) -> None:
        heavy = [
            path
            for path in FIXTURES.glob("eea_wei_plus*")
            if path.suffix.lower() in {".shp", ".geojson", ".topojson", ".zip", ".gpkg"}
        ]

        assert not heavy


# ---------------------------------------------------------------------------
# Intégration pipeline P03 — dry-run, aucune écriture
# ---------------------------------------------------------------------------


def run_wei_pipeline(
    *,
    license_decision: WaterLicenseDecision | None,
    csv_text: str | None = None,
    geography_resolver=None,
    period_resolver=None,
    source_code: str | None = None,
):
    config = make_config()
    text = csv_text if csv_text is not None else read(VALID_FIXTURE)
    # Le référentiel géographique est construit à partir de l'extrait lui-même.
    # Un extrait au schéma invalide n'en produit aucun : c'est le PIPELINE qui
    # doit alors échouer proprement, pas ce helper de test.
    try:
        known_rows = eea.parse_wei_plus_csv(text, config=config).rows
    except eea.WeiPlusError:
        known_rows = []
    transport = FakeTransport(
        {None: ScriptedPage(content=text.encode("utf-8"), has_next_page=False)}
    )
    return run_pipeline(
        source_code=source_code or eea.SOURCE_CODE,
        release_key=config.release_key,
        transport=transport,
        normalizer=eea.build_normalizer(config),
        source=_source_reference(
            config, license_decision=license_decision or BLOCKED
        ),
        method=eea.METHOD,
        geography_resolver=geography_resolver or eea.build_geography_resolver(known_rows),
        max_pages=1,
        decoder=eea.PAGE_DECODER,
        period_resolver=period_resolver or eea.build_period_resolver(),
        license_decision=license_decision,
        clock=lambda: datetime(2026, 2, 11, tzinfo=timezone.utc),
    )


class TestPipelineIntegration:
    def test_full_dry_run_through_the_p03_pipeline(self) -> None:
        report = run_wei_pipeline(license_decision=ALLOWED)

        assert report.succeeded
        assert report.dry_run is True
        assert report.steps_executed == [
            "plan", "fetch", "parse", "normalize", "derive", "validate", "publish",
        ]
        assert report.source_code == eea.SOURCE_CODE
        assert report.records_read == 8  # 4 valeurs présentes × (value_pct + stress_band)

    def test_source_code_is_registered_in_the_normalised_catalogue(self) -> None:
        """Le stage `plan` ne connaît que le catalogue P01b : un connecteur
        dont le code n'y figure pas est refusé."""
        report = run_wei_pipeline(license_decision=ALLOWED, source_code="EEA_ABSENT_DU_CATALOGUE")

        assert not report.succeeded
        assert report.steps_failed == ["plan"]

    def test_unknown_schema_fails_cleanly_at_normalize(self) -> None:
        report = run_wei_pipeline(
            license_decision=ALLOWED, csv_text=read(UNKNOWN_COLUMN_FIXTURE)
        )

        assert not report.succeeded
        assert report.steps_failed == ["normalize"]
        assert any("hors schéma canonique" in e for e in report.errors)
        assert "derive" not in report.steps_executed

    def test_unresolved_geography_fails_cleanly_at_derive(self) -> None:
        report = run_wei_pipeline(
            license_decision=ALLOWED, geography_resolver=eea.build_geography_resolver([])
        )

        assert not report.succeeded
        assert report.steps_failed == ["derive"]
        assert all("géographie non résolue" in e for e in report.errors)

    def test_connector_error_hierarchy_is_compatible_with_adapter_error(self) -> None:
        assert issubclass(eea.WeiPlusError, AdapterError)
        assert issubclass(eea.WeiPlusSchemaError, AdapterError)
        assert issubclass(eea.WeiPlusReleaseError, AdapterError)
        assert issubclass(eea.WeiPlusBudgetError, AdapterError)


# ---------------------------------------------------------------------------
# Licence — autorisée / bloquée / inconnue
# ---------------------------------------------------------------------------


class TestLicenceGate:
    def test_allowed_licence_publishes_values(self) -> None:
        report = run_wei_pipeline(license_decision=ALLOWED)

        assert report.records_publishable == 8
        assert report.license_status is not None
        assert report.license_status.allow_display is True

    def test_blocked_licence_withholds_every_value(self) -> None:
        report = run_wei_pipeline(license_decision=BLOCKED)

        assert report.succeeded
        assert report.records_publishable == 0

    def test_unknown_licence_withholds_every_value(self) -> None:
        """Aucune licence fournie ne veut PAS dire licence permissive."""
        report = run_wei_pipeline(license_decision=None)

        assert report.records_publishable == 0
        assert any("licence inconnue" in w for w in report.warnings)

    def test_verified_licence_facts_are_carried_by_the_connector(self) -> None:
        assert eea.LICENSE_CODE == "CC-BY-4.0"
        assert eea.LICENSE_URL == "https://creativecommons.org/licenses/by/4.0/"
        assert eea.COPYRIGHT_HOLDER == "European Environment Agency (EEA)"

    def test_connector_never_decides_the_licence_itself(self) -> None:
        """La porte de licence appartient au pipeline : le connecteur ne
        construit aucune `WaterLicenseDecision`."""
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")

        assert "WaterLicenseDecision" not in source
        assert "allow_display" not in source


# ---------------------------------------------------------------------------
# Statut de donnée et fixture
# ---------------------------------------------------------------------------


class TestDataStatus:
    def test_default_status_is_modelled_not_observed(self) -> None:
        """Le WEI+ est modélisé (comblement de lacunes, retours modélisés) :
        revendiquer une mesure directe serait faux."""
        assert eea.DEFAULT_DATA_STATUS == "modelled"

    def test_fixture_is_labelled_as_such(self) -> None:
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=make_config())
        drafts = eea._drafts_from_rows(result.rows, make_config(is_fixture=True))

        assert {d.data_status for d in drafts} == {"fixture"}

    def test_non_fixture_extract_keeps_the_modelled_status(self) -> None:
        config = make_config(is_fixture=False)
        result = eea.parse_wei_plus_csv(read(VALID_FIXTURE), config=config)

        drafts = eea._drafts_from_rows(result.rows, config)

        assert {d.data_status for d in drafts} == {"modelled"}


# ---------------------------------------------------------------------------
# Absence de réseau / de base — preuve structurelle
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
        offending = self._imported_roots(CONNECTOR_MODULE) & forbidden

        assert not offending, f"le connecteur importe {offending} — interdit en P06."

    def test_connector_adds_no_heavy_geospatial_dependency(self) -> None:
        forbidden = {"gdal", "osgeo", "rasterio", "fiona", "geopandas", "shapely", "pyproj"}
        offending = self._imported_roots(CONNECTOR_MODULE) & forbidden

        assert not offending, f"dépendance lourde {offending} sans ADR — interdite."

    def test_connector_issues_no_sql(self) -> None:
        lowered = CONNECTOR_MODULE.read_text(encoding="utf-8").lower()

        assert "insert into" not in lowered
        assert "update " not in lowered
        assert "delete from" not in lowered

    def test_connector_uses_no_implicit_clock(self) -> None:
        """Aucune horloge implicite : un build reproductible ne dépend pas de
        l'heure courante. Vérifié sur l'AST — une mention en commentaire ou
        en docstring ne doit ni déclencher ni masquer ce test."""
        tree = ast.parse(CONNECTOR_MODULE.read_text(encoding="utf-8"))

        clock_calls = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in {"now", "utcnow", "today"}
        ]

        assert not clock_calls, f"horloge implicite appelée : {clock_calls}"
