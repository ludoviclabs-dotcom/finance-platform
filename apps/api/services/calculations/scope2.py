"""
scope2.py — moteur de calcul Scope 2 DUAL (PR-06B).

Calcule les deux comptabilités du GHG Protocol Scope 2 Guidance, **toujours
ensemble, jamais l'une à la place de l'autre** :

  * **location-based (LB)** — consommation × facteur moyen du réseau ;
  * **market-based (MB)**  — instruments contractuels alloués, puis facteur
    fournisseur admissible, puis mix résiduel.

Tout ce module est **PUR** : aucune I/O, aucune DB, aucun LLM, aucun aléa, aucune
lecture d'horloge dans le calcul (la date du jour est un paramètre explicite).
Le chargement des entrées et la persistance des runs vivent dans
`scope2_runs.py`. Cette séparation rend les DEUX hiérarchies entièrement
testables sans PostgreSQL.

────────────────────────────────────────────────────────────────────────────
HIÉRARCHIE LOCATION-BASED (ordre strict)
  1. facteur de réseau **sous-national** compatible (zone exacte, ex. FR-IDF)
  2. facteur **national** (ex. FR)
  3. facteur **régional explicitement documenté** (ex. EU — exige un sourcing,
     `source_release_id` présent) + warning
  4. **erreur explicite** (`CalculationError`) — jamais un zéro silencieux

HIÉRARCHIE MARKET-BASED (ordre strict)
  1. **instrument contractuel valide alloué** (REC/GO/PPA/tarif vert)
  2. **facteur fournisseur admissible** (`basis='market'`)
  3. **mix résiduel compatible** (`basis='residual_mix'`) + warning
  4. **repli UNIQUEMENT si la méthodologie l'autorise explicitement**
     (`Methodology.allow_market_fallback`), tracé `fallback_reason` obligatoire ;
     sinon **erreur explicite**

────────────────────────────────────────────────────────────────────────────
INTERDITS MÉTHODOLOGIQUES (non négociables)
  * **Une moyenne nationale n'est JAMAIS market-based.** Structurellement
    impossible ici : la sélection MB n'interroge QUE des candidats de `basis`
    'market' ou 'residual_mix'. Le repli autorisé (niveau 4) est étiqueté
    `documented_fallback`, jamais `location` — et la migration 033 le refuse
    aussi en base (CHECK `scope2_lines_market_purity_check`).
  * **Une estimation n'est jamais présentée comme vérifiée.** `data_quality`
    ne vaut `verified` que si la preuve existe (certificat d'instrument, ou
    facteur sourcé par une release).
  * **Un proxy fournisseur n'est jamais présenté comme facteur contractuel
    vérifié.** Un facteur fournisseur non sourcé est `estimated` + warning ;
    seul un instrument contractuel alloué produit le niveau
    `contractual_instrument`.
  * **Aucun facteur n'est choisi silencieusement** : chaque sélection porte son
    `level` ET sa `reason`, et l'échec du dernier niveau est une erreur.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Iterable, Literal, Sequence

from services.calculations import CalculationError, units

# Tolérance de comparaison des volumes (MWh) — les quantités sont des NUMERIC
# convertis en float ; on ne refuse pas une allocation pour 1e-12 MWh d'écart.
EPSILON_MWH = 1e-9

FactorBasis = Literal["location", "market", "residual_mix"]
Basis = Literal["location", "market"]
Segment = Literal["total", "covered", "uncovered"]
DataQuality = Literal["verified", "estimated", "manual", "inferred"]

# Zones supranationales reconnues. Une zone qui n'est ni sous-nationale
# (contient un tiret, ex. FR-IDF) ni un code pays ISO-2 est traitée comme
# régionale — donc soumise à l'exigence de documentation explicite (niveau 3).
SUPRANATIONAL_ZONES = frozenset({
    "EU", "EU27", "EU28", "UE", "EUROPE", "EEA", "ENTSOE", "UCTE", "NORDIC",
    "OECD", "WORLD", "GLOBAL", "AFRICA", "ASIA", "AMERICAS", "LATAM", "MENA",
})

# Taux d'émission conventionnel porté par un instrument contractuel de
# production renouvelable (REC/GO/PPA/tarif vert) : l'attribut acheté EST la
# caractéristique d'émission de la production associée. Constante nommée et
# documentée — jamais un 0 magique perdu dans le code.
INSTRUMENT_EMISSION_RATE_KGCO2E_PER_MWH = 0.0

# Score de confiance (0-100) par niveau de hiérarchie retenu. Déterministe et
# documenté : la confiance n'est PAS le statut de donnée et n'est PAS un score
# de risque (contrats §2 — ne jamais fusionner ces trois grandeurs).
LEVEL_CONFIDENCE: dict[str, int] = {
    "subnational_grid": 100,
    "national_grid": 90,
    "documented_regional": 65,
    "contractual_instrument": 100,
    "supplier_factor_sourced": 85,
    "supplier_factor": 70,
    "residual_mix_sourced": 80,
    "residual_mix": 70,
    "documented_fallback": 45,
}

# Pénalités de confiance au niveau du run (part pondérée par les MWh).
PENALTY_PENDING_REVIEW = 15
PENALTY_MISSING_FACTOR = 50


# ---------------------------------------------------------------------------
# Méthodologie
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Methodology:
    """Méthode de calcul versionnée (contrats §4 : pas de calcul sans méthode).

    `allow_market_fallback` est le SEUL interrupteur qui autorise le niveau 4 de
    la hiérarchie market-based. Il est **faux par défaut** : sans autorisation
    méthodologique explicite, l'absence d'instrument, de facteur fournisseur ET
    de mix résiduel est une erreur, pas un repli.
    """

    code: str = "CC-SCOPE2-DUAL"
    version: str = "1.0.0"
    allow_market_fallback: bool = False
    fallback_note: str | None = None


DEFAULT_METHODOLOGY = Methodology()


# ---------------------------------------------------------------------------
# Entrées (immuables) — miroir typé du ledger énergie (migration 031)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FactorCandidate:
    """Un facteur candidat = une ligne `energy_factor_metadata` jointe à son
    `emission_factors`. `source_release_id` non nul ⇒ facteur SOURCÉ (tracé par
    une release du noyau Evidence Kernel), ce qui conditionne son admissibilité
    au niveau régional et son `data_quality`."""

    ef_id: int
    ef_code: str
    ef_version: str
    factor_value: float
    factor_unit: str
    basis: FactorBasis
    carrier: str
    geography_code: str | None
    valid_from: date | None = None
    valid_to: date | None = None
    source_release_id: int | None = None
    label: str | None = None
    license_allows_derived_use: bool = True

    @property
    def is_sourced(self) -> bool:
        return self.source_release_id is not None

    def rate_kgco2e_per_mwh(self) -> float:
        """Facteur ramené en kgCO2e/MWh (erreur explicite si non convertible)."""
        return units.factor_to_kgco2e_per_mwh(self.factor_value, self.factor_unit)


@dataclass(frozen=True)
class AllocationInput:
    """Une allocation d'instrument contractuel à une activité (table
    `instrument_allocations` jointe à `contractual_instruments`)."""

    allocation_id: int
    instrument_id: int
    instrument_type: str
    allocated_mwh: float
    carrier: str
    valid_from: date
    valid_to: date
    instrument_volume_mwh: float
    status: str = "active"
    geography_code: str | None = None
    certificate_artifact_id: int | None = None
    reference: str | None = None


@dataclass(frozen=True)
class ActivityInput:
    """Une activité de consommation (table `energy_activities`) + ses allocations.

    `geography_code` est la zone de réseau déclarée pour cette consommation
    (résolue en amont : zone du périmètre, ou surcharge par site). Elle est
    OBLIGATOIRE — un calcul location-based sans zone n'a pas de sens, et la
    deviner serait un choix silencieux.
    """

    activity_id: int
    carrier: str
    quantity: float
    unit: str
    period_start: date
    period_end: date
    geography_code: str
    site_id: int | None = None
    meter_id: int | None = None
    data_status: str = "manual"
    review_status: str = "pending"
    allocations: tuple[AllocationInput, ...] = ()


# ---------------------------------------------------------------------------
# Sorties
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FactorSelection:
    """Résultat d'une sélection de facteur — TOUJOURS accompagné de son niveau
    et de sa raison (« aucun facteur choisi silencieusement »)."""

    level: str
    reason: str
    rate_kgco2e_per_mwh: float
    factor_basis: str
    confidence: int
    data_quality: DataQuality
    ef_id: int | None = None
    ef_code: str | None = None
    ef_version: str | None = None
    fallback_reason: str | None = None
    instrument_id: int | None = None
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class LineResult:
    """Une ligne de trace de calcul (table `scope2_line_results`)."""

    energy_activity_id: int
    basis: Basis
    segment: Segment
    carrier: str
    geography_code: str | None
    period_start: date
    period_end: date
    activity_value: float
    activity_unit: str
    activity_mwh: float
    result_tco2e: float
    selection: FactorSelection

    @property
    def uncertainty(self) -> float:
        """Incertitude conventionnelle dérivée du niveau retenu : 1 - confiance.
        Une valeur de présentation, pas une propagation d'incertitude physique
        (aucune donnée d'incertitude n'existe dans le catalogue de facteurs)."""
        return round((100 - self.selection.confidence) / 100.0, 4)


@dataclass(frozen=True)
class MissingFactor:
    """Un facteur introuvable au terme de sa hiérarchie — l'erreur explicite du
    dernier niveau, CONSERVÉE et remontée plutôt qu'avalée. L'activité concernée
    ne contribue à AUCUN total (jamais substituée par zéro)."""

    energy_activity_id: int
    basis: Basis
    segment: Segment
    carrier: str
    geography_code: str | None
    activity_mwh: float
    message: str


@dataclass(frozen=True)
class Scope2Result:
    """Résultat complet d'un run : les deux totaux, la couverture, la trace."""

    location_based_tco2e: float
    market_based_tco2e: float
    total_consumption_mwh: float
    calculated_consumption_mwh: float
    contractual_coverage_mwh: float
    contractual_coverage_pct: float
    uncovered_mwh: float
    residual_mix_used: bool
    confidence: int
    coverage_pct: float
    lines: tuple[LineResult, ...]
    missing_factors: tuple[MissingFactor, ...]
    warnings: tuple[str, ...]
    factor_versions: tuple[dict[str, Any], ...]
    methodology: Methodology

    @property
    def is_complete(self) -> bool:
        """Un run est complet quand AUCUN facteur ne manque. Un run incomplet
        reste consultable (la trace montre exactement ce qui manque) mais ne
        peut pas être approuvé — cf. `scope2_runs.approve_run`."""
        return not self.missing_factors


# ---------------------------------------------------------------------------
# Zones géographiques
# ---------------------------------------------------------------------------

def geo_level(code: str | None) -> Literal["subnational", "national", "regional", "unknown"]:
    """Granularité d'une zone, par une règle DÉTERMINISTE et documentée :

      * contient un tiret (ISO 3166-2, ex. `FR-IDF`) → **sous-national** ;
      * code supranational connu (`EU`, `OECD`, `WORLD`…) → **régional** ;
      * code pays ISO 3166-1 alpha-2 (2 lettres, ex. `FR`) → **national** ;
      * tout le reste → **régional** (traité comme supranational : soumis à
        l'exigence de documentation explicite, jamais promu national par défaut).
    """
    if not code:
        return "unknown"
    normalized = code.strip().upper()
    if not normalized:
        return "unknown"
    if "-" in normalized:
        return "subnational"
    if normalized in SUPRANATIONAL_ZONES:
        return "regional"
    if len(normalized) == 2 and normalized.isalpha():
        return "national"
    return "regional"


def national_of(code: str | None) -> str | None:
    """Zone nationale parente d'une zone : `FR-IDF` → `FR`, `FR` → `FR`,
    zone régionale → `None` (une zone supranationale n'a pas de pays parent)."""
    if not code:
        return None
    normalized = code.strip().upper()
    level = geo_level(normalized)
    if level == "subnational":
        return normalized.split("-", 1)[0]
    if level == "national":
        return normalized
    return None


def _period_covers(
    valid_from: date | None, valid_to: date | None, start: date, end: date
) -> bool:
    """La fenêtre de validité du facteur couvre-t-elle toute la période
    d'activité ? Bornes ouvertes (`None`) = pas de limite de ce côté. On exige
    une couverture TOTALE : un facteur valable sur la moitié de la période n'est
    pas « à peu près bon », il est incompatible (compatibilité d'année)."""
    if valid_from is not None and start < valid_from:
        return False
    if valid_to is not None and end > valid_to:
        return False
    return True


def _eligible(candidate: FactorCandidate, activity: ActivityInput) -> bool:
    """Filtres transverses appliqués AVANT toute hiérarchie : vecteur (la
    « technologie » pertinente ici), période, unité convertible et licence."""
    if candidate.carrier != activity.carrier:
        return False
    if not _period_covers(
        candidate.valid_from, candidate.valid_to, activity.period_start, activity.period_end
    ):
        return False
    if not units.is_energy_unit(candidate.factor_unit):
        return False
    if not candidate.license_allows_derived_use:
        return False
    return True


def _sort_candidates(candidates: Iterable[FactorCandidate]) -> list[FactorCandidate]:
    """Ordre total déterministe : à niveau de hiérarchie égal, le facteur SOURCÉ
    prime, puis le plus récemment valide, puis le plus petit `ef_id`. Sans cet
    ordre, deux exécutions pourraient retenir deux facteurs différents — la
    reproductibilité serait perdue."""
    return sorted(
        candidates,
        key=lambda c: (
            0 if c.is_sourced else 1,
            -(c.valid_from.toordinal() if c.valid_from else 0),
            c.ef_id,
        ),
    )


# ---------------------------------------------------------------------------
# Hiérarchie LOCATION-BASED
# ---------------------------------------------------------------------------

def select_location_factor(
    activity: ActivityInput, candidates: Sequence[FactorCandidate]
) -> FactorSelection:
    """Sélectionne le facteur location-based selon la hiérarchie stricte.

    Niveau 4 = `CalculationError` explicite. Jamais de zéro par défaut, jamais
    de facteur d'une autre base : seuls les candidats `basis='location'` sont
    considérés (un facteur `market` ou `residual_mix` n'est pas un facteur de
    réseau et ne peut pas servir ici).
    """
    zone = (activity.geography_code or "").strip().upper()
    if not zone:
        raise CalculationError(
            f"Zone de réseau requise pour l'activité {activity.activity_id} : "
            "aucun facteur location-based ne peut être choisi sans zone déclarée."
        )

    pool = _sort_candidates(
        c for c in candidates if c.basis == "location" and _eligible(c, activity)
    )
    country = national_of(zone)

    # Niveau 1 — facteur de réseau SOUS-NATIONAL, zone exacte.
    for c in pool:
        code = (c.geography_code or "").strip().upper()
        if geo_level(code) == "subnational" and code == zone:
            return _location_selection(c, "subnational_grid",
                                       f"Facteur de réseau sous-national {code} (zone exacte).")

    # Niveau 2 — facteur NATIONAL (zone elle-même si nationale, sinon parent).
    if country:
        for c in pool:
            code = (c.geography_code or "").strip().upper()
            if geo_level(code) == "national" and code == country:
                return _location_selection(c, "national_grid",
                                           f"Facteur de réseau national {code}"
                                           + (f" (parent de {zone})." if code != zone else "."))

    # Niveau 3 — facteur RÉGIONAL, admis SEULEMENT s'il est explicitement
    # documenté (sourcé par une release). Un facteur régional non sourcé est
    # rejeté : « explicitement documenté » est une condition, pas un vœu.
    for c in pool:
        code = (c.geography_code or "").strip().upper()
        if geo_level(code) == "regional" and c.is_sourced:
            return _location_selection(
                c, "documented_regional",
                f"Facteur régional documenté {code} (release {c.source_release_id}) — "
                f"aucun facteur sous-national ni national disponible pour {zone}.",
                warnings=(
                    f"Activité {activity.activity_id} : facteur location-based régional "
                    f"({code}) utilisé faute de facteur national pour {zone} — "
                    "précision géographique dégradée.",
                ),
            )

    # Niveau 4 — ERREUR EXPLICITE.
    raise CalculationError(
        f"Aucun facteur location-based admissible pour l'activité "
        f"{activity.activity_id} (vecteur {activity.carrier}, zone {zone}, période "
        f"{activity.period_start}→{activity.period_end}). Hiérarchie épuisée : "
        "ni sous-national, ni national, ni régional documenté."
    )


def _location_selection(
    c: FactorCandidate, level: str, reason: str, warnings: tuple[str, ...] = ()
) -> FactorSelection:
    return FactorSelection(
        level=level,
        reason=reason,
        rate_kgco2e_per_mwh=c.rate_kgco2e_per_mwh(),
        factor_basis="location",
        confidence=LEVEL_CONFIDENCE[level],
        # Un facteur sourcé (release tracée) est vérifié ; sinon c'est une
        # donnée de catalogue non sourcée → `estimated`, jamais `verified`.
        data_quality="verified" if c.is_sourced else "estimated",
        ef_id=c.ef_id,
        ef_code=c.ef_code,
        ef_version=c.ef_version,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Hiérarchie MARKET-BASED
# ---------------------------------------------------------------------------

def select_instrument_factor(
    activity: ActivityInput, allocation: AllocationInput
) -> FactorSelection:
    """Niveau 1 market-based — un instrument contractuel VALIDE et alloué.

    L'instrument porte l'attribut d'émission de la production associée
    (constante `INSTRUMENT_EMISSION_RATE_KGCO2E_PER_MWH`). Un instrument SANS
    certificat (`certificate_artifact_id IS NULL`) reste utilisable mais n'est
    **jamais** présenté comme vérifié : `estimated` + warning. C'est l'interdit
    « un proxy fournisseur présenté comme facteur contractuel vérifié ».
    """
    verified = allocation.certificate_artifact_id is not None
    warnings: tuple[str, ...] = ()
    if not verified:
        warnings = (
            f"Instrument {allocation.instrument_id} ({allocation.instrument_type}) alloué "
            f"à l'activité {activity.activity_id} sans certificat attaché — couverture "
            "contractuelle comptée comme ESTIMÉE, non vérifiée.",
        )
    return FactorSelection(
        level="contractual_instrument",
        reason=(
            f"Instrument contractuel {allocation.instrument_type} #{allocation.instrument_id} "
            f"valide {allocation.valid_from}→{allocation.valid_to}, alloué "
            f"{allocation.allocated_mwh} MWh."
        ),
        rate_kgco2e_per_mwh=INSTRUMENT_EMISSION_RATE_KGCO2E_PER_MWH,
        factor_basis="contractual_instrument",
        confidence=LEVEL_CONFIDENCE["contractual_instrument"],
        data_quality="verified" if verified else "estimated",
        instrument_id=allocation.instrument_id,
        warnings=warnings,
    )


def select_market_factor(
    activity: ActivityInput,
    candidates: Sequence[FactorCandidate],
    methodology: Methodology = DEFAULT_METHODOLOGY,
    location_candidates: Sequence[FactorCandidate] | None = None,
) -> FactorSelection:
    """Sélectionne le facteur market-based de la part NON COUVERTE par un
    instrument, selon la hiérarchie stricte (niveaux 2 → 4).

    Le niveau 1 (instrument) est traité en amont par `select_instrument_factor`
    sur la part couverte : cette fonction ne s'applique qu'au résidu.

    **Aucun candidat `basis='location'` n'entre ici.** Le niveau 4 (repli) est
    le seul chemin par lequel un facteur de réseau peut intervenir en
    market-based, et il exige `methodology.allow_market_fallback=True` ; il est
    alors étiqueté `documented_fallback` avec `fallback_reason` obligatoire —
    jamais présenté comme un facteur de marché.
    """
    zone = (activity.geography_code or "").strip().upper()
    pool = _sort_candidates(
        c for c in candidates
        if c.basis in ("market", "residual_mix") and _eligible(c, activity)
    )

    # Niveau 2 — facteur FOURNISSEUR admissible (basis='market').
    for c in pool:
        if c.basis == "market" and _zone_compatible(c.geography_code, zone):
            level = "supplier_factor_sourced" if c.is_sourced else "supplier_factor"
            warnings: tuple[str, ...] = ()
            if not c.is_sourced:
                warnings = (
                    f"Activité {activity.activity_id} : facteur fournisseur "
                    f"'{c.ef_code}' non sourcé (aucune release) — comptabilisé comme "
                    "ESTIMÉ, jamais comme facteur contractuel vérifié.",
                )
            return FactorSelection(
                level=level,
                reason=(
                    f"Facteur fournisseur admissible '{c.ef_code}' "
                    f"(zone {c.geography_code}, base market)"
                    + (f", sourcé par la release {c.source_release_id}." if c.is_sourced
                       else ", non sourcé.")
                ),
                rate_kgco2e_per_mwh=c.rate_kgco2e_per_mwh(),
                factor_basis="market",
                confidence=LEVEL_CONFIDENCE[level],
                data_quality="verified" if c.is_sourced else "estimated",
                ef_id=c.ef_id,
                ef_code=c.ef_code,
                ef_version=c.ef_version,
                warnings=warnings,
            )

    # Niveau 3 — MIX RÉSIDUEL compatible.
    for c in pool:
        if c.basis == "residual_mix" and _zone_compatible(c.geography_code, zone):
            level = "residual_mix_sourced" if c.is_sourced else "residual_mix"
            return FactorSelection(
                level=level,
                reason=(
                    f"Mix résiduel '{c.ef_code}' (zone {c.geography_code})"
                    + (f", sourcé par la release {c.source_release_id}." if c.is_sourced
                       else ", non sourcé.")
                ),
                rate_kgco2e_per_mwh=c.rate_kgco2e_per_mwh(),
                factor_basis="residual_mix",
                confidence=LEVEL_CONFIDENCE[level],
                data_quality="verified" if c.is_sourced else "estimated",
                ef_id=c.ef_id,
                ef_code=c.ef_code,
                ef_version=c.ef_version,
                warnings=(
                    f"Activité {activity.activity_id} : part non couverte "
                    "comptabilisée au MIX RÉSIDUEL (aucun instrument ni facteur "
                    "fournisseur pour cette part).",
                ),
            )

    # Niveau 4 — REPLI, uniquement si la méthodologie l'autorise EXPLICITEMENT.
    if methodology.allow_market_fallback:
        fallback = _market_fallback(activity, location_candidates or (), methodology)
        if fallback is not None:
            return fallback

    raise CalculationError(
        f"Aucun facteur market-based admissible pour l'activité "
        f"{activity.activity_id} (vecteur {activity.carrier}, zone {zone}, période "
        f"{activity.period_start}→{activity.period_end}). Hiérarchie épuisée : ni "
        "instrument contractuel, ni facteur fournisseur, ni mix résiduel. La "
        "méthodologie "
        f"{methodology.code} {methodology.version} n'autorise aucun repli — "
        "une moyenne de réseau n'est jamais un résultat market-based."
    )


def _zone_compatible(factor_zone: str | None, activity_zone: str) -> bool:
    """Compatibilité de zone pour un facteur de marché / mix résiduel.

    Un facteur de marché sans zone (`NULL`) est réputé porter sur le contrat, pas
    sur une géographie : il est compatible. Sinon la zone du facteur doit être
    la zone de l'activité, ou sa nationale parente.
    """
    if not factor_zone:
        return True
    code = factor_zone.strip().upper()
    if not activity_zone:
        return False
    return code == activity_zone or code == national_of(activity_zone)


def _market_fallback(
    activity: ActivityInput,
    location_candidates: Sequence[FactorCandidate],
    methodology: Methodology,
) -> FactorSelection | None:
    """Niveau 4 — repli documenté sur le facteur de réseau, SI et seulement si
    la méthodologie l'autorise. Étiqueté `documented_fallback` (jamais
    `location`) et porteur d'un `fallback_reason` obligatoire : le lecteur du
    résultat voit immédiatement que cette part n'est pas un vrai market-based.
    """
    try:
        location = select_location_factor(activity, location_candidates)
    except CalculationError:
        return None
    reason = (
        methodology.fallback_note
        or "Repli explicitement autorisé par la méthodologie : à défaut d'instrument, "
           "de facteur fournisseur et de mix résiduel, la part non couverte est "
           "valorisée au facteur de réseau."
    )
    return FactorSelection(
        level="documented_fallback",
        reason=(
            f"Repli documenté sur le facteur de réseau ({location.level}, "
            f"'{location.ef_code}') — méthodologie {methodology.code} "
            f"{methodology.version}."
        ),
        rate_kgco2e_per_mwh=location.rate_kgco2e_per_mwh,
        factor_basis="documented_fallback",
        confidence=LEVEL_CONFIDENCE["documented_fallback"],
        data_quality="estimated",
        ef_id=location.ef_id,
        ef_code=location.ef_code,
        ef_version=location.ef_version,
        fallback_reason=reason,
        warnings=(
            f"Activité {activity.activity_id} : part non couverte valorisée par REPLI "
            "documenté sur le facteur de réseau — ce n'est PAS un résultat "
            "market-based au sens strict du GHG Protocol.",
        ),
    )


# ---------------------------------------------------------------------------
# Contrôles d'allocation
# ---------------------------------------------------------------------------

@dataclass
class _AllocationCheck:
    valid: list[AllocationInput] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _check_allocations(activity: ActivityInput, activity_mwh: float, today: date) -> _AllocationCheck:
    """Contrôles d'allocation d'une activité (contrôles obligatoires du plan) :

      * **double allocation** : deux allocations du MÊME instrument à la MÊME
        activité → erreur explicite (la base l'interdit déjà via `UNIQUE`, on ne
        s'y fie pas aveuglément au moment de calculer) ;
      * **vecteur compatible** (technologie pertinente ici) → exclusion + warning ;
      * **période compatible** : la consommation doit tomber dans la validité de
        l'instrument → exclusion + warning ;
      * **instrument actif** (non annulé/expiré à la date de calcul) → exclusion
        + warning ;
      * **quantité couverte ≤ consommation** → erreur explicite (survente d'un
        périmètre : on ne peut pas couvrir plus que ce qu'on a consommé).
    """
    check = _AllocationCheck()
    seen: set[int] = set()
    for alloc in sorted(activity.allocations, key=lambda a: a.allocation_id):
        if alloc.instrument_id in seen:
            raise CalculationError(
                f"Double allocation détectée : l'instrument {alloc.instrument_id} est "
                f"alloué plusieurs fois à l'activité {activity.activity_id}."
            )
        seen.add(alloc.instrument_id)

        if alloc.carrier != activity.carrier:
            check.warnings.append(
                f"Allocation {alloc.allocation_id} ignorée : vecteur incompatible "
                f"(instrument {alloc.carrier} vs activité {activity.carrier})."
            )
            continue
        if alloc.status != "active":
            check.warnings.append(
                f"Allocation {alloc.allocation_id} ignorée : instrument "
                f"{alloc.instrument_id} non actif (statut {alloc.status})."
            )
            continue
        if alloc.valid_to < today:
            check.warnings.append(
                f"Allocation {alloc.allocation_id} ignorée : instrument "
                f"{alloc.instrument_id} expiré le {alloc.valid_to}."
            )
            continue
        if activity.period_start < alloc.valid_from or activity.period_end > alloc.valid_to:
            check.warnings.append(
                f"Allocation {alloc.allocation_id} ignorée : période d'activité "
                f"{activity.period_start}→{activity.period_end} hors de la validité de "
                f"l'instrument {alloc.instrument_id} "
                f"({alloc.valid_from}→{alloc.valid_to})."
            )
            continue
        if alloc.allocated_mwh <= 0:
            check.warnings.append(
                f"Allocation {alloc.allocation_id} ignorée : volume alloué non positif."
            )
            continue
        check.valid.append(alloc)

    covered = sum(a.allocated_mwh for a in check.valid)
    if covered > activity_mwh + EPSILON_MWH:
        raise CalculationError(
            f"Quantité couverte supérieure à la consommation pour l'activité "
            f"{activity.activity_id} : {covered} MWh alloués pour {activity_mwh} MWh "
            "consommés. Une couverture contractuelle ne peut pas excéder la "
            "consommation qu'elle couvre."
        )
    return check


def _check_instrument_volumes(activities: Sequence[ActivityInput]) -> None:
    """Contrôle transverse : le volume utilisé d'un instrument (toutes activités
    confondues) ne peut pas dépasser son volume émis. La base l'impose déjà
    (trigger `energy_allocation_guard`), mais un run se calcule sur un snapshot
    et doit revérifier — un instrument dont le volume aurait été réduit après
    coup rendrait des allocations historiquement valides désormais excessives.
    """
    used: dict[int, float] = {}
    volume: dict[int, float] = {}
    for activity in activities:
        for alloc in activity.allocations:
            used[alloc.instrument_id] = used.get(alloc.instrument_id, 0.0) + alloc.allocated_mwh
            volume[alloc.instrument_id] = alloc.instrument_volume_mwh
    for instrument_id in sorted(used):
        if used[instrument_id] > volume[instrument_id] + EPSILON_MWH:
            raise CalculationError(
                f"Volume utilisé supérieur au volume de l'instrument {instrument_id} : "
                f"{used[instrument_id]} MWh alloués pour {volume[instrument_id]} MWh émis "
                "(survente de garanties)."
            )


# ---------------------------------------------------------------------------
# Calcul
# ---------------------------------------------------------------------------

def _tco2e(mwh: float, rate_kgco2e_per_mwh: float) -> float:
    """MWh × kgCO2e/MWh → tCO2e. Valeur BRUTE conservée (l'arrondi est réservé à
    l'affichage) ; on n'arrondit qu'à 9 décimales pour neutraliser le bruit
    binaire et garantir des runs bit-à-bit reproductibles."""
    return round(units.kg_to_tonnes(mwh * rate_kgco2e_per_mwh), 9)


def calculate(
    activities: Sequence[ActivityInput],
    factors: Sequence[FactorCandidate],
    *,
    methodology: Methodology = DEFAULT_METHODOLOGY,
    today: date | None = None,
) -> Scope2Result:
    """Calcule le Scope 2 dual sur un ensemble d'activités.

    Fonction PURE et REPRODUCTIBLE : mêmes entrées ⇒ mêmes sorties. `today` (par
    défaut la date du jour) n'intervient QUE dans le contrôle d'expiration des
    instruments et doit être fourni explicitement pour un calcul rejouable.

    Les erreurs de fin de hiérarchie ne font pas échouer tout le run : elles sont
    capturées en `MissingFactor` (avec le message d'erreur explicite intégral),
    l'activité concernée ne contribue à AUCUN total, et le run devient
    **incomplet** — donc non approuvable. C'est le compromis entre « erreur
    explicite » et « la trace doit montrer tout ce qui manque, pas seulement le
    premier problème ».
    """
    today = today or date.today()
    ordered = sorted(activities, key=lambda a: a.activity_id)
    _check_instrument_volumes(ordered)

    lines: list[LineResult] = []
    missing: list[MissingFactor] = []
    warnings: list[str] = []
    factor_versions: dict[tuple[int, str], dict[str, Any]] = {}

    total_mwh = 0.0
    covered_total = 0.0
    uncovered_total = 0.0
    residual_used = False
    lb_total = 0.0
    mb_total = 0.0
    pending_mwh = 0.0
    missing_mwh = 0.0
    calculated_mwh = 0.0

    for activity in ordered:
        # Unité convertible — erreur explicite sinon (jamais de conversion « au mieux »).
        activity_mwh = units.to_mwh(activity.quantity, activity.unit)
        total_mwh += activity_mwh
        if activity.review_status == "pending":
            pending_mwh += activity_mwh
            warnings.append(
                f"Activité {activity.activity_id} incluse alors qu'elle est encore EN "
                "ATTENTE DE REVUE (review_status=pending)."
            )

        check = _check_allocations(activity, activity_mwh, today)
        warnings.extend(check.warnings)
        covered = sum(a.allocated_mwh for a in check.valid)
        uncovered = max(0.0, activity_mwh - covered)
        covered_total += covered
        uncovered_total += uncovered

        # ── Location-based : une seule ligne, sur la TOTALITÉ de la consommation.
        # Les instruments contractuels n'ont AUCUN effet en location-based.
        lb_missing = False
        try:
            lb_sel = select_location_factor(activity, factors)
        except CalculationError as exc:
            lb_missing = True
            missing.append(MissingFactor(
                energy_activity_id=activity.activity_id, basis="location", segment="total",
                carrier=activity.carrier, geography_code=activity.geography_code,
                activity_mwh=activity_mwh, message=str(exc),
            ))
            warnings.append(str(exc))
        else:
            value = _tco2e(activity_mwh, lb_sel.rate_kgco2e_per_mwh)
            lb_total += value
            warnings.extend(lb_sel.warnings)
            _record_factor(factor_versions, lb_sel, "location")
            lines.append(LineResult(
                energy_activity_id=activity.activity_id, basis="location", segment="total",
                carrier=activity.carrier, geography_code=activity.geography_code,
                period_start=activity.period_start, period_end=activity.period_end,
                activity_value=activity.quantity, activity_unit=activity.unit,
                activity_mwh=activity_mwh, result_tco2e=value, selection=lb_sel,
            ))

        # ── Market-based : part COUVERTE (par instrument) + part NON COUVERTE.
        mb_missing = False
        for alloc in check.valid:
            sel = select_instrument_factor(activity, alloc)
            value = _tco2e(alloc.allocated_mwh, sel.rate_kgco2e_per_mwh)
            mb_total += value
            warnings.extend(sel.warnings)
            lines.append(LineResult(
                energy_activity_id=activity.activity_id, basis="market", segment="covered",
                carrier=activity.carrier, geography_code=activity.geography_code,
                period_start=activity.period_start, period_end=activity.period_end,
                activity_value=alloc.allocated_mwh, activity_unit="MWh",
                activity_mwh=alloc.allocated_mwh, result_tco2e=value, selection=sel,
            ))

        if uncovered > EPSILON_MWH:
            try:
                mb_sel = select_market_factor(
                    activity, factors, methodology=methodology, location_candidates=factors,
                )
            except CalculationError as exc:
                mb_missing = True
                missing.append(MissingFactor(
                    energy_activity_id=activity.activity_id, basis="market",
                    segment="uncovered", carrier=activity.carrier,
                    geography_code=activity.geography_code, activity_mwh=uncovered,
                    message=str(exc),
                ))
                warnings.append(str(exc))
            else:
                if mb_sel.factor_basis == "residual_mix":
                    residual_used = True
                value = _tco2e(uncovered, mb_sel.rate_kgco2e_per_mwh)
                mb_total += value
                warnings.extend(mb_sel.warnings)
                _record_factor(factor_versions, mb_sel, "market")
                lines.append(LineResult(
                    energy_activity_id=activity.activity_id, basis="market",
                    segment="uncovered", carrier=activity.carrier,
                    geography_code=activity.geography_code,
                    period_start=activity.period_start, period_end=activity.period_end,
                    activity_value=uncovered, activity_unit="MWh", activity_mwh=uncovered,
                    result_tco2e=value, selection=mb_sel,
                ))

        if lb_missing or mb_missing:
            missing_mwh += activity_mwh
        else:
            calculated_mwh += activity_mwh

    confidence = _confidence(
        lines=lines, total_mwh=total_mwh, pending_mwh=pending_mwh, missing_mwh=missing_mwh,
    )
    coverage_pct = _pct(calculated_mwh, total_mwh)
    contractual_pct = _pct(covered_total, total_mwh)

    if missing:
        warnings.append(
            f"Run INCOMPLET : {len(missing)} facteur(s) manquant(s) — "
            f"{round(missing_mwh, 6)} MWh non calculés, exclus des totaux (jamais "
            "remplacés par zéro). Ce run ne peut pas être approuvé en l'état."
        )

    return Scope2Result(
        location_based_tco2e=round(lb_total, 9),
        market_based_tco2e=round(mb_total, 9),
        total_consumption_mwh=round(total_mwh, 9),
        calculated_consumption_mwh=round(calculated_mwh, 9),
        contractual_coverage_mwh=round(covered_total, 9),
        contractual_coverage_pct=contractual_pct,
        uncovered_mwh=round(uncovered_total, 9),
        residual_mix_used=residual_used,
        confidence=confidence,
        coverage_pct=coverage_pct,
        lines=tuple(lines),
        missing_factors=tuple(missing),
        warnings=tuple(_dedupe(warnings)),
        factor_versions=tuple(
            factor_versions[k] for k in sorted(factor_versions, key=lambda t: (t[0], t[1]))
        ),
        methodology=methodology,
    )


def _record_factor(
    registry: dict[tuple[int, str], dict[str, Any]], sel: FactorSelection, basis: str
) -> None:
    """Consigne un facteur RÉELLEMENT utilisé (`factor_versions` des contrats §4).
    Un facteur candidat non retenu n'y figure pas — la liste dit ce qui a servi,
    pas ce qui existait."""
    if sel.ef_id is None:
        return
    key = (sel.ef_id, basis)
    registry.setdefault(key, {
        "ef_id": sel.ef_id,
        "ef_code": sel.ef_code,
        "ef_version": sel.ef_version,
        "basis": basis,
        "selection_level": sel.level,
        "factor_basis": sel.factor_basis,
    })


def _pct(part: float, whole: float) -> float:
    if whole <= 0:
        return 0.0
    return round(min(100.0, max(0.0, part / whole * 100.0)), 4)


def _confidence(
    *, lines: Sequence[LineResult], total_mwh: float, pending_mwh: float, missing_mwh: float
) -> int:
    """Confiance 0-100 (entier, présentation — contrats §4).

    Moyenne des scores de niveau pondérée par les MWh de chaque ligne, puis
    pénalités pour la part encore en attente de revue et la part non calculée.
    Déterministe, sans aléa : deux runs identiques donnent la même confiance.
    """
    if not lines:
        return 0
    weight = sum(line.activity_mwh for line in lines)
    if weight <= 0:
        base = sum(line.selection.confidence for line in lines) / len(lines)
    else:
        base = sum(line.selection.confidence * line.activity_mwh for line in lines) / weight
    if total_mwh > 0:
        base -= PENALTY_PENDING_REVIEW * (pending_mwh / total_mwh)
        base -= PENALTY_MISSING_FACTOR * (missing_mwh / total_mwh)
    return int(max(0, min(100, round(base))))


def _dedupe(messages: Iterable[str]) -> list[str]:
    """Déduplique en conservant l'ordre d'apparition (un même warning répété par
    12 activités n'a pas besoin d'être lu 12 fois, mais l'ordre reste celui du
    calcul — donc reproductible)."""
    seen: set[str] = set()
    out: list[str] = []
    for message in messages:
        if message not in seen:
            seen.add(message)
            out.append(message)
    return out


# ---------------------------------------------------------------------------
# Snapshot d'entrée & empreinte (reproductibilité)
# ---------------------------------------------------------------------------

def build_input_snapshot(
    activities: Sequence[ActivityInput],
    factors: Sequence[FactorCandidate],
    *,
    methodology: Methodology,
    period_start: date,
    period_end: date,
    geography_code: str,
    today: date,
) -> dict[str, Any]:
    """Gèle les entrées d'un run sous une forme canonique et sérialisable.

    Le snapshot est ce qui rend le run REJOUABLE : il contient les activités,
    leurs allocations et les facteurs candidats tels qu'ils étaient au moment du
    calcul, plus la méthodologie et la date de référence. Ordre déterministe
    (tri par identifiant) pour que deux runs identiques produisent des snapshots
    bit-à-bit identiques.
    """
    return {
        "methodology": {
            "code": methodology.code,
            "version": methodology.version,
            "allow_market_fallback": methodology.allow_market_fallback,
            "fallback_note": methodology.fallback_note,
        },
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "geography_code": geography_code,
        "reference_date": today.isoformat(),
        "activities": [
            {
                "activity_id": a.activity_id,
                "site_id": a.site_id,
                "meter_id": a.meter_id,
                "carrier": a.carrier,
                "quantity": float(a.quantity),
                "unit": a.unit,
                "period_start": a.period_start.isoformat(),
                "period_end": a.period_end.isoformat(),
                "geography_code": a.geography_code,
                "data_status": a.data_status,
                "review_status": a.review_status,
                "allocations": [
                    {
                        "allocation_id": al.allocation_id,
                        "instrument_id": al.instrument_id,
                        "instrument_type": al.instrument_type,
                        "allocated_mwh": float(al.allocated_mwh),
                        "carrier": al.carrier,
                        "valid_from": al.valid_from.isoformat(),
                        "valid_to": al.valid_to.isoformat(),
                        "instrument_volume_mwh": float(al.instrument_volume_mwh),
                        "status": al.status,
                        "geography_code": al.geography_code,
                        "certificate_artifact_id": al.certificate_artifact_id,
                        "reference": al.reference,
                    }
                    for al in sorted(a.allocations, key=lambda x: x.allocation_id)
                ],
            }
            for a in sorted(activities, key=lambda x: x.activity_id)
        ],
        "factor_candidates": [
            {
                "ef_id": c.ef_id,
                "ef_code": c.ef_code,
                "ef_version": c.ef_version,
                "factor_value": float(c.factor_value),
                "factor_unit": c.factor_unit,
                "basis": c.basis,
                "carrier": c.carrier,
                "geography_code": c.geography_code,
                "valid_from": c.valid_from.isoformat() if c.valid_from else None,
                "valid_to": c.valid_to.isoformat() if c.valid_to else None,
                "source_release_id": c.source_release_id,
                "license_allows_derived_use": c.license_allows_derived_use,
            }
            for c in sorted(factors, key=lambda x: (x.ef_id, x.basis))
        ],
    }


def canonical_json(payload: Any) -> str:
    """Sérialisation canonique (clés triées, séparateurs fixes) — base de toute
    empreinte reproductible."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def fingerprint(snapshot: dict[str, Any]) -> str:
    """SHA-256 du snapshot canonique : deux runs de même empreinte DOIVENT
    porter le même résultat (propriété vérifiée par test)."""
    return hashlib.sha256(canonical_json(snapshot).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Sérialisation du résultat (trace de calcul)
# ---------------------------------------------------------------------------

def selection_to_dict(sel: FactorSelection) -> dict[str, Any]:
    return {
        "level": sel.level,
        "reason": sel.reason,
        "factor_basis": sel.factor_basis,
        "rate_kgco2e_per_mwh": sel.rate_kgco2e_per_mwh,
        "confidence": sel.confidence,
        "data_quality": sel.data_quality,
        "ef_id": sel.ef_id,
        "ef_code": sel.ef_code,
        "ef_version": sel.ef_version,
        "fallback_reason": sel.fallback_reason,
        "instrument_id": sel.instrument_id,
        "warnings": list(sel.warnings),
    }


def line_to_dict(line: LineResult) -> dict[str, Any]:
    return {
        "energy_activity_id": line.energy_activity_id,
        "basis": line.basis,
        "segment": line.segment,
        "carrier": line.carrier,
        "geography_code": line.geography_code,
        "period_start": line.period_start.isoformat(),
        "period_end": line.period_end.isoformat(),
        "activity_value": line.activity_value,
        "activity_unit": line.activity_unit,
        "activity_mwh": line.activity_mwh,
        "result_tco2e": line.result_tco2e,
        "uncertainty": line.uncertainty,
        "selection": selection_to_dict(line.selection),
    }


def result_to_dict(result: Scope2Result) -> dict[str, Any]:
    """Forme sérialisable du résultat — sert le champ `result` du run, la trace
    de calcul de l'API et l'Evidence Pack (une seule représentation, pas trois)."""
    return {
        "location_based_tco2e": result.location_based_tco2e,
        "market_based_tco2e": result.market_based_tco2e,
        "total_consumption_mwh": result.total_consumption_mwh,
        "calculated_consumption_mwh": result.calculated_consumption_mwh,
        "contractual_coverage_mwh": result.contractual_coverage_mwh,
        "contractual_coverage_pct": result.contractual_coverage_pct,
        "uncovered_mwh": result.uncovered_mwh,
        "residual_mix_used": result.residual_mix_used,
        "confidence": result.confidence,
        "coverage_pct": result.coverage_pct,
        "is_complete": result.is_complete,
        "methodology": {
            "code": result.methodology.code,
            "version": result.methodology.version,
            "allow_market_fallback": result.methodology.allow_market_fallback,
        },
        "missing_factors": [
            {
                "energy_activity_id": m.energy_activity_id,
                "basis": m.basis,
                "segment": m.segment,
                "carrier": m.carrier,
                "geography_code": m.geography_code,
                "activity_mwh": m.activity_mwh,
                "message": m.message,
            }
            for m in result.missing_factors
        ],
        "factor_versions": [dict(f) for f in result.factor_versions],
        "warnings": list(result.warnings),
        "trace": [line_to_dict(line) for line in result.lines],
    }
