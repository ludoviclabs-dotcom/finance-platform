"""
test_water_intelligence_source_catalog.py — parseur PUR du catalogue de
sources Water Intelligence (P01b).

AUCUNE base requise : `services/water_intelligence/source_catalog.py` est pur
(bibliothèque standard uniquement) — ces tests tournent dans le job `tests`
standard, sans DATABASE_URL.

Couvre : le fichier réel `SOURCE_CATALOG_NORMALIZED_V1.csv` (16 entrées, 12
`user_csv` + 4 `recommended_addition`), doublon de `source_code`, colonne
manquante, colonne inattendue, `origin` invalide, cellule obligatoire vide,
mauvaise répartition 12/4, conservation verbatim de `unknown` pour
`official_domain`/`license_status`, et déterminisme du parseur.
"""

from __future__ import annotations

import csv
import io
from pathlib import Path

import pytest

from services.water_intelligence.source_catalog import (
    REQUIRED_COLUMNS,
    SourceCatalogValidationError,
    load_source_catalog,
    parse_source_catalog_csv,
    validate_catalog_shape,
)

# apps/api/tests/<this file> -> repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
REAL_CATALOG_PATH = (
    REPO_ROOT
    / "docs"
    / "carbonco"
    / "water-intelligence"
    / "SOURCE_CATALOG_NORMALIZED_V1.csv"
)


def _row(**overrides: str) -> dict[str, str]:
    base = {
        "origin": "user_csv",
        "source_code": "TEST_CODE",
        "portal_name": "Test Portal",
        "theme": "Test theme",
        "geographic_scope": "France",
        "source_role": "test_role",
        "connector_candidate": "catalog_only",
        "access_mode": "metadata_only",
        "official_domain": "unknown",
        "license_status": "unknown",
        "priority": "P0",
        "planned_prompt": "P01",
        "notes": "Fixture de test.",
    }
    base.update(overrides)
    return base


def _csv_from_rows(rows: list[dict[str, str]]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=REQUIRED_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


class TestRealCatalogFile:
    def test_parses_to_16_entries_with_expected_split(self) -> None:
        result = load_source_catalog(REAL_CATALOG_PATH)

        assert result.total == 16
        assert result.origin_counts == {"user_csv": 12, "recommended_addition": 4}
        assert len({e.source_code for e in result.entries}) == 16

    def test_shape_validation_passes_for_current_expected_distribution(self) -> None:
        result = load_source_catalog(REAL_CATALOG_PATH)

        validate_catalog_shape(
            result,
            expected_origin_counts={"user_csv": 12, "recommended_addition": 4},
            expected_total=16,
        )  # ne lève rien = succès


class TestDeterminism:
    def test_same_bytes_yield_equal_results(self) -> None:
        csv_text = _csv_from_rows([_row(source_code="A"), _row(source_code="B")])

        first = parse_source_catalog_csv(csv_text)
        second = parse_source_catalog_csv(csv_text)

        assert first == second


class TestValidationFailures:
    def test_duplicate_source_code_is_rejected(self) -> None:
        csv_text = _csv_from_rows(
            [_row(source_code="DUPLICATE"), _row(source_code="DUPLICATE")]
        )

        with pytest.raises(SourceCatalogValidationError, match="doublon"):
            parse_source_catalog_csv(csv_text)

    def test_missing_column_is_rejected(self) -> None:
        columns = [c for c in REQUIRED_COLUMNS if c != "notes"]
        csv_text = ",".join(columns) + "\n" + ",".join(["x"] * len(columns)) + "\n"

        with pytest.raises(SourceCatalogValidationError, match="manquante"):
            parse_source_catalog_csv(csv_text)

    def test_unexpected_column_is_rejected(self) -> None:
        columns = list(REQUIRED_COLUMNS) + ["extra_field"]
        csv_text = ",".join(columns) + "\n" + ",".join(["x"] * len(columns)) + "\n"

        with pytest.raises(SourceCatalogValidationError, match="inattendue"):
            parse_source_catalog_csv(csv_text)

    def test_invalid_origin_is_rejected(self) -> None:
        csv_text = _csv_from_rows([_row(origin="not_a_valid_origin")])

        with pytest.raises(SourceCatalogValidationError, match="origin invalide"):
            parse_source_catalog_csv(csv_text)

    def test_empty_required_cell_is_rejected(self) -> None:
        csv_text = _csv_from_rows([_row(theme="")])

        with pytest.raises(SourceCatalogValidationError, match="vide ou manquante"):
            parse_source_catalog_csv(csv_text)

    def test_wrong_12_4_distribution_is_rejected_by_shape_validator(self) -> None:
        rows = [_row(origin="user_csv", source_code=f"U{i}") for i in range(11)]
        rows += [
            _row(origin="recommended_addition", source_code=f"R{i}") for i in range(5)
        ]
        result = parse_source_catalog_csv(_csv_from_rows(rows))
        assert result.total == 16  # même total, répartition erronée (11/5 au lieu de 12/4)

        with pytest.raises(SourceCatalogValidationError, match="user_csv"):
            validate_catalog_shape(
                result,
                expected_origin_counts={"user_csv": 12, "recommended_addition": 4},
            )


class TestUnknownIsPreservedVerbatim:
    def test_unknown_domain_and_license_are_not_rejected_or_altered(self) -> None:
        csv_text = _csv_from_rows(
            [_row(official_domain="unknown", license_status="unknown")]
        )

        result = parse_source_catalog_csv(csv_text)

        entry = result.entries[0]
        assert entry.official_domain == "unknown"
        assert entry.license_status == "unknown"
