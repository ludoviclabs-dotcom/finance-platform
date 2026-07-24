"""
test_water_intelligence_pipeline.py — pipeline opérateur PUR Water
Intelligence (P03).

AUCUNE base requise, AUCUN réseau réel : ni `services/water_intelligence/pipeline.py`
ni `pipeline_transport.py` n'importent `db.database`/psycopg ni
`requests`/`httpx`/`urllib`/`socket` — vérifié explicitement ci-dessous
(`TestNoRealNetworkOrDatabase`), pas seulement promis. Ces tests tournent
dans le job `tests` standard, sans DATABASE_URL, comme
`test_water_intelligence_contracts.py` et `test_water_intelligence_source_catalog.py`.

Couvre : exécution complète en dry-run, idempotence des checksums, échec de
parsing (JSON invalide) distinct d'une corruption détectée par le transport,
échec de validation (contrat P02), licence bloquée vs licence inconnue
(deux scénarios distincts), source inconnue refusée, pagination bornée,
dépassement de limite de pages, reprise contrôlée (sans re-fetch des pages
déjà obtenues), absence de réseau réel, absence d'écriture en base, et
conservation de `null` sans conversion en `0` à travers tout le pipeline.
"""

from __future__ import annotations

import ast
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from models.analytics import MethodRef
from models.water_intelligence import (
    WaterGeographyRef,
    WaterLicenseDecision,
    WaterSourceReference,
)
from services.intelligence.adapters.base import ObservationDraft
from services.water_intelligence.pipeline import (
    PipelineDataUnavailableError,
    PipelineUnknownSourceError,
    make_plan,
    publish_dry_run,
    run_pipeline,
)
from services.water_intelligence.pipeline_transport import (
    FakeTransport,
    ScriptedPage,
    TransportCorrupted,
    TransportHttpError,
    TransportTimeout,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_PACKAGE_DIR = REPO_ROOT / "apps" / "api" / "services" / "water_intelligence"

# Un source_code réel du catalogue P01b (WATER_SOURCE_REGISTRY_SEED_V1, origin=user_csv).
KNOWN_SOURCE_CODE = "EAUFRANCE_PORTAL"


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _page_bytes(rows: list[dict]) -> bytes:
    return json.dumps({"rows": rows}).encode("utf-8")


def _normalizer(parsed: list[dict]) -> list[ObservationDraft]:
    """parsed = liste des pages décodées (une entrée par page assemblée)."""
    drafts: list[ObservationDraft] = []
    for page in parsed:
        for row in page["rows"]:
            drafts.append(
                ObservationDraft(
                    subject_type="fixture_station",
                    subject_key=row["station"],
                    metric_code="fixture.metric",
                    numeric_value=row.get("value"),
                    geography_code=row.get("geography_code", "FR"),
                    observed_at=datetime.fromisoformat(row["date"]) if row.get("date") else None,
                    data_status="observed",
                    methodology_version="1.0.0",
                )
            )
    return drafts


def _source(**overrides) -> WaterSourceReference:
    base = dict(
        source_code=KNOWN_SOURCE_CODE,
        release_key="fixture-2026-01",
        checksum_sha256="a" * 64,
        retrieved_at=date(2026, 1, 2),
        methodology_version="1.0.0",
        license=WaterLicenseDecision(
            allow_ingest=True, allow_store=True, allow_display=True, allow_derived_use=True,
        ),
    )
    base.update(overrides)
    return WaterSourceReference(**base)


def _method() -> MethodRef:
    return MethodRef(code="FIXTURE-METHOD", version="1.0.0")


def _geography_resolver(code: str | None) -> WaterGeographyRef:
    if code == "FR":
        return WaterGeographyRef(scope="france", code="FR", label="France (fixture)")
    raise PipelineDataUnavailableError(f"géographie inconnue : {code!r}")


def _fixed_clock(moment: datetime = datetime(2026, 1, 3, tzinfo=timezone.utc)):
    return lambda: moment


def _run(**overrides):
    defaults = dict(
        source_code=KNOWN_SOURCE_CODE,
        release_key="fixture-2026-01",
        normalizer=_normalizer,
        source=_source(),
        method=_method(),
        geography_resolver=_geography_resolver,
        max_pages=1,
        clock=_fixed_clock(),
    )
    defaults.update(overrides)
    return run_pipeline(**defaults)


ONE_ROW = [{"station": "X1", "value": 12.5, "date": "2025-06-01"}]


# ---------------------------------------------------------------------------
# Exécution complète en dry-run
# ---------------------------------------------------------------------------


class TestFullDryRunExecution:
    def test_fixture_end_to_end_dry_run_succeeds(self) -> None:
        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        report = _run(transport=transport, license_decision=_source().license)

        assert report.succeeded
        assert report.dry_run is True
        assert report.steps_executed == [
            "plan", "fetch", "parse", "normalize", "derive", "validate", "publish",
        ]
        assert report.steps_failed == []
        assert report.records_read == 1
        assert report.records_normalized == 1
        assert report.records_publishable == 1
        assert report.input_checksum is not None and len(report.input_checksum) == 64
        assert report.output_checksum is not None and len(report.output_checksum) == 64
        assert report.source_code == KNOWN_SOURCE_CODE

    def test_dry_run_false_is_refused_explicitly(self) -> None:
        """P03 ne fournit aucun graveur réel : dry_run=False s'arrête,
        n'écrit jamais rien en silence."""
        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        report = _run(transport=transport, license_decision=_source().license, dry_run=False)

        assert not report.succeeded
        assert report.steps_failed == ["publish"]
        assert any("dry_run=False" in e for e in report.errors)


# ---------------------------------------------------------------------------
# Idempotence
# ---------------------------------------------------------------------------


class TestIdempotence:
    def test_same_input_yields_same_checksums(self) -> None:
        page = _page_bytes(ONE_ROW)
        t1 = FakeTransport({None: ScriptedPage(content=page, has_next_page=False)})
        t2 = FakeTransport({None: ScriptedPage(content=page, has_next_page=False)})

        r1 = _run(transport=t1, license_decision=_source().license, clock=_fixed_clock())
        r2 = _run(
            transport=t2,
            license_decision=_source().license,
            clock=_fixed_clock(datetime(2099, 1, 1, tzinfo=timezone.utc)),
        )

        assert r1.input_checksum == r2.input_checksum
        assert r1.output_checksum == r2.output_checksum
        # Seule exception horloge autorisée (règle 9) : le rapport diffère, jamais le calcul.
        assert r1.executed_at != r2.executed_at


# ---------------------------------------------------------------------------
# Échec de parsing (distinct d'une corruption détectée par le transport)
# ---------------------------------------------------------------------------


class TestParsingFailure:
    def test_invalid_json_page_fails_at_parse_stage(self) -> None:
        transport = FakeTransport(
            {None: ScriptedPage(content=b"{not valid json", has_next_page=False)}
        )

        report = _run(transport=transport, license_decision=_source().license)

        assert not report.succeeded
        assert report.steps_failed == ["parse"]
        assert any("JSON invalide" in e for e in report.errors)
        assert report.input_checksum is not None  # fetch, lui, a réussi (octets bruts assemblés)

    def test_transport_corruption_fails_at_fetch_stage_not_parse(self) -> None:
        """Une corruption signalée par le TRANSPORT (ex. échec de checksum
        HTTP) est un échec de fetch, pas de parse — deux causes distinctes."""
        transport = FakeTransport(
            {None: ScriptedPage(raise_error=TransportCorrupted("checksum HTTP invalide (simulé)"))}
        )

        report = _run(transport=transport, license_decision=_source().license)

        assert not report.succeeded
        assert report.steps_failed == ["fetch"]
        assert report.input_checksum is None


# ---------------------------------------------------------------------------
# Échec de validation (contrat P02)
# ---------------------------------------------------------------------------


class TestValidationFailure:
    def test_missing_geography_is_rejected_at_derive_not_invented(self) -> None:
        rows = [{"station": "X1", "value": 12.5, "date": "2025-06-01", "geography_code": "UNKNOWN_CODE"}]
        transport = FakeTransport({None: ScriptedPage(content=_page_bytes(rows), has_next_page=False)})

        report = _run(transport=transport, license_decision=_source().license)

        assert not report.succeeded
        assert "derive" in report.steps_failed
        assert any("géographie" in e for e in report.errors)
        assert report.records_publishable == 0

    def test_missing_observed_date_is_rejected_not_defaulted(self) -> None:
        rows = [{"station": "X1", "value": 12.5, "date": None}]
        transport = FakeTransport({None: ScriptedPage(content=_page_bytes(rows), has_next_page=False)})

        report = _run(transport=transport, license_decision=_source().license)

        assert not report.succeeded
        assert "derive" in report.steps_failed
        assert any("observed_at absent" in e for e in report.errors)


# ---------------------------------------------------------------------------
# Licence bloquée vs licence inconnue — deux scénarios distincts
# ---------------------------------------------------------------------------


class TestLicenseGating:
    def test_explicit_blocked_license_withholds_value_but_pipeline_succeeds(self) -> None:
        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )
        blocked = WaterLicenseDecision(
            allow_ingest=True, allow_store=True, allow_display=False, allow_derived_use=False,
            reasons=["display_allowed=false (fixture)"],
        )

        report = _run(transport=transport, license_decision=blocked)

        assert report.succeeded  # le pipeline réussit — la valeur est retenue, pas l'exécution qui échoue
        assert report.records_publishable == 0
        assert report.license_status is not None
        assert report.license_status.allow_display is False
        assert report.license_status.reasons == ["display_allowed=false (fixture)"]

    def test_unknown_license_withholds_everything_without_assuming(self) -> None:
        """Aucune `license_decision` fournie : reste `unknown`, jamais
        supposée permissive — distinct du cas « licence explicitement
        bloquée » ci-dessus (raisons vides vs raisons documentées)."""
        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        report = _run(transport=transport, license_decision=None)

        assert report.succeeded
        assert report.records_publishable == 0
        assert report.license_status is None
        assert any("licence inconnue" in w for w in report.warnings)


# ---------------------------------------------------------------------------
# Source inconnue
# ---------------------------------------------------------------------------


class TestUnknownSource:
    def test_unknown_source_code_is_rejected_at_plan(self) -> None:
        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        report = _run(transport=transport, source_code="NOT_IN_CATALOG_XYZ")

        assert not report.succeeded
        assert report.steps_failed == ["plan"]
        assert report.steps_executed == []
        assert any("absent du catalogue" in e for e in report.errors)

    def test_make_plan_raises_directly_for_unknown_source(self) -> None:
        with pytest.raises(PipelineUnknownSourceError, match="absent du catalogue"):
            make_plan(source_code="NOT_IN_CATALOG_XYZ", max_pages=1, max_raw_bytes=1_000)

    def test_make_plan_succeeds_for_a_real_catalog_entry(self) -> None:
        plan = make_plan(source_code=KNOWN_SOURCE_CODE, max_pages=1, max_raw_bytes=1_000)

        assert plan.source_code == KNOWN_SOURCE_CODE
        assert plan.license_known is False  # tout le catalogue P01b est aujourd'hui `unknown`


# ---------------------------------------------------------------------------
# Pagination bornée / dépassement de limite / reprise contrôlée
# ---------------------------------------------------------------------------


class TestPagination:
    def test_bounded_pagination_within_max_pages_succeeds(self) -> None:
        page1 = ScriptedPage(
            content=_page_bytes([{"station": "X1", "value": 1, "date": "2025-01-01"}]),
            page_number=1, has_next_page=True, next_page_token="p2",
        )
        page2 = ScriptedPage(
            content=_page_bytes([{"station": "X2", "value": 2, "date": "2025-01-02"}]),
            page_number=2, has_next_page=False,
        )
        transport = FakeTransport({None: page1, "p2": page2})

        report = _run(transport=transport, license_decision=_source().license, max_pages=2)

        assert report.succeeded
        assert report.records_read == 2
        assert transport.call_count == 2

    def test_exceeding_max_pages_fails_explicitly_at_fetch(self) -> None:
        page1 = ScriptedPage(
            content=_page_bytes([{"station": "X1", "value": 1, "date": "2025-01-01"}]),
            page_number=1, has_next_page=True, next_page_token="p2",
        )
        page2 = ScriptedPage(
            content=_page_bytes([{"station": "X2", "value": 2, "date": "2025-01-02"}]),
            page_number=2, has_next_page=True, next_page_token="p3",
        )
        transport = FakeTransport({None: page1, "p2": page2})

        report = _run(transport=transport, license_decision=_source().license, max_pages=1)

        assert not report.succeeded
        assert report.steps_failed == ["fetch"]
        assert any("limite de pages" in e for e in report.errors)

    def test_controlled_resume_does_not_refetch_earlier_pages(self) -> None:
        """Reprise contrôlée : reprendre depuis le jeton de la page 2 ne
        rappelle jamais la page 1 (vérifié par `calls_for_token`)."""
        page1 = ScriptedPage(
            content=_page_bytes([{"station": "X1", "value": 1, "date": "2025-01-01"}]),
            page_number=1, has_next_page=True, next_page_token="p2",
        )
        page2 = ScriptedPage(
            content=_page_bytes([{"station": "X2", "value": 2, "date": "2025-01-02"}]),
            page_number=2, has_next_page=False,
        )
        transport = FakeTransport({None: page1, "p2": page2})

        # Premier passage borné à 1 page : la page 1 réussit, la limite coupe
        # avant même de tenter la page 2 (jamais atteinte).
        first = _run(transport=transport, license_decision=_source().license, max_pages=1)
        assert not first.succeeded
        assert first.steps_failed == ["fetch"]
        assert transport.calls_for_token(None) == 1
        assert transport.calls_for_token("p2") == 0

        # Reprise à partir du jeton connu de la page 2 : ne re-fetch jamais la page 1.
        resumed = _run(
            transport=transport,
            license_decision=_source().license,
            max_pages=1,
            resume_from_token="p2",
        )

        assert resumed.succeeded
        assert resumed.records_read == 1  # uniquement la page 2, pas un doublon de la page 1
        assert transport.calls_for_token(None) == 1  # toujours 1 : la reprise n'a pas re-fetché la page 1
        assert transport.calls_for_token("p2") == 1

    def test_retry_after_transient_failure_eventually_succeeds(self) -> None:
        failing_transport = FakeTransport({None: ScriptedPage(raise_error=TransportTimeout("timeout simulé"))})
        first_attempt = _run(transport=failing_transport, license_decision=_source().license)
        assert not first_attempt.succeeded
        assert first_attempt.steps_failed == ["fetch"]

        recovered_transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )
        second_attempt = _run(transport=recovered_transport, license_decision=_source().license)
        assert second_attempt.succeeded

    def test_http_error_is_captured_in_report(self) -> None:
        transport = FakeTransport(
            {None: ScriptedPage(raise_error=TransportHttpError(503, "service indisponible (simulé)"))}
        )

        report = _run(transport=transport, license_decision=_source().license)

        assert not report.succeeded
        assert report.steps_failed == ["fetch"]
        assert any("503" in e for e in report.errors)


# ---------------------------------------------------------------------------
# Absence de réseau réel / absence d'écriture en base
# ---------------------------------------------------------------------------


class TestNoRealNetworkOrDatabase:
    """Vérifie l'ABSENCE d'import réseau/BDD par analyse statique du code
    source — une preuve structurelle, pas une simple relecture manuelle."""

    @staticmethod
    def _imported_module_roots(path: Path) -> set[str]:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    roots.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots.add(node.module.split(".")[0])
        return roots

    def test_no_network_or_database_imports_in_pipeline_modules(self) -> None:
        forbidden = {"requests", "httpx", "urllib", "urllib3", "socket", "aiohttp", "db", "psycopg", "psycopg2"}
        for py_file in PIPELINE_PACKAGE_DIR.glob("*.py"):
            roots = self._imported_module_roots(py_file)
            offending = roots & forbidden
            assert not offending, f"{py_file.name} importe {offending} — interdit en P03."

    def test_pipeline_never_touches_source_registry(self) -> None:
        """Recherche textuelle de bon sens en complément de l'analyse AST :
        aucune requête SQL d'écriture dans ce paquet — P03 ne crée aucune
        ligne en base, par construction. (La prose des docstrings peut
        légitimement *mentionner* `source_registry` en expliquant la
        réutilisation du noyau — seule une requête d'écriture est interdite.)
        """
        for py_file in PIPELINE_PACKAGE_DIR.glob("*.py"):
            lowered = py_file.read_text(encoding="utf-8").lower()
            assert "insert into" not in lowered, f"{py_file.name} contient une requête INSERT."
            assert "cur.execute" not in lowered, f"{py_file.name} exécute une requête SQL."
            assert "get_db(" not in lowered, f"{py_file.name} ouvre une connexion base de données."


# ---------------------------------------------------------------------------
# Conservation de `null` — jamais convertie en 0
# ---------------------------------------------------------------------------


class TestNullPreservation:
    def test_boolean_value_survives_pipeline_without_becoming_zero(self) -> None:
        """Une valeur booléenne `False` ne doit jamais être confondue avec
        une valeur absente ni un zéro — bout en bout à travers derive+validate."""
        rows = [{"station": "X1", "date": "2025-06-01"}]  # pas de "value" numérique

        def normalizer_with_boolean(parsed):
            drafts = []
            for page in parsed:
                for row in page["rows"]:
                    drafts.append(
                        ObservationDraft(
                            subject_type="fixture_station", subject_key=row["station"],
                            metric_code="fixture.flag", boolean_value=False,
                            geography_code="FR", observed_at=datetime.fromisoformat(row["date"]),
                            data_status="observed", methodology_version="1.0.0",
                        )
                    )
            return drafts

        transport = FakeTransport({None: ScriptedPage(content=_page_bytes(rows), has_next_page=False)})

        report = _run(
            transport=transport,
            normalizer=normalizer_with_boolean,
            license_decision=_source().license,
        )

        assert report.succeeded
        assert report.records_publishable == 1  # False est publiable — ce n'est pas une valeur absente

    def test_publish_dry_run_report_distinguishes_withheld_from_published(self) -> None:
        from models.water_intelligence import (
            WaterMetricObservation,
            WaterQualityMetadata,
        )

        withheld = WaterMetricObservation(
            metric_code="m1", value=None, geography=_geography_resolver("FR"),
            period_start=date(2025, 1, 1), period_end=date(2025, 1, 1), method=_method(),
            quality=WaterQualityMetadata(data_status="observed"), source=_source(),
            value_withheld=True,
        )
        published = WaterMetricObservation(
            metric_code="m2", value=0.0, geography=_geography_resolver("FR"),
            period_start=date(2025, 1, 1), period_end=date(2025, 1, 1), method=_method(),
            quality=WaterQualityMetadata(data_status="observed"), source=_source(),
            value_withheld=False,
        )

        result = publish_dry_run([withheld, published], dry_run=True)

        assert result.records_publishable == 1  # seul "published" (value=0.0, PAS None) compte
        assert published.value == 0.0
        assert published.value is not None
