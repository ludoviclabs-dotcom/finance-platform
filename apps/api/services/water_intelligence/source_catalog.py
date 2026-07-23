"""Parseur et validateur purs du catalogue de sources Water Intelligence.

Lit un CSV au schéma `docs/carbonco/water-intelligence/SOURCE_CATALOG_NORMALIZED_V1.csv`
et produit une structure validée, exploitable par une future ingestion. Aucune
écriture en base, aucun appel réseau, aucune dépendance hors bibliothèque
standard. Erreurs de validation explicites (`SourceCatalogValidationError`),
jamais de correction silencieuse d'un contenu ambigu.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

# Ordre = celui de SOURCE_CATALOG_NORMALIZED_V1.csv ; l'ordre des colonnes
# dans le fichier source n'est pas imposé (csv.DictReader mappe par nom).
REQUIRED_COLUMNS: tuple[str, ...] = (
    "origin",
    "source_code",
    "portal_name",
    "theme",
    "geographic_scope",
    "source_role",
    "connector_candidate",
    "access_mode",
    "official_domain",
    "license_status",
    "priority",
    "planned_prompt",
    "notes",
)

VALID_ORIGINS: frozenset[str] = frozenset({"user_csv", "recommended_addition"})

# Valeur explicitement acceptée pour les champs non vérifiés — jamais une
# absence de valeur, jamais une valeur devinée. `parse_source_catalog_csv`
# ne lui accorde aucun traitement spécial : c'est une chaîne comme une autre,
# ni remplacée ni rejetée.
UNKNOWN = "unknown"


class SourceCatalogValidationError(ValueError):
    """Le catalogue ne respecte pas le schéma ou les invariants attendus."""


@dataclass(frozen=True)
class SourceCatalogEntry:
    origin: str
    source_code: str
    portal_name: str
    theme: str
    geographic_scope: str
    source_role: str
    connector_candidate: str
    access_mode: str
    official_domain: str
    license_status: str
    priority: str
    planned_prompt: str
    notes: str


@dataclass(frozen=True)
class SourceCatalogResult:
    entries: tuple[SourceCatalogEntry, ...]
    origin_counts: Mapping[str, int]

    @property
    def total(self) -> int:
        return len(self.entries)


def parse_source_catalog_csv(csv_text: str) -> SourceCatalogResult:
    """Parse déterministe : les mêmes octets en entrée produisent toujours
    le même résultat (mêmes entrées, dans le même ordre, mêmes comptes)."""
    reader = csv.DictReader(csv_text.splitlines())
    _validate_columns(reader.fieldnames)

    entries: list[SourceCatalogEntry] = []
    seen_codes: set[str] = set()

    for line_number, row in enumerate(reader, start=2):  # ligne 1 = en-tête
        _validate_row(row, line_number)

        source_code = row["source_code"]
        if source_code in seen_codes:
            raise SourceCatalogValidationError(
                f"ligne {line_number}: source_code en doublon : {source_code!r}"
            )
        seen_codes.add(source_code)

        origin = row["origin"]
        if origin not in VALID_ORIGINS:
            raise SourceCatalogValidationError(
                f"ligne {line_number}: origin invalide {origin!r}, "
                f"attendu l'un de {sorted(VALID_ORIGINS)}"
            )

        entries.append(
            SourceCatalogEntry(**{name: row[name] for name in REQUIRED_COLUMNS})
        )

    origin_counts: dict[str, int] = {}
    for entry in entries:
        origin_counts[entry.origin] = origin_counts.get(entry.origin, 0) + 1

    return SourceCatalogResult(entries=tuple(entries), origin_counts=origin_counts)


def validate_catalog_shape(
    result: SourceCatalogResult,
    *,
    expected_origin_counts: Mapping[str, int] | None = None,
    expected_total: int | None = None,
) -> None:
    """Vérifications de forme optionnelles, explicitement paramétrées.

    N'impose aucun total ni aucune répartition par défaut : le catalogue
    grandira au fil des prompts suivants, un total figé en dur serait faux
    dès la prochaine entrée. L'appelant fournit la forme attendue pour LE
    fichier qu'il valide (ex. 12/4/16 pour `SOURCE_CATALOG_NORMALIZED_V1.csv`
    aujourd'hui) plutôt que le module ne la suppose.
    """
    if expected_total is not None and result.total != expected_total:
        raise SourceCatalogValidationError(
            f"total attendu {expected_total}, obtenu {result.total}"
        )
    if expected_origin_counts is not None:
        for origin, expected_count in expected_origin_counts.items():
            actual = result.origin_counts.get(origin, 0)
            if actual != expected_count:
                raise SourceCatalogValidationError(
                    f"origin {origin!r} : attendu {expected_count}, obtenu {actual}"
                )
        unexpected_origins = sorted(set(result.origin_counts) - set(expected_origin_counts))
        if unexpected_origins:
            raise SourceCatalogValidationError(
                f"origin(s) non attendue(s) dans la répartition : {unexpected_origins}"
            )


def load_source_catalog(path: Path) -> SourceCatalogResult:
    """Charge et parse un fichier local. Aucun appel réseau, aucune écriture."""
    return parse_source_catalog_csv(path.read_text(encoding="utf-8"))


def _validate_columns(fieldnames: Sequence[str] | None) -> None:
    present = list(fieldnames or [])
    missing = [c for c in REQUIRED_COLUMNS if c not in present]
    if missing:
        raise SourceCatalogValidationError(f"colonne(s) manquante(s) : {missing}")
    unexpected = [c for c in present if c not in REQUIRED_COLUMNS]
    if unexpected:
        raise SourceCatalogValidationError(f"colonne(s) inattendue(s) : {unexpected}")


def _validate_row(row: Mapping[str, str | None], line_number: int) -> None:
    extras = row.get(None)  # type: ignore[call-overload]
    if extras:
        raise SourceCatalogValidationError(
            f"ligne {line_number}: colonne(s) supplémentaire(s) non déclarée(s) : {extras}"
        )
    for column in REQUIRED_COLUMNS:
        value = row.get(column)
        if value is None or value.strip() == "":
            raise SourceCatalogValidationError(
                f"ligne {line_number}: valeur vide ou manquante pour la colonne "
                f"obligatoire {column!r}"
            )
