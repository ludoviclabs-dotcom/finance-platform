"""
connectors/eea_wei_plus.py — connecteur EEA / WISE / WEI+ (P06).

Périmètre : lecture d'un extrait tabulaire *fourni par un opérateur* du jeu
« Water Exploitation Index plus (WEI+) » de l'Agence européenne pour
l'environnement, normalisation vers les contrats P02 via le pipeline P03.
**Aucun réseau** : ce module n'importe aucun client HTTP et ne télécharge
rien ; l'opérateur fournit les octets. Aucune écriture en base, aucun
frontend, aucune publication — `run_pipeline` reste en dry-run.

Le WEI+ mesure la rareté hydrique STRUCTURELLE et SAISONNIÈRE (consommation
rapportée à la ressource renouvelable, par trimestre). Il est distinct d'un
indicateur de sécheresse COURANTE (Copernicus EDO, P09) : les deux ne sont
jamais fusionnés ni comparés terme à terme.

## Faits VÉRIFIÉS sur la source (cf. handoffs/WAVE_A_EU_CONNECTORS.md §2)

Deux releases sœurs, publiées le 29 janvier 2026, édition « 01.00 » :

  - « Water Exploitation Index plus (WEI+) at sub unit level, 2023 »
    `eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00`
    DOI 10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba
  - « Water Exploitation Index plus (WEI+) at river basin level, 2023 »
    `eea_v_3035_250_k_wei-riverbasin-level_p_2023_v01_r00`
    DOI 10.2909/f25b4715-d18b-4f87-b869-7e96fd385700

  - étendue temporelle : 2000-01-01 → 2023-12-31, moyennes TRIMESTRIELLES ;
  - vocabulaire de trimestre, verbatim de la fiche officielle :
    « Q1: Jan., Feb., Mar. / Q2: Apr., May, Jun. / Q3: Jul., Aug., Sep. /
    Q4: Oc., Nov., Dec. » ;
  - unité : pourcentage — « total water consumption as a percentage of the
    renewable freshwater resources available » ;
  - seuils officiels : au-dessus de 20 % la ressource est « under stress »,
    au-dessus de 40 % le stress est « severe » ;
  - identifiant de jointure : `spatialUnitIdentifier` côté tableur,
    `thematicId` côté SHP — jamais un libellé ;
  - référentiel spatial : EPSG:3035, échelle équivalente 1:250 000 ;
  - licence : « License CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
    Copyright holder: European Environment Agency (EEA). », accès public sans
    limitation. Stockage, affichage et usage dérivé sont donc permis SOUS
    RÉSERVE d'attribution — mais la porte de licence du pipeline reste
    pilotée par l'appelant, jamais supposée permissive ici (cf. P03 §5.5).

## Faits NON vérifiés — conservés `unknown`, jamais comblés

1. **Le vocabulaire d'en-tête du tableur officiel.** Seul le nom du champ de
   jointure (`spatialUnitIdentifier`) est documenté ; les noms exacts des
   colonnes d'année, de trimestre et de valeur ne le sont pas. Ce module ne
   les devine donc pas : il définit un format tabulaire CANONIQUE explicite
   (`CANONICAL_COLUMNS` ci-dessous) et la conversion depuis le classeur
   d'origine reste un geste opérateur documenté — même choix qu'en P05 pour
   le conteneur WRI.
2. **Les libellés officiels des unités spatiales.** Aucun n'est repris : le
   `label` d'une géographie est l'identifiant lui-même. C'est volontaire —
   c'est ce qui rend une jointure par nom structurellement impossible.

## Invariants tenus ici

  - release toujours nommée explicitement, aucun « latest » implicite ;
  - schéma clos : toute colonne hors `CANONICAL_COLUMNS` est refusée ;
  - jointure uniquement sur `spatialUnitIdentifier`, jamais sur un libellé ;
  - saison conservée : le trimestre est porté par le `metric_code` ET par
    la date d'observation (premier jour du trimestre) ;
  - période bornée à l'étendue publiée de la release — une année hors
    2000-2023 est refusée, jamais extrapolée ;
  - unité vérifiée : une unité déclarée différente de `%` est refusée ;
  - valeur absente conservée absente — jamais convertie en `0` ;
  - stress, saisonnalité, couverture et confiance restent quatre choses
    distinctes (cf. §« agrégat » ci-dessous) ;
  - aucune moyenne inter-bassins : le WEI+ est un RATIO, on n'en fait jamais
    la moyenne arithmétique entre unités sans pondération par les volumes,
    que cette release ne publie pas. L'agrégat UE est donc une DISTRIBUTION
    DE COMPTES, jamais une valeur moyenne (`WeiPlusPeriodAggregate`) ;
  - chaque erreur ATTENDUE porte le type que le pipeline capture au stage
    concerné : `WeiPlusError` (→ `AdapterError`) en `parse`/`normalize`,
    `WeiPlusGeographyUnavailableError` (→ `PipelineDataUnavailableError`) en
    `derive` (contrat P03 §5.4).
"""

from __future__ import annotations

import csv
import hashlib
import io
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Literal

from models.analytics import MethodRef
from models.water_intelligence import (
    WaterGeoLayerDescriptor,
    WaterGeographyRef,
    WaterSourceReference,
)
from services.intelligence.adapters.base import AdapterError, ObservationDraft
from services.water_intelligence.pipeline import (
    PipelineDataUnavailableError,
    TextPageDecoder,
)

# ---------------------------------------------------------------------------
# Identité de la source — valeurs VÉRIFIÉES (cf. rapport de source Wave A)
# ---------------------------------------------------------------------------

SOURCE_CODE = "EEA_WEI_PLUS"

LICENSE_CODE = "CC-BY-4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
COPYRIGHT_HOLDER = "European Environment Agency (EEA)"

#: Méthode de CE connecteur (recopie fidèle), distincte de la méthodologie
#: WEI+ elle-même : il ne recalcule aucun indice.
METHOD = MethodRef(code="CC-WI-EEA-WEI-PLUS-PASSTHROUGH", version="1.0.0")

#: Décodeur de page (P03B) : l'extrait opérateur est du texte CSV en UTF-8
#: explicite. À passer tel quel à `run_pipeline(decoder=...)`.
PAGE_DECODER = TextPageDecoder()

#: Le WEI+ est un indicateur MODÉLISÉ (comblement de lacunes sur les
#: prélèvements, retours modélisés à partir des capacités de stations
#: d'épuration, apports Copernicus pour les débits sortants). Revendiquer
#: `observed` serait faux.
DEFAULT_DATA_STATUS = "modelled"

WeiPlusScale = Literal["subunit", "riverbasin"]


@dataclass(frozen=True)
class WeiPlusDatasetRelease:
    """Identité VÉRIFIÉE d'une release publiée par l'EEA."""

    scale: WeiPlusScale
    title: str
    dataset_code: str
    edition: str
    doi: str
    published_at: date
    coverage_start: date
    coverage_end: date
    crs: str
    scale_denominator: int


#: Les deux releases inspectées. Toute autre échelle est refusée : ce module
#: ne connaît que ce qu'il a vérifié.
DATASET_RELEASES: dict[str, WeiPlusDatasetRelease] = {
    "subunit": WeiPlusDatasetRelease(
        scale="subunit",
        title="Water Exploitation Index plus (WEI+) at sub unit level, 2023",
        dataset_code="eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00",
        edition="01.00",
        doi="10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba",
        published_at=date(2026, 1, 29),
        coverage_start=date(2000, 1, 1),
        coverage_end=date(2023, 12, 31),
        crs="EPSG:3035",
        scale_denominator=250_000,
    ),
    "riverbasin": WeiPlusDatasetRelease(
        scale="riverbasin",
        title="Water Exploitation Index plus (WEI+) at river basin level, 2023",
        dataset_code="eea_v_3035_250_k_wei-riverbasin-level_p_2023_v01_r00",
        edition="01.00",
        doi="10.2909/f25b4715-d18b-4f87-b869-7e96fd385700",
        published_at=date(2026, 1, 29),
        coverage_start=date(2000, 1, 1),
        coverage_end=date(2023, 12, 31),
        crs="EPSG:3035",
        scale_denominator=250_000,
    ),
}

# ---------------------------------------------------------------------------
# Schéma canonique — défini par CE connecteur, pas par l'EEA (cf. docstring)
# ---------------------------------------------------------------------------

#: Nom officiel du champ de jointure, repris verbatim de la fiche EEA.
IDENTIFIER_COLUMN = "spatialUnitIdentifier"
YEAR_COLUMN = "year"
QUARTER_COLUMN = "quarter"
VALUE_COLUMN = "wei_plus_pct"
#: Colonne d'unité FACULTATIVE : si l'extrait la porte, elle doit valoir `%`.
#: Sa présence protège contre l'ingestion silencieuse d'un export réexprimé
#: dans une autre unité.
UNIT_COLUMN = "unit"

REQUIRED_COLUMNS: tuple[str, ...] = (
    IDENTIFIER_COLUMN,
    YEAR_COLUMN,
    QUARTER_COLUMN,
    VALUE_COLUMN,
)
CANONICAL_COLUMNS: tuple[str, ...] = REQUIRED_COLUMNS + (UNIT_COLUMN,)

#: Unité vérifiée de l'indicateur.
EXPECTED_UNIT = "%"

#: Vocabulaire de trimestre VÉRIFIÉ, avec les mois couverts.
QUARTER_MONTHS: dict[str, tuple[int, int]] = {
    "Q1": (1, 3),
    "Q2": (4, 6),
    "Q3": (7, 9),
    "Q4": (10, 12),
}

#: Seuils OFFICIELS, cités dans les métadonnées de méthode plutôt que
#: dupliqués dans une vue (interdiction de figer un seuil dans le JSX).
STRESS_THRESHOLD_PCT = 20.0
SEVERE_THRESHOLD_PCT = 40.0

#: Bandes de stress. Vocabulaire dérivé des seuils vérifiés, JAMAIS une
#: conclusion réglementaire ni un classement sanitaire.
STRESS_BAND_BELOW = "at_or_below_stress_threshold"
STRESS_BAND_STRESS = "above_stress_threshold"
STRESS_BAND_SEVERE = "above_severe_threshold"

#: Marqueurs textuels d'absence rencontrés dans les extraits tabulaires.
_BLANK_MARKERS = {"", "na", "n/a", "nan", "null", "none"}

#: Budget de couche cartographique (P02 : 1 000 entités simultanées max).
MAX_LAYER_FEATURES = 1000

#: Borne du comparatif temporel — aucun historique complet non borné.
MAX_COMPARISON_PERIODS = 8

_ONE_DAY = timedelta(days=1)


class WeiPlusError(AdapterError):
    """Erreur du connecteur — jamais un échec silencieux.

    Hérite d'`AdapterError` (P03C) : une erreur de format/schéma/contenu
    levée pendant `parse` ou `normalize` est ainsi capturée par
    `run_pipeline()` et transformée en `PipelineExecutionReport`."""


class WeiPlusSchemaError(WeiPlusError):
    """L'extrait ne respecte pas le schéma canonique vérifié."""


class WeiPlusReleaseError(WeiPlusError):
    """Release absente, vide ou non nommée — aucun « latest » implicite."""


class WeiPlusBudgetError(WeiPlusError):
    """Une borne documentée (entités de couche, périodes comparées) est
    dépassée — refus explicite plutôt que troncature silencieuse."""


class WeiPlusGeographyUnavailableError(PipelineDataUnavailableError):
    """Unité spatiale non résolue au stage `derive`.

    Hérite de `PipelineDataUnavailableError`, PAS d'`AdapterError` : c'est le
    seul type que `derive_observations()` capture autour du résolveur
    (contrat P03 §5.4). Voir la même décision côté connecteur WRI."""


# ---------------------------------------------------------------------------
# Configuration de release — toujours explicite
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WeiPlusReleaseConfig:
    """Identité d'un extrait fourni par l'opérateur.

    `release_key` est OBLIGATOIRE et doit être explicite : ce connecteur
    refuse toute notion de « dernière version » implicite, qui rendrait un
    build non reproductible.
    """

    release_key: str
    retrieved_at: date
    scale: WeiPlusScale = "subunit"
    data_status: str = DEFAULT_DATA_STATUS
    is_fixture: bool = False

    def __post_init__(self) -> None:
        key = (self.release_key or "").strip()
        if not key:
            raise WeiPlusReleaseError(
                "release_key obligatoire : aucune release anonyme ni « latest » implicite."
            )
        if key.lower() in {"latest", "current", "head"}:
            raise WeiPlusReleaseError(
                f"release_key={self.release_key!r} interdit : une release doit être "
                "nommée/versionnée pour rester reproductible."
            )
        if self.scale not in DATASET_RELEASES:
            raise WeiPlusSchemaError(
                f"échelle {self.scale!r} inconnue : seules {sorted(DATASET_RELEASES)} "
                "ont été vérifiées."
            )

    @property
    def dataset(self) -> WeiPlusDatasetRelease:
        return DATASET_RELEASES[self.scale]

    def attribution(self) -> str:
        """Attribution COMPOSÉE à partir des faits vérifiés (titre, édition,
        DOI, licence, détenteur des droits). L'EEA ne publie pas de gabarit
        d'attribution imposé pour ce jeu — contrairement à WRI Aqueduct : ce
        libellé est donc construit ici, il n'est pas cité comme officiel.
        """
        dataset = self.dataset
        return (
            f"Source: {COPYRIGHT_HOLDER} — {dataset.title}, edition {dataset.edition}, "
            f"DOI {dataset.doi}, {LICENSE_CODE} ({LICENSE_URL}), "
            f"accessed on {self.retrieved_at.isoformat()}"
        )


# ---------------------------------------------------------------------------
# Structures parsées
# ---------------------------------------------------------------------------


def quarter_period(year: int, quarter: str) -> tuple[date, date]:
    """Bornes du trimestre, dérivées du vocabulaire officiel vérifié."""
    first_month, last_month = QUARTER_MONTHS[quarter]
    start = date(year, first_month, 1)
    if last_month == 12:
        end = date(year, 12, 31)
    else:
        end = date(year, last_month + 1, 1) - _ONE_DAY
    return start, end


def stress_band(value_pct: float | None) -> str | None:
    """Bande de stress d'une valeur, ou `None` si la valeur est absente.

    Absent n'est JAMAIS traduit en « pas de stress » : une unité sans mesure
    reste sans bande (règle « absent ≠ zéro », « aucune correspondance ≠
    risque faible »). Les comparaisons sont strictes, conformément au
    libellé officiel « values above 20% / above 40% ».
    """
    if value_pct is None:
        return None
    if value_pct > SEVERE_THRESHOLD_PCT:
        return STRESS_BAND_SEVERE
    if value_pct > STRESS_THRESHOLD_PCT:
        return STRESS_BAND_STRESS
    return STRESS_BAND_BELOW


@dataclass(frozen=True)
class WeiPlusRow:
    """Une valeur WEI+ pour une unité spatiale et un trimestre.

    `value_pct=None` signifie « non renseigné par la source », jamais zéro.
    """

    spatial_unit_id: str
    year: int
    quarter: str
    value_pct: float | None

    @property
    def period(self) -> tuple[date, date]:
        return quarter_period(self.year, self.quarter)

    @property
    def stress_band(self) -> str | None:
        return stress_band(self.value_pct)

    @property
    def period_key(self) -> tuple[int, str]:
        return (self.year, self.quarter)


@dataclass
class WeiPlusParseResult:
    rows: list[WeiPlusRow] = field(default_factory=list)
    input_checksum: str = ""
    columns_seen: tuple[str, ...] = ()
    #: Comptages FACTUELS sur l'extrait, jamais une couverture inventée.
    rows_total: int = 0
    values_present: int = 0
    values_absent: int = 0
    warnings: list[str] = field(default_factory=list)

    @property
    def spatial_units(self) -> tuple[str, ...]:
        """Unités spatiales distinctes, dans un ordre déterministe."""
        return tuple(sorted({row.spatial_unit_id for row in self.rows}))

    @property
    def periods(self) -> tuple[tuple[int, str], ...]:
        return tuple(sorted({row.period_key for row in self.rows}))


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _parse_text(raw: str | None) -> str | None:
    if raw is None:
        return None
    text = raw.strip()
    return text or None


def _parse_value(raw: str | None) -> float | None:
    """`None` pour toute valeur absente. Ne renvoie JAMAIS 0.0 par défaut."""
    if raw is None:
        return None
    text = raw.strip()
    if text.lower() in _BLANK_MARKERS:
        return None
    try:
        return float(text)
    except ValueError as exc:
        raise WeiPlusSchemaError(f"valeur WEI+ illisible : {raw!r}") from exc


def parse_wei_plus_csv(
    csv_text: str,
    *,
    config: WeiPlusReleaseConfig,
) -> WeiPlusParseResult:
    """Parse un extrait canonique WEI+ (format long : une ligne par unité et
    par trimestre).

    Déterministe : mêmes octets → mêmes lignes et même `input_checksum`.
    Refuse un en-tête hors schéma canonique, une unité incompatible, une
    période hors de l'étendue publiée, un identifiant absent et un doublon
    (unité, année, trimestre).
    """
    checksum = hashlib.sha256(csv_text.encode("utf-8")).hexdigest()
    reader = csv.DictReader(io.StringIO(csv_text))
    columns = tuple(reader.fieldnames or ())
    if not columns:
        raise WeiPlusSchemaError("fichier sans en-tête : schéma non vérifiable.")

    _reject_unknown_columns(columns)
    _require_columns(columns)

    dataset = config.dataset
    result = WeiPlusParseResult(input_checksum=checksum, columns_seen=columns)
    seen: set[tuple[str, int, str]] = set()

    for line_number, raw_row in enumerate(reader, start=2):
        spatial_unit_id = _parse_text(raw_row.get(IDENTIFIER_COLUMN))
        if not spatial_unit_id:
            raise WeiPlusSchemaError(
                f"ligne {line_number} : {IDENTIFIER_COLUMN!r} absent — une jointure "
                "par libellé n'est jamais autorisée en repli."
            )

        year = _parse_year(raw_row.get(YEAR_COLUMN), line_number, dataset)
        quarter = _parse_quarter(raw_row.get(QUARTER_COLUMN), line_number)
        _check_unit(raw_row.get(UNIT_COLUMN) if UNIT_COLUMN in columns else None, line_number)

        key = (spatial_unit_id, year, quarter)
        if key in seen:
            raise WeiPlusSchemaError(
                f"ligne {line_number} : doublon ({spatial_unit_id}, {year}, {quarter}) — "
                "un extrait ne peut porter deux valeurs pour la même unité et la même "
                "période sans règle d'arbitrage documentée."
            )
        seen.add(key)

        value = _parse_value(raw_row.get(VALUE_COLUMN))
        if value is None:
            result.values_absent += 1
        else:
            result.values_present += 1

        result.rows.append(
            WeiPlusRow(
                spatial_unit_id=spatial_unit_id,
                year=year,
                quarter=quarter,
                value_pct=value,
            )
        )

    result.rows_total = len(result.rows)
    if result.rows_total == 0:
        raise WeiPlusReleaseError(
            "extrait vide : aucune ligne — release refusée plutôt que publiée vide."
        )
    if result.values_absent:
        result.warnings.append(
            f"{result.values_absent} valeur(s) absente(s) conservée(s) comme absentes "
            "(jamais converties en 0, jamais interprétées comme « pas de stress »)."
        )
    return result


def _reject_unknown_columns(columns: Iterable[str]) -> None:
    unknown = [col for col in columns if col not in CANONICAL_COLUMNS]
    if unknown:
        raise WeiPlusSchemaError(
            f"colonne(s) hors schéma canonique WEI+ : {unknown} — schéma inconnu "
            f"refusé (colonnes acceptées : {list(CANONICAL_COLUMNS)})."
        )


def _require_columns(columns: Iterable[str]) -> None:
    present = set(columns)
    missing = [col for col in REQUIRED_COLUMNS if col not in present]
    if missing:
        raise WeiPlusSchemaError(f"colonne(s) obligatoire(s) manquante(s) : {missing}")


def _parse_year(raw: str | None, line_number: int, dataset: WeiPlusDatasetRelease) -> int:
    text = _parse_text(raw)
    if not text:
        raise WeiPlusSchemaError(
            f"ligne {line_number} : année absente — la période est obligatoire, "
            "aucune date substituée."
        )
    try:
        year = int(text)
    except ValueError as exc:
        raise WeiPlusSchemaError(f"ligne {line_number} : année illisible {raw!r}") from exc
    if not (dataset.coverage_start.year <= year <= dataset.coverage_end.year):
        raise WeiPlusSchemaError(
            f"ligne {line_number} : année {year} hors de l'étendue publiée de la "
            f"release ({dataset.coverage_start.year}-{dataset.coverage_end.year}) — "
            "aucune extrapolation."
        )
    return year


def _parse_quarter(raw: str | None, line_number: int) -> str:
    text = _parse_text(raw)
    if not text:
        raise WeiPlusSchemaError(
            f"ligne {line_number} : trimestre absent — la saison est obligatoire, "
            "jamais aplatie en valeur annuelle."
        )
    quarter = text.upper()
    if quarter not in QUARTER_MONTHS:
        raise WeiPlusSchemaError(
            f"ligne {line_number} : trimestre {raw!r} hors vocabulaire officiel "
            f"{sorted(QUARTER_MONTHS)}."
        )
    return quarter


def _check_unit(raw: str | None, line_number: int) -> None:
    text = _parse_text(raw)
    if text is None:
        return
    if text != EXPECTED_UNIT:
        raise WeiPlusSchemaError(
            f"ligne {line_number} : unité {text!r} incompatible — le WEI+ est publié "
            f"en {EXPECTED_UNIT!r}, aucune conversion n'est devinée."
        )


# ---------------------------------------------------------------------------
# Agrégat UE — distribution de comptes, JAMAIS une moyenne de ratios
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WeiPlusPeriodAggregate:
    """Agrégat déterministe pour une période, à l'échelle du jeu fourni.

    Ne porte VOLONTAIREMENT aucune valeur moyenne : le WEI+ est un ratio
    (consommation / ressource renouvelable). En faire la moyenne arithmétique
    entre unités spatiales supposerait une pondération par les volumes, que
    cette release ne publie pas — ce serait un chiffre inventé. L'agrégat
    publiable est donc une distribution de COMPTES, plus la couverture.

    `coverage_pct` (part d'unités renseignées) et le stress sont deux
    dimensions distinctes : une couverture faible n'est jamais un stress
    faible.
    """

    year: int
    quarter: str
    units_total: int
    units_with_value: int
    units_without_value: int
    units_above_stress_threshold: int
    units_above_severe_threshold: int

    @property
    def coverage_pct(self) -> float | None:
        """Part d'unités renseignées, ou `None` si le lot est vide."""
        if self.units_total == 0:
            return None
        return round(self.units_with_value * 100.0 / self.units_total, 4)

    @property
    def period(self) -> tuple[date, date]:
        return quarter_period(self.year, self.quarter)


def aggregate_by_period(rows: Iterable[WeiPlusRow]) -> list[WeiPlusPeriodAggregate]:
    """Agrège par (année, trimestre), dans un ordre déterministe.

    Indépendant de l'ordre des lignes en entrée : mêmes lignes dans un ordre
    différent → mêmes agrégats.
    """
    buckets: dict[tuple[int, str], list[WeiPlusRow]] = {}
    for row in rows:
        buckets.setdefault(row.period_key, []).append(row)

    aggregates: list[WeiPlusPeriodAggregate] = []
    for (year, quarter) in sorted(buckets):
        bucket = buckets[(year, quarter)]
        with_value = [r for r in bucket if r.value_pct is not None]
        aggregates.append(
            WeiPlusPeriodAggregate(
                year=year,
                quarter=quarter,
                units_total=len(bucket),
                units_with_value=len(with_value),
                units_without_value=len(bucket) - len(with_value),
                units_above_stress_threshold=sum(
                    1 for r in with_value if r.stress_band in (STRESS_BAND_STRESS, STRESS_BAND_SEVERE)
                ),
                units_above_severe_threshold=sum(
                    1 for r in with_value if r.stress_band == STRESS_BAND_SEVERE
                ),
            )
        )
    return aggregates


# ---------------------------------------------------------------------------
# Comparatif temporel borné
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WeiPlusPeriodComparison:
    """Comparaison d'une unité entre deux périodes explicitement nommées.

    `delta_pct_points` est une différence de POINTS DE POURCENTAGE, jamais une
    variation relative, et vaut `None` dès qu'une des deux valeurs est
    absente — une absence ne se compare pas.
    """

    spatial_unit_id: str
    from_period: tuple[int, str]
    to_period: tuple[int, str]
    from_value_pct: float | None
    to_value_pct: float | None

    @property
    def delta_pct_points(self) -> float | None:
        if self.from_value_pct is None or self.to_value_pct is None:
            return None
        return round(self.to_value_pct - self.from_value_pct, 6)


def bounded_periods(
    rows: Iterable[WeiPlusRow], *, limit: int = MAX_COMPARISON_PERIODS
) -> tuple[tuple[int, str], ...]:
    """Périodes distinctes présentes dans l'extrait, BORNÉES.

    Au-delà de `limit`, refuse explicitement plutôt que de renvoyer une série
    complète : l'import d'un historique non borné est interdit (P06), et une
    troncature silencieuse ferait passer un extrait partiel pour un extrait
    entier.
    """
    periods = sorted({row.period_key for row in rows})
    if len(periods) > limit:
        raise WeiPlusBudgetError(
            f"{len(periods)} périodes distinctes > borne {limit} — restreindre "
            "l'extrait aux périodes nécessaires, jamais tronquer en silence."
        )
    return tuple(periods)


def compare_periods(
    rows: Iterable[WeiPlusRow],
    *,
    from_period: tuple[int, str],
    to_period: tuple[int, str],
) -> list[WeiPlusPeriodComparison]:
    """Comparatif borné entre DEUX périodes nommées, jamais un historique
    complet. L'ordre de sortie est déterministe (identifiant croissant)."""
    materialised = list(rows)
    by_key = {(r.spatial_unit_id, r.period_key): r for r in materialised}
    unit_ids = sorted({r.spatial_unit_id for r in materialised})

    comparisons: list[WeiPlusPeriodComparison] = []
    for unit_id in unit_ids:
        start = by_key.get((unit_id, from_period))
        end = by_key.get((unit_id, to_period))
        if start is None and end is None:
            continue
        comparisons.append(
            WeiPlusPeriodComparison(
                spatial_unit_id=unit_id,
                from_period=from_period,
                to_period=to_period,
                from_value_pct=start.value_pct if start is not None else None,
                to_value_pct=end.value_pct if end is not None else None,
            )
        )
    return comparisons


# ---------------------------------------------------------------------------
# Descripteur de future couche cartographique — aucune géométrie dans Git
# ---------------------------------------------------------------------------


def build_layer_descriptor(
    parse_result: WeiPlusParseResult,
    *,
    config: WeiPlusReleaseConfig,
    source: WaterSourceReference,
) -> WaterGeoLayerDescriptor:
    """Décrit la future couche sans transporter la moindre géométrie.

    `payload_bytes_gzip=None` : aucun poids n'est annoncé tant qu'aucune
    géométrie n'a été produite — un chiffre inventé serait pire qu'une
    absence. Les frontières officielles restent hors du dépôt (SHP EPSG:3035
    publié par l'EEA, échelle 1:250 000).
    """
    feature_count = len(parse_result.spatial_units)
    if feature_count > MAX_LAYER_FEATURES:
        raise WeiPlusBudgetError(
            f"{feature_count} entités > budget de couche {MAX_LAYER_FEATURES} "
            "(P02) — extrait à restreindre, jamais tronqué en silence."
        )
    return WaterGeoLayerDescriptor(
        layer_id=f"eea_wei_plus.{config.scale}.{config.release_key}",
        zoom_level="europe",
        geography=WaterGeographyRef(
            scope="europe",
            code=config.dataset.dataset_code,
            label=config.dataset.title,
        ),
        feature_count=feature_count,
        boundary_format="topojson",
        payload_bytes_gzip=None,
        source=source,
    )


# ---------------------------------------------------------------------------
# Intégration pipeline P03
# ---------------------------------------------------------------------------


def metric_code(scale: str, quarter: str, facet: str) -> str:
    """Code de métrique namespacé, PORTANT LA SAISON.

    Le stage `derive` de P03 aplatit la période sur la date d'observation
    (`period_start == period_end`). Le trimestre est donc porté ici, dans le
    code de métrique, en plus de la date d'observation (premier jour du
    trimestre) : la saison reste lisible et non ambiguë côté read model.
    """
    return f"eea_wei_plus.{scale}.{quarter.lower()}.{facet}"


def _observed_at(year: int, quarter: str) -> datetime:
    """Premier jour du trimestre observé. Jamais `datetime.now()` : la valeur
    doit rester reproductible."""
    start, _ = quarter_period(year, quarter)
    return datetime(start.year, start.month, start.day, tzinfo=timezone.utc)


def build_normalizer(config: WeiPlusReleaseConfig):
    """Retourne un `Normalizer` compatible `run_pipeline` (P03).

    Le pipeline lui passe la liste des pages décodées ; chaque page est le
    texte CSV d'un extrait opérateur.

    Une valeur absente ne produit AUCUN draft (le noyau exige au moins une
    valeur par observation) — elle n'est ni inventée, ni convertie en 0. Le
    compte des absences reste disponible via `parse_wei_plus_csv`.
    """

    def normalizer(pages: Any) -> list[ObservationDraft]:
        drafts: list[ObservationDraft] = []
        for page in pages:
            if not isinstance(page, str):
                raise WeiPlusSchemaError(
                    "page inattendue : le connecteur attend du texte CSV WEI+."
                )
            parsed = parse_wei_plus_csv(page, config=config)
            drafts.extend(_drafts_from_rows(parsed.rows, config))
        return drafts

    return normalizer


def _drafts_from_rows(
    rows: Iterable[WeiPlusRow], config: WeiPlusReleaseConfig
) -> list[ObservationDraft]:
    drafts: list[ObservationDraft] = []
    dataset = config.dataset
    status = "fixture" if config.is_fixture else config.data_status

    for row in rows:
        if row.value_pct is None:
            continue

        base_metadata = {
            "source_code": SOURCE_CODE,
            "release_key": config.release_key,
            "dataset_code": dataset.dataset_code,
            "dataset_edition": dataset.edition,
            "dataset_doi": dataset.doi,
            "scale": config.scale,
            "identifier_column": IDENTIFIER_COLUMN,
            "year": row.year,
            "quarter": row.quarter,
            "period_start": row.period[0].isoformat(),
            "period_end": row.period[1].isoformat(),
        }

        drafts.append(
            ObservationDraft(
                subject_type="eea_wei_plus_unit",
                subject_key=row.spatial_unit_id,
                metric_code=metric_code(config.scale, row.quarter, "value_pct"),
                numeric_value=row.value_pct,
                unit=EXPECTED_UNIT,
                geography_code=row.spatial_unit_id,
                observed_at=_observed_at(row.year, row.quarter),
                data_status=status,
                methodology_version=METHOD.version,
                metadata=dict(base_metadata),
            )
        )

        band = row.stress_band
        if band is not None:
            # La BANDE est transportée comme texte, avec ses seuils recopiés
            # dans les métadonnées : jamais un nombre à moyenner, jamais une
            # conclusion de conformité réglementaire.
            drafts.append(
                ObservationDraft(
                    subject_type="eea_wei_plus_unit",
                    subject_key=row.spatial_unit_id,
                    metric_code=metric_code(config.scale, row.quarter, "stress_band"),
                    text_value=band,
                    geography_code=row.spatial_unit_id,
                    observed_at=_observed_at(row.year, row.quarter),
                    data_status=status,
                    methodology_version=METHOD.version,
                    metadata={
                        **base_metadata,
                        "stress_threshold_pct": STRESS_THRESHOLD_PCT,
                        "severe_threshold_pct": SEVERE_THRESHOLD_PCT,
                        "threshold_comparison": "strictly_greater_than",
                    },
                )
            )
    return drafts


def build_geography_resolver(rows: Iterable[WeiPlusRow]):
    """Résolveur basé UNIQUEMENT sur `spatialUnitIdentifier`.

    Un code inconnu lève `WeiPlusGeographyUnavailableError` — jamais un repli
    sur un libellé, jamais une géographie inventée (contrat P03 §5.4).

    Le `label` est l'identifiant lui-même : les libellés officiels des unités
    spatiales n'ont pas été vérifiés, et n'en reprendre aucun rend une
    jointure par nom structurellement impossible.
    """
    known = {row.spatial_unit_id for row in rows}

    def resolver(code: str | None) -> WaterGeographyRef:
        if code is None or code not in known:
            raise WeiPlusGeographyUnavailableError(
                f"unité spatiale inconnue pour l'identifiant {code!r} — "
                "aucun appariement par libellé n'est autorisé."
            )
        return WaterGeographyRef(scope="europe", code=code, label=code)

    return resolver
