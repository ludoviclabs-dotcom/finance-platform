"""
test_water_intelligence_copernicus_edo.py — connecteur Copernicus EDO (P09).

AUCUNE base requise, AUCUN réseau : le connecteur est pur (bibliothèque
standard + contrats P02) — vérifié explicitement ci-dessous par analyse des
imports, pas seulement promis.

Couvre : décade obligatoire et explicite (aucun « latest »), paramètres de
snapshot, identité et vocabulaire de classes vérifiés, licence et attribution
officielles, corruption et absence d'artefact, format déclaré vs format
observé, budget, checksum et idempotence, distinction stricte entre sécheresse
courante et stress structurel, et surtout : le BLOCAGE de décodage raster est
rapporté proprement par le pipeline, jamais contourné par une valeur inventée.

Les artefacts de test sont des en-têtes de conteneur minimaux construits en
mémoire — aucun binaire n'est versionné, et aucune valeur de sécheresse n'est
simulée.
"""

from __future__ import annotations

import ast
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.water_intelligence import WaterLicenseDecision, WaterSourceReference
from services.intelligence.adapters.base import AdapterError
from services.water_intelligence.connectors import copernicus_edo as edo
from services.water_intelligence.connectors import eea_wei_plus as eea
from services.water_intelligence.pipeline import RawBytesPageDecoder, run_pipeline
from services.water_intelligence.pipeline_transport import FakeTransport, ScriptedPage

CONNECTOR_MODULE = (
    Path(__file__).resolve().parents[1]
    / "services" / "water_intelligence" / "connectors" / "copernicus_edo.py"
)

#: En-têtes de conteneur minimaux — identité de FORMAT uniquement, aucune
#: grille, aucune valeur de pixel, rien de téléchargé.
GEOTIFF_HEADER = b"II\x2a\x00" + b"\x08\x00\x00\x00" + b"\x00" * 24
NETCDF_HEADER = b"CDF\x01" + b"\x00" * 28
NETCDF4_HEADER = b"\x89HDF\r\n\x1a\n" + b"\x00" * 24

ALLOWED = WaterLicenseDecision(
    allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True
)


def make_config(**overrides) -> edo.EdoSnapshotConfig:
    params = dict(
        year=2026,
        month=7,
        dekad=2,
        payload_format="tif",
        retrieved_at=date(2026, 7, 24),
        is_fixture=True,
    )
    params.update(overrides)
    return edo.EdoSnapshotConfig(**params)


# ---------------------------------------------------------------------------
# Snapshot — décade explicite, aucune date flottante
# ---------------------------------------------------------------------------


class TestSnapshotIdentity:
    def test_snapshot_date_is_the_first_day_of_the_dekad(self) -> None:
        assert make_config(dekad=1).snapshot_date == date(2026, 7, 1)
        assert make_config(dekad=2).snapshot_date == date(2026, 7, 11)
        assert make_config(dekad=3).snapshot_date == date(2026, 7, 21)

    def test_release_key_carries_the_dekad(self) -> None:
        assert make_config().release_key == "copernicus-edo-cdi-v4.1-202607d2"

    def test_release_key_is_deterministic(self) -> None:
        assert make_config().release_key == make_config().release_key

    @pytest.mark.parametrize("bad_dekad", [0, 4, -1, 10])
    def test_invalid_dekad_is_refused(self, bad_dekad: int) -> None:
        with pytest.raises(edo.EdoSnapshotError, match="décade"):
            make_config(dekad=bad_dekad)

    @pytest.mark.parametrize("bad_month", [0, 13])
    def test_invalid_month_is_refused(self, bad_month: int) -> None:
        with pytest.raises(edo.EdoSnapshotError, match="mois"):
            make_config(month=bad_month)

    def test_year_before_the_published_archive_is_refused(self) -> None:
        with pytest.raises(edo.EdoSnapshotError, match="hors archive"):
            make_config(year=edo.COVERAGE_FIRST_YEAR - 1)

    def test_unknown_payload_format_is_refused(self) -> None:
        """Le portail officiel ne propose que GeoTIFF et NetCDF."""
        with pytest.raises(edo.EdoSnapshotError, match="format"):
            make_config(payload_format="csv")

    def test_no_moving_target_keyword_exists_in_the_contract(self) -> None:
        """Une décade se désigne par (année, mois, décade) : il n'existe
        aucun chemin permettant de demander « la dernière carte »."""
        fields = set(edo.EdoSnapshotConfig.__dataclass_fields__)

        assert "latest" not in fields
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")
        assert "def latest" not in source
        assert "def current" not in source


# ---------------------------------------------------------------------------
# Identité du produit et vocabulaire de classes
# ---------------------------------------------------------------------------


class TestProductIdentity:
    def test_verified_product_facts(self) -> None:
        assert edo.PRODUCT_VERSION == "v4.1"
        assert edo.CRS == "EPSG:4326"
        assert edo.COVERAGE_FIRST_YEAR == 2012
        assert edo.BOUNDING_BOX == {
            "xmin": -25.0, "xmax": 51.0, "ymin": 22.0, "ymax": 72.0
        }
        assert edo.RESOLUTION_DEGREES == pytest.approx(1 / 24)

    def test_seven_official_classes_are_carried_verbatim(self) -> None:
        assert sorted(edo.CDI_CLASSES) == [0, 1, 2, 3, 4, 5, 6]
        assert edo.CDI_CLASSES[0] == "No drought"
        assert edo.CDI_CLASSES[1] == "Watch"
        assert edo.CDI_CLASSES[2] == "Warning"
        assert edo.CDI_CLASSES[3] == "Alert"

    def test_unknown_class_code_is_refused_never_rounded(self) -> None:
        with pytest.raises(edo.EdoPayloadError, match="hors table officielle"):
            edo.cdi_class_label(7)

    def test_official_warning_is_carried_to_the_reader(self) -> None:
        """Une limite connue de la source ne disparaît jamais en chemin."""
        warnings = make_config().warnings()

        assert warnings
        assert any("mi-mai 2025" in w for w in warnings)
        assert any("Pologne" in w for w in warnings)


# ---------------------------------------------------------------------------
# Licence et attribution
# ---------------------------------------------------------------------------


class TestLicenceAndAttribution:
    def test_attribution_follows_the_official_wording(self) -> None:
        config = make_config()

        assert config.attribution() == (
            "Generated using Copernicus Emergency Management Service information 2026"
        )
        assert config.attribution(modified=True) == (
            "Contains modified Copernicus Emergency Management Service information 2026"
        )

    def test_licence_is_not_presented_as_creative_commons(self) -> None:
        """L'accès CEMS est « free, full and open » au titre du règlement
        (UE) 2021/696 — le présenter comme du CC BY serait faux."""
        assert edo.LICENSE_CODE == "COPERNICUS-EMS-FREE-FULL-OPEN"
        assert edo.LICENSE_REFERENCE == "Regulation (EU) 2021/696"
        assert "CC-BY" not in edo.LICENSE_CODE

    def test_connector_never_decides_the_licence_itself(self) -> None:
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")

        assert "WaterLicenseDecision" not in source
        assert "allow_display" not in source


# ---------------------------------------------------------------------------
# Artefact — corruption, absence, budget, format
# ---------------------------------------------------------------------------


class TestArtifactInspection:
    def test_geotiff_header_is_identified(self) -> None:
        assert edo.identify_payload_format(GEOTIFF_HEADER) == "tif"

    @pytest.mark.parametrize("payload", [NETCDF_HEADER, NETCDF4_HEADER])
    def test_netcdf_headers_are_identified(self, payload: bytes) -> None:
        assert edo.identify_payload_format(payload) == "nc"

    def test_empty_artifact_is_refused(self) -> None:
        with pytest.raises(edo.EdoPayloadError, match="vide"):
            edo.identify_payload_format(b"")

    def test_corrupted_artifact_is_refused(self) -> None:
        with pytest.raises(edo.EdoPayloadError, match="non reconnu"):
            edo.identify_payload_format(b"pas-un-raster-du-tout")

    def test_declared_format_must_match_the_observed_one(self) -> None:
        with pytest.raises(edo.EdoPayloadError, match="format déclaré"):
            edo.inspect_artifact(NETCDF_HEADER, config=make_config(payload_format="tif"))

    def test_oversized_artifact_is_refused(self) -> None:
        oversized = GEOTIFF_HEADER + b"\x00" * edo.MAX_PAYLOAD_BYTES

        with pytest.raises(edo.EdoPayloadError, match="budget"):
            edo.inspect_artifact(oversized, config=make_config())

    def test_artifact_checksum_is_stable(self) -> None:
        first = edo.inspect_artifact(GEOTIFF_HEADER, config=make_config())
        second = edo.inspect_artifact(GEOTIFF_HEADER, config=make_config())

        assert first == second
        assert first.checksum_sha256 == second.checksum_sha256
        assert len(first.checksum_sha256) == 64

    def test_different_bytes_give_a_different_checksum(self) -> None:
        first = edo.inspect_artifact(GEOTIFF_HEADER, config=make_config())
        second = edo.inspect_artifact(
            GEOTIFF_HEADER + b"\x01", config=make_config()
        )

        assert first.checksum_sha256 != second.checksum_sha256

    def test_artifact_carries_the_snapshot_date_not_the_run_date(self) -> None:
        artifact = edo.inspect_artifact(GEOTIFF_HEADER, config=make_config())

        assert artifact.snapshot_date == date(2026, 7, 11)
        assert artifact.release_key == "copernicus-edo-cdi-v4.1-202607d2"

    def test_artifact_holds_no_pixel_value(self) -> None:
        """L'artefact décrit un conteneur, jamais un contenu de grille."""
        fields = set(edo.EdoArtifact.__dataclass_fields__)

        assert fields == {
            "release_key", "snapshot_date", "payload_format",
            "payload_bytes", "checksum_sha256",
        }


# ---------------------------------------------------------------------------
# Blocage assumé — rapporté, jamais contourné
# ---------------------------------------------------------------------------


def _source_reference(config: edo.EdoSnapshotConfig) -> WaterSourceReference:
    return WaterSourceReference(
        source_code=edo.SOURCE_CODE,
        release_key=config.release_key,
        checksum_sha256="c" * 64,
        retrieved_at=config.retrieved_at,
        observed_period_start=config.snapshot_date,
        observed_period_end=config.snapshot_date,
        methodology_version=edo.METHOD.version,
        license=ALLOWED,
        attribution=config.attribution(),
        warnings=config.warnings(),
    )


def run_edo_pipeline(*, payload: bytes = GEOTIFF_HEADER, config=None):
    config = config or make_config()
    transport = FakeTransport({None: ScriptedPage(content=payload, has_next_page=False)})
    return run_pipeline(
        source_code=edo.SOURCE_CODE,
        release_key=config.release_key,
        transport=transport,
        normalizer=edo.build_normalizer(config),
        source=_source_reference(config),
        method=edo.METHOD,
        geography_resolver=_unreachable_resolver,
        max_pages=1,
        decoder=edo.PAGE_DECODER,
        license_decision=ALLOWED,
        clock=lambda: datetime(2026, 7, 24, tzinfo=timezone.utc),
    )


def _unreachable_resolver(code):
    raise AssertionError("derive ne doit jamais être atteint : normalize bloque avant")


class TestDocumentedBlockage:
    def test_raster_decoding_is_refused_explicitly(self) -> None:
        normalizer = edo.build_normalizer(make_config())

        with pytest.raises(edo.EdoRasterDecodingUnavailableError, match="dépendance lourde"):
            normalizer([GEOTIFF_HEADER])

    def test_pipeline_reports_the_blockage_instead_of_a_silent_empty_batch(self) -> None:
        report = run_edo_pipeline()

        assert report.succeeded is False
        assert report.steps_failed == ["normalize"]
        assert report.records_read == 0
        assert report.records_publishable == 0
        assert any("grille raster n'est pas décodée" in e for e in report.errors)
        assert "derive" not in report.steps_executed
        assert "publish" not in report.steps_executed

    def test_blockage_message_names_the_reason_and_the_missing_authorisation(self) -> None:
        report = run_edo_pipeline()

        message = " ".join(report.errors)
        assert "GDAL" in message or "rasterio" in message
        assert "ADR" in message

    def test_corrupted_payload_fails_before_the_blockage(self) -> None:
        """Une corruption reste une corruption : elle n'est pas absorbée par
        le blocage de décodage."""
        report = run_edo_pipeline(payload=b"contenu-illisible")

        assert report.steps_failed == ["normalize"]
        assert any("non reconnu" in e for e in report.errors)

    def test_no_observation_is_ever_produced(self) -> None:
        """Aucune valeur de sécheresse n'est inventée ni approchée."""
        source = CONNECTOR_MODULE.read_text(encoding="utf-8")

        assert "ObservationDraft(" not in source

    def test_text_page_would_be_refused(self) -> None:
        """Le décodeur est explicitement `RawBytesPageDecoder` : recevoir du
        texte déjà décodé signale un branchement incorrect."""
        normalizer = edo.build_normalizer(make_config())

        with pytest.raises(edo.EdoPayloadError, match="octets bruts"):
            normalizer(["du texte"])

    def test_absent_page_is_refused(self) -> None:
        normalizer = edo.build_normalizer(make_config())

        with pytest.raises(edo.EdoPayloadError, match="aucune page"):
            normalizer([])

    def test_error_hierarchy_is_compatible_with_adapter_error(self) -> None:
        assert issubclass(edo.EdoError, AdapterError)
        assert issubclass(edo.EdoSnapshotError, AdapterError)
        assert issubclass(edo.EdoPayloadError, AdapterError)
        assert issubclass(edo.EdoRasterDecodingUnavailableError, AdapterError)

    def test_declared_decoder_is_the_raw_bytes_one(self) -> None:
        assert isinstance(edo.PAGE_DECODER, RawBytesPageDecoder)


# ---------------------------------------------------------------------------
# Décision MVP formalisée (Wave A, commit de clôture) — source vérifiée,
# décodeur reporté. Ni un échec de source, ni une source vivante.
# ---------------------------------------------------------------------------


class TestFormalizedMvpDecision:
    def test_connector_status_is_formally_source_verified_decoder_deferred(self) -> None:
        assert edo.CONNECTOR_STATUS == "source_verified_decoder_deferred"

    def test_mvp_decision_guarantees_hold(self) -> None:
        """Les cinq garanties de la décision MVP, vérifiées ensemble : aucune
        dépendance géospatiale lourde, aucun endpoint WMS/WCS deviné, aucune
        couche simulée, aucune valeur Copernicus publiée.

        Vérifié sur l'AST (imports) pour les dépendances — pas par recherche
        de sous-chaîne, qui matcherait aussi la docstring expliquant
        pourquoi ces dépendances sont interdites (cf. §3.2 du module)."""
        tree = ast.parse(CONNECTOR_MODULE.read_text(encoding="utf-8"))
        imported = {
            alias.name
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        } | {
            node.module
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module
        }
        forbidden = {"gdal", "osgeo", "rasterio", "fiona", "netCDF4", "netcdf4", "h5py", "xarray"}
        assert not (imported & forbidden)

        # Aucun endpoint WMS/WCS deviné : aucun littéral d'URL dans le code
        # (au sens AST — une chaîne "http://…" en dur serait une valeur
        # littérale, distincte du texte de docstring).
        url_literals = [
            node.value
            for node in ast.walk(tree)
            if isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and (node.value.startswith("http://") or node.value.startswith("https://"))
        ]
        assert not url_literals

        # Aucune couche simulée, aucune valeur publiée.
        assert not [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "ObservationDraft"
        ]

        report = run_edo_pipeline()
        assert report.records_publishable == 0

    def test_mvp_decision_is_not_presented_as_a_source_failure(self) -> None:
        """Le statut formel distingue explicitement « vérifié, décodage
        reporté » d'un échec de source — les deux notions ne sont jamais
        confondues dans le nom du statut lui-même."""
        assert "fail" not in edo.CONNECTOR_STATUS
        assert "error" not in edo.CONNECTOR_STATUS
        assert "verified" in edo.CONNECTOR_STATUS
        assert "deferred" in edo.CONNECTOR_STATUS


# ---------------------------------------------------------------------------
# Sécheresse courante ≠ stress structurel
# ---------------------------------------------------------------------------


class TestDroughtIsNotStructuralStress:
    def test_metric_namespaces_are_disjoint(self) -> None:
        assert edo.METRIC_NAMESPACE.startswith("copernicus_edo.")
        assert not edo.metric_code("class").startswith("eea_wei_plus.")
        assert not eea.metric_code("subunit", "value_pct").startswith(
            edo.METRIC_NAMESPACE
        )

    def test_source_codes_are_distinct(self) -> None:
        assert edo.SOURCE_CODE != eea.SOURCE_CODE

    def test_edo_connector_never_references_the_structural_stress_indicator(self) -> None:
        """Aucune fusion possible : aucun chemin de CODE du connecteur
        sécheresse ne touche au WEI+ ni à ses seuils.

        Vérifié sur l'AST (imports et identifiants) : la docstring, elle,
        mentionne délibérément le WEI+ pour EXPLIQUER la distinction — c'est
        de la documentation, pas un couplage."""
        tree = ast.parse(CONNECTOR_MODULE.read_text(encoding="utf-8"))

        imported = {
            alias.name
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        } | {
            node.module
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module
        }
        assert not [m for m in imported if "wei" in m.lower()]

        identifiers = {
            node.id for node in ast.walk(tree) if isinstance(node, ast.Name)
        } | {
            node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
        }
        assert not [i for i in identifiers if "wei" in i.lower()]
        assert not [i for i in identifiers if "STRESS_THRESHOLD" in i]

    def test_the_two_connectors_use_different_methods(self) -> None:
        assert edo.METHOD.code != eea.METHOD.code


# ---------------------------------------------------------------------------
# Absence de réseau / de base / de dépendance lourde
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

        assert not offending, f"le connecteur importe {offending} — interdit en P09."

    def test_connector_adds_no_heavy_geospatial_dependency(self) -> None:
        """Le blocage EXISTE précisément parce que ces dépendances ne sont pas
        autorisées : ce test garantit qu'elles n'entrent pas par la porte de
        derrière."""
        forbidden = {
            "gdal", "osgeo", "rasterio", "fiona", "geopandas", "shapely",
            "pyproj", "netCDF4", "netcdf4", "h5py", "xarray",
        }
        offending = self._imported_roots(CONNECTOR_MODULE) & forbidden

        assert not offending, f"dépendance lourde {offending} sans ADR — interdite."

    def test_connector_issues_no_sql(self) -> None:
        lowered = CONNECTOR_MODULE.read_text(encoding="utf-8").lower()

        assert "insert into" not in lowered
        assert "delete from" not in lowered

    def test_connector_uses_no_implicit_clock(self) -> None:
        tree = ast.parse(CONNECTOR_MODULE.read_text(encoding="utf-8"))

        clock_calls = [
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in {"now", "utcnow", "today"}
        ]

        assert not clock_calls, f"horloge implicite appelée : {clock_calls}"

    def test_no_raster_binary_is_versioned(self) -> None:
        fixtures = Path(__file__).resolve().parent / "fixtures"
        heavy = [
            path
            for path in fixtures.glob("*")
            if path.suffix.lower() in {".tif", ".tiff", ".nc", ".hdf", ".h5"}
        ]

        assert not heavy, f"binaire raster versionné : {heavy}"
