"""
test_water_intelligence_hubeau_withdrawals_quality.py — prélèvements et
qualité Hub'Eau (P08).

AUCUNE base requise, AUCUN réseau.

Couvre les dix cas exigés par le MACRO-PROMPT B — code inconnu, paramètre hors
allowlist, unités incompatibles, valeur censurée, limite de quantification,
absence, pagination, période, licence, idempotence — plus les cinq
interdictions structurelles : pas de classement sanitaire, pas de conformité,
pas d'agrégat entre paramètres incompatibles, pas de jointure par nom, pas
d'aspiration de tous les analytes. Et surtout : absence de déclaration ≠ zéro.
"""

from __future__ import annotations

import ast
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import WaterLicenseDecision, WaterSourceReference
from services.intelligence.adapters.base import AdapterError
from services.water_intelligence.connectors import (
    hubeau_withdrawals_quality as wq,
)
from services.water_intelligence.pipeline import (
    PipelineDataUnavailableError,
    derive_observations,
    run_pipeline,
)
from services.water_intelligence.pipeline_transport import FakeTransport, ScriptedPage

CONNECTOR_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "connectors" / "hubeau_withdrawals_quality.py"
)

WITHDRAWALS_RELEASE = "hubeau-bnpe-2022-2023-fixture"
QUALITY_RELEASE = "hubeau-naiades-2026-01-fixture"

ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)
BLOCKED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False
)


def withdrawals_config(**overrides) -> wq.WithdrawalsReleaseConfig:
    params = dict(
        release_key=WITHDRAWALS_RELEASE,
        retrieved_at=date(2026, 2, 1),
        year_min=2022,
        year_max=2023,
        is_fixture=True,
    )
    params.update(overrides)
    return wq.WithdrawalsReleaseConfig(**params)


def quality_config(**overrides) -> wq.QualityReleaseConfig:
    params = dict(
        release_key=QUALITY_RELEASE,
        retrieved_at=date(2026, 2, 1),
        window_start=date(2026, 1, 1),
        window_end=date(2026, 1, 31),
        is_fixture=True,
    )
    params.update(overrides)
    return wq.QualityReleaseConfig(**params)


def page(*records) -> dict:
    return {"count": len(records), "data": list(records)}


def withdrawal_record(*, ouvrage="FIX-OUVRAGE-001", year=2023, volume=125000.0, usage="AEP"):
    return {
        "code_ouvrage": ouvrage,
        "annee": year,
        "volume": volume,
        "code_usage": usage,
        "libelle_usage": "Eau potable (fixture)",
        "code_type_milieu": "SOUT",
        "libelle_type_milieu": "Souterrain",
        "code_commune_insee": "34172",
    }


def analysis_record(*, station="FIX-QUAL-001", parameter="1340", day="2026-01-10",
                    value=12.5, unit="mg(NO3)/L", remark="1", limit=None):
    return {
        "code_station": station,
        "libelle_station": "Station fictive (fixture)",
        "code_parametre": parameter,
        "libelle_parametre": "Nitrates",
        "date_prelevement": day,
        "resultat": value,
        "symbole_unite": unit,
        "code_remarque": remark,
        "mnemo_remarque": "Résultat (fixture)",
        "code_statut": "1",
        "mnemo_statut": "Données contrôlées (fixture)",
        "code_qualification": "1",
        "libelle_qualification": "Correcte",
        "limite_quantification": limit,
    }


WITHDRAWALS_PAGES = [
    page(
        withdrawal_record(ouvrage="FIX-OUVRAGE-001", year=2022, volume=100000.0),
        withdrawal_record(ouvrage="FIX-OUVRAGE-001", year=2023, volume=125000.0),
        withdrawal_record(ouvrage="FIX-OUVRAGE-002", year=2023, volume=None),
    )
]

QUALITY_PAGES = [
    page(
        analysis_record(day="2026-01-10", value=12.5),
        analysis_record(day="2026-01-20", value=18.0),
        analysis_record(parameter="1339", day="2026-01-10", value=0.05, unit="mg(NO2)/L"),
    )
]


# ---------------------------------------------------------------------------
# Absence de déclaration ≠ zéro
# ---------------------------------------------------------------------------


class TestAbsenceIsNotZero:
    def test_undeclared_volume_is_none_not_zero(self) -> None:
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())

        undeclared = [r for r in parsed.records if not r.has_value()]
        assert len(undeclared) == 1
        assert undeclared[0].volume_m3 is None
        assert parsed.values_absent == 1

    def test_undeclared_volume_produces_no_observation(self) -> None:
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())
        drafts = wq.withdrawals_drafts(parsed.records, withdrawals_config())

        assert not [d for d in drafts if d.subject_key == "FIX-OUVRAGE-002"]

    def test_official_coverage_limit_is_always_reported(self) -> None:
        """La source ne connaît pas les usages exonérés de redevance ni les
        volumes sous le seuil de déclaration : l'avertissement est émis même
        quand tout est déclaré."""
        complete = [page(withdrawal_record(volume=100000.0))]

        parsed = wq.parse_withdrawals_pages(complete, config=withdrawals_config())

        assert any("exonérés de redevance" in w for w in parsed.warnings)
        assert any("JAMAIS un prélèvement nul" in w for w in parsed.warnings)

    def test_coverage_never_presents_a_partial_sum_as_a_total(self) -> None:
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())

        by_year = {c.year: c for c in wq.coverage_by_year(parsed.records)}

        assert by_year[2023].ouvrages_total == 2
        assert by_year[2023].ouvrages_with_declaration == 1
        assert by_year[2023].is_complete is False
        assert by_year[2022].is_complete is True

    def test_declared_volume_is_named_as_declared_not_as_total(self) -> None:
        fields = set(wq.WithdrawalsCoverage.__dataclass_fields__)

        assert "declared_volume_m3" in fields
        assert "total_volume_m3" not in fields

    def test_zero_volume_is_a_real_declaration(self) -> None:
        parsed = wq.parse_withdrawals_pages(
            [page(withdrawal_record(volume=0))], config=withdrawals_config()
        )

        assert parsed.records[0].volume_m3 == 0.0
        assert parsed.values_present == 1
        assert parsed.values_absent == 0

    def test_coverage_threshold_is_the_documented_one(self) -> None:
        assert wq.UNDECLARED_VOLUME_THRESHOLD_M3 == 10_000


# ---------------------------------------------------------------------------
# Allowlist de paramètres — aucune aspiration de tous les analytes
# ---------------------------------------------------------------------------


class TestParameterAllowlist:
    def test_default_allowlist_is_sourced(self) -> None:
        for code, parameter in wq.DEFAULT_PARAMETER_ALLOWLIST.items():
            assert parameter.code == code
            assert parameter.label
            assert "SANDRE" in parameter.source

    def test_verified_sandre_codes(self) -> None:
        assert wq.DEFAULT_PARAMETER_ALLOWLIST["1340"].label == "Nitrates"
        assert wq.DEFAULT_PARAMETER_ALLOWLIST["1339"].label == "Nitrites"

    def test_parameter_outside_allowlist_is_refused(self) -> None:
        rogue = [page(analysis_record(parameter="9999"))]

        with pytest.raises(wq.HubeauParameterRefused, match="hors allowlist"):
            wq.parse_quality_pages(rogue, config=quality_config())

    def test_empty_allowlist_is_refused_at_configuration(self) -> None:
        with pytest.raises(wq.HubeauParameterRefused, match="aspiration"):
            quality_config(parameter_allowlist={})

    def test_allowlist_can_be_narrowed_by_the_operator(self) -> None:
        only_nitrates = {"1340": wq.DEFAULT_PARAMETER_ALLOWLIST["1340"]}

        with pytest.raises(wq.HubeauParameterRefused, match="1339"):
            wq.parse_quality_pages(
                QUALITY_PAGES, config=quality_config(parameter_allowlist=only_nitrates)
            )

    def test_missing_parameter_code_is_refused(self) -> None:
        broken = [page({k: v for k, v in analysis_record().items() if k != "code_parametre"})]

        with pytest.raises(wq.HubeauUsageSchemaError, match="code_parametre"):
            wq.parse_quality_pages(broken, config=quality_config())


# ---------------------------------------------------------------------------
# Aucune interprétation sanitaire
# ---------------------------------------------------------------------------


class TestNoSanitaryJudgement:
    def test_connector_declares_no_regulatory_threshold(self) -> None:
        """Aucun seuil réglementaire n'existe dans ce module : comparer un
        résultat à une limite juridique appartient à P13, avec son contexte."""
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")
        tree = ast.parse(source)

        names = {
            node.id for node in ast.walk(tree) if isinstance(node, ast.Name)
        } | {
            node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
        }
        forbidden = [
            n for n in names
            if any(m in n.lower() for m in ("seuil_reglementaire", "conformite", "conformity",
                                            "potabilite", "classement", "ranking", "grade"))
        ]
        assert not forbidden, f"vocabulaire de jugement sanitaire : {forbidden}"

    def test_vocabularies_are_carried_verbatim_and_marked_uninterpreted(self) -> None:
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())
        drafts = wq.quality_drafts(parsed.analyses, quality_config())

        metadata = drafts[0].metadata
        assert metadata["remark_vocabulary"] == "unknown"
        assert metadata["interpretation"] == "none"
        assert metadata["qualification_label"] == "Correcte"  # recopié, jamais jugé

    def test_no_quality_score_or_class_is_produced(self) -> None:
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())
        drafts = wq.quality_drafts(parsed.analyses, quality_config())

        assert all(d.text_value is None for d in drafts)
        assert all("score" not in d.metric_code and "class" not in d.metric_code for d in drafts)


# ---------------------------------------------------------------------------
# Valeur censurée et limite de quantification
# ---------------------------------------------------------------------------


class TestCensoringAndQuantificationLimit:
    def test_no_censoring_is_deduced_without_an_operator_declaration(self) -> None:
        """Le vocabulaire de `code_remarque` n'a pas été vérifié : ce module
        n'invente aucune sémantique."""
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())

        assert parsed.censored_count == 0
        assert all(not a.is_censored for a in parsed.analyses)
        assert any("aucune censure n'est déduite" in w for w in parsed.warnings)

    def test_operator_declared_censoring_codes_are_honoured(self) -> None:
        config = quality_config(censoring_remark_codes=frozenset({"2"}))
        censored = [page(analysis_record(remark="2", value=0.5))]

        parsed = wq.parse_quality_pages(censored, config=config)

        assert parsed.censored_count == 1
        assert parsed.analyses[0].is_censored is True

    def test_censored_value_is_never_replaced(self) -> None:
        """Une valeur censurée reste transportée telle quelle — jamais
        remplacée par la limite de quantification, ni par 0, ni par la moitié
        du seuil."""
        config = quality_config(censoring_remark_codes=frozenset({"2"}))
        censored = [page(analysis_record(remark="2", value=0.5, limit=1.0))]

        parsed = wq.parse_quality_pages(censored, config=config)

        assert parsed.analyses[0].value == 0.5
        assert parsed.analyses[0].quantification_limit == 1.0

    def test_censoring_flag_travels_to_the_observation(self) -> None:
        config = quality_config(censoring_remark_codes=frozenset({"2"}))
        censored = [page(analysis_record(remark="2", value=0.5, limit=1.0))]
        parsed = wq.parse_quality_pages(censored, config=config)

        drafts = wq.quality_drafts(parsed.analyses, config)

        assert drafts[0].metadata["is_censored"] is True
        assert drafts[0].metadata["quantification_limit"] == 1.0

    def test_quantification_limit_is_optional(self) -> None:
        """Le nom exact du champ n'ayant pas été vérifié, son absence n'est
        jamais une erreur."""
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())

        assert parsed.analyses[0].quantification_limit is None
        assert parsed.records_total == 3


# ---------------------------------------------------------------------------
# Unités et agrégats
# ---------------------------------------------------------------------------


class TestUnitsAndGrouping:
    def test_grouping_never_mixes_parameters(self) -> None:
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())

        grouped = wq.group_by_parameter(parsed.analyses)

        assert {key[1] for key in grouped} == {"1340", "1339"}
        assert len(grouped[("FIX-QUAL-001", "1340", "mg(NO3)/L")]) == 2

    def test_grouping_never_mixes_units(self) -> None:
        mixed = [page(
            analysis_record(day="2026-01-10", value=12.5, unit="mg(NO3)/L"),
            analysis_record(day="2026-01-11", value=0.0125, unit="g(NO3)/L"),
        )]
        parsed = wq.parse_quality_pages(mixed, config=quality_config())

        grouped = wq.group_by_parameter(parsed.analyses)

        assert len(grouped) == 2  # même paramètre, unités différentes → jamais réunis

    def test_unit_travels_with_every_observation(self) -> None:
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())
        drafts = wq.quality_drafts(parsed.analyses, quality_config())

        assert {d.unit for d in drafts} == {"mg(NO3)/L", "mg(NO2)/L"}

    def test_volume_unit_is_cubic_metres(self) -> None:
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())
        drafts = wq.withdrawals_drafts(parsed.records, withdrawals_config())

        assert {d.unit for d in drafts} == {"m3"}


# ---------------------------------------------------------------------------
# Schéma, période, pagination
# ---------------------------------------------------------------------------


class TestSchemaAndPeriod:
    def test_missing_ouvrage_identifier_is_refused(self) -> None:
        broken = [page({"annee": 2023, "volume": 1.0})]

        with pytest.raises(wq.HubeauUsageSchemaError, match="code_ouvrage"):
            wq.parse_withdrawals_pages(broken, config=withdrawals_config())

    def test_missing_station_identifier_is_refused(self) -> None:
        broken = [page({k: v for k, v in analysis_record().items() if k != "code_station"})]

        with pytest.raises(wq.HubeauUsageSchemaError, match="code_station"):
            wq.parse_quality_pages(broken, config=quality_config())

    def test_year_outside_the_requested_window_is_refused(self) -> None:
        with pytest.raises(wq.HubeauUsageSchemaError, match="hors de la fenêtre"):
            wq.parse_withdrawals_pages(
                [page(withdrawal_record(year=2019))], config=withdrawals_config()
            )

    def test_missing_year_is_refused(self) -> None:
        with pytest.raises(wq.HubeauUsageSchemaError, match="année absente"):
            wq.parse_withdrawals_pages(
                [page(withdrawal_record(year=None))], config=withdrawals_config()
            )

    def test_missing_sampling_date_is_refused(self) -> None:
        with pytest.raises(wq.HubeauUsageSchemaError, match="date absente"):
            wq.parse_quality_pages(
                [page(analysis_record(day=None))], config=quality_config()
            )

    def test_negative_volume_is_refused(self) -> None:
        with pytest.raises(wq.HubeauUsageSchemaError, match="volume négatif"):
            wq.parse_withdrawals_pages(
                [page(withdrawal_record(volume=-5.0))], config=withdrawals_config()
            )

    def test_empty_collection_is_refused(self) -> None:
        with pytest.raises(wq.HubeauUsageReleaseError, match="collecte vide"):
            wq.parse_withdrawals_pages([page()], config=withdrawals_config())

    def test_multiple_pages_are_concatenated(self) -> None:
        pages = [
            page(withdrawal_record(ouvrage="FIX-OUVRAGE-001", year=2022)),
            page(withdrawal_record(ouvrage="FIX-OUVRAGE-002", year=2023)),
        ]

        parsed = wq.parse_withdrawals_pages(pages, config=withdrawals_config())

        assert parsed.records_total == 2
        assert parsed.ouvrage_ids == ("FIX-OUVRAGE-001", "FIX-OUVRAGE-002")

    @pytest.mark.parametrize("moving", ["latest", "current", "head"])
    def test_moving_release_keys_are_refused(self, moving: str) -> None:
        with pytest.raises(wq.HubeauUsageReleaseError, match="release nommée"):
            withdrawals_config(release_key=moving)
        with pytest.raises(wq.HubeauUsageReleaseError, match="release nommée"):
            quality_config(release_key=moving)


# ---------------------------------------------------------------------------
# PeriodResolver — annuel vs ponctuel
# ---------------------------------------------------------------------------


class TestPeriodResolvers:
    def test_withdrawals_period_covers_the_whole_civil_year(self) -> None:
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())
        draft = wq.withdrawals_drafts(parsed.records, withdrawals_config())[0]

        assert wq.build_withdrawals_period_resolver()(draft) == (
            date(2022, 1, 1), date(2022, 12, 31)
        )

    def test_quality_period_is_the_sampling_day(self) -> None:
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())
        draft = wq.quality_drafts(parsed.analyses, quality_config())[0]

        assert wq.build_quality_period_resolver()(draft) == (
            date(2026, 1, 10), date(2026, 1, 10)
        )

    def test_resolver_errors_match_the_derive_contract(self) -> None:
        assert issubclass(wq.HubeauUsagePeriodUnavailableError, PipelineDataUnavailableError)
        assert not issubclass(wq.HubeauUsagePeriodUnavailableError, AdapterError)

    def test_metric_codes_never_carry_a_period(self) -> None:
        assert wq.withdrawals_metric_code() == "hubeau.prelevements.volume"
        assert wq.quality_metric_code("1340") == "hubeau.qualite_rivieres.parametre.1340"
        assert "2023" not in wq.withdrawals_metric_code()

    def test_two_years_share_a_metric_code_but_keep_distinct_periods(self) -> None:
        config = withdrawals_config()
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=config)
        drafts = wq.withdrawals_drafts(parsed.records, config)
        assert len({d.metric_code for d in drafts}) == 1

        result = derive_observations(
            drafts,
            source=_withdrawals_source(config, ALLOWED),
            method=wq.WITHDRAWALS_METHOD,
            geography_resolver=wq.build_geography_resolver(parsed.ouvrage_ids),
            period_resolver=wq.build_withdrawals_period_resolver(),
        )

        assert not result.errors
        assert {(c["period_start"], c["period_end"]) for c in result.candidates} == {
            (date(2022, 1, 1), date(2022, 12, 31)),
            (date(2023, 1, 1), date(2023, 12, 31)),
        }

    def test_quality_metric_code_uses_the_sandre_code_not_the_label(self) -> None:
        assert "1340" in wq.quality_metric_code("1340")
        assert "nitrate" not in wq.quality_metric_code("1340").lower()


# ---------------------------------------------------------------------------
# Déterminisme
# ---------------------------------------------------------------------------


class TestDeterminism:
    def test_withdrawals_checksum_is_stable(self) -> None:
        first = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())
        second = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())

        assert first.input_checksum == second.input_checksum
        assert first.records == second.records

    def test_quality_checksum_is_stable(self) -> None:
        first = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())
        second = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())

        assert first.input_checksum == second.input_checksum

    def test_drafts_are_idempotent(self) -> None:
        parsed = wq.parse_quality_pages(QUALITY_PAGES, config=quality_config())

        assert wq.quality_drafts(parsed.analyses, quality_config()) == wq.quality_drafts(
            parsed.analyses, quality_config()
        )

    def test_coverage_is_independent_of_input_order(self) -> None:
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=withdrawals_config())

        assert wq.coverage_by_year(parsed.records) == wq.coverage_by_year(
            list(reversed(parsed.records))
        )


# ---------------------------------------------------------------------------
# Intégration pipeline et licence
# ---------------------------------------------------------------------------


def _withdrawals_source(config, decision) -> WaterSourceReference:
    return WaterSourceReference(
        source_code=wq.WITHDRAWALS_SOURCE_CODE,
        release_key=config.release_key,
        checksum_sha256="e" * 64,
        retrieved_at=config.retrieved_at,
        methodology_version=wq.WITHDRAWALS_METHOD.version,
        license=decision,
        attribution="Source : Hub'Eau BNPE (fixture de test)",
    )


def _quality_source(config, decision) -> WaterSourceReference:
    return WaterSourceReference(
        source_code=wq.QUALITY_SOURCE_CODE,
        release_key=config.release_key,
        checksum_sha256="f" * 64,
        retrieved_at=config.retrieved_at,
        observed_period_start=config.window_start,
        observed_period_end=config.window_end,
        methodology_version=wq.QUALITY_METHOD.version,
        license=decision,
        attribution="Source : Hub'Eau Naïades (fixture de test)",
    )


def run_quality_pipeline(*, license_decision, pages=None, config=None):
    config = config or quality_config()
    pages = pages if pages is not None else QUALITY_PAGES
    try:
        station_ids = wq.parse_quality_pages(pages, config=config).station_ids
    except wq.HubeauUsageError:
        station_ids = []

    content = json.dumps(pages[0]).encode("utf-8")
    transport = FakeTransport({None: ScriptedPage(content=content, has_next_page=False)})

    return run_pipeline(
        source_code=wq.QUALITY_SOURCE_CODE,
        release_key=config.release_key,
        transport=transport,
        normalizer=wq.build_quality_normalizer(config),
        source=_quality_source(config, license_decision or BLOCKED),
        method=wq.QUALITY_METHOD,
        geography_resolver=wq.build_geography_resolver(station_ids),
        period_resolver=wq.build_quality_period_resolver(),
        max_pages=1,
        decoder=wq.PAGE_DECODER,
        license_decision=license_decision,
        clock=lambda: datetime(2026, 2, 2, tzinfo=timezone.utc),
    )


class TestPipelineIntegration:
    def test_quality_full_dry_run(self) -> None:
        report = run_quality_pipeline(license_decision=ALLOWED)

        assert report.succeeded
        assert report.dry_run is True
        assert report.records_read == 3

    def test_withdrawals_full_dry_run(self) -> None:
        config = withdrawals_config()
        parsed = wq.parse_withdrawals_pages(WITHDRAWALS_PAGES, config=config)
        content = json.dumps(WITHDRAWALS_PAGES[0]).encode("utf-8")
        transport = FakeTransport({None: ScriptedPage(content=content, has_next_page=False)})

        report = run_pipeline(
            source_code=wq.WITHDRAWALS_SOURCE_CODE,
            release_key=config.release_key,
            transport=transport,
            normalizer=wq.build_withdrawals_normalizer(config),
            source=_withdrawals_source(config, ALLOWED),
            method=wq.WITHDRAWALS_METHOD,
            geography_resolver=wq.build_geography_resolver(parsed.ouvrage_ids),
            period_resolver=wq.build_withdrawals_period_resolver(),
            max_pages=1,
            decoder=wq.PAGE_DECODER,
            license_decision=ALLOWED,
            clock=lambda: datetime(2026, 2, 2, tzinfo=timezone.utc),
        )

        assert report.succeeded
        assert report.records_read == 2  # le volume non déclaré ne produit rien

    def test_parameter_outside_allowlist_fails_cleanly_at_normalize(self) -> None:
        report = run_quality_pipeline(
            license_decision=ALLOWED, pages=[page(analysis_record(parameter="9999"))]
        )

        assert not report.succeeded
        assert report.steps_failed == ["normalize"]
        assert any("hors allowlist" in e for e in report.errors)
        assert "derive" not in report.steps_executed

    def test_error_hierarchy_is_compatible_with_adapter_error(self) -> None:
        for error_type in (
            wq.HubeauUsageError, wq.HubeauUsageSchemaError,
            wq.HubeauUsageReleaseError, wq.HubeauParameterRefused,
        ):
            assert issubclass(error_type, AdapterError)

    def test_geography_error_matches_the_derive_contract(self) -> None:
        assert issubclass(
            wq.HubeauUsageGeographyUnavailableError, PipelineDataUnavailableError
        )

    def test_unknown_station_is_refused(self) -> None:
        resolver = wq.build_geography_resolver(["FIX-QUAL-001"])

        with pytest.raises(wq.HubeauUsageGeographyUnavailableError, match="inconnu"):
            resolver("FIX-QUAL-999")


class TestLicenceGate:
    def test_allowed_licence_publishes_values(self) -> None:
        report = run_quality_pipeline(license_decision=ALLOWED)

        assert report.records_publishable == 3

    def test_blocked_licence_withholds_every_value(self) -> None:
        report = run_quality_pipeline(license_decision=BLOCKED)

        assert report.succeeded
        assert report.records_publishable == 0

    def test_unknown_licence_withholds_every_value(self) -> None:
        report = run_quality_pipeline(license_decision=None)

        assert report.records_publishable == 0
        assert any("licence inconnue" in w for w in report.warnings)

    def test_connector_never_decides_the_licence(self) -> None:
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")

        assert "WaterLicenseDecision" not in source
        assert "allow_display" not in source


class TestDataStatus:
    def test_withdrawals_are_declarative_not_instrumental(self) -> None:
        """Un volume déclaré n'est pas une mesure : `manual` est honnête."""
        assert wq.WITHDRAWALS_DATA_STATUS == "manual"

    def test_analyses_are_observed(self) -> None:
        assert wq.QUALITY_DATA_STATUS == "observed"


# ---------------------------------------------------------------------------
# Absence de réseau / de base / groundwater quality hors périmètre
# ---------------------------------------------------------------------------


class TestScopeAndIsolation:
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

        assert not clock_calls

    def test_groundwater_quality_is_out_of_scope(self) -> None:
        """Le MACRO-PROMPT B conditionne la qualité souterraine à un gate
        concluant. Ses endpoints et champs n'ont pas été vérifiés : aucun code
        spéculatif ne doit exister pour elle."""
        tree = ast.parse(CONNECTOR_MODULE.read_text(encoding="utf-8"))
        names = {
            node.id for node in ast.walk(tree) if isinstance(node, ast.Name)
        } | {
            node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
        }

        assert not [n for n in names if "qualite_nappes" in n.lower()]
        assert not [n for n in names if "groundwater_quality" in n.lower()]
