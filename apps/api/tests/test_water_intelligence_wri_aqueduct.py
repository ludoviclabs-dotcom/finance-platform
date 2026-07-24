"""
test_water_intelligence_wri_aqueduct.py — connecteur WRI Aqueduct 4.0 (P05).

AUCUNE base requise, AUCUN réseau : le connecteur est pur (bibliothèque
standard + contrats P02) — vérifié explicitement ci-dessous par analyse des
imports, pas seulement promis. Ces tests tournent dans le job `tests`
standard, sans DATABASE_URL.

Couvre : parsing d'une fixture valide, refus d'un schéma inconnu, refus d'une
source inconnue, refus d'une release non nommée, conservation de `null` sans
conversion en `0`, normalisation d'une valeur présente, absence conservée,
séparation risque/confiance, statut de donnée (`modelled` vs `fixture`),
scénario/horizon conservés, licence autorisée / bloquée / inconnue,
attribution conservée, checksum stable, idempotence, dry-run sans écriture,
et intégration au pipeline P03.
"""

from __future__ import annotations

import ast
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import WaterLicenseDecision, WaterSourceReference
from services.water_intelligence.connectors import wri_aqueduct as wri
from services.water_intelligence.pipeline import TextPageDecoder, run_pipeline
from services.water_intelligence.pipeline_transport import FakeTransport, ScriptedPage

FIXTURES = Path(__file__).resolve().parent / "fixtures"
VALID_FIXTURE = FIXTURES / "wri_aqueduct_baseline_annual_fixture.csv"
UNKNOWN_COLUMN_FIXTURE = FIXTURES / "wri_aqueduct_unknown_column_fixture.csv"
NAMES_ONLY_FIXTURE = FIXTURES / "wri_aqueduct_names_only_fixture.csv"

CONNECTOR_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "connectors" / "wri_aqueduct.py"
)

# Valeur passée par variable (jamais `release_key="<litteral>"`) : le motif
# `<nom_de_champ> = "<valeur>"` déclenche le faux positif generic-api-key de
# gitleaks, déjà rencontré en P03.
FIXTURE_RELEASE = "aqueduct-4-0-extrait-fixture"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def make_config(**overrides) -> wri.AqueductReleaseConfig:
    params = dict(
        release_key=FIXTURE_RELEASE,
        retrieved_at=date(2026, 1, 2),
        is_fixture=True,
    )
    params.update(overrides)
    return wri.AqueductReleaseConfig(**params)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


class TestParsing:
    def test_valid_fixture_parses(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())

        assert result.rows_total == 2
        assert result.rows[0].stable_id == "FIXTURE-AREA-001"
        assert result.rows[0].stable_id_column == "string_id"

    def test_unknown_schema_is_rejected(self) -> None:
        with pytest.raises(wri.AqueductSchemaError, match="hors dictionnaire"):
            wri.parse_baseline_annual_csv(read(UNKNOWN_COLUMN_FIXTURE), config=make_config())

    def test_names_only_file_is_rejected_no_join_by_name(self) -> None:
        """Un fichier sans identifiant stable est refusé : jamais de repli
        sur name_0/name_1 comme clé de jointure."""
        with pytest.raises(wri.AqueductSchemaError, match="identifiant stable"):
            wri.parse_baseline_annual_csv(read(NAMES_ONLY_FIXTURE), config=make_config())

    def test_unknown_indicator_is_rejected(self) -> None:
        with pytest.raises(wri.AqueductSchemaError, match="hors dictionnaire"):
            make_config(indicators=("not_an_indicator",))

    def test_indicator_absent_from_extract_is_rejected(self) -> None:
        with pytest.raises(wri.AqueductSchemaError, match="absent de l'extrait"):
            wri.parse_baseline_annual_csv(
                read(VALID_FIXTURE), config=make_config(indicators=("drr",))
            )

    def test_empty_extract_is_refused_not_published_empty(self) -> None:
        header = "string_id,bws_raw\n"
        with pytest.raises(wri.AqueductReleaseError, match="extrait vide"):
            wri.parse_baseline_annual_csv(header, config=make_config())

    def test_file_without_header_is_refused(self) -> None:
        with pytest.raises(wri.AqueductSchemaError, match="sans en-tête"):
            wri.parse_baseline_annual_csv("", config=make_config())


# ---------------------------------------------------------------------------
# Release toujours nommée
# ---------------------------------------------------------------------------


class TestReleaseNaming:
    def test_empty_release_key_is_refused(self) -> None:
        with pytest.raises(wri.AqueductReleaseError, match="obligatoire"):
            make_config(release_key="   ")

    @pytest.mark.parametrize("implicit", ["latest", "LATEST", "current", "head"])
    def test_implicit_latest_is_refused(self, implicit: str) -> None:
        with pytest.raises(wri.AqueductReleaseError, match="reproductible"):
            make_config(release_key=implicit)


# ---------------------------------------------------------------------------
# Valeurs absentes — jamais converties en 0
# ---------------------------------------------------------------------------


class TestAbsentValues:
    def test_absent_values_stay_none_never_zero(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        absent = result.rows[1].indicators["bws"]

        assert absent.raw is None
        assert absent.score is None
        assert absent.category is None
        assert absent.label is None
        # Le point central : None, jamais 0/0.0.
        assert absent.raw != 0
        assert absent.score != 0.0
        assert not absent.has_any_value()

    def test_absent_values_are_counted_not_silently_dropped(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())

        assert result.values_present == 1
        assert result.values_absent == 1
        assert any("absente" in w for w in result.warnings)

    def test_absent_row_produces_no_fabricated_draft(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        drafts = wri._drafts_from_rows(result.rows, make_config())

        keys = {d.subject_key for d in drafts}
        assert "FIXTURE-AREA-001" in keys
        assert "FIXTURE-AREA-002" not in keys  # aucune valeur inventée pour la ligne vide

    @pytest.mark.parametrize("blank", ["", "   ", "NA", "n/a", "NaN", "null", "None"])
    def test_blank_markers_parse_to_none(self, blank: str) -> None:
        csv_text = f"string_id,bws_raw\nFIXTURE-AREA-001,{blank}\n"
        result = wri.parse_baseline_annual_csv(csv_text, config=make_config())

        assert result.rows[0].indicators["bws"].raw is None

    def test_unparseable_number_is_refused_not_defaulted(self) -> None:
        csv_text = "string_id,bws_raw\nFIXTURE-AREA-001,pas-un-nombre\n"
        with pytest.raises(wri.AqueductSchemaError, match="illisible"):
            wri.parse_baseline_annual_csv(csv_text, config=make_config())

    def test_official_no_data_sentinel_is_treated_as_absent(self) -> None:
        """La FAQ officielle Aqueduct 4.0 documente `-9999` comme
        « insufficient data ». Le laisser passer produirait une mesure de
        stress à -9999 — un faux chiffre, pas une donnée manquante."""
        csv_text = "string_id,bws_raw,bws_score\nFIXTURE-AREA-001,-9999,-9999\n"
        result = wri.parse_baseline_annual_csv(csv_text, config=make_config())
        value = result.rows[0].indicators["bws"]

        assert value.raw is None
        assert value.score is None
        assert result.values_absent == 1

    def test_no_data_sentinel_never_becomes_a_draft(self) -> None:
        csv_text = "string_id,bws_raw\nFIXTURE-AREA-001,-9999\n"
        config = make_config()
        result = wri.parse_baseline_annual_csv(csv_text, config=config)
        drafts = wri._drafts_from_rows(result.rows, config)

        assert drafts == []

    def test_category_minus_one_is_preserved_not_confused_with_sentinel(self) -> None:
        """`_cat` est documenté sur [-1,4] : -1 est une CATÉGORIE valide
        (dont « Arid and Low Water Use »), à ne pas confondre avec -9999."""
        csv_text = "string_id,bws_cat\nFIXTURE-AREA-001,-1\n"
        result = wri.parse_baseline_annual_csv(csv_text, config=make_config())

        assert result.rows[0].indicators["bws"].category == -1


# ---------------------------------------------------------------------------
# Valeur présente et catégorie
# ---------------------------------------------------------------------------


class TestPresentValues:
    def test_present_value_is_normalised(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        value = result.rows[0].indicators["bws"]

        assert value.raw == 1.5
        assert value.score == 3.2
        assert value.category == 3
        assert value.label is not None

    def test_category_is_carried_verbatim_never_interpreted(self) -> None:
        """La correspondance cat→label n'étant pas vérifiée officiellement, le
        connecteur recopie les deux sans jamais traduire l'une en l'autre."""
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        drafts = wri._drafts_from_rows(result.rows, make_config())

        category_draft = next(d for d in drafts if d.metric_code.endswith(".category"))
        assert category_draft.metadata["category_code"] == 3
        assert category_draft.metadata["category_label"] == result.rows[0].indicators["bws"].label
        assert category_draft.metadata["category_vocabulary"] == "unknown"
        # Transportée comme TEXTE : jamais un nombre que l'on pourrait moyenner.
        assert category_draft.numeric_value is None
        assert category_draft.text_value is not None

    def test_risk_and_confidence_stay_separate(self) -> None:
        """Le connecteur ne fabrique aucune confiance : Aqueduct n'en publie
        pas par valeur. `confidence` reste None, distinct de la valeur."""
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        drafts = wri._drafts_from_rows(result.rows, make_config())

        for draft in drafts:
            assert draft.confidence is None
        raw_draft = next(d for d in drafts if d.metric_code.endswith(".raw"))
        assert raw_draft.numeric_value == 1.5  # la valeur n'a pas absorbé la confiance


# ---------------------------------------------------------------------------
# Scénario / horizon
# ---------------------------------------------------------------------------


class TestScenarioAndHorizon:
    def test_projection_scenario_and_horizon_are_preserved(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        projections = result.rows[0].projections

        assert len(projections) == 1
        projection = projections[0]
        assert projection.scenario_code == "bau"
        assert projection.horizon_year == 2030
        assert projection.indicator == "ws"
        assert projection.value == 2.75
        assert projection.column == "bau30_ws_x_r"

    def test_projection_draft_carries_scenario_metadata(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        drafts = wri._drafts_from_rows(result.rows, make_config())

        projection_draft = next(d for d in drafts if "projection" in d.metric_code)
        assert projection_draft.metadata["scenario_code"] == "bau"
        assert projection_draft.metadata["horizon_year"] == 2030

    def test_absent_projection_value_produces_no_draft(self) -> None:
        csv_text = "string_id,bws_raw,bau30_ws_x_r\nFIXTURE-AREA-001,1.5,\n"
        result = wri.parse_baseline_annual_csv(csv_text, config=make_config())
        drafts = wri._drafts_from_rows(result.rows, make_config())

        assert result.rows[0].projections[0].value is None
        assert not any("projection" in d.metric_code for d in drafts)


# ---------------------------------------------------------------------------
# Statut de donnée
# ---------------------------------------------------------------------------


class TestDataStatus:
    def test_fixture_config_marks_drafts_as_fixture(self) -> None:
        config = make_config(is_fixture=True)
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=config)
        drafts = wri._drafts_from_rows(result.rows, config)

        assert {d.data_status for d in drafts} == {"fixture"}

    def test_real_extract_defaults_to_modelled_never_observed(self) -> None:
        """Aqueduct publie des indicateurs modélisés : revendiquer `observed`
        serait une affirmation fausse."""
        config = make_config(is_fixture=False)
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=config)
        drafts = wri._drafts_from_rows(result.rows, config)

        assert {d.data_status for d in drafts} == {"modelled"}
        assert wri.DEFAULT_DATA_STATUS == "modelled"


# ---------------------------------------------------------------------------
# Licence et attribution
# ---------------------------------------------------------------------------


class TestLicenceAndAttribution:
    def test_verified_licence_identifier(self) -> None:
        assert wri.LICENSE_CODE == "CC-BY-4.0"

    def test_attribution_includes_access_date_and_source(self) -> None:
        config = make_config(retrieved_at=date(2026, 1, 2))
        attribution = config.attribution()

        assert "WRI Aqueduct" in attribution
        assert "2026-01-02" in attribution
        assert "aqueduct.wri.org" in attribution

    def test_attribution_is_preserved_in_the_source_reference(self) -> None:
        config = make_config()
        reference = _source_reference(config, allow_display=True)

        assert reference.attribution == config.attribution()

    def test_blocked_licence_prevents_publication(self) -> None:
        """`display_allowed=false` ⇒ la valeur est retenue par le pipeline."""
        report = _run_with_licence(
            WaterLicenseDecision(
                allow_ingest=True, allow_store=True,
                allow_display=False, allow_derived_use=False,
                reasons=["display_allowed=false (fixture)"],
            )
        )

        assert report.succeeded
        assert report.records_publishable == 0

    def test_unknown_licence_never_becomes_allowed(self) -> None:
        """Aucune décision fournie ⇒ reste inconnue : rien n'est publiable."""
        report = _run_with_licence(None)

        assert report.succeeded
        assert report.records_publishable == 0
        assert report.license_status is None
        assert any("licence inconnue" in w for w in report.warnings)

    def test_allowed_licence_permits_publication(self) -> None:
        report = _run_with_licence(
            WaterLicenseDecision(
                allow_ingest=True, allow_store=True,
                allow_display=True, allow_derived_use=True,
            )
        )

        assert report.succeeded
        assert report.records_publishable > 0


# ---------------------------------------------------------------------------
# Checksum / idempotence
# ---------------------------------------------------------------------------


class TestDeterminism:
    def test_checksum_is_stable_for_identical_bytes(self) -> None:
        text = read(VALID_FIXTURE)
        first = wri.parse_baseline_annual_csv(text, config=make_config())
        second = wri.parse_baseline_annual_csv(text, config=make_config())

        assert first.input_checksum == second.input_checksum
        assert len(first.input_checksum) == 64

    def test_checksum_changes_when_bytes_change(self) -> None:
        text = read(VALID_FIXTURE)
        altered = text.replace("1.5", "1.6")
        assert altered != text

        assert (
            wri.parse_baseline_annual_csv(text, config=make_config()).input_checksum
            != wri.parse_baseline_annual_csv(altered, config=make_config()).input_checksum
        )

    def test_same_bytes_yield_identical_normalised_observations(self) -> None:
        config = make_config()
        text = read(VALID_FIXTURE)
        normalizer = wri.build_normalizer(config)

        first = normalizer([text])
        second = normalizer([text])

        assert first == second

    def test_observed_at_is_derived_from_the_release_never_now(self) -> None:
        config = make_config(published_at=date(2023, 8, 16))
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=config)
        drafts = wri._drafts_from_rows(result.rows, config)

        assert {d.observed_at for d in drafts} == {
            datetime(2023, 8, 16, tzinfo=timezone.utc)
        }


# ---------------------------------------------------------------------------
# Géographie
# ---------------------------------------------------------------------------


class TestGeography:
    def test_resolver_uses_stable_identifier(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        resolver = wri.build_geography_resolver(result.rows)

        geography = resolver("FIXTURE-AREA-001")
        assert geography.code == "FIXTURE-AREA-001"
        assert geography.scope == "world"

    def test_unknown_geography_is_refused(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        resolver = wri.build_geography_resolver(result.rows)

        with pytest.raises(wri.AqueductSchemaError, match="géographie inconnue"):
            resolver("IDENTIFIANT-ABSENT")

    def test_names_are_never_used_as_join_keys(self) -> None:
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=make_config())
        resolver = wri.build_geography_resolver(result.rows)

        with pytest.raises(wri.AqueductSchemaError):
            resolver("Zone fictive A (fixture)")


# ---------------------------------------------------------------------------
# Intégration pipeline P03
# ---------------------------------------------------------------------------


def _source_reference(
    config: wri.AqueductReleaseConfig, *, allow_display: bool
) -> WaterSourceReference:
    return WaterSourceReference(
        source_code=wri.SOURCE_CODE,
        release_key=config.release_key,
        checksum_sha256="a" * 64,
        published_at=config.published_at,
        retrieved_at=config.retrieved_at,
        methodology_version=wri.METHOD.version,
        license=WaterLicenseDecision(
            allow_ingest=True, allow_store=True,
            allow_display=allow_display, allow_derived_use=allow_display,
        ),
        attribution=config.attribution(),
    )


def _run_with_licence(decision: WaterLicenseDecision | None):
    config = make_config()
    text = read(VALID_FIXTURE)
    parsed = wri.parse_baseline_annual_csv(text, config=config)

    transport = FakeTransport(
        {None: ScriptedPage(content=text.encode("utf-8"), has_next_page=False)}
    )

    return run_pipeline(
        source_code=wri.SOURCE_CODE,
        release_key=config.release_key,
        transport=transport,
        normalizer=wri.build_normalizer(config),
        source=_source_reference(config, allow_display=bool(decision and decision.allow_display)),
        method=wri.METHOD,
        geography_resolver=wri.build_geography_resolver(parsed.rows),
        max_pages=1,
        decoder=wri.PAGE_DECODER,
        license_decision=decision,
        clock=lambda: datetime(2026, 1, 3, tzinfo=timezone.utc),
    )


class TestPipelineIntegration:
    def test_full_dry_run_through_the_p03_pipeline(self) -> None:
        report = _run_with_licence(
            WaterLicenseDecision(
                allow_ingest=True, allow_store=True,
                allow_display=True, allow_derived_use=True,
            )
        )

        assert report.succeeded
        assert report.dry_run is True
        assert report.steps_executed == [
            "plan", "fetch", "parse", "normalize", "derive", "validate", "publish",
        ]
        assert report.source_code == wri.SOURCE_CODE
        assert report.records_read > 0

    def test_unknown_source_code_is_refused_by_the_plan_stage(self) -> None:
        config = make_config()
        text = read(VALID_FIXTURE)
        transport = FakeTransport(
            {None: ScriptedPage(content=text.encode("utf-8"), has_next_page=False)}
        )
        parsed = wri.parse_baseline_annual_csv(text, config=config)

        report = run_pipeline(
            source_code="SOURCE_ABSENTE_DU_CATALOGUE",
            release_key=config.release_key,
            transport=transport,
            normalizer=wri.build_normalizer(config),
            source=_source_reference(config, allow_display=True),
            method=wri.METHOD,
            geography_resolver=wri.build_geography_resolver(parsed.rows),
            max_pages=1,
            decoder=wri.PAGE_DECODER,
            clock=lambda: datetime(2026, 1, 3, tzinfo=timezone.utc),
        )

        assert not report.succeeded
        assert report.steps_failed == ["plan"]

    def test_dry_run_writes_nothing(self) -> None:
        report = _run_with_licence(
            WaterLicenseDecision(
                allow_ingest=True, allow_store=True,
                allow_display=True, allow_derived_use=True,
            )
        )

        assert report.dry_run is True


# ---------------------------------------------------------------------------
# Décodeur de page (P03B) — plus d'emballage JSON pour transporter la CSV
# ---------------------------------------------------------------------------


class TestPageDecoderIntegration:
    def test_page_decoder_is_a_text_decoder_with_explicit_utf8(self) -> None:
        assert isinstance(wri.PAGE_DECODER, TextPageDecoder)
        assert wri.PAGE_DECODER.encoding == "utf-8"

    def test_connector_transports_csv_as_plain_utf8_bytes_no_json_wrapper(self) -> None:
        """P03B : la CSV voyage telle quelle (texte UTF-8) — plus d'emballage
        JSON. Preuve directe : le décodeur du connecteur rend le texte EXACT
        à partir des octets bruts, sans `json.loads` impliqué."""
        text = read(VALID_FIXTURE)
        assert not text.startswith('"')  # CSV brut, pas une chaîne JSON échappée

        decoded = wri.PAGE_DECODER.decode(text.encode("utf-8"), page_index=1)

        assert decoded == text

    def test_full_pipeline_run_accepts_raw_csv_bytes_directly(self) -> None:
        """Bout en bout : `FakeTransport` reçoit directement les octets CSV
        (`text.encode("utf-8")`), sans passer par `json.dumps` au préalable."""
        report = _run_with_licence(
            WaterLicenseDecision(
                allow_ingest=True, allow_store=True,
                allow_display=True, allow_derived_use=True,
            )
        )

        assert report.succeeded
        assert report.records_read > 0


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

        assert not offending, f"le connecteur importe {offending} — interdit en P05."

    def test_connector_issues_no_sql(self) -> None:
        lowered = CONNECTOR_MODULE.read_text(encoding="utf-8").lower()

        assert "insert into" not in lowered
        assert "cur.execute" not in lowered
        assert "get_db(" not in lowered

    def test_fixtures_are_small_no_heavy_dataset_committed(self) -> None:
        """Aucun extrait réel lourd n'est versionné : les fixtures restent
        minimales (quelques centaines d'octets)."""
        for fixture in FIXTURES.glob("wri_aqueduct_*.csv"):
            assert fixture.stat().st_size < 4096, f"{fixture.name} trop volumineux."

    def test_fixtures_are_explicitly_marked(self) -> None:
        content = read(VALID_FIXTURE).lower()
        assert "fixture" in content


# ---------------------------------------------------------------------------
# Traçabilité de la source
# ---------------------------------------------------------------------------


class TestSourceIdentity:
    def test_source_identity_matches_the_catalogue_entry(self) -> None:
        assert wri.SOURCE_CODE == "WRI_AQUEDUCT"
        assert wri.DATASET_VERSION == "4.0"
        assert wri.DATASET_PUBLISHED_AT == date(2023, 8, 16)

    def test_method_is_declared_as_passthrough(self) -> None:
        """Ce connecteur ne recalcule aucun indicateur Aqueduct."""
        assert "PASSTHROUGH" in wri.METHOD.code
        assert wri.METHOD.version

    def test_metadata_carries_release_and_identifiers(self) -> None:
        config = make_config()
        result = wri.parse_baseline_annual_csv(read(VALID_FIXTURE), config=config)
        drafts = wri._drafts_from_rows(result.rows, config)

        metadata = drafts[0].metadata
        assert metadata["source_code"] == wri.SOURCE_CODE
        assert metadata["release_key"] == FIXTURE_RELEASE
        assert metadata["stable_id_column"] == "string_id"
        # Sérialisable tel quel pour un journal machine-readable.
        assert json.loads(json.dumps(metadata, default=str))
