"""tests/test_water_staging_ingestion_contract.py — contrat d'entrée du
graveur Evidence Kernel Eau (X2B).

AUCUNE base, AUCUN réseau : ces quinze règles de refus doivent être exerçables
sans PostgreSQL, sinon elles ne tourneraient qu'en CI DB-gated. Les rapports
lus ici sont SYNTHÉTIQUES (écrits par les tests dans `tmp_path`) — aucun
rapport réel du dépôt n'est modifié.
"""

from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

import pytest

from services.water import staging_ingestion as contract
from services.water.staging_ingestion import (
    StagingIngestionRefused,
    WaterStagingIngestionRequest,
)

ARTIFACT_BYTES = b'{"data": [{"code_station": "FIX-001"}]}'
ARTIFACT_SHA = hashlib.sha256(ARTIFACT_BYTES).hexdigest()
SOURCE = "HUBEAU_HYDROMETRIE"
RELEASE = "hubeau-hydrometrie-2026-07-26-x2b-fixture"


def _report_payload(**overrides) -> dict:
    payload = {
        "source_code": SOURCE,
        "release_key": RELEASE,
        "verdict": "ready_for_staging",
        "dry_run": True,
        "payload_sha256": ARTIFACT_SHA,
        "periods": ["2026-01-01 → 2026-01-02"],
        "geographies": ["FIX-001"],
        "query_parameters": {"code_entite": "FIX-001"},
        "executed_at": "2026-07-26T10:00:00+00:00",
    }
    payload.update(overrides)
    return payload


def _write_report(tmp_path: Path, **overrides) -> Path:
    """Écrit un rapport Markdown SYNTHÉTIQUE au format réel (JSON en bloc)."""
    payload = _report_payload(**overrides)
    path = tmp_path / "report.md"
    path.write_text(
        "# Validation live — fixture\n\n"
        "<details><summary>Rapport structuré (JSON)</summary>\n\n"
        "```json\n" + json.dumps(payload, indent=2, ensure_ascii=False) + "\n```\n\n"
        "</details>\n",
        encoding="utf-8",
    )
    return path


def _write_artifact(tmp_path: Path, data: bytes = ARTIFACT_BYTES) -> Path:
    path = tmp_path / "artifact.json"
    path.write_bytes(data)
    return path


def _request(tmp_path: Path, **overrides) -> WaterStagingIngestionRequest:
    artifact = overrides.pop("artifact_path", None) or _write_artifact(tmp_path)
    report = overrides.pop("report_path", None) or _write_report(tmp_path)
    params = {
        "source_code": SOURCE,
        "release_key": RELEASE,
        "artifact_path": artifact,
        "expected_sha256": ARTIFACT_SHA,
        "report_path": report,
        # Le rapport peut être délibérément absent (règle 4) : ne pas le lire
        # pour calculer un checksum par défaut qui ne servira pas.
        "report_sha256": (
            hashlib.sha256(report.read_bytes()).hexdigest() if report.is_file() else "0" * 64
        ),
        "method_code": "CC-WI-HUBEAU-HYDRO-PASSTHROUGH",
        "method_version": "1.0.0",
    }
    params.update(overrides)
    return WaterStagingIngestionRequest(**params)


# ---------------------------------------------------------------------------
# Le cas nominal existe — sinon les refus ne prouveraient rien
# ---------------------------------------------------------------------------


class TestNominalCase:
    def test_a_well_formed_request_is_accepted(self, tmp_path: Path) -> None:
        request = _request(tmp_path)

        assert request.source_code == SOURCE
        assert request.environment == "staging"
        assert request.dry_run is True

    def test_the_four_hubeau_families_are_the_whole_allowlist(self) -> None:
        assert set(contract.INGESTIBLE_SOURCES) == {
            "HUBEAU_HYDROMETRIE",
            "HUBEAU_ADES",
            "HUBEAU_BNPE_PRELEVEMENTS",
            "HUBEAU_QUALITE_SURFACE",
        }

    def test_reading_the_artifact_verifies_its_checksum(self, tmp_path: Path) -> None:
        assert _request(tmp_path).read_artifact_pages() == [ARTIFACT_BYTES]

    def test_a_valid_report_passes_every_check(self, tmp_path: Path) -> None:
        request = _request(tmp_path)
        report = contract.load_validation_report(request.report_path)

        contract.verify_report(request, report)  # ne lève pas


# ---------------------------------------------------------------------------
# Règle 1 — source inconnue ; §3 — sources explicitement interdites
# ---------------------------------------------------------------------------


class TestSourceRefusals:
    def test_an_unknown_source_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="inconnue"):
            _request(tmp_path, source_code="HUBEAU_INVENTEE")

    def test_an_empty_source_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="source_code vide"):
            _request(tmp_path, source_code="   ")

    @pytest.mark.parametrize(
        ("code", "expected_status"),
        [
            ("EEA_WEI_PLUS", "manual_artifact_required"),
            ("WRI_AQUEDUCT", "blocked_registration_required"),
            ("COPERNICUS_EDO", "source_verified_decoder_deferred"),
        ],
    )
    def test_a_forbidden_source_is_refused_by_name_with_its_real_status(
        self, tmp_path: Path, code: str, expected_status: str
    ) -> None:
        """Le refus cite le statut réel : « source inconnue » laisserait croire
        à une faute de frappe et inviterait à réessayer."""
        with pytest.raises(StagingIngestionRefused) as excinfo:
            _request(tmp_path, source_code=code)

        assert expected_status in str(excinfo.value)
        assert "inconnue" not in str(excinfo.value)

    def test_the_three_forbidden_sources_are_never_ingestible(self) -> None:
        assert not set(contract.REFUSED_SOURCES) & set(contract.INGESTIBLE_SOURCES)


# ---------------------------------------------------------------------------
# Règles 2 et 3 — la release doit nommer un contenu figé
# ---------------------------------------------------------------------------


class TestReleaseKeyRefusals:
    def test_an_unnamed_release_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="release_key vide"):
            _request(tmp_path, release_key="  ")

    @pytest.mark.parametrize("key", ["latest", "LATEST", "current", "head", "main", "now"])
    def test_a_moving_cursor_is_refused(self, tmp_path: Path, key: str) -> None:
        with pytest.raises(StagingIngestionRefused, match="curseur mouvant"):
            _request(tmp_path, release_key=key)


# ---------------------------------------------------------------------------
# Règles 4 et 5 — artefact et checksums
# ---------------------------------------------------------------------------


class TestArtifactRefusals:
    def test_a_missing_artifact_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="artefact introuvable"):
            _request(tmp_path, artifact_path=tmp_path / "absent.json")

    def test_a_missing_report_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="rapport introuvable"):
            _request(
                tmp_path,
                report_path=tmp_path / "absent.md",
                report_sha256="0" * 64,
            )

    def test_a_malformed_checksum_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="expected_sha256"):
            _request(tmp_path, expected_sha256="pas-un-checksum")

    def test_a_different_checksum_is_refused_at_read_time(self, tmp_path: Path) -> None:
        request = _request(tmp_path, expected_sha256="a" * 64)

        with pytest.raises(StagingIngestionRefused, match="checksum du payload"):
            request.read_artifact_pages()

    def test_tampered_bytes_are_caught(self, tmp_path: Path) -> None:
        """Le checksum déclaré est correct, mais les octets ont changé depuis."""
        request = _request(tmp_path)
        request.artifact_path.write_bytes(ARTIFACT_BYTES + b" ")

        with pytest.raises(StagingIngestionRefused, match="ne sont pas ceux que le rapport atteste"):
            request.read_artifact_pages()


class TestPaginatedArtifact:
    """Une acquisition Hub'Eau est paginée : l'artefact peut être un
    répertoire de pages, et son checksum obéit alors à la règle du rapport."""

    PAGES = [b'{"data": [{"a": 1}]}', b'{"data": [{"a": 2}]}']

    def _artifact_dir(self, tmp_path: Path) -> Path:
        directory = tmp_path / "pages"
        directory.mkdir()
        for index, page in enumerate(self.PAGES, start=1):
            (directory / f"HUBEAU_HYDROMETRIE_p{index:03d}.json").write_bytes(page)
        return directory

    def test_a_directory_of_pages_is_read_in_pagination_order(self, tmp_path: Path) -> None:
        directory = self._artifact_dir(tmp_path)
        request = _request(
            tmp_path,
            artifact_path=directory,
            expected_sha256=contract.payload_digest(self.PAGES),
        )

        assert request.read_artifact_pages() == self.PAGES

    def test_the_multi_page_digest_matches_the_report_rule(self, tmp_path: Path) -> None:
        """Même règle que `validate_hubeau._payload_checksum` : sans elle, la
        concordance rapport/artefact serait fausse dès la deuxième page."""
        from types import SimpleNamespace

        from scripts.water_intelligence.validate_hubeau import _payload_checksum

        # `_payload_checksum` ne lit qu'`entry.sha256` : un substitut minimal
        # suffit et évite de dépendre des sept champs de `FetchLogEntry`.
        fetcher = SimpleNamespace(
            log=[
                SimpleNamespace(sha256=hashlib.sha256(page).hexdigest())
                for page in self.PAGES
            ]
        )

        assert contract.payload_digest(self.PAGES) == _payload_checksum(fetcher)

    def test_a_single_page_digest_is_its_own_sha256(self) -> None:
        assert contract.payload_digest([ARTIFACT_BYTES]) == ARTIFACT_SHA

    def test_an_empty_artifact_directory_is_refused(self, tmp_path: Path) -> None:
        directory = tmp_path / "vide"
        directory.mkdir()
        request = _request(tmp_path, artifact_path=directory)

        with pytest.raises(StagingIngestionRefused, match="artefact vide"):
            request.read_artifact_pages()


# ---------------------------------------------------------------------------
# Règles 6 à 9 — le rapport
# ---------------------------------------------------------------------------


class TestReportRefusals:
    def test_an_unreadable_report_is_refused(self, tmp_path: Path) -> None:
        path = tmp_path / "report.md"
        path.write_text("# Aucun bloc JSON ici\n", encoding="utf-8")

        with pytest.raises(StagingIngestionRefused, match="sans bloc JSON"):
            contract.load_validation_report(path)

    def test_an_invalid_json_block_is_refused(self, tmp_path: Path) -> None:
        path = tmp_path / "report.md"
        path.write_text("```json\n{pas du json}\n```\n", encoding="utf-8")

        with pytest.raises(StagingIngestionRefused, match="JSON invalide"):
            contract.load_validation_report(path)

    def test_a_report_checksum_mismatch_is_refused(self, tmp_path: Path) -> None:
        request = _request(tmp_path, report_sha256="b" * 64)
        report = contract.load_validation_report(request.report_path)

        with pytest.raises(StagingIngestionRefused, match="checksum du rapport"):
            contract.verify_report(request, report)

    @pytest.mark.parametrize(
        "verdict",
        ["schema_drift", "source_unavailable", "blocked", "decoder_deferred",
         "manual_artifact_required"],
    )
    def test_any_verdict_other_than_ready_for_staging_is_refused(
        self, tmp_path: Path, verdict: str
    ) -> None:
        report_path = _write_report(tmp_path, verdict=verdict)
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="ready_for_staging"):
            contract.verify_report(request, report)

    def test_a_report_claiming_dry_run_false_is_refused(self, tmp_path: Path) -> None:
        """X1/X2A sont en lecture seule par construction : un rapport qui
        prétend le contraire est incohérent avec sa propre phase."""
        report_path = _write_report(tmp_path, dry_run=False)
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="dry_run=false"):
            contract.verify_report(request, report)

    def test_a_report_attesting_another_artifact_is_refused(self, tmp_path: Path) -> None:
        report_path = _write_report(tmp_path, payload_sha256="c" * 64)
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="checksum attesté par le rapport"):
            contract.verify_report(request, report)

    def test_a_report_for_another_source_is_refused(self, tmp_path: Path) -> None:
        report_path = _write_report(tmp_path, source_code="HUBEAU_ADES")
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="rapport émis pour"):
            contract.verify_report(request, report)

    def test_a_report_for_another_release_is_refused(self, tmp_path: Path) -> None:
        report_path = _write_report(tmp_path, release_key="une-autre-release")
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="release"):
            contract.verify_report(request, report)


# ---------------------------------------------------------------------------
# Règles 10 à 15 — méthode, période, géographie, environnement, tenant
# ---------------------------------------------------------------------------


class TestRemainingRefusals:
    def test_a_method_without_version_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="sans version"):
            _request(tmp_path, method_version="")

    def test_a_method_that_is_not_the_connector_method_is_refused(
        self, tmp_path: Path
    ) -> None:
        with pytest.raises(StagingIngestionRefused, match="méthode vérifiée du connecteur"):
            _request(tmp_path, method_version="9.9.9")

    def test_a_report_without_period_is_refused(self, tmp_path: Path) -> None:
        report_path = _write_report(tmp_path, periods=[])
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="sans période"):
            contract.verify_report(request, report)

    def test_a_report_without_geography_is_refused(self, tmp_path: Path) -> None:
        report_path = _write_report(tmp_path, geographies=[])
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="sans géographie"):
            contract.verify_report(request, report)

    @pytest.mark.parametrize("environment", ["production", "public", "prod", ""])
    def test_any_environment_other_than_staging_is_refused(
        self, tmp_path: Path, environment: str
    ) -> None:
        with pytest.raises(StagingIngestionRefused, match="X2B n'écrit qu'en"):
            _request(tmp_path, environment=environment)

    def test_publication_is_never_an_argument(self, tmp_path: Path) -> None:
        """La publication publique n'est pas un environnement qu'on demande :
        elle est une décision humaine (X4). Aucun champ ne la porte."""
        assert "publish" not in {f for f in WaterStagingIngestionRequest.__dataclass_fields__}
        assert "published" not in {f for f in WaterStagingIngestionRequest.__dataclass_fields__}

    @pytest.mark.parametrize(
        "param", ["company_id", "tenant_id", "siren", "customer_ref", "organisation_id"]
    )
    def test_a_tenant_parameter_in_the_report_recipe_is_refused(
        self, tmp_path: Path, param: str
    ) -> None:
        report_path = _write_report(tmp_path, query_parameters={param: "42"})
        request = _request(
            tmp_path,
            report_path=report_path,
            report_sha256=hashlib.sha256(report_path.read_bytes()).hexdigest(),
        )
        report = contract.load_validation_report(report_path)

        with pytest.raises(StagingIngestionRefused, match="tenant"):
            contract.verify_report(request, report)

    def test_a_tenant_flavoured_operator_identity_is_refused(self, tmp_path: Path) -> None:
        with pytest.raises(StagingIngestionRefused, match="évoque un tenant"):
            _request(tmp_path, operator="company_id=42")

    def test_a_plain_operator_identity_is_accepted(self, tmp_path: Path) -> None:
        assert _request(tmp_path, operator="ops-eau").operator == "ops-eau"


# ---------------------------------------------------------------------------
# Le contrat ne dérive pas de ses sources de vérité
# ---------------------------------------------------------------------------


class TestNoDrift:
    def test_the_accepted_verdict_still_exists_in_the_report_vocabulary(self) -> None:
        """`ACCEPTED_VERDICT` est recopié (services n'importe jamais scripts) :
        ce test est le fil qui empêche les deux définitions de diverger."""
        from scripts.water_intelligence.reporting import VERDICTS

        assert contract.ACCEPTED_VERDICT in VERDICTS

    def test_every_ingestible_source_carries_its_connector_method(self) -> None:
        from services.water_intelligence.connectors import hubeau_hydro as hydro
        from services.water_intelligence.connectors import (
            hubeau_withdrawals_quality as usage,
        )

        expected = {
            "HUBEAU_HYDROMETRIE": hydro.METHOD,
            "HUBEAU_ADES": hydro.METHOD,
            "HUBEAU_BNPE_PRELEVEMENTS": usage.WITHDRAWALS_METHOD,
            "HUBEAU_QUALITE_SURFACE": usage.QUALITY_METHOD,
        }
        assert {c: s.method for c, s in contract.INGESTIBLE_SOURCES.items()} == expected

    def test_the_contract_module_touches_neither_network_nor_database(self) -> None:
        path = (
            Path(__file__).resolve().parents[1]
            / "services" / "water" / "staging_ingestion.py"
        )
        tree = ast.parse(path.read_text(encoding="utf-8"))
        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots.add(node.module.split(".")[0])

        forbidden = {
            "requests", "httpx", "urllib", "urllib3", "socket", "aiohttp",
            "db", "psycopg", "psycopg2",
        }
        assert not (roots & forbidden)

    def test_the_contract_never_imports_the_operator_scripts(self) -> None:
        """Sens de la dépendance : `services` ne dépend jamais de `scripts`."""
        path = (
            Path(__file__).resolve().parents[1]
            / "services" / "water" / "staging_ingestion.py"
        )
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert not node.module.startswith("scripts")
