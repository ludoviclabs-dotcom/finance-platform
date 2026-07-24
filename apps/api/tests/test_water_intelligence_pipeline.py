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
déjà obtenues), absence de réseau réel, absence d'écriture en base,
conservation de `null` sans conversion en `0` à travers tout le pipeline, et
le décodage de page INJECTABLE (`PageDecoder` — P03B) : JSON par défaut
inchangé, texte/octets bruts pour les sources tabulaires/binaires, sans
repli automatique d'un format vers un autre.

P03C : la frontière d'erreur entre erreurs ATTENDUES (`PipelineError`/
`TransportError`/`AdapterError`, toujours capturées en un rapport) et
erreurs INATTENDUES (bug de programmation, volontairement non capturées et
remontées nues) — voir `TestUnexpectedErrorsPropagateRaw` ci-dessous et
`docs/carbonco/water-intelligence/handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md`.
"""

from __future__ import annotations

import ast
import hashlib
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
from services.intelligence.adapters.base import AdapterError, ObservationDraft
from services.water_intelligence.pipeline import (
    JsonPageDecoder,
    PipelineDataUnavailableError,
    PipelineUnknownSourceError,
    RawBytesPageDecoder,
    TextPageDecoder,
    _frame_pages,
    derive_observations,
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


# ---------------------------------------------------------------------------
# PageDecoder — décodage de page injectable (P03B)
# ---------------------------------------------------------------------------


class TestJsonPageDecoderUnchanged:
    """Comportement par défaut : identique à l'ancien `parse()` figé (aucune
    régression), que le décodeur soit implicite ou explicite."""

    def test_valid_json_page_decodes_like_before(self) -> None:
        decoder = JsonPageDecoder()

        assert decoder.decode(b'{"a": 1}', page_index=1) == {"a": 1}

    def test_invalid_json_page_raises_adapter_error(self) -> None:
        decoder = JsonPageDecoder()

        with pytest.raises(AdapterError, match="JSON invalide"):
            decoder.decode(b"{not valid json", page_index=1)

    def test_omitting_decoder_behaves_identically_to_explicit_json_decoder(self) -> None:
        """Rétrocompatibilité explicite : ne pas préciser `decoder` (comme
        avant P03B) produit EXACTEMENT le même rapport que
        `decoder=JsonPageDecoder()`."""
        transport_a = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )
        transport_b = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        implicit = _run(transport=transport_a, license_decision=_source().license)
        explicit = _run(
            transport=transport_b, license_decision=_source().license, decoder=JsonPageDecoder()
        )

        assert implicit.model_dump(exclude={"executed_at"}) == explicit.model_dump(
            exclude={"executed_at"}
        )


class TestTextPageDecoder:
    def test_decodes_bytes_to_exact_text_no_json_escaping(self) -> None:
        csv_text = "id,value\nA,1\nB,\n"  # virgules, retour ligne, valeur vide
        decoder = TextPageDecoder()

        assert decoder.decode(csv_text.encode("utf-8"), page_index=1) == csv_text

    def test_default_encoding_is_explicit_utf8(self) -> None:
        assert TextPageDecoder().encoding == "utf-8"

    def test_non_utf8_bytes_are_refused_not_mangled(self) -> None:
        latin1_only = "café".encode("latin-1")  # invalide en UTF-8 strict
        decoder = TextPageDecoder()  # UTF-8 explicite, pas de détection auto

        with pytest.raises(AdapterError, match="illisible"):
            decoder.decode(latin1_only, page_index=1)

    def test_explicit_alternate_encoding_is_honoured_not_guessed(self) -> None:
        latin1_only = "café".encode("latin-1")
        decoder = TextPageDecoder(encoding="latin-1")

        assert decoder.decode(latin1_only, page_index=1) == "café"


class TestRawBytesPageDecoder:
    def test_returns_bytes_unchanged_including_non_utf8(self) -> None:
        raw = b"\x00\x01\xff\xfe\x02"  # invalide en UTF-8 et en JSON
        decoder = RawBytesPageDecoder()

        assert decoder.decode(raw, page_index=1) == raw
        assert isinstance(decoder.decode(raw, page_index=1), bytes)


class TestPageDecoderNoAutomaticFallback:
    def test_json_decoder_never_falls_back_to_text_on_failure(self) -> None:
        """Des octets CSV valides (texte) ne sont PAS silencieusement acceptés
        par le décodeur JSON — aucun repli JSON -> texte -> bytes."""
        csv_bytes = b"string_id,bws_raw\nFIXTURE-AREA-001,1.5\n"

        with pytest.raises(AdapterError):
            JsonPageDecoder().decode(csv_bytes, page_index=1)

    def test_text_decoder_never_reinterprets_valid_json_as_an_object(self) -> None:
        """Un décodeur texte explicite renvoie du texte, jamais un objet
        JSON désérialisé, même si le contenu ressemble à du JSON valide."""
        json_like = b'{"a": 1}'

        decoded = TextPageDecoder().decode(json_like, page_index=1)

        assert decoded == '{"a": 1}'
        assert isinstance(decoded, str)
        assert not isinstance(decoded, dict)


class TestPageDecoderNullPreservation:
    def test_text_decoder_preserves_empty_string_not_none_or_zero(self) -> None:
        assert TextPageDecoder().decode(b"", page_index=1) == ""

    def test_raw_bytes_decoder_preserves_empty_bytes_not_none(self) -> None:
        result = RawBytesPageDecoder().decode(b"", page_index=1)

        assert result == b""
        assert result is not None


class TestPageDecoderPipelineIntegration:
    def test_text_pages_traverse_the_pipeline_without_json_wrapping(self) -> None:
        csv_text = "string_id,name\nFIXTURE-A,Zone A (fixture)\n"
        transport = FakeTransport(
            {None: ScriptedPage(content=csv_text.encode("utf-8"), has_next_page=False)}
        )
        captured = []

        def normalizer(pages):
            captured.extend(pages)
            return []

        report = _run(
            transport=transport,
            normalizer=normalizer,
            decoder=TextPageDecoder(),
            license_decision=_source().license,
        )

        assert report.steps_executed[:3] == ["plan", "fetch", "parse"]
        assert captured == [csv_text]  # texte préservé EXACTEMENT, pas de ré-échappement JSON

    def test_checksum_is_computed_over_the_actually_decoded_bytes(self) -> None:
        """P03B : le checksum d'entrée porte sur les octets RÉELLEMENT
        transportés (et donc décodés à `parse`) — plus sur un emballage JSON
        intermédiaire qui les aurait fait diverger."""
        csv_text = "string_id,name\nFIXTURE-A,Zone A (fixture)\n"
        page_bytes = csv_text.encode("utf-8")
        transport = FakeTransport({None: ScriptedPage(content=page_bytes, has_next_page=False)})

        report = _run(
            transport=transport,
            normalizer=lambda pages: [],
            decoder=TextPageDecoder(),
            license_decision=_source().license,
        )

        expected = hashlib.sha256(_frame_pages([page_bytes])).hexdigest()
        assert report.input_checksum == expected

    def test_raw_bytes_decoder_pagination_unchanged(self) -> None:
        page1 = ScriptedPage(content=b"AAA", page_number=1, has_next_page=True, next_page_token="p2")
        page2 = ScriptedPage(content=b"BBB", page_number=2, has_next_page=False)
        transport = FakeTransport({None: page1, "p2": page2})
        captured = []

        def normalizer(pages):
            captured.extend(pages)
            return []

        report = _run(
            transport=transport,
            normalizer=normalizer,
            decoder=RawBytesPageDecoder(),
            license_decision=_source().license,
            max_pages=2,
        )

        assert report.succeeded
        assert captured == [b"AAA", b"BBB"]
        assert transport.call_count == 2

    def test_page_limit_still_enforced_regardless_of_decoder(self) -> None:
        page1 = ScriptedPage(content=b"AAA", page_number=1, has_next_page=True, next_page_token="p2")
        transport = FakeTransport({None: page1})

        report = _run(
            transport=transport,
            normalizer=lambda pages: [],
            decoder=RawBytesPageDecoder(),
            license_decision=_source().license,
            max_pages=1,
        )

        assert not report.succeeded
        assert report.steps_failed == ["fetch"]  # la limite est vérifiée avant tout décodage

    def test_resume_with_a_non_json_decoder_does_not_refetch_earlier_pages(self) -> None:
        page1 = ScriptedPage(content=b"AAA", page_number=1, has_next_page=True, next_page_token="p2")
        page2 = ScriptedPage(content=b"BBB", page_number=2, has_next_page=False)
        transport = FakeTransport({None: page1, "p2": page2})

        first = _run(
            transport=transport,
            normalizer=lambda pages: [],
            decoder=RawBytesPageDecoder(),
            license_decision=_source().license,
            max_pages=1,
        )
        assert not first.succeeded

        resumed = _run(
            transport=transport,
            normalizer=lambda pages: [],
            decoder=RawBytesPageDecoder(),
            license_decision=_source().license,
            max_pages=1,
            resume_from_token="p2",
        )

        assert resumed.succeeded
        assert transport.calls_for_token(None) == 1
        assert transport.calls_for_token("p2") == 1

    def test_transport_corruption_fails_at_fetch_even_with_text_decoder(self) -> None:
        transport = FakeTransport(
            {None: ScriptedPage(raise_error=TransportCorrupted("checksum HTTP invalide (simulé)"))}
        )

        report = _run(
            transport=transport,
            normalizer=lambda pages: [],
            decoder=TextPageDecoder(),
            license_decision=_source().license,
        )

        assert not report.succeeded
        assert report.steps_failed == ["fetch"]  # jamais atteint le décodage

    def test_decode_error_is_distinct_from_business_normalizer_error(self) -> None:
        """Le stage `parse` (décodage) et le stage `normalize` (erreur métier
        du connecteur) restent deux échecs distincts et non confondus."""
        bad_transport = FakeTransport({None: ScriptedPage(content=b"\xff\xfe", has_next_page=False)})

        decode_failure = _run(
            transport=bad_transport,
            normalizer=lambda pages: [],
            decoder=TextPageDecoder(),
            license_decision=_source().license,
        )
        assert decode_failure.steps_failed == ["parse"]

        ok_transport = FakeTransport(
            {None: ScriptedPage(content=b"donnee-inattendue", has_next_page=False)}
        )

        def business_rejecting_normalizer(pages):
            raise AdapterError("schéma métier inconnu (simulé)")

        normalize_failure = _run(
            transport=ok_transport,
            normalizer=business_rejecting_normalizer,
            decoder=TextPageDecoder(),
            license_decision=_source().license,
        )
        assert normalize_failure.steps_failed == ["normalize"]
        assert decode_failure.steps_failed != normalize_failure.steps_failed


class TestPageDecoderIsStructuralProtocol:
    def test_any_object_with_a_decode_method_works_no_registry_needed(self) -> None:
        """`PageDecoder` est un Protocol structurel (PEP 544) : un objet qui
        expose `decode(page_bytes, *, page_index)` convient, sans registre ni
        détection automatique — juste une injection explicite."""

        class CountingUppercaseDecoder:
            def __init__(self) -> None:
                self.calls = 0

            def decode(self, page_bytes: bytes, *, page_index: int) -> str:
                self.calls += 1
                return page_bytes.decode("utf-8").upper()

        custom = CountingUppercaseDecoder()
        transport = FakeTransport({None: ScriptedPage(content=b"abc", has_next_page=False)})
        captured = []

        def normalizer(pages):
            captured.extend(pages)
            return []

        report = _run(
            transport=transport,
            normalizer=normalizer,
            decoder=custom,
            license_decision=_source().license,
        )

        assert report.steps_executed[:3] == ["plan", "fetch", "parse"]
        assert captured == ["ABC"]
        assert custom.calls == 1


# ---------------------------------------------------------------------------
# Frontière d'erreur connecteur (P03C) : attendue vs inattendue
# ---------------------------------------------------------------------------


class TestConnectorAdapterErrorIsAlwaysCaught:
    """Toute erreur métier attendue d'un connecteur, levée depuis `normalize`,
    est capturée dès lors qu'elle hérite d'`AdapterError` — quelle que soit
    sa sous-classe exacte (contrat imposé aux connecteurs, P03C)."""

    def test_custom_adapter_error_subclass_from_normalizer_is_caught_at_normalize(self) -> None:
        class CustomConnectorSchemaError(AdapterError):
            """Simule une erreur métier propre à un connecteur (ex. WRI)."""

        def failing_normalizer(pages):
            raise CustomConnectorSchemaError("schéma refusé (simulé) : colonne inconnue")

        transport = FakeTransport({None: ScriptedPage(content=b"donnee", has_next_page=False)})

        report = _run(
            transport=transport,
            normalizer=failing_normalizer,
            decoder=RawBytesPageDecoder(),
            license_decision=_source().license,
        )

        assert report.succeeded is False
        assert report.steps_failed == ["normalize"]
        assert any("schéma refusé (simulé)" in e for e in report.errors)
        assert "derive" not in report.steps_executed
        assert "validate" not in report.steps_executed
        assert "publish" not in report.steps_executed


class TestUnexpectedErrorsPropagateRaw:
    """P03C : la garantie « toujours un rapport » couvre uniquement les
    erreurs ATTENDUES (`PipelineError`/`TransportError`/`AdapterError`). Un
    bug de programmation (`ValueError`, `TypeError`, ou toute autre
    exception hors de ces trois familles) n'est PAS intercepté — il remonte
    nu, volontairement, pour ne jamais masquer un défaut de code."""

    def test_unexpected_valueerror_from_normalizer_propagates_raw(self) -> None:
        def buggy_normalizer(pages):
            raise ValueError("bug de programmation (simulé), pas une erreur métier")

        transport = FakeTransport({None: ScriptedPage(content=b"donnee", has_next_page=False)})

        with pytest.raises(ValueError, match="bug de programmation"):
            _run(
                transport=transport,
                normalizer=buggy_normalizer,
                decoder=RawBytesPageDecoder(),
                license_decision=_source().license,
            )

    def test_unexpected_typeerror_from_normalizer_propagates_raw(self) -> None:
        def buggy_normalizer(pages):
            raise TypeError("bug de programmation (simulé)")

        transport = FakeTransport({None: ScriptedPage(content=b"donnee", has_next_page=False)})

        with pytest.raises(TypeError, match="bug de programmation"):
            _run(
                transport=transport,
                normalizer=buggy_normalizer,
                decoder=RawBytesPageDecoder(),
                license_decision=_source().license,
            )

    def test_unexpected_error_from_page_decoder_propagates_raw(self) -> None:
        """Même logique côté décodeur : un `PageDecoder` custom qui lève un
        bug de programmation (pas `AdapterError`) n'est pas non plus
        intercepté au stage `parse`."""

        class BuggyDecoder:
            def decode(self, page_bytes: bytes, *, page_index: int):
                raise KeyError("bug de programmation (simulé) dans un décodeur custom")

        transport = FakeTransport({None: ScriptedPage(content=b"donnee", has_next_page=False)})

        with pytest.raises(KeyError):
            _run(
                transport=transport,
                normalizer=lambda pages: [],
                decoder=BuggyDecoder(),
                license_decision=_source().license,
            )


class TestGeographyResolverErrorBoundaryIsUnchanged:
    """P03C n'étend PAS la capture du stage `derive` : le contrat P03
    existant (`geography_resolver` doit lever `PipelineDataUnavailableError`
    pour un code non résolu) reste inchangé et est le SEUL type intercepté
    autour de `geography_resolver`. Documenté comme une limite de portée
    délibérée de P03C (cf. handoff), pas un oubli."""

    def test_pipeline_data_unavailable_error_is_still_caught_at_derive(self) -> None:
        rows = [{"station": "X1", "value": 12.5, "date": "2025-06-01", "geography_code": "UNKNOWN"}]
        transport = FakeTransport({None: ScriptedPage(content=_page_bytes(rows), has_next_page=False)})

        report = _run(transport=transport, license_decision=_source().license)

        assert not report.succeeded
        assert "derive" in report.steps_failed

    def test_adapter_error_from_geography_resolver_is_not_caught_at_derive(self) -> None:
        """Un `geography_resolver` qui lève `AdapterError` (au lieu du
        `PipelineDataUnavailableError` attendu par le contrat P03 §5) n'est
        PAS capturé par `derive_observations` — comportement inchangé par
        P03C, qui ne porte que sur `parse`/`normalize`."""

        def resolver_raising_adapter_error(code):
            raise AdapterError("géographie refusée par un connecteur non conforme (simulé)")

        rows = [{"station": "X1", "value": 12.5, "date": "2025-06-01"}]
        transport = FakeTransport({None: ScriptedPage(content=_page_bytes(rows), has_next_page=False)})

        with pytest.raises(AdapterError, match="géographie refusée"):
            _run(
                transport=transport,
                geography_resolver=resolver_raising_adapter_error,
                license_decision=_source().license,
            )


# ---------------------------------------------------------------------------
# PeriodResolver — contrat générique injectable (Wave A, commit de clôture).
# Audit d'identité temporelle complet :
# docs/carbonco/water-intelligence/handoffs/WAVE_A_EU_CONNECTORS.md §5. Ces
# tests portent sur le CONTRAT lui-même (indépendant de tout connecteur) ;
# le résolveur trimestriel EEA est testé séparément dans
# `test_water_intelligence_eea_wei_plus.py::TestPeriodResolver`.
# ---------------------------------------------------------------------------


class TestPeriodResolverContract:
    def test_default_resolver_produces_a_single_day_period(self) -> None:
        """Rétrocompatibilité (item 1) : sans `period_resolver` injecté,
        `period_start == period_end == observed_at.date()` — comportement
        strictement inchangé depuis avant Wave A."""
        drafts = _normalizer([{"rows": ONE_ROW}])

        result = derive_observations(
            drafts,
            source=_source(),
            method=_method(),
            geography_resolver=_geography_resolver,
        )

        assert not result.errors
        candidate = result.candidates[0]
        assert candidate["period_start"] == candidate["period_end"] == date(2025, 6, 1)

    def test_period_resolver_reversing_bounds_is_refused(self) -> None:
        """`période invalide` (item 8) : un résolveur qui inverse les bornes
        est rejeté par `derive_observations()` elle-même, indépendamment du
        résolveur branché — jamais corrigé en silence."""

        def backwards_resolver(draft: ObservationDraft) -> tuple[date, date]:
            return date(2025, 6, 2), date(2025, 6, 1)

        drafts = _normalizer([{"rows": ONE_ROW}])

        result = derive_observations(
            drafts,
            source=_source(),
            method=_method(),
            geography_resolver=_geography_resolver,
            period_resolver=backwards_resolver,
        )

        assert not result.candidates
        assert any("période invalide" in e for e in result.errors)

    def test_observed_at_absent_is_still_reported_by_the_default_resolver(self) -> None:
        """Non-régression (item 9) : `observed_at` absent reste une période
        absente refusée par le résolveur par défaut — même message qu'avant
        l'introduction du `PeriodResolver` injectable."""
        rows = [{"station": "X1", "value": 12.5}]  # pas de "date"

        result = derive_observations(
            _normalizer([{"rows": rows}]),
            source=_source(),
            method=_method(),
            geography_resolver=_geography_resolver,
        )

        assert not result.candidates
        assert any("observed_at absent" in e for e in result.errors)

    def test_period_resolver_error_fails_the_derive_stage_cleanly(self) -> None:
        """Erreur de période → rapport `derive failed` (item 13), à travers
        le pipeline complet — jamais une exception qui remonte nue."""

        def failing_resolver(draft: ObservationDraft) -> tuple[date, date]:
            raise PipelineDataUnavailableError("période simulée non résolue (test générique)")

        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        report = _run(
            transport=transport,
            license_decision=_source().license,
            period_resolver=failing_resolver,
        )

        assert not report.succeeded
        assert "derive" in report.steps_failed
        assert any("période simulée non résolue" in e for e in report.errors)
        assert "validate" not in report.steps_executed
        assert "publish" not in report.steps_executed

    def test_period_resolver_error_is_not_an_adapter_error(self) -> None:
        """Même discipline que `geography_resolver` (P03C §6) : le résolveur
        de période doit lever `PipelineDataUnavailableError`, jamais un
        `AdapterError` propre à un connecteur — sinon l'exception remonte
        nue, hors de `run_pipeline()`."""

        def resolver_raising_adapter_error(draft: ObservationDraft) -> tuple[date, date]:
            raise AdapterError("période refusée par un connecteur non conforme (simulé)")

        transport = FakeTransport(
            {None: ScriptedPage(content=_page_bytes(ONE_ROW), has_next_page=False)}
        )

        with pytest.raises(AdapterError, match="période refusée"):
            _run(
                transport=transport,
                license_decision=_source().license,
                period_resolver=resolver_raising_adapter_error,
            )
