"""
connectors/wri_aqueduct.py — connecteur WRI Aqueduct 4.0 (P05).

Périmètre : lecture d'un extrait tabulaire *fourni par un opérateur* du jeu
« Aqueduct 4.0 Water Risk Atlas — baseline annual », normalisation vers les
contrats P02 via le pipeline P03. **Aucun réseau** : ce module n'importe
aucun client HTTP et ne télécharge rien ; l'opérateur fournit les octets.

Source inspectée (voir `docs/carbonco/water-intelligence/handoffs/P05_WRI_AQUEDUCT.md`
pour le rapport de source complet et ses limites) :
  - dépôt officiel `wri/Aqueduct40`, dictionnaire de données
    `data_dictionary_water-risk-atlas.md` ;
  - page de données WRI « Aqueduct 4.0 Current and Future Global Maps Data »,
    version 4.0, publiée le 16 août 2023 ;
  - licence CC BY 4.0, attribution « Source: WRI Aqueduct, accessed on [date] ».

Deux points N'ONT PAS pu être vérifiés et sont traités comme inconnus, jamais
comblés par une hypothèse :

1. **La correspondance `_cat` → `_label`.** Le dictionnaire officiel définit
   `_cat` comme « integer for each category [-1,4] » et `_label` comme « A
   label explaining the category of the indicator including threshold », mais
   n'énumère pas les valeurs. Ce module ne traduit donc JAMAIS une catégorie :
   `cat` et `label` sont recopiés verbatim, tels que fournis par la source.
   C'est aussi ce qu'impose l'interdiction de transformer une classe Aqueduct
   en conclusion réglementaire.
2. **Le format de conteneur exact** livré par WRI (extensions du zip). Ce
   module parse un CSV dont les COLONNES respectent le dictionnaire officiel
   vérifié ; la conversion depuis le conteneur d'origine reste un geste
   opérateur documenté.

Invariants tenus ici :
  - schéma inconnu refusé (colonne hors dictionnaire, identifiant absent) ;
  - jointure uniquement sur identifiant stable (`string_id`/`pfaf_id`/`gid_0`),
    jamais sur `name_0`/`name_1` ;
  - valeur absente conservée absente — jamais convertie en `0` ;
  - release toujours nommée explicitement, aucun « latest » implicite ;
  - risque (valeur/catégorie) et confiance documentaire restent séparés.
"""

from __future__ import annotations

import csv
import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Iterable

from models.analytics import MethodRef
from models.water_intelligence import WaterGeographyRef
from services.intelligence.adapters.base import ObservationDraft

# ---------------------------------------------------------------------------
# Identité de la source — valeurs VÉRIFIÉES (cf. rapport de source P05)
# ---------------------------------------------------------------------------

SOURCE_CODE = "WRI_AQUEDUCT"
DATASET_VERSION = "4.0"
DATASET_PUBLISHED_AT = date(2023, 8, 16)

LICENSE_CODE = "CC-BY-4.0"
ATTRIBUTION_TEMPLATE = "Source: WRI Aqueduct, accessed on {accessed_on} — https://aqueduct.wri.org"

#: Méthode de CE connecteur (recopie fidèle), distincte de la méthodologie
#: Aqueduct elle-même : il ne recalcule aucun indicateur.
METHOD = MethodRef(code="CC-WI-WRI-AQUEDUCT-PASSTHROUGH", version="1.0.0")

#: Aqueduct publie des indicateurs MODÉLISÉS, pas des mesures directes.
#: Classement conservateur : `modelled` (revendiquer `observed` serait faux).
DEFAULT_DATA_STATUS = "modelled"

# ---------------------------------------------------------------------------
# Schéma vérifié — dictionnaire officiel Aqueduct 4.0 (baseline annual)
# ---------------------------------------------------------------------------

#: Colonnes d'identifiant documentées.
IDENTIFIER_COLUMNS: tuple[str, ...] = (
    "string_id", "aq30_id", "pfaf_id", "gid_1", "aqid", "gid_0", "name_0", "name_1",
)

#: Identifiants STABLES utilisables comme clé de jointure, par ordre de
#: préférence. `name_0`/`name_1` en sont volontairement exclus : ce sont des
#: libellés, jamais des clés (invariant « aucune jointure par nom »).
STABLE_ID_COLUMNS: tuple[str, ...] = ("string_id", "pfaf_id", "gid_0")

#: Les 13 codes d'indicateurs annuels de référence.
INDICATOR_CODES: tuple[str, ...] = (
    "bws", "bwd", "iav", "sev", "gtd", "rfr", "cfr", "drr", "ucw", "cep", "udw", "usa", "rri",
)

#: Suffixes documentés et leur nature.
INDICATOR_SUFFIXES: tuple[str, ...] = ("raw", "score", "cat", "label")

#: Scénarios et horizons publiés pour les projections.
SCENARIO_CODES: tuple[str, ...] = ("bau", "opt", "pes")
HORIZON_YEARS: dict[str, int] = {"30": 2030, "50": 2050, "80": 2080}

#: Indicateur retenu pour le MVP : stress hydrique structurel (ADR P00).
DEFAULT_INDICATORS: tuple[str, ...] = ("bws",)

#: Sentinelle « données insuffisantes » documentée par la FAQ officielle
#: Aqueduct 4.0 : « A raw value of -9999 indicates insufficient data to
#: compute risk for that specific sub-basin. » Elle est convertie en `None`,
#: JAMAIS conservée comme mesure : -9999 n'est pas une valeur de stress.
NO_DATA_SENTINEL = -9999.0

#: Marqueurs textuels d'absence rencontrés dans les extraits tabulaires.
_BLANK_MARKERS = {"", "na", "n/a", "nan", "null", "none"}

_BASELINE_COLUMN_RE = re.compile(
    rf"^({'|'.join(INDICATOR_CODES)})_({'|'.join(INDICATOR_SUFFIXES)})$"
)
#: `{scenario}{year}_{indicator}_{unit}_{type}`, ex. `bau30_ws_x_r`.
#: `indicator`/`unit`/`type` restent des jetons opaques : une seule
#: combinaison a pu être vérifiée, on ne fige donc pas leur vocabulaire.
_PROJECTION_COLUMN_RE = re.compile(
    rf"^({'|'.join(SCENARIO_CODES)})({'|'.join(HORIZON_YEARS)})_([a-z]+)_([a-z]+)_([a-z]+)$"
)


class AqueductError(Exception):
    """Erreur du connecteur — jamais un échec silencieux."""


class AqueductSchemaError(AqueductError):
    """Le fichier ne respecte pas le dictionnaire Aqueduct 4.0 vérifié."""


class AqueductReleaseError(AqueductError):
    """Release absente, vide ou non nommée — aucun « latest » implicite."""


# ---------------------------------------------------------------------------
# Configuration de release — toujours explicite
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AqueductReleaseConfig:
    """Identité d'un extrait fourni par l'opérateur.

    `release_key` est OBLIGATOIRE et doit être explicite : ce connecteur
    refuse toute notion de « dernière version » implicite, qui rendrait un
    build non reproductible.
    """

    release_key: str
    retrieved_at: date
    published_at: date | None = DATASET_PUBLISHED_AT
    dataset_version: str = DATASET_VERSION
    indicators: tuple[str, ...] = DEFAULT_INDICATORS
    data_status: str = DEFAULT_DATA_STATUS
    is_fixture: bool = False

    def __post_init__(self) -> None:
        key = (self.release_key or "").strip()
        if not key:
            raise AqueductReleaseError(
                "release_key obligatoire : aucune release anonyme ni « latest » implicite."
            )
        if key.lower() in {"latest", "current", "head"}:
            raise AqueductReleaseError(
                f"release_key={self.release_key!r} interdit : une release doit être "
                "nommée/versionnée pour rester reproductible."
            )
        unknown = [i for i in self.indicators if i not in INDICATOR_CODES]
        if unknown:
            raise AqueductSchemaError(
                f"indicateur(s) hors dictionnaire Aqueduct 4.0 : {unknown}"
            )
        if not self.indicators:
            raise AqueductSchemaError("au moins un indicateur doit être demandé.")

    def attribution(self) -> str:
        return ATTRIBUTION_TEMPLATE.format(accessed_on=self.retrieved_at.isoformat())


# ---------------------------------------------------------------------------
# Structures parsées
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AqueductIndicatorValue:
    """Un indicateur pour une entité. Chaque champ peut être absent —
    `None` signifie « non renseigné par la source », jamais zéro."""

    indicator: str
    raw: float | None = None
    score: float | None = None
    category: int | None = None
    label: str | None = None

    def has_any_value(self) -> bool:
        return any(v is not None for v in (self.raw, self.score, self.category, self.label))


@dataclass(frozen=True)
class AqueductProjection:
    """Projection publiée : scénario + horizon explicites, valeur brute."""

    scenario_code: str
    horizon_year: int
    indicator: str
    unit_token: str
    type_token: str
    value: float | None
    column: str


@dataclass(frozen=True)
class AqueductRow:
    """Une entité géographique Aqueduct et ses valeurs."""

    stable_id: str
    stable_id_column: str
    identifiers: dict[str, str]
    indicators: dict[str, AqueductIndicatorValue]
    projections: tuple[AqueductProjection, ...] = ()

    @property
    def label(self) -> str:
        """Libellé lisible — jamais utilisé comme clé de jointure."""
        return self.identifiers.get("name_0") or self.stable_id


@dataclass
class AqueductParseResult:
    rows: list[AqueductRow] = field(default_factory=list)
    input_checksum: str = ""
    columns_seen: tuple[str, ...] = ()
    #: Comptages FACTUELS sur l'extrait, jamais une couverture inventée.
    rows_total: int = 0
    values_present: int = 0
    values_absent: int = 0
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _parse_float(raw: str | None) -> float | None:
    """`None` pour toute valeur absente. Ne renvoie JAMAIS 0.0 par défaut.

    La sentinelle officielle `-9999` (« insufficient data ») est traitée comme
    une absence : la laisser passer en ferait une mesure de stress fortement
    négative, exactement le genre de faux chiffre que ce module doit empêcher.
    """
    if raw is None:
        return None
    text = raw.strip()
    if text.lower() in _BLANK_MARKERS:
        return None
    try:
        value = float(text)
    except ValueError as exc:
        raise AqueductSchemaError(f"valeur numérique illisible : {raw!r}") from exc
    if value == NO_DATA_SENTINEL:
        return None
    return value


def _parse_int(raw: str | None) -> int | None:
    value = _parse_float(raw)
    if value is None:
        return None
    if value != int(value):
        raise AqueductSchemaError(f"catégorie non entière : {raw!r}")
    return int(value)


def _parse_text(raw: str | None) -> str | None:
    if raw is None:
        return None
    text = raw.strip()
    return text or None


def parse_baseline_annual_csv(
    csv_text: str,
    *,
    config: AqueductReleaseConfig,
) -> AqueductParseResult:
    """Parse un extrait CSV « baseline annual » Aqueduct 4.0.

    Déterministe : mêmes octets → mêmes lignes et même `input_checksum`.
    Refuse tout en-tête contenant une colonne hors dictionnaire officiel, et
    toute ligne dépourvue d'identifiant stable.
    """
    checksum = hashlib.sha256(csv_text.encode("utf-8")).hexdigest()
    reader = csv.DictReader(io.StringIO(csv_text))
    columns = tuple(reader.fieldnames or ())
    if not columns:
        raise AqueductSchemaError("fichier sans en-tête : schéma non vérifiable.")

    _reject_unknown_columns(columns)
    id_column = _pick_stable_id_column(columns)
    requested = tuple(config.indicators)
    _require_indicator_columns(columns, requested)

    result = AqueductParseResult(input_checksum=checksum, columns_seen=columns)

    for line_number, raw_row in enumerate(reader, start=2):
        stable_id = _parse_text(raw_row.get(id_column))
        if not stable_id:
            raise AqueductSchemaError(
                f"ligne {line_number} : identifiant stable {id_column!r} absent — "
                "aucune jointure par nom n'est autorisée en repli."
            )

        identifiers = {
            col: value
            for col in IDENTIFIER_COLUMNS
            if col in columns and (value := _parse_text(raw_row.get(col))) is not None
        }

        indicators: dict[str, AqueductIndicatorValue] = {}
        for indicator in requested:
            value = AqueductIndicatorValue(
                indicator=indicator,
                raw=_parse_float(raw_row.get(f"{indicator}_raw")),
                score=_parse_float(raw_row.get(f"{indicator}_score")),
                category=_parse_int(raw_row.get(f"{indicator}_cat")),
                # Recopié verbatim : la correspondance cat→label n'est pas
                # vérifiée, ce connecteur ne l'interprète donc jamais.
                label=_parse_text(raw_row.get(f"{indicator}_label")),
            )
            indicators[indicator] = value
            if value.has_any_value():
                result.values_present += 1
            else:
                result.values_absent += 1

        projections = tuple(_parse_projections(columns, raw_row))

        result.rows.append(
            AqueductRow(
                stable_id=stable_id,
                stable_id_column=id_column,
                identifiers=identifiers,
                indicators=indicators,
                projections=projections,
            )
        )

    result.rows_total = len(result.rows)
    if result.rows_total == 0:
        raise AqueductReleaseError(
            "extrait vide : aucune ligne — release refusée plutôt que publiée vide."
        )
    if result.values_absent:
        result.warnings.append(
            f"{result.values_absent} valeur(s) absente(s) conservée(s) comme absentes "
            "(jamais converties en 0)."
        )
    return result


def _reject_unknown_columns(columns: Iterable[str]) -> None:
    unknown = [
        col
        for col in columns
        if col not in IDENTIFIER_COLUMNS
        and not _BASELINE_COLUMN_RE.match(col)
        and not _PROJECTION_COLUMN_RE.match(col)
    ]
    if unknown:
        raise AqueductSchemaError(
            f"colonne(s) hors dictionnaire Aqueduct 4.0 : {unknown} — "
            "schéma inconnu refusé (aucune interprétation devinée)."
        )


def _pick_stable_id_column(columns: Iterable[str]) -> str:
    present = set(columns)
    for candidate in STABLE_ID_COLUMNS:
        if candidate in present:
            return candidate
    raise AqueductSchemaError(
        f"aucun identifiant stable parmi {list(STABLE_ID_COLUMNS)} — "
        "une jointure par nom (name_0/name_1) est explicitement interdite."
    )


def _require_indicator_columns(columns: Iterable[str], indicators: Iterable[str]) -> None:
    present = set(columns)
    for indicator in indicators:
        expected = {f"{indicator}_{suffix}" for suffix in INDICATOR_SUFFIXES}
        if not (expected & present):
            raise AqueductSchemaError(
                f"indicateur {indicator!r} demandé mais absent de l'extrait "
                f"(aucune colonne parmi {sorted(expected)})."
            )


def _parse_projections(columns: Iterable[str], raw_row: dict[str, Any]) -> list[AqueductProjection]:
    projections: list[AqueductProjection] = []
    for col in columns:
        match = _PROJECTION_COLUMN_RE.match(col)
        if not match:
            continue
        scenario, year_token, indicator, unit_token, type_token = match.groups()
        projections.append(
            AqueductProjection(
                scenario_code=scenario,
                horizon_year=HORIZON_YEARS[year_token],
                indicator=indicator,
                unit_token=unit_token,
                type_token=type_token,
                value=_parse_float(raw_row.get(col)),
                column=col,
            )
        )
    return projections


# ---------------------------------------------------------------------------
# Intégration pipeline P03
# ---------------------------------------------------------------------------


def metric_code(indicator: str, facet: str) -> str:
    """Code de métrique namespacé — jamais un nom de colonne brut."""
    return f"wri_aqueduct.{indicator}.{facet}"


def build_normalizer(config: AqueductReleaseConfig):
    """Retourne un `Normalizer` compatible `run_pipeline` (P03).

    Le pipeline lui passe la liste des pages décodées ; chaque page est le
    texte CSV d'un extrait opérateur.

    Une valeur absente ne produit AUCUN draft (le noyau exige au moins une
    valeur par observation) — elle n'est ni inventée, ni convertie en 0. Le
    compte des absences reste disponible via `parse_baseline_annual_csv`.
    """

    def normalizer(pages: Any) -> list[ObservationDraft]:
        drafts: list[ObservationDraft] = []
        for page in pages:
            if not isinstance(page, str):
                raise AqueductSchemaError(
                    "page inattendue : le connecteur attend du texte CSV Aqueduct."
                )
            parsed = parse_baseline_annual_csv(page, config=config)
            drafts.extend(_drafts_from_rows(parsed.rows, config))
        return drafts

    return normalizer


def _observed_at(config: AqueductReleaseConfig) -> datetime:
    """Horodatage de l'observation = date de publication de la release.

    Jamais `datetime.now()` : la valeur doit rester reproductible.
    """
    reference = config.published_at or config.retrieved_at
    return datetime(reference.year, reference.month, reference.day, tzinfo=timezone.utc)


def _drafts_from_rows(
    rows: Iterable[AqueductRow], config: AqueductReleaseConfig
) -> list[ObservationDraft]:
    drafts: list[ObservationDraft] = []
    observed_at = _observed_at(config)
    status = "fixture" if config.is_fixture else config.data_status

    for row in rows:
        base_metadata = {
            "source_code": SOURCE_CODE,
            "release_key": config.release_key,
            "dataset_version": config.dataset_version,
            "stable_id_column": row.stable_id_column,
            "identifiers": dict(row.identifiers),
        }

        for indicator, value in row.indicators.items():
            if value.raw is not None:
                drafts.append(
                    ObservationDraft(
                        subject_type="wri_aqueduct_area",
                        subject_key=row.stable_id,
                        metric_code=metric_code(indicator, "raw"),
                        numeric_value=value.raw,
                        geography_code=row.stable_id,
                        observed_at=observed_at,
                        data_status=status,
                        methodology_version=METHOD.version,
                        metadata=dict(base_metadata),
                    )
                )
            if value.score is not None:
                drafts.append(
                    ObservationDraft(
                        subject_type="wri_aqueduct_area",
                        subject_key=row.stable_id,
                        metric_code=metric_code(indicator, "score"),
                        numeric_value=value.score,
                        geography_code=row.stable_id,
                        observed_at=observed_at,
                        data_status=status,
                        methodology_version=METHOD.version,
                        metadata=dict(base_metadata),
                    )
                )
            if value.category is not None or value.label is not None:
                # La CLASSE est transportée comme texte, avec `cat` et `label`
                # recopiés verbatim dans les métadonnées : jamais un nombre à
                # moyenner, jamais une conclusion réglementaire.
                drafts.append(
                    ObservationDraft(
                        subject_type="wri_aqueduct_area",
                        subject_key=row.stable_id,
                        metric_code=metric_code(indicator, "category"),
                        text_value=value.label if value.label is not None else str(value.category),
                        geography_code=row.stable_id,
                        observed_at=observed_at,
                        data_status=status,
                        methodology_version=METHOD.version,
                        metadata={
                            **base_metadata,
                            "category_code": value.category,
                            "category_label": value.label,
                            "category_vocabulary": "unknown",
                        },
                    )
                )

        for projection in row.projections:
            if projection.value is None:
                continue
            drafts.append(
                ObservationDraft(
                    subject_type="wri_aqueduct_area",
                    subject_key=row.stable_id,
                    metric_code=metric_code(projection.indicator, f"projection.{projection.column}"),
                    numeric_value=projection.value,
                    geography_code=row.stable_id,
                    observed_at=observed_at,
                    data_status=status,
                    methodology_version=METHOD.version,
                    metadata={
                        **base_metadata,
                        "scenario_code": projection.scenario_code,
                        "horizon_year": projection.horizon_year,
                        "unit_token": projection.unit_token,
                        "type_token": projection.type_token,
                    },
                )
            )
    return drafts


def build_geography_resolver(rows: Iterable[AqueductRow]):
    """Résolveur de géographie basé UNIQUEMENT sur les identifiants stables.

    Un code inconnu lève une erreur — jamais un repli sur le nom, jamais une
    géographie inventée. Aqueduct étant mondial, l'échelle publiée est
    `world` (le niveau site reste réservé au cockpit authentifié).
    """
    labels = {row.stable_id: row.label for row in rows}

    def resolver(code: str | None) -> WaterGeographyRef:
        if code is None or code not in labels:
            raise AqueductSchemaError(
                f"géographie inconnue pour l'identifiant {code!r} — "
                "aucun appariement par nom n'est autorisé."
            )
        return WaterGeographyRef(scope="world", code=code, label=labels[code])

    return resolver
