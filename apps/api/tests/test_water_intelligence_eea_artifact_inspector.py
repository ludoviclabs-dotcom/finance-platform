"""tests/test_water_intelligence_eea_artifact_inspector.py — cadre de
conversion opérateur des artefacts EEA WEI+ (X2A).

AUCUN réseau, AUCUNE base : `inspect_workbook`/`convert_to_canonical_csv`
n'ouvrent qu'un fichier LOCAL. Les classeurs de ce fichier sont SYNTHÉTIQUES,
construits en mémoire avec `openpyxl` — ils ne prétendent PAS reproduire le
schéma réel d'un classeur WEI+ officiel (aucun n'a été obtenu, cf.
`docs/carbonco/water-intelligence/activation/X1_LIVE_VALIDATION_HANDOFF.md`
§3.1). Ils vérifient le MÉCANISME : inspection fidèle, refus sans profil,
conversion correcte une fois un profil fourni.
"""

from __future__ import annotations

import ast
import io
import zipfile
from datetime import date
from pathlib import Path

import openpyxl
import pytest

from scripts.water_intelligence import eea_artifact_inspector as inspector
from services.water_intelligence.connectors import eea_wei_plus as wei

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts" / "water_intelligence" / "eea_artifact_inspector.py"
)


def _workbook_bytes(sheets: dict[str, list[list]]) -> bytes:
    """Classeur SYNTHÉTIQUE en mémoire — jamais écrit sur disque."""
    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    for name, rows in sheets.items():
        sheet = workbook.create_sheet(name)
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _profile(**overrides) -> inspector.ColumnMappingProfile:
    params = dict(
        release_key="test-release",
        sheet_name="Data",
        identifier_column="spatialUnitIdentifier",
        year_column="year",
        quarter_column="quarter",
        value_column="wei_plus_pct",
        unit_column="unit",
        verified_by="opérateur de test",
        verified_on="2026-07-26",
    )
    params.update(overrides)
    return inspector.ColumnMappingProfile(**params)


# ---------------------------------------------------------------------------
# Le registre est vide par construction
# ---------------------------------------------------------------------------


class TestEmptyByConstruction:
    def test_no_mapping_profile_exists_yet(self) -> None:
        """Aucun artefact officiel réel n'a jamais été obtenu : inventer un
        profil ici reviendrait à deviner des colonnes."""
        assert inspector.MAPPING_PROFILES == {}

    def test_status_constant_names_the_gap_honestly(self) -> None:
        assert inspector.MAPPING_PROFILE_STATUS == "manual_artifact_converter_required"


# ---------------------------------------------------------------------------
# ColumnMappingProfile — un profil non attribué n'est pas un profil
# ---------------------------------------------------------------------------


class TestColumnMappingProfile:
    def test_empty_release_key_is_refused(self) -> None:
        with pytest.raises(inspector.ArtifactError, match="release_key"):
            _profile(release_key="  ")

    def test_unattributed_profile_is_refused(self) -> None:
        with pytest.raises(inspector.ArtifactError, match="non attribué"):
            _profile(verified_by="")
        with pytest.raises(inspector.ArtifactError, match="non attribué"):
            _profile(verified_on="")

    def test_a_valid_profile_carries_the_verifier_identity(self) -> None:
        profile = _profile()
        assert profile.verified_by == "opérateur de test"
        assert profile.verified_on == "2026-07-26"


# ---------------------------------------------------------------------------
# Inspection — un constat, jamais une interprétation
# ---------------------------------------------------------------------------


class TestInspectWorkbook:
    def test_sheet_names_are_reported_verbatim(self) -> None:
        raw = _workbook_bytes({"Feuille1": [["a", "b"]], "Feuille2": [["c"]]})

        result = inspector.inspect_workbook(raw)

        assert result.sheet_names == ("Feuille1", "Feuille2")

    def test_headers_are_the_real_first_row(self) -> None:
        raw = _workbook_bytes({
            "Data": [["spatialUnitIdentifier", "year", "quarter", "wei_plus_pct"], ["X1", 2020, "Q1", 12.3]],
        })

        result = inspector.inspect_workbook(raw)

        assert result.headers_by_sheet["Data"] == (
            "spatialUnitIdentifier", "year", "quarter", "wei_plus_pct",
        )

    def test_no_macro_in_a_plain_workbook(self) -> None:
        raw = _workbook_bytes({"Data": [["a"]]})

        assert inspector.inspect_workbook(raw).has_macro_indicators is False

    def test_macro_project_entry_is_detected(self) -> None:
        """Ajoute une entrée `xl/vbaProject.bin` à un classeur zip réel —
        signature suffisante, sans écrire un vrai projet VBA."""
        raw = _workbook_bytes({"Data": [["a"]]})
        buffer = io.BytesIO(raw)
        with zipfile.ZipFile(buffer, "a") as archive:
            archive.writestr("xl/vbaProject.bin", b"\x00")

        assert inspector.has_macro_indicators(buffer.getvalue()) is True

    def test_non_zip_container_is_not_verifiable(self) -> None:
        with pytest.raises(inspector.ArtifactError, match="non-zip"):
            inspector.has_macro_indicators(b"\xd0\xcf\x11\xe0not-a-zip")


# ---------------------------------------------------------------------------
# Conversion — refuse sans profil, convertit correctement avec
# ---------------------------------------------------------------------------


class TestConvertToCanonicalCsv:
    def test_refuses_without_a_verified_profile(self) -> None:
        raw = _workbook_bytes({"Data": [["a"]]})

        with pytest.raises(inspector.ArtifactError, match="manual_artifact_converter_required"):
            inspector.convert_to_canonical_csv(raw, release_key="jamais-declaree")

    def test_converts_with_a_synthetic_profile(self, monkeypatch: pytest.MonkeyPatch) -> None:
        profile = _profile(release_key="synthetic-test-release")
        monkeypatch.setitem(inspector.MAPPING_PROFILES, profile.release_key, profile)
        raw = _workbook_bytes({
            "Data": [
                ["spatialUnitIdentifier", "year", "quarter", "wei_plus_pct", "unit"],
                ["FR001", 2020, "Q1", "12.3", "%"],
                ["FR001", 2020, "Q2", "14.1", "%"],
            ],
        })

        csv_text = inspector.convert_to_canonical_csv(raw, release_key=profile.release_key)

        assert csv_text.splitlines()[0] == "spatialUnitIdentifier,year,quarter,wei_plus_pct,unit"
        assert "FR001,2020,Q1,12.3,%" in csv_text

    def test_converted_csv_round_trips_through_the_real_connector(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Le CSV produit n'est pas seulement bien formé : il est accepté par
        `eea_wei_plus.parse_wei_plus_csv`, le même parseur que la production."""
        profile = _profile(release_key="synthetic-round-trip")
        monkeypatch.setitem(inspector.MAPPING_PROFILES, profile.release_key, profile)
        raw = _workbook_bytes({
            "Data": [
                ["spatialUnitIdentifier", "year", "quarter", "wei_plus_pct", "unit"],
                ["FR001", 2020, "Q1", "12.3", "%"],
            ],
        })

        csv_text = inspector.convert_to_canonical_csv(raw, release_key=profile.release_key)
        config = wei.WeiPlusReleaseConfig(
            release_key="synthetic-round-trip-fixture", retrieved_at=date(2026, 2, 1),
        )
        parsed = wei.parse_wei_plus_csv(csv_text, config=config)

        assert parsed.rows_total == 1
        assert parsed.rows[0].spatial_unit_id == "FR001"

    def test_missing_sheet_is_refused_with_real_sheet_names(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        profile = _profile(release_key="missing-sheet-test", sheet_name="AutreFeuille")
        monkeypatch.setitem(inspector.MAPPING_PROFILES, profile.release_key, profile)
        raw = _workbook_bytes({"Data": [["a"]]})

        with pytest.raises(inspector.ArtifactError, match="AutreFeuille"):
            inspector.convert_to_canonical_csv(raw, release_key=profile.release_key)

    def test_missing_column_is_refused_with_real_headers(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        profile = _profile(release_key="missing-column-test")
        monkeypatch.setitem(inspector.MAPPING_PROFILES, profile.release_key, profile)
        raw = _workbook_bytes({
            "Data": [["spatialUnitIdentifier", "year"]],  # quarter/wei_plus_pct absents
        })

        with pytest.raises(inspector.ArtifactError, match="quarter"):
            inspector.convert_to_canonical_csv(raw, release_key=profile.release_key)

    def test_never_guesses_a_unit_when_the_profile_has_none(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """`unit_column=None` : l'unité vient d'`EXPECTED_UNIT`, jamais
        devinée depuis une colonne absente du classeur."""
        profile = _profile(release_key="no-unit-column-test", unit_column=None)
        monkeypatch.setitem(inspector.MAPPING_PROFILES, profile.release_key, profile)
        raw = _workbook_bytes({
            "Data": [
                ["spatialUnitIdentifier", "year", "quarter", "wei_plus_pct"],
                ["FR001", 2020, "Q1", "12.3"],
            ],
        })

        csv_text = inspector.convert_to_canonical_csv(raw, release_key=profile.release_key)

        assert "FR001,2020,Q1,12.3,%" in csv_text


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

    def test_module_imports_no_network_or_database_client(self) -> None:
        forbidden = {
            "requests", "httpx", "urllib", "urllib3", "socket", "aiohttp",
            "db", "psycopg", "psycopg2",
        }
        assert not (self._imported_roots(MODULE_PATH) & forbidden)
