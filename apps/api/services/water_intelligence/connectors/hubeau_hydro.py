"""
connectors/hubeau_hydro.py — hydrométrie et piézométrie Hub'Eau (P07).

Deux sources distinctes, volontairement réunies dans un seul module parce
qu'elles partagent le socle (`hubeau_transport.py`), le contrat P02 et la même
discipline d'erreur — mais **jamais leurs grandeurs** : un débit, une hauteur
d'eau de rivière et un niveau de nappe ne sont ni la même chose, ni dans la
même unité, ni dans le même référentiel. Ils ne sont donc jamais additionnés,
moyennés ni comparés terme à terme.

**Aucun réseau ici** : ce module ne fait que normaliser des pages déjà
récupérées par le socle (lui-même sans client HTTP — voir son docstring).

## Faits VÉRIFIÉS sur les deux API (cf. handoffs/WAVE_B_HUBEAU.md §2)

### Hydrométrie — `https://hubeau.eaufrance.fr/api/v2/hydrometrie/`

  - opérations : `referentiel/sites`, `referentiel/stations`,
    `observations_tr`, `obs_elab` ;
  - identifiant de station : `code_station` ;
  - `grandeur_hydro` : **`H` = hauteur d'eau, `Q` = débit** ;
  - **unités natives : les hauteurs sont en MILLIMÈTRES, les débits en
    LITRES PAR SECONDE** — la documentation officielle précise « mm pour les
    hauteurs d'eau » et « l/s pour les débits » (diviser par 1 000 pour
    obtenir mètres et m³/s). Ce module **conserve l'unité native** et ne
    convertit rien : une conversion silencieuse est exactement le genre
    d'erreur d'échelle que le chantier interdit ;
  - fenêtre temporelle : `date_debut_obs` / `date_fin_obs` (ISO 8601).

  ### X2A — bascule `obs_elab` → `observations_tr`

  La validation live X1 a montré que ce parseur ciblait `obs_elab` (grandeurs
  ÉLABORÉES : `HIXM`, `QINM`, `QmM`…) tout en validant contre `{H, Q}` — le
  vocabulaire du TEMPS RÉEL, que `obs_elab` rejette en HTTP 400
  (`docs/carbonco/water-intelligence/activation/X1_LIVE_VALIDATION_HANDOFF.md`
  §2.1). Les deux seules valeurs acceptées par ce module étaient donc
  précisément celles que l'endpoint interrogé refusait.

  Le MVP retenu (X2A) bascule sur `observations_tr`, VÉRIFIÉ EN DIRECT le
  2026-07-26 sur la station `O400101101` : `grandeur_hydro=H` et `=Q`
  répondent 200 ; tout autre code (essayé : `HIXM`) répond 400 avec
  « Wrong value(s), possibles values are H or Q or H,Q » — la plateforme
  elle-même impose l'exclusivité du vocabulaire déjà déclaré ici. Champs de
  réponse réels : `code_station`, `grandeur_hydro`, `date_obs`,
  `resultat_obs`, `libelle_statut` — aucun champ d'unité (`unite`/
  `libelle_unite` valent `null`), confirmant que `HYDRO_QUANTITIES` reste la
  SEULE source d'unité, comme pour `obs_elab`.

  `obs_elab` reste un endpoint réel et déclaré dans le socle
  (`hubeau_transport.ENDPOINTS`), mais aucune `HubeauFamily` de
  `scripts/water_intelligence/validate_hubeau.py` n'y pointe plus : son statut
  est `OBS_ELAB_STATUS = "derived_metrics_mapping_deferred"` ci-dessous, et
  aucun fallback automatique entre les deux endpoints n'existe — le choix est
  toujours explicite, jamais une bascule silencieuse en cas d'échec.

### Piézométrie — `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes`

  - opérations : `stations`, `chroniques`, `chroniques_tr` ;
  - identifiant de point : **`code_bss`** ;
  - `niveau_nappe_eau` : niveau en **mètres NGF** (altitude) ;
  - `profondeur_nappe` : profondeur en **mètres** sous le repère de mesure ;
  - ces deux grandeurs sont **opposées en sens** (une nappe qui baisse voit
    son niveau NGF diminuer et sa profondeur augmenter) : les confondre
    inverserait la lecture du risque. Elles restent deux métriques distinctes.

## Invariants tenus ici

  - aucune interpolation : une valeur absente ne produit aucune observation,
    elle n'est ni comblée, ni reportée depuis la mesure précédente ;
  - `null` n'est jamais converti en `0` ;
  - unité native conservée et portée explicitement sur chaque observation ;
  - identifiants officiels uniquement (`code_station`, `code_bss`) — jamais un
    libellé de station comme clé ;
  - période portée par `period_start`/`period_end` via le `PeriodResolver`
    livré en Wave A — le `metric_code` reste stable et ne contient jamais de
    date (contournement caduc, cf. handoffs/WAVE_A_EU_CONNECTORS.md §5.1) ;
  - fraîcheur explicite : une chronique porte sa fenêtre, jamais « la
    dernière valeur » sans date ;
  - agrégat déterministe et documenté, jamais une moyenne implicite ;
  - erreurs attendues : `HubeauHydroError` (→ `AdapterError`) en
    `parse`/`normalize`, `HubeauGeographyUnavailableError` /
    `HubeauPeriodUnavailableError` (→ `PipelineDataUnavailableError`) en
    `derive`.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Iterable, Literal, Mapping

from models.analytics import MethodRef
from models.water_intelligence import WaterGeographyRef
from services.intelligence.adapters.base import AdapterError, ObservationDraft
from services.water_intelligence.pipeline import (
    JsonPageDecoder,
    PipelineDataUnavailableError,
)

# ---------------------------------------------------------------------------
# Identité des sources — valeurs VÉRIFIÉES
# ---------------------------------------------------------------------------

HYDROMETRIE_SOURCE_CODE = "HUBEAU_HYDROMETRIE"
PIEZOMETRIE_SOURCE_CODE = "HUBEAU_ADES"

METHOD = MethodRef(code="CC-WI-HUBEAU-HYDRO-PASSTHROUGH", version="1.0.0")

#: Les réponses Hub'Eau sont du JSON : décodeur choisi EXPLICITEMENT (P03B).
PAGE_DECODER = JsonPageDecoder()

#: Mesures instrumentales réelles — contrairement au WEI+ (`modelled`) ou au
#: CDI. `observed` est ici le statut honnête.
DEFAULT_DATA_STATUS = "observed"

#: Grandeurs hydrométriques officielles et leur unité NATIVE.
#: Aucune conversion n'est appliquée : l'unité voyage avec la valeur.
HYDRO_QUANTITIES: dict[str, tuple[str, str]] = {
    "Q": ("debit", "l/s"),
    "H": ("hauteur", "mm"),
}

#: Statut MVP de l'endpoint élaboré (X2A) — jamais branché par
#: `scripts/water_intelligence/validate_hubeau.py`. Son vocabulaire
#: (`HIXM`, `QINM`, `QmM`…) exigerait un mapping d'unité vérifié par
#: grandeur, qu'aucune documentation officielle consultée ne publie :
#: l'inventer romprait l'invariant « aucune dimension devinée ». Cité par
#: `docs/carbonco/water-intelligence/activation/X1_CONNECTOR_READINESS_MATRIX.md`.
OBS_ELAB_STATUS = "derived_metrics_mapping_deferred"

#: Grandeurs piézométriques et leur unité. `niveau_nappe_eau` et
#: `profondeur_nappe` varient en sens OPPOSÉ — jamais confondues.
PIEZO_QUANTITIES: dict[str, tuple[str, str]] = {
    "niveau_nappe_eau": ("niveau_nappe", "m NGF"),
    "profondeur_nappe": ("profondeur_nappe", "m"),
}

#: Marqueurs textuels d'absence rencontrés dans les réponses.
_BLANK_MARKERS = {"", "na", "n/a", "nan", "null", "none"}

HubeauHydroKind = Literal["hydrometrie", "piezometrie"]


class HubeauHydroError(AdapterError):
    """Erreur métier attendue des connecteurs hydro/piézo.

    Hérite d'`AdapterError` (contrat P03C) : capturée par `run_pipeline()` aux
    stages `parse`/`normalize`, jamais une exception nue."""


class HubeauSchemaError(HubeauHydroError):
    """Réponse dont la forme ne correspond pas au schéma officiel vérifié."""


class HubeauReleaseError(HubeauHydroError):
    """Release absente, vide ou non nommée — aucun « latest » implicite."""


class HubeauGeographyUnavailableError(PipelineDataUnavailableError):
    """Station/point non résolu au stage `derive`.

    Hérite de `PipelineDataUnavailableError` — seul type capturé autour du
    `geography_resolver` (contrat P03 §5.4). N'hérite PAS d'`AdapterError` :
    les deux familles restent distinctes."""


class HubeauPeriodUnavailableError(PipelineDataUnavailableError):
    """Période non résolue au stage `derive` — même contrat que ci-dessus,
    appliqué au `PeriodResolver` livré en Wave A."""


# ---------------------------------------------------------------------------
# Configuration de release
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HubeauHydroReleaseConfig:
    """Identité d'une collecte Hub'Eau.

    `release_key` est obligatoire et explicite : une collecte est datée et
    bornée, jamais « la dernière ». La fenêtre demandée est portée par la
    config elle-même, ce qui rend la fraîcheur vérifiable.
    """

    release_key: str
    retrieved_at: date
    window_start: date
    window_end: date
    kind: HubeauHydroKind = "hydrometrie"
    data_status: str = DEFAULT_DATA_STATUS
    is_fixture: bool = False

    def __post_init__(self) -> None:
        key = (self.release_key or "").strip()
        if not key:
            raise HubeauReleaseError(
                "release_key obligatoire : aucune release anonyme ni « latest » implicite."
            )
        if key.lower() in {"latest", "current", "head"}:
            raise HubeauReleaseError(
                f"release_key={self.release_key!r} interdit : une release doit être "
                "nommée/versionnée pour rester reproductible."
            )
        if self.kind not in ("hydrometrie", "piezometrie"):
            raise HubeauSchemaError(f"type de source inconnu : {self.kind!r}")
        if self.window_start > self.window_end:
            raise HubeauReleaseError(
                f"fenêtre invalide : {self.window_start} > {self.window_end}."
            )

    @property
    def source_code(self) -> str:
        return (
            HYDROMETRIE_SOURCE_CODE if self.kind == "hydrometrie" else PIEZOMETRIE_SOURCE_CODE
        )

    @property
    def identifier_field(self) -> str:
        return "code_station" if self.kind == "hydrometrie" else "code_bss"


# ---------------------------------------------------------------------------
# Structures parsées
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HubeauMeasurement:
    """Une mesure instrumentale.

    `value` à `None` signifie « non renseignée par la source », jamais zéro et
    jamais une valeur reportée depuis une autre date.
    """

    station_id: str
    quantity: str
    unit: str
    value: float | None
    observed_on: date
    #: `libelle_statut` recopié verbatim (ex. « Donnée brute »), absent pour
    #: la piézométrie. Statut éventuel, jamais interprété par ce module.
    status_label: str | None = None

    def has_value(self) -> bool:
        return self.value is not None


@dataclass
class HubeauParseResult:
    measurements: list[HubeauMeasurement] = field(default_factory=list)
    input_checksum: str = ""
    records_total: int = 0
    values_present: int = 0
    values_absent: int = 0
    warnings: list[str] = field(default_factory=list)

    @property
    def station_ids(self) -> tuple[str, ...]:
        return tuple(sorted({m.station_id for m in self.measurements}))

    @property
    def observed_days(self) -> tuple[date, ...]:
        return tuple(sorted({m.observed_on for m in self.measurements}))


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _parse_text(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if text.lower() in _BLANK_MARKERS:
        return None
    return text


def _parse_float(raw: Any, *, context: str) -> float | None:
    """`None` pour toute absence. Ne renvoie JAMAIS 0.0 par défaut."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        raise HubeauSchemaError(f"{context} : booléen inattendu pour une mesure.")
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if text.lower() in _BLANK_MARKERS:
        return None
    try:
        return float(text)
    except ValueError as exc:
        raise HubeauSchemaError(f"{context} : valeur illisible {raw!r}") from exc


def _parse_day(raw: Any, *, context: str) -> date:
    text = _parse_text(raw)
    if not text:
        raise HubeauSchemaError(
            f"{context} : date absente — la période est obligatoire, "
            "aucune date substituée."
        )
    candidate = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(candidate).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError as exc:
            raise HubeauSchemaError(f"{context} : date illisible {raw!r}") from exc


def _records_of(page: Any, *, page_index: int) -> list[Mapping[str, Any]]:
    if not isinstance(page, dict):
        raise HubeauSchemaError(
            f"page {page_index} : objet JSON attendu (réponse Hub'Eau)."
        )
    data = page.get("data")
    if not isinstance(data, list):
        raise HubeauSchemaError(f"page {page_index} : tableau `data` absent.")
    for record in data:
        if not isinstance(record, dict):
            raise HubeauSchemaError(
                f"page {page_index} : enregistrement inattendu ({type(record).__name__})."
            )
    return data


def parse_hydrometrie_pages(
    pages: Iterable[Any], *, config: HubeauHydroReleaseConfig
) -> HubeauParseResult:
    """Parse des pages `observations_tr` (X2A). Débit et hauteur restent
    SÉPARÉS.

    Champs réels VÉRIFIÉS EN DIRECT (cf. docstring de module) :
    `code_station`, `grandeur_hydro`, `date_obs`, `resultat_obs`,
    `libelle_statut`. Aucun fallback vers les noms `_elab` : ce parseur cible
    exclusivement `observations_tr`, jamais `obs_elab` (MVP, X2A) — un champ
    absent est une erreur de schéma, jamais une bascule silencieuse d'endpoint.
    """
    if config.kind != "hydrometrie":
        raise HubeauSchemaError("config hydrométrie attendue.")
    result = HubeauParseResult()
    checksum = hashlib.sha256()

    for page_index, page in enumerate(list(pages), start=1):
        checksum.update(json.dumps(page, sort_keys=True, default=str).encode("utf-8"))
        for line, record in enumerate(_records_of(page, page_index=page_index), start=1):
            context = f"page {page_index} ligne {line}"
            station = _parse_text(record.get("code_station"))
            if not station:
                raise HubeauSchemaError(
                    f"{context} : `code_station` absent — aucune jointure par "
                    "libellé de station n'est autorisée en repli."
                )
            grandeur = _parse_text(record.get("grandeur_hydro"))
            if grandeur not in HYDRO_QUANTITIES:
                raise HubeauSchemaError(
                    f"{context} : grandeur {grandeur!r} hors vocabulaire officiel "
                    f"{sorted(HYDRO_QUANTITIES)}."
                )
            quantity, unit = HYDRO_QUANTITIES[grandeur]
            observed_on = _parse_day(record.get("date_obs"), context=context)
            value = _parse_float(record.get("resultat_obs"), context=context)
            status_label = _parse_text(record.get("libelle_statut"))

            _accumulate(result, HubeauMeasurement(
                station_id=station, quantity=quantity, unit=unit,
                value=value, observed_on=observed_on, status_label=status_label,
            ))

    return _finalise(result, checksum)


def parse_piezometrie_pages(
    pages: Iterable[Any], *, config: HubeauHydroReleaseConfig
) -> HubeauParseResult:
    """Parse des pages `chroniques`. Niveau NGF et profondeur restent DEUX
    métriques distinctes — elles varient en sens opposé."""
    if config.kind != "piezometrie":
        raise HubeauSchemaError("config piézométrie attendue.")
    result = HubeauParseResult()
    checksum = hashlib.sha256()

    for page_index, page in enumerate(list(pages), start=1):
        checksum.update(json.dumps(page, sort_keys=True, default=str).encode("utf-8"))
        for line, record in enumerate(_records_of(page, page_index=page_index), start=1):
            context = f"page {page_index} ligne {line}"
            station = _parse_text(record.get("code_bss"))
            if not station:
                raise HubeauSchemaError(
                    f"{context} : `code_bss` absent — aucune jointure par libellé."
                )
            observed_on = _parse_day(record.get("date_mesure"), context=context)

            present_fields = [f for f in PIEZO_QUANTITIES if f in record]
            if not present_fields:
                raise HubeauSchemaError(
                    f"{context} : aucune grandeur piézométrique parmi "
                    f"{sorted(PIEZO_QUANTITIES)}."
                )
            for source_field in present_fields:
                quantity, unit = PIEZO_QUANTITIES[source_field]
                value = _parse_float(record.get(source_field), context=context)
                _accumulate(result, HubeauMeasurement(
                    station_id=station, quantity=quantity, unit=unit,
                    value=value, observed_on=observed_on,
                ))

    return _finalise(result, checksum)


def _accumulate(result: HubeauParseResult, measurement: HubeauMeasurement) -> None:
    result.measurements.append(measurement)
    if measurement.has_value():
        result.values_present += 1
    else:
        result.values_absent += 1


def _finalise(result: HubeauParseResult, checksum: "hashlib._Hash") -> HubeauParseResult:
    result.input_checksum = checksum.hexdigest()
    result.records_total = len(result.measurements)
    if result.records_total == 0:
        raise HubeauReleaseError(
            "collecte vide : aucune mesure — release refusée plutôt que publiée vide."
        )
    if result.values_absent:
        result.warnings.append(
            f"{result.values_absent} mesure(s) sans valeur conservée(s) comme absentes "
            "(jamais converties en 0, jamais interpolées)."
        )
    return result


# ---------------------------------------------------------------------------
# Agrégat déterministe — jamais une moyenne implicite
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HubeauStationAggregate:
    """Agrégat par (station, grandeur), sur la fenêtre demandée.

    Porte la COUVERTURE (jours renseignés / jours observés) séparément de la
    valeur : une couverture faible n'est jamais un niveau faible. La moyenne
    n'est calculée que sur les valeurs présentes et le nombre de valeurs
    utilisées est exposé — jamais une moyenne dont on ignore l'assise.
    """

    station_id: str
    quantity: str
    unit: str
    days_total: int
    days_with_value: int
    first_day: date
    last_day: date
    minimum: float | None
    maximum: float | None
    mean: float | None

    @property
    def coverage_pct(self) -> float | None:
        if self.days_total == 0:
            return None
        return round(self.days_with_value * 100.0 / self.days_total, 4)


def aggregate_by_station(
    measurements: Iterable[HubeauMeasurement],
) -> list[HubeauStationAggregate]:
    """Agrège par (station, grandeur), dans un ordre déterministe et
    indépendant de l'ordre d'entrée.

    Les grandeurs ne sont JAMAIS mélangées entre elles : un débit et une
    hauteur d'une même station produisent deux agrégats distincts, et deux
    unités différentes ne sont jamais réunies.
    """
    buckets: dict[tuple[str, str], list[HubeauMeasurement]] = {}
    for measurement in measurements:
        buckets.setdefault((measurement.station_id, measurement.quantity), []).append(measurement)

    aggregates: list[HubeauStationAggregate] = []
    for (station_id, quantity) in sorted(buckets):
        bucket = buckets[(station_id, quantity)]
        units = {m.unit for m in bucket}
        if len(units) > 1:
            raise HubeauSchemaError(
                f"{station_id}/{quantity} : unités incompatibles {sorted(units)} — "
                "aucun agrégat entre unités différentes."
            )
        valued = [m for m in bucket if m.value is not None]
        values = [m.value for m in valued if m.value is not None]
        days = sorted({m.observed_on for m in bucket})
        aggregates.append(
            HubeauStationAggregate(
                station_id=station_id,
                quantity=quantity,
                unit=units.pop(),
                days_total=len(days),
                days_with_value=len({m.observed_on for m in valued}),
                first_day=days[0],
                last_day=days[-1],
                minimum=min(values) if values else None,
                maximum=max(values) if values else None,
                mean=round(sum(values) / len(values), 6) if values else None,
            )
        )
    return aggregates


def latest_measurement(
    measurements: Iterable[HubeauMeasurement], *, station_id: str, quantity: str
) -> HubeauMeasurement | None:
    """Dernier état RENSEIGNÉ d'une station pour une grandeur.

    Ignore les mesures sans valeur plutôt que de renvoyer un « dernier point »
    vide, et ne remonte jamais plus loin qu'une mesure réellement présente :
    aucune valeur n'est reportée dans le temps.
    """
    candidates = [
        m for m in measurements
        if m.station_id == station_id and m.quantity == quantity and m.has_value()
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda m: m.observed_on)


# ---------------------------------------------------------------------------
# Intégration pipeline P03
# ---------------------------------------------------------------------------


def metric_code(kind: HubeauHydroKind, quantity: str) -> str:
    """Code de métrique namespacé et STABLE.

    Ne contient JAMAIS de date : la période vit dans `period_start`/
    `period_end`, via le `PeriodResolver` livré en Wave A. Le contournement
    par `metric_code` est caduc."""
    return f"hubeau.{kind}.{quantity}"


def build_normalizer(config: HubeauHydroReleaseConfig):
    """`Normalizer` compatible `run_pipeline` (P03).

    Une mesure sans valeur ne produit AUCUN draft (le noyau exige au moins une
    valeur) — elle n'est ni inventée, ni convertie en 0, ni interpolée.
    """
    parser = (
        parse_hydrometrie_pages if config.kind == "hydrometrie" else parse_piezometrie_pages
    )

    def normalizer(pages: Any) -> list[ObservationDraft]:
        parsed = parser(pages, config=config)
        return drafts_from_measurements(parsed.measurements, config)

    return normalizer


def drafts_from_measurements(
    measurements: Iterable[HubeauMeasurement], config: HubeauHydroReleaseConfig
) -> list[ObservationDraft]:
    status = "fixture" if config.is_fixture else config.data_status
    drafts: list[ObservationDraft] = []

    for measurement in measurements:
        if measurement.value is None:
            continue
        drafts.append(
            ObservationDraft(
                subject_type=f"hubeau_{config.kind}_station",
                subject_key=measurement.station_id,
                metric_code=metric_code(config.kind, measurement.quantity),
                numeric_value=measurement.value,
                unit=measurement.unit,
                geography_code=measurement.station_id,
                observed_at=datetime(
                    measurement.observed_on.year,
                    measurement.observed_on.month,
                    measurement.observed_on.day,
                    tzinfo=timezone.utc,
                ),
                data_status=status,
                methodology_version=METHOD.version,
                metadata={
                    "source_code": config.source_code,
                    "release_key": config.release_key,
                    "identifier_field": config.identifier_field,
                    "quantity": measurement.quantity,
                    "native_unit": measurement.unit,
                    "observed_on": measurement.observed_on.isoformat(),
                    "window_start": config.window_start.isoformat(),
                    "window_end": config.window_end.isoformat(),
                    "status_label": measurement.status_label,
                },
            )
        )
    return drafts


def build_geography_resolver(station_ids: Iterable[str]):
    """Résolveur basé UNIQUEMENT sur l'identifiant officiel de station.

    Un code inconnu lève `HubeauGeographyUnavailableError` — jamais un repli
    sur un libellé, jamais une géographie inventée. `label` est l'identifiant
    lui-même : aucun libellé officiel n'est repris, ce qui rend une jointure
    par nom structurellement impossible.
    """
    known = set(station_ids)

    def resolver(code: str | None) -> WaterGeographyRef:
        if code is None or code not in known:
            raise HubeauGeographyUnavailableError(
                f"station inconnue pour l'identifiant {code!r} — "
                "aucun appariement par libellé n'est autorisé."
            )
        return WaterGeographyRef(scope="france", code=code, label=code)

    return resolver


def build_period_resolver():
    """`PeriodResolver` (contrat Wave A) pour une mesure ponctuelle datée.

    Une mesure hydrométrique ou piézométrique porte un jour d'observation
    précis : `period_start == period_end == observed_on`. La date est lue dans
    les métadonnées STRUCTURÉES du draft, jamais reconstituée depuis un
    libellé.

    Une date absente ou illisible lève `PipelineDataUnavailableError` — seul
    type capturé autour du résolveur : le draft est écarté et nommé dans le
    rapport, jamais complété par une date inventée.
    """

    def resolver(draft: ObservationDraft) -> tuple[date, date]:
        raw = draft.metadata.get("observed_on")
        if not isinstance(raw, str) or not raw:
            raise HubeauPeriodUnavailableError(
                f"période non résolue pour {draft.subject_key!r}/{draft.metric_code!r} : "
                f"`observed_on` absent des métadonnées structurées ({raw!r})."
            )
        try:
            day = date.fromisoformat(raw)
        except ValueError as exc:
            raise HubeauPeriodUnavailableError(
                f"période non résolue pour {draft.subject_key!r}/{draft.metric_code!r} : "
                f"`observed_on` illisible ({raw!r})."
            ) from exc
        return day, day

    return resolver
