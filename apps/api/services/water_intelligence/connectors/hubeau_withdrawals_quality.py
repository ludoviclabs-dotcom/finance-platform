"""
connectors/hubeau_withdrawals_quality.py — prélèvements (BNPE) et qualité des
cours d'eau (Naïades) Hub'Eau (P08).

**Aucun réseau ici** : ce module normalise des pages déjà récupérées par le
socle borné (`hubeau_transport.py`, lui-même sans client HTTP).

## Faits VÉRIFIÉS (cf. handoffs/WAVE_B_HUBEAU.md §2)

### Prélèvements — `https://hubeau.eaufrance.fr/api/v1/prelevements/`

  - opérations : `referentiel/ouvrages`, `referentiel/points_prelevement`,
    `chroniques` (volumes ANNUELS) ;
  - identifiants : `code_ouvrage`, `code_point_prelevement` ;
  - `volume` en **m³** ; `code_usage`/`libelle_usage` ;
    `code_type_milieu`/`libelle_type_milieu` (`SOUT` = souterrain) ;
  - **limite de couverture OFFICIELLE, décisive** : « Les volumes prélevés
    pour des usages exonérés de redevance ne sont pas connus », et les
    volumes inférieurs à 10 000 m³ ne sont pas déclarés. Une année sans
    déclaration n'est donc **PAS un prélèvement nul** : c'est une absence de
    donnée. Ce module l'encode structurellement (§ « absence ≠ zéro »).

### Qualité des cours d'eau — `https://hubeau.eaufrance.fr/api/v2/qualite_rivieres/`

  - opérations : `station_pc`, `operation_pc`,
    `condition_environnementale_pc`, `analyse_pc` ;
  - champs `analyse_pc` vérifiés : `code_station`, `libelle_station`,
    `code_parametre`, `libelle_parametre`, `date_prelevement`, `resultat`,
    `symbole_unite`, `code_remarque`, `mnemo_remarque`, `code_statut`,
    `mnemo_statut`, `code_qualification`, `libelle_qualification` ;
  - les paramètres sont identifiés par leur **code SANDRE** ; codes vérifiés
    sur le référentiel SANDRE : **1340 = Nitrates**, **1339 = Nitrites**.

## Ce qui reste `unknown` — jamais comblé

1. **Le vocabulaire de `code_remarque`.** Le champ existe et est repris
   verbatim, mais la signification de chaque code n'a pas été vérifiée sur le
   référentiel SANDRE. Ce module ne décide donc JAMAIS seul qu'un résultat est
   censuré : les codes considérés comme censurants sont **déclarés par
   l'opérateur** (`censoring_remark_codes`), vides par défaut. Sans
   déclaration, la remarque est transportée telle quelle et aucune sémantique
   n'est inventée.
2. **Le nom exact du champ de limite de quantification.** Il n'a pas été
   vérifié ; `limite_quantification` est donc lu s'il est présent, jamais
   exigé, et son absence n'est pas une erreur.
3. **La qualité des NAPPES** (`qualite_nappes`) : endpoints et champs non
   vérifiés → **hors périmètre de cette vague**, conformément au
   MACRO-PROMPT B (« qualité souterraine seulement si le gate est
   concluant »). Aucun code spéculatif n'est écrit pour elle.

## Interdictions tenues ici

  - **aucun classement sanitaire**, aucune note, aucun indice de qualité ;
  - **aucune conclusion de conformité** : ce module ne connaît aucun seuil
    réglementaire et n'en applique aucun. Comparer un résultat à une limite
    juridique exige un contexte (usage, texte, période) qui appartient à P13 ;
  - **aucun agrégat entre paramètres incompatibles** : deux codes SANDRE
    différents, ou deux unités différentes, ne sont jamais additionnés ni
    moyennés ensemble ;
  - **aucune jointure par nom** : `code_station` et `code_parametre` seuls ;
  - **aucune aspiration de tous les analytes** : une allowlist explicite et
    sourcée est OBLIGATOIRE, et un paramètre hors allowlist est refusé.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Iterable, Mapping

from models.analytics import MethodRef
from models.water_intelligence import WaterGeographyRef
from services.intelligence.adapters.base import AdapterError, ObservationDraft
from services.water_intelligence.pipeline import (
    JsonPageDecoder,
    PipelineDataUnavailableError,
)

# ---------------------------------------------------------------------------
# Identité des sources
# ---------------------------------------------------------------------------

WITHDRAWALS_SOURCE_CODE = "HUBEAU_BNPE_PRELEVEMENTS"
QUALITY_SOURCE_CODE = "HUBEAU_QUALITE_SURFACE"

WITHDRAWALS_METHOD = MethodRef(code="CC-WI-HUBEAU-BNPE-PASSTHROUGH", version="1.0.0")
QUALITY_METHOD = MethodRef(code="CC-WI-HUBEAU-NAIADES-PASSTHROUGH", version="1.0.0")

PAGE_DECODER = JsonPageDecoder()

#: Un volume déclaré est une donnée déclarative, pas une mesure instrumentale.
WITHDRAWALS_DATA_STATUS = "manual"
#: Une analyse physico-chimique est une mesure de laboratoire.
QUALITY_DATA_STATUS = "observed"

VOLUME_UNIT = "m3"

#: Seuil officiel en dessous duquel un volume n'est pas déclaré. Utilisé
#: UNIQUEMENT pour documenter la couverture, jamais pour combler une absence.
UNDECLARED_VOLUME_THRESHOLD_M3 = 10_000

_BLANK_MARKERS = {"", "na", "n/a", "nan", "null", "none"}


@dataclass(frozen=True)
class SandreParameter:
    """Un paramètre d'analyse identifié par son code SANDRE VÉRIFIÉ."""

    code: str
    label: str
    source: str


#: Allowlist initiale SOURCÉE. Chaque entrée porte la référence qui l'atteste.
#: Ajouter un paramètre exige de vérifier son code sur le référentiel SANDRE —
#: jamais de code deviné, jamais d'aspiration de tous les analytes.
DEFAULT_PARAMETER_ALLOWLIST: dict[str, SandreParameter] = {
    "1340": SandreParameter(
        code="1340",
        label="Nitrates",
        source="Référentiel SANDRE des paramètres, fiche [1340] Nitrates",
    ),
    "1339": SandreParameter(
        code="1339",
        label="Nitrites",
        source="Référentiel SANDRE des paramètres, fiche [1339] Nitrites",
    ),
}


class HubeauUsageError(AdapterError):
    """Erreur métier attendue des connecteurs prélèvements/qualité.

    Hérite d'`AdapterError` (contrat P03C) : capturée par `run_pipeline()`
    aux stages `parse`/`normalize`."""


class HubeauUsageSchemaError(HubeauUsageError):
    """Réponse hors schéma officiel vérifié."""


class HubeauUsageReleaseError(HubeauUsageError):
    """Release absente, vide ou non nommée."""


class HubeauParameterRefused(HubeauUsageError):
    """Paramètre d'analyse hors allowlist sourcée — refusé plutôt qu'ingéré.

    C'est l'interdiction « aucune aspiration de tous les analytes » rendue
    structurelle : sans allowlist explicite, rien ne passe."""


class HubeauUsageGeographyUnavailableError(PipelineDataUnavailableError):
    """Ouvrage/station non résolu au stage `derive` (contrat P03 §5.4)."""


class HubeauUsagePeriodUnavailableError(PipelineDataUnavailableError):
    """Période non résolue au stage `derive` (contrat Wave A)."""


# ---------------------------------------------------------------------------
# Prélèvements — volumes annuels déclarés
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WithdrawalsReleaseConfig:
    release_key: str
    retrieved_at: date
    year_min: int
    year_max: int
    is_fixture: bool = False

    def __post_init__(self) -> None:
        key = (self.release_key or "").strip()
        if not key:
            raise HubeauUsageReleaseError("release_key obligatoire.")
        if key.lower() in {"latest", "current", "head"}:
            raise HubeauUsageReleaseError(
                f"release_key={self.release_key!r} interdit : release nommée exigée."
            )
        if self.year_min > self.year_max:
            raise HubeauUsageReleaseError(
                f"fenêtre invalide : {self.year_min} > {self.year_max}."
            )


@dataclass(frozen=True)
class WithdrawalRecord:
    """Un volume annuel DÉCLARÉ pour un ouvrage.

    `volume_m3` à `None` signifie « non déclaré », ce qui n'est **jamais** un
    volume nul : la source ne connaît pas les usages exonérés de redevance ni
    les volumes sous le seuil de déclaration.
    """

    ouvrage_id: str
    year: int
    volume_m3: float | None
    usage_code: str | None
    usage_label: str | None
    resource_type_code: str | None
    resource_type_label: str | None
    territory_code: str | None

    def has_value(self) -> bool:
        return self.volume_m3 is not None

    @property
    def period(self) -> tuple[date, date]:
        return date(self.year, 1, 1), date(self.year, 12, 31)


@dataclass
class WithdrawalsParseResult:
    records: list[WithdrawalRecord] = field(default_factory=list)
    input_checksum: str = ""
    records_total: int = 0
    values_present: int = 0
    values_absent: int = 0
    warnings: list[str] = field(default_factory=list)

    @property
    def ouvrage_ids(self) -> tuple[str, ...]:
        return tuple(sorted({r.ouvrage_id for r in self.records}))


def parse_withdrawals_pages(
    pages: Iterable[Any], *, config: WithdrawalsReleaseConfig
) -> WithdrawalsParseResult:
    """Parse des pages `prelevements/chroniques` (volumes annuels)."""
    result = WithdrawalsParseResult()
    checksum = hashlib.sha256()

    for page_index, page in enumerate(list(pages), start=1):
        checksum.update(json.dumps(page, sort_keys=True, default=str).encode("utf-8"))
        for line, record in enumerate(_records_of(page, page_index=page_index), start=1):
            context = f"page {page_index} ligne {line}"
            ouvrage = _text(record.get("code_ouvrage"))
            if not ouvrage:
                raise HubeauUsageSchemaError(
                    f"{context} : `code_ouvrage` absent — aucune jointure par libellé."
                )
            year = _year(record.get("annee"), context=context, config=config)
            volume = _number(record.get("volume"), context=context)
            if volume is not None and volume < 0:
                raise HubeauUsageSchemaError(
                    f"{context} : volume négatif ({volume}) — refusé."
                )

            entry = WithdrawalRecord(
                ouvrage_id=ouvrage,
                year=year,
                volume_m3=volume,
                usage_code=_text(record.get("code_usage")),
                usage_label=_text(record.get("libelle_usage")),
                resource_type_code=_text(record.get("code_type_milieu")),
                resource_type_label=_text(record.get("libelle_type_milieu")),
                territory_code=_text(record.get("code_commune_insee"))
                or _text(record.get("code_departement")),
            )
            result.records.append(entry)
            if entry.has_value():
                result.values_present += 1
            else:
                result.values_absent += 1

    result.input_checksum = checksum.hexdigest()
    result.records_total = len(result.records)
    if result.records_total == 0:
        raise HubeauUsageReleaseError("collecte vide : aucun enregistrement.")
    result.warnings.append(
        "Couverture partielle par construction : les volumes prélevés pour des usages "
        "exonérés de redevance ne sont pas connus, et les volumes inférieurs à "
        f"{UNDECLARED_VOLUME_THRESHOLD_M3} m³ ne sont pas déclarés. Une absence de "
        "déclaration n'est JAMAIS un prélèvement nul."
    )
    if result.values_absent:
        result.warnings.append(
            f"{result.values_absent} volume(s) non déclaré(s) conservé(s) comme absents "
            "(jamais convertis en 0)."
        )
    return result


@dataclass(frozen=True)
class WithdrawalsCoverage:
    """Couverture d'un territoire pour une année.

    Ne porte AUCUN total quand des déclarations manquent : sommer les volumes
    connus en présentant le résultat comme « le prélèvement du territoire »
    ferait passer une couverture partielle pour un total. `declared_volume_m3`
    est donc explicitement le volume DÉCLARÉ, et `is_complete` dit s'il peut
    être lu comme un total.
    """

    year: int
    ouvrages_total: int
    ouvrages_with_declaration: int
    ouvrages_without_declaration: int
    declared_volume_m3: float | None

    @property
    def coverage_pct(self) -> float | None:
        if self.ouvrages_total == 0:
            return None
        return round(self.ouvrages_with_declaration * 100.0 / self.ouvrages_total, 4)

    @property
    def is_complete(self) -> bool:
        return self.ouvrages_without_declaration == 0


def coverage_by_year(records: Iterable[WithdrawalRecord]) -> list[WithdrawalsCoverage]:
    """Couverture déterministe par année. L'ordre d'entrée n'a aucun effet."""
    buckets: dict[int, list[WithdrawalRecord]] = {}
    for record in records:
        buckets.setdefault(record.year, []).append(record)

    coverages: list[WithdrawalsCoverage] = []
    for year in sorted(buckets):
        bucket = buckets[year]
        declared = [r for r in bucket if r.has_value()]
        volumes = [r.volume_m3 for r in declared if r.volume_m3 is not None]
        coverages.append(
            WithdrawalsCoverage(
                year=year,
                ouvrages_total=len({r.ouvrage_id for r in bucket}),
                ouvrages_with_declaration=len({r.ouvrage_id for r in declared}),
                ouvrages_without_declaration=len(
                    {r.ouvrage_id for r in bucket} - {r.ouvrage_id for r in declared}
                ),
                declared_volume_m3=round(sum(volumes), 6) if volumes else None,
            )
        )
    return coverages


# ---------------------------------------------------------------------------
# Qualité — analyses physico-chimiques
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class QualityReleaseConfig:
    """Configuration d'une collecte qualité.

    `parameter_allowlist` est OBLIGATOIRE et non vide : sans allowlist
    explicite, aucune analyse n'est ingérée. `censoring_remark_codes` est vide
    par défaut — la signification des codes de remarque n'ayant pas été
    vérifiée, ce module n'en invente aucune ; l'opérateur déclare ceux qu'il a
    vérifiés lui-même.
    """

    release_key: str
    retrieved_at: date
    window_start: date
    window_end: date
    parameter_allowlist: Mapping[str, SandreParameter] = field(
        default_factory=lambda: dict(DEFAULT_PARAMETER_ALLOWLIST)
    )
    censoring_remark_codes: frozenset[str] = frozenset()
    is_fixture: bool = False

    def __post_init__(self) -> None:
        key = (self.release_key or "").strip()
        if not key:
            raise HubeauUsageReleaseError("release_key obligatoire.")
        if key.lower() in {"latest", "current", "head"}:
            raise HubeauUsageReleaseError(
                f"release_key={self.release_key!r} interdit : release nommée exigée."
            )
        if self.window_start > self.window_end:
            raise HubeauUsageReleaseError(
                f"fenêtre invalide : {self.window_start} > {self.window_end}."
            )
        if not self.parameter_allowlist:
            raise HubeauParameterRefused(
                "allowlist de paramètres vide : aucune analyse ne peut être ingérée. "
                "L'aspiration de tous les analytes est interdite (MACRO-PROMPT B)."
            )


@dataclass(frozen=True)
class QualityAnalysis:
    """Une analyse physico-chimique, transportée VERBATIM.

    Aucun jugement n'est porté : ni classement, ni conformité, ni comparaison
    à un seuil. `remark_code`/`remark_label`, `status_code`/`status_label` et
    `qualification_code`/`qualification_label` sont recopiés tels quels — leur
    vocabulaire n'est pas interprété par ce module.
    """

    station_id: str
    parameter_code: str
    parameter_label: str | None
    sampled_on: date
    value: float | None
    unit: str | None
    quantification_limit: float | None
    remark_code: str | None
    remark_label: str | None
    status_code: str | None
    status_label: str | None
    qualification_code: str | None
    qualification_label: str | None
    is_censored: bool

    def has_value(self) -> bool:
        return self.value is not None


@dataclass
class QualityParseResult:
    analyses: list[QualityAnalysis] = field(default_factory=list)
    input_checksum: str = ""
    records_total: int = 0
    values_present: int = 0
    values_absent: int = 0
    censored_count: int = 0
    warnings: list[str] = field(default_factory=list)

    @property
    def station_ids(self) -> tuple[str, ...]:
        return tuple(sorted({a.station_id for a in self.analyses}))

    @property
    def parameter_codes(self) -> tuple[str, ...]:
        return tuple(sorted({a.parameter_code for a in self.analyses}))


def parse_quality_pages(
    pages: Iterable[Any], *, config: QualityReleaseConfig
) -> QualityParseResult:
    """Parse des pages `analyse_pc`.

    Un paramètre hors allowlist est REFUSÉ (et non ignoré en silence) : une
    collecte qui ramène autre chose que ce qui a été demandé signale une
    requête mal bornée, pas une donnée à trier après coup.
    """
    result = QualityParseResult()
    checksum = hashlib.sha256()

    for page_index, page in enumerate(list(pages), start=1):
        checksum.update(json.dumps(page, sort_keys=True, default=str).encode("utf-8"))
        for line, record in enumerate(_records_of(page, page_index=page_index), start=1):
            context = f"page {page_index} ligne {line}"
            station = _text(record.get("code_station"))
            if not station:
                raise HubeauUsageSchemaError(
                    f"{context} : `code_station` absent — aucune jointure par libellé."
                )
            parameter_code = _text(record.get("code_parametre"))
            if not parameter_code:
                raise HubeauUsageSchemaError(f"{context} : `code_parametre` absent.")
            if parameter_code not in config.parameter_allowlist:
                raise HubeauParameterRefused(
                    f"{context} : paramètre SANDRE {parameter_code!r} hors allowlist "
                    f"{sorted(config.parameter_allowlist)} — refusé, jamais ingéré « au cas où »."
                )

            remark_code = _text(record.get("code_remarque"))
            analysis = QualityAnalysis(
                station_id=station,
                parameter_code=parameter_code,
                parameter_label=_text(record.get("libelle_parametre")),
                sampled_on=_day(record.get("date_prelevement"), context=context),
                value=_number(record.get("resultat"), context=context),
                unit=_text(record.get("symbole_unite")),
                quantification_limit=_number(
                    record.get("limite_quantification"), context=context
                ),
                remark_code=remark_code,
                remark_label=_text(record.get("mnemo_remarque")),
                status_code=_text(record.get("code_statut")),
                status_label=_text(record.get("mnemo_statut")),
                qualification_code=_text(record.get("code_qualification")),
                qualification_label=_text(record.get("libelle_qualification")),
                is_censored=bool(
                    remark_code is not None and remark_code in config.censoring_remark_codes
                ),
            )
            result.analyses.append(analysis)
            if analysis.has_value():
                result.values_present += 1
            else:
                result.values_absent += 1
            if analysis.is_censored:
                result.censored_count += 1

    result.input_checksum = checksum.hexdigest()
    result.records_total = len(result.analyses)
    if result.records_total == 0:
        raise HubeauUsageReleaseError("collecte vide : aucune analyse.")
    if not config.censoring_remark_codes:
        result.warnings.append(
            "Aucun code de remarque n'a été déclaré comme censurant : les remarques sont "
            "transportées verbatim et aucune censure n'est déduite. Le vocabulaire SANDRE "
            "de `code_remarque` n'a pas été vérifié par ce connecteur."
        )
    if result.censored_count:
        result.warnings.append(
            f"{result.censored_count} résultat(s) marqué(s) comme censuré(s) selon les codes "
            "déclarés par l'opérateur — la valeur reste transportée telle quelle, jamais "
            "remplacée par la limite de quantification ni par 0."
        )
    return result


def group_by_parameter(
    analyses: Iterable[QualityAnalysis],
) -> dict[tuple[str, str, str | None], list[QualityAnalysis]]:
    """Regroupe par (station, paramètre, unité) — jamais entre paramètres.

    Deux codes SANDRE différents, ou deux unités différentes, ne partagent
    jamais un groupe : les agréger produirait un nombre sans signification.
    """
    grouped: dict[tuple[str, str, str | None], list[QualityAnalysis]] = {}
    for analysis in analyses:
        grouped.setdefault(
            (analysis.station_id, analysis.parameter_code, analysis.unit), []
        ).append(analysis)
    return grouped


# ---------------------------------------------------------------------------
# Helpers de parsing
# ---------------------------------------------------------------------------


def _records_of(page: Any, *, page_index: int) -> list[Mapping[str, Any]]:
    if not isinstance(page, dict):
        raise HubeauUsageSchemaError(f"page {page_index} : objet JSON attendu.")
    data = page.get("data")
    if not isinstance(data, list):
        raise HubeauUsageSchemaError(f"page {page_index} : tableau `data` absent.")
    for record in data:
        if not isinstance(record, dict):
            raise HubeauUsageSchemaError(f"page {page_index} : enregistrement inattendu.")
    return data


def _text(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if text.lower() in _BLANK_MARKERS:
        return None
    return text


def _number(raw: Any, *, context: str) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        raise HubeauUsageSchemaError(f"{context} : booléen inattendu pour une valeur.")
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if text.lower() in _BLANK_MARKERS:
        return None
    try:
        return float(text)
    except ValueError as exc:
        raise HubeauUsageSchemaError(f"{context} : valeur illisible {raw!r}") from exc


def _year(raw: Any, *, context: str, config: WithdrawalsReleaseConfig) -> int:
    text = _text(raw)
    if not text:
        raise HubeauUsageSchemaError(f"{context} : année absente — période obligatoire.")
    try:
        year = int(text)
    except ValueError as exc:
        raise HubeauUsageSchemaError(f"{context} : année illisible {raw!r}") from exc
    if not (config.year_min <= year <= config.year_max):
        raise HubeauUsageSchemaError(
            f"{context} : année {year} hors de la fenêtre demandée "
            f"({config.year_min}-{config.year_max})."
        )
    return year


def _day(raw: Any, *, context: str) -> date:
    text = _text(raw)
    if not text:
        raise HubeauUsageSchemaError(f"{context} : date absente — période obligatoire.")
    candidate = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(candidate).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError as exc:
            raise HubeauUsageSchemaError(f"{context} : date illisible {raw!r}") from exc


# ---------------------------------------------------------------------------
# Intégration pipeline P03
# ---------------------------------------------------------------------------


def withdrawals_metric_code(facet: str = "volume") -> str:
    """Code stable — jamais d'année : la période vit dans period_start/end."""
    return f"hubeau.prelevements.{facet}"


def quality_metric_code(parameter_code: str) -> str:
    """Code stable, namespacé par le CODE SANDRE — jamais par le libellé, et
    jamais porteur d'une date."""
    return f"hubeau.qualite_rivieres.parametre.{parameter_code}"


def build_withdrawals_normalizer(config: WithdrawalsReleaseConfig):
    def normalizer(pages: Any) -> list[ObservationDraft]:
        parsed = parse_withdrawals_pages(pages, config=config)
        return withdrawals_drafts(parsed.records, config)

    return normalizer


def withdrawals_drafts(
    records: Iterable[WithdrawalRecord], config: WithdrawalsReleaseConfig
) -> list[ObservationDraft]:
    status = "fixture" if config.is_fixture else WITHDRAWALS_DATA_STATUS
    drafts: list[ObservationDraft] = []
    for record in records:
        if record.volume_m3 is None:
            continue
        start, end = record.period
        drafts.append(
            ObservationDraft(
                subject_type="hubeau_prelevement_ouvrage",
                subject_key=record.ouvrage_id,
                metric_code=withdrawals_metric_code(),
                numeric_value=record.volume_m3,
                unit=VOLUME_UNIT,
                geography_code=record.ouvrage_id,
                observed_at=datetime(record.year, 1, 1, tzinfo=timezone.utc),
                data_status=status,
                methodology_version=WITHDRAWALS_METHOD.version,
                metadata={
                    "source_code": WITHDRAWALS_SOURCE_CODE,
                    "release_key": config.release_key,
                    "year": record.year,
                    "period_start": start.isoformat(),
                    "period_end": end.isoformat(),
                    "usage_code": record.usage_code,
                    "usage_label": record.usage_label,
                    "resource_type_code": record.resource_type_code,
                    "resource_type_label": record.resource_type_label,
                    "territory_code": record.territory_code,
                    "declaration_coverage_note": (
                        "usages exonérés de redevance inconnus ; volumes < "
                        f"{UNDECLARED_VOLUME_THRESHOLD_M3} m³ non déclarés"
                    ),
                },
            )
        )
    return drafts


def build_quality_normalizer(config: QualityReleaseConfig):
    def normalizer(pages: Any) -> list[ObservationDraft]:
        parsed = parse_quality_pages(pages, config=config)
        return quality_drafts(parsed.analyses, config)

    return normalizer


def quality_drafts(
    analyses: Iterable[QualityAnalysis], config: QualityReleaseConfig
) -> list[ObservationDraft]:
    status = "fixture" if config.is_fixture else QUALITY_DATA_STATUS
    drafts: list[ObservationDraft] = []
    for analysis in analyses:
        if analysis.value is None:
            continue
        drafts.append(
            ObservationDraft(
                subject_type="hubeau_qualite_station",
                subject_key=analysis.station_id,
                metric_code=quality_metric_code(analysis.parameter_code),
                numeric_value=analysis.value,
                unit=analysis.unit,
                geography_code=analysis.station_id,
                observed_at=datetime(
                    analysis.sampled_on.year,
                    analysis.sampled_on.month,
                    analysis.sampled_on.day,
                    tzinfo=timezone.utc,
                ),
                data_status=status,
                methodology_version=QUALITY_METHOD.version,
                metadata={
                    "source_code": QUALITY_SOURCE_CODE,
                    "release_key": config.release_key,
                    "parameter_code": analysis.parameter_code,
                    "parameter_label": analysis.parameter_label,
                    "sampled_on": analysis.sampled_on.isoformat(),
                    "unit_symbol": analysis.unit,
                    "quantification_limit": analysis.quantification_limit,
                    "remark_code": analysis.remark_code,
                    "remark_label": analysis.remark_label,
                    "status_code": analysis.status_code,
                    "status_label": analysis.status_label,
                    "qualification_code": analysis.qualification_code,
                    "qualification_label": analysis.qualification_label,
                    "is_censored": analysis.is_censored,
                    # Vocabulaires recopiés verbatim : ce connecteur ne les
                    # interprète pas et n'en tire aucune conclusion sanitaire.
                    "remark_vocabulary": "unknown",
                    "interpretation": "none",
                },
            )
        )
    return drafts


def build_geography_resolver(identifiers: Iterable[str]):
    """Résolveur basé UNIQUEMENT sur l'identifiant officiel."""
    known = set(identifiers)

    def resolver(code: str | None) -> WaterGeographyRef:
        if code is None or code not in known:
            raise HubeauUsageGeographyUnavailableError(
                f"identifiant inconnu {code!r} — aucun appariement par libellé."
            )
        return WaterGeographyRef(scope="france", code=code, label=code)

    return resolver


def build_withdrawals_period_resolver():
    """`PeriodResolver` annuel : une déclaration couvre l'année civile
    entière, du 1er janvier au 31 décembre — jamais un jour unique."""

    def resolver(draft: ObservationDraft) -> tuple[date, date]:
        year = draft.metadata.get("year")
        if not isinstance(year, int):
            raise HubeauUsagePeriodUnavailableError(
                f"période non résolue pour {draft.subject_key!r} : `year` absent ou "
                f"invalide dans les métadonnées structurées ({year!r})."
            )
        return date(year, 1, 1), date(year, 12, 31)

    return resolver


def build_quality_period_resolver():
    """`PeriodResolver` ponctuel : une analyse porte sur un prélèvement daté."""

    def resolver(draft: ObservationDraft) -> tuple[date, date]:
        raw = draft.metadata.get("sampled_on")
        if not isinstance(raw, str) or not raw:
            raise HubeauUsagePeriodUnavailableError(
                f"période non résolue pour {draft.subject_key!r} : `sampled_on` absent "
                f"des métadonnées structurées ({raw!r})."
            )
        try:
            day = date.fromisoformat(raw)
        except ValueError as exc:
            raise HubeauUsagePeriodUnavailableError(
                f"période non résolue pour {draft.subject_key!r} : `sampled_on` "
                f"illisible ({raw!r})."
            ) from exc
        return day, day

    return resolver
