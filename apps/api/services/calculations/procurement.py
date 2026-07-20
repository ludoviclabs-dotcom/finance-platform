"""
services/calculations/procurement.py — moteur Scope 3 catégorie 1 (achats).

**Cœur PUR** : aucune I/O, aucun accès base. Toutes les entrées d'une ligne sont
passées dans `LineContext` par l'orchestrateur
(`services/procurement/calculation_run_service.py`), ce qui rend la hiérarchie
entièrement testable sans PostgreSQL.

═══════════════════════════════════════════════════════════════════════════════
HIÉRARCHIE DE MÉTHODE — ordre non négociable (plan PR-05 §6)
═══════════════════════════════════════════════════════════════════════════════

  1. `supplier_pcf_verified`     PCF fournisseur **vérifiée par tiers ET
                                 comparable** (unité déclarée convertible vers
                                 l'unité de la ligne).
  2. `supplier_specific_hybrid`  Donnée **spécifique au fournisseur** : PCF non
                                 vérifiée par tiers (auto-déclarée) ou
                                 déclaration d'intensité GES du fournisseur.
  3. `average_physical`          Facteur **physique moyen** appliqué à une
                                 quantité (masse issue de la BOM si disponible,
                                 sinon quantité de la ligne).
  4. `spend_based_economic`      Facteur **monétaire** appliqué à une dépense.
  5. `unresolved`                **Aucun chiffre.** La ligne reste dans les
                                 résultats avec la raison de chaque échec, et
                                 alimente la file de correction.

═══════════════════════════════════════════════════════════════════════════════
GARANTIES
═══════════════════════════════════════════════════════════════════════════════

**Aucun fallback silencieux.** Chaque niveau est ESSAYÉ dans l'ordre et son
échec produit une entrée de trace (`method_trace`) avec sa raison. Dès que le
rang retenu n'est pas 1, `fallback_reason` agrège les raisons des niveaux
écartés — jamais vide (le CHECK SQL de la migration 032 le garantit aussi côté
base, même si un appelant l'oubliait).

**Aucune valeur inventée.** Une ligne non résolue a `result_tco2e = None`, pas
`0.0` : un trou de donnée n'est pas une émission nulle.

**Conversion d'unité explicite.** Toute conversion est enregistrée
(`conversion_factor`, `converted_unit`, `conversion_note`). Deux unités de
dimensions différentes ne sont JAMAIS rapprochées — l'incompatibilité fait
échouer le niveau avec sa raison, elle ne produit pas un chiffre approximatif.

**Reproductible.** Fonctions pures, sans horloge ni aléatoire ; arrondi fixe
(`_ROUNDING`) pour que deux exécutions sur les mêmes entrées soient identiques
au bit près dans le stockage.

**Confiance ≠ risque ≠ statut** (contrats §2). Ce module produit `confidence` et
`data_quality` (solidité du chiffre). Le RISQUE fournisseur est une grandeur
distincte, calculée ailleurs (`services/procurement/scoring.py`), jamais fusionnée.

**Aucun LLM.** Aucune suggestion, aucun modèle, aucune heuristique floue : la
sélection de méthode est une cascade de conditions explicites et lisibles.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

METHODOLOGY_CODE = "CC-SCOPE3-CAT1"
METHODOLOGY_VERSION = "1.0.0"

# Arrondi de stockage : borne la dérive de représentation flottante pour que la
# reproductibilité soit vérifiable par égalité stricte.
_ROUNDING = 9

MethodCode = Literal[
    "supplier_pcf_verified",
    "supplier_specific_hybrid",
    "average_physical",
    "spend_based_economic",
    "unresolved",
]

METHOD_RANKS: dict[str, int] = {
    "supplier_pcf_verified": 1,
    "supplier_specific_hybrid": 2,
    "average_physical": 3,
    "spend_based_economic": 4,
    "unresolved": 5,
}

# Ordre canonique de parcours — la source unique de « dans quel ordre on essaie ».
METHOD_ORDER: tuple[str, ...] = (
    "supplier_pcf_verified",
    "supplier_specific_hybrid",
    "average_physical",
    "spend_based_economic",
)


# ---------------------------------------------------------------------------
# Profils de méthode — PARAMÈTRES CONVENTIONNELS de la méthodologie versionnée
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MethodProfile:
    """Incertitude et qualité attachées à une méthode.

    **Ce sont des PARAMÈTRES DE MÉTHODOLOGIE, pas des mesures.** Ils traduisent
    la hiérarchie qualitative reconnue (une PCF vérifiée est plus fiable qu'un
    ratio monétaire) et sont versionnés avec `METHODOLOGY_VERSION` : les faire
    évoluer impose de changer la version, donc de recalculer explicitement.
    Ils ne sont jamais présentés comme une incertitude mesurée sur la donnée
    réelle du fournisseur.
    """

    uncertainty_pct: float | None
    data_quality: float | None
    data_quality_label: str
    confidence: float | None
    data_status: str


METHOD_PROFILES: dict[str, MethodProfile] = {
    "supplier_pcf_verified": MethodProfile(
        uncertainty_pct=10.0, data_quality=0.95, data_quality_label="Élevée",
        confidence=0.90, data_status="verified",
    ),
    "supplier_specific_hybrid": MethodProfile(
        uncertainty_pct=25.0, data_quality=0.75, data_quality_label="Bonne",
        confidence=0.70, data_status="estimated",
    ),
    "average_physical": MethodProfile(
        uncertainty_pct=40.0, data_quality=0.50, data_quality_label="Moyenne",
        confidence=0.50, data_status="estimated",
    ),
    "spend_based_economic": MethodProfile(
        uncertainty_pct=70.0, data_quality=0.25, data_quality_label="Faible",
        confidence=0.30, data_status="estimated",
    ),
    "unresolved": MethodProfile(
        uncertainty_pct=None, data_quality=None, data_quality_label="Non applicable",
        confidence=None, data_status="estimated",
    ),
}

# Méthodes considérées comme « donnée primaire fournisseur » (rangs 1-2) —
# alimente le taux de données primaires exposé par la couverture.
PRIMARY_DATA_METHODS: frozenset[str] = frozenset(
    {"supplier_pcf_verified", "supplier_specific_hybrid"}
)


# ---------------------------------------------------------------------------
# Conversion d'unités — EXPLICITE, par dimension. Jamais de rapprochement
# entre deux dimensions différentes.
# ---------------------------------------------------------------------------

_MASS_TO_KG: dict[str, float] = {
    "kg": 1.0, "kgs": 1.0, "kilogramme": 1.0, "kilogrammes": 1.0,
    "g": 0.001, "gramme": 0.001, "grammes": 0.001,
    "mg": 1e-6,
    "t": 1000.0, "to": 1000.0, "tonne": 1000.0, "tonnes": 1000.0, "tn": 1000.0,
    "kt": 1_000_000.0,
    "lb": 0.45359237, "lbs": 0.45359237,
}

_COUNT_TO_UNIT: dict[str, float] = {
    "unit": 1.0, "units": 1.0, "unite": 1.0, "unites": 1.0, "u": 1.0,
    "pcs": 1.0, "pce": 1.0, "piece": 1.0, "pieces": 1.0,
    "item": 1.0, "items": 1.0, "ea": 1.0,
}

_VOLUME_TO_L: dict[str, float] = {
    "l": 1.0, "litre": 1.0, "litres": 1.0, "lt": 1.0,
    "ml": 0.001, "cl": 0.01,
    "m3": 1000.0, "hl": 100.0,
}

_ENERGY_TO_KWH: dict[str, float] = {
    "kwh": 1.0, "wh": 0.001, "mwh": 1000.0, "gwh": 1_000_000.0,
    "mj": 1.0 / 3.6, "gj": 1000.0 / 3.6,
}

_MONETARY_TO_EUR: dict[str, float] = {
    "eur": 1.0, "€": 1.0, "euro": 1.0, "euros": 1.0,
    "keur": 1000.0, "meur": 1_000_000.0,
}

# (nom de dimension, table de conversion vers l'unité de base)
_DIMENSIONS: tuple[tuple[str, str, dict[str, float]], ...] = (
    ("masse", "kg", _MASS_TO_KG),
    ("quantité", "unit", _COUNT_TO_UNIT),
    ("volume", "l", _VOLUME_TO_L),
    ("énergie", "kWh", _ENERGY_TO_KWH),
    ("monétaire", "EUR", _MONETARY_TO_EUR),
)


def normalize_unit(unit: str | None) -> str | None:
    """Normalise une unité pour la comparaison (casse, espaces, accents usuels).

    Retourne `None` pour une unité absente ou vide — un `None` est traité comme
    « unité inconnue », jamais comme une unité par défaut implicite.
    """
    if unit is None:
        return None
    u = unit.strip().lower().rstrip(".")
    if not u:
        return None
    u = (
        u.replace("é", "e").replace("è", "e").replace("ê", "e")
        .replace("û", "u").replace("ù", "u")
        .replace("³", "3").replace(" ", "")
    )
    return u


def unit_dimension(unit: str | None) -> tuple[str, str, dict[str, float]] | None:
    """Dimension physique d'une unité (masse / quantité / volume / énergie /
    monétaire), ou `None` si l'unité est inconnue du référentiel."""
    u = normalize_unit(unit)
    if u is None:
        return None
    for dim in _DIMENSIONS:
        if u in dim[2]:
            return dim
    return None


@dataclass(frozen=True)
class Conversion:
    """Résultat d'une conversion réussie — conservé tel quel sur la ligne."""

    value: float
    unit: str
    factor: float
    note: str


def convert_units(value: float, from_unit: str | None, to_unit: str | None) -> Conversion | None:
    """Convertit `value` de `from_unit` vers `to_unit`.

    Retourne `None` — jamais une approximation — si :
      - l'une des unités est absente ou inconnue du référentiel ;
      - les deux unités appartiennent à des DIMENSIONS différentes (kg vs kWh).

    L'appelant traite ce `None` comme l'échec explicite d'un niveau de la
    hiérarchie, avec sa raison.
    """
    src = unit_dimension(from_unit)
    dst = unit_dimension(to_unit)
    if src is None or dst is None:
        return None
    if src[0] != dst[0]:
        return None
    from_norm = normalize_unit(from_unit)
    to_norm = normalize_unit(to_unit)
    # Toujours passer par l'unité de base de la dimension : évite d'accumuler
    # deux arrondis successifs et rend le facteur global explicite.
    factor = src[2][from_norm] / dst[2][to_norm]
    return Conversion(
        value=round(value * factor, _ROUNDING),
        unit=to_unit or to_norm or "",
        factor=round(factor, _ROUNDING),
        note=f"{from_unit} → {to_unit} (dimension {src[0]}, ×{factor:g})",
    )


# ---------------------------------------------------------------------------
# Entrées du moteur
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LineInput:
    """Une ligne d'achat, telle que retenue par le périmètre du run."""

    line_id: int
    supplier_id: int | None = None
    supplier_product_id: int | None = None
    quantity: float | None = None
    unit: str | None = None
    spend_amount: float | None = None
    currency: str | None = None
    category_code: str | None = None
    origin_country: str | None = None
    mapping_status: str = "unmapped"


@dataclass(frozen=True)
class PcfCandidate:
    """PCF déclarée d'un produit fournisseur (table `product_carbon_footprints`)."""

    pcf_id: int
    value_kgco2e: float | None
    declared_unit: str | None
    verification_status: str | None
    data_status: str = "manual"
    methodology: str | None = None
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None
    observation_id: int | None = None


@dataclass(frozen=True)
class DeclarationCandidate:
    """Déclaration chiffrée d'un fournisseur (`supplier_metric_declarations`).

    Seule une déclaration **acceptée en revue** est utilisable pour un calcul :
    le gate humain de PR-05A n'est pas contournable ici."""

    declaration_id: int
    metric_code: str
    value: float | None
    unit: str | None
    review_status: str = "pending"
    data_status: str = "manual"
    primary_data_pct: float | None = None
    methodology: str | None = None
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None
    observation_id: int | None = None


@dataclass(frozen=True)
class FactorCandidate:
    """Facteur d'émission du catalogue (`emission_factors`), physique ou monétaire."""

    factor_id: str
    factor_version: str
    factor_kgco2e: float
    unit: str
    source: str | None = None
    category: str | None = None


@dataclass(frozen=True)
class LicenseContext:
    """Droits de licence de la source d'une donnée dérivée (contrats §8).

    `derived_use_allowed=None` : aucune source licenciée n'est impliquée (donnée
    saisie manuellement) — rien à vérifier."""

    derived_use_allowed: bool | None = None
    source_code: str | None = None
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class LineContext:
    """Tout ce que l'orchestrateur a pu réunir pour UNE ligne.

    Un champ à `None` signifie « donnée absente » et fait échouer proprement le
    niveau correspondant, avec sa raison — jamais une substitution implicite."""

    pcf: PcfCandidate | None = None
    declaration: DeclarationCandidate | None = None
    physical_factor: FactorCandidate | None = None
    spend_factor: FactorCandidate | None = None
    # Masse issue de la BOM / des correspondances matières (kg), quand la
    # nomenclature du produit est connue et revue.
    material_mass_kg: float | None = None
    material_label: str | None = None
    license: LicenseContext = field(default_factory=LicenseContext)


@dataclass(frozen=True)
class LineComputation:
    """Résultat de la cascade pour une ligne — miroir de `procurement_line_results`."""

    line_id: int
    calculation_method: str
    method_rank: int
    result_tco2e: float | None = None
    factor_id: str | None = None
    factor_version: str | None = None
    factor_source: str | None = None
    activity_value: float | None = None
    activity_unit: str | None = None
    converted_value: float | None = None
    converted_unit: str | None = None
    conversion_factor: float | None = None
    conversion_note: str | None = None
    uncertainty_pct: float | None = None
    uncertainty_low_tco2e: float | None = None
    uncertainty_high_tco2e: float | None = None
    data_quality: float | None = None
    data_quality_label: str | None = None
    confidence: float | None = None
    data_status: str = "estimated"
    fallback_reason: str | None = None
    warnings: tuple[str, ...] = ()
    method_trace: tuple[dict[str, Any], ...] = ()
    supplier_id: int | None = None
    supplier_product_id: int | None = None
    evidence_artifact_id: int | None = None
    source_release_id: int | None = None
    observation_id: int | None = None


# ---------------------------------------------------------------------------
# Tentative par niveau — chacune renvoie soit un résultat partiel, soit une
# RAISON D'ÉCHEC lisible. Aucune ne renvoie « rien » sans explication.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _Attempt:
    """Issue d'un niveau : `payload` rempli = retenu ; sinon `reason` explique."""

    ok: bool
    reason: str
    payload: dict[str, Any] | None = None
    warnings: tuple[str, ...] = ()


def _kg_to_t(value_kg: float) -> float:
    return round(value_kg / 1000.0, _ROUNDING)


def _license_warnings(lic: LicenseContext, what: str) -> tuple[str, ...]:
    """Contrats §8 : avant d'utiliser une donnée sourcée dans un calcul dérivé,
    vérifier `allow_derived_use`. Le contrat prescrit un **avertissement tracé**
    (pas un blocage) — la donnée reste utilisée, mais l'utilisateur voit la
    réserve de licence sur la ligne comme sur le run."""
    if lic.derived_use_allowed is None or lic.derived_use_allowed:
        return ()
    src = f" (source {lic.source_code})" if lic.source_code else ""
    detail = f" — {'; '.join(lic.reasons)}" if lic.reasons else ""
    return (
        f"Licence : usage dérivé non couvert pour {what}{src}{detail}. "
        "Valeur utilisée avec réserve, à valider avant publication.",
    )


def _try_supplier_pcf_verified(line: LineInput, ctx: LineContext) -> _Attempt:
    """Niveau 1 — PCF fournisseur VÉRIFIÉE PAR TIERS et COMPARABLE.

    « Comparable » a un sens strict : l'unité déclarée de la PCF et l'unité de
    la ligne doivent appartenir à la même dimension et être convertibles. Une
    PCF « par kg » face à une ligne « en litres » n'est pas comparable — le
    niveau échoue avec sa raison au lieu de produire un chiffre douteux.
    """
    pcf = ctx.pcf
    if pcf is None:
        return _Attempt(False, "aucune PCF produit rattachée à la ligne")
    if pcf.value_kgco2e is None:
        return _Attempt(False, f"PCF #{pcf.pcf_id} sans valeur kgCO2e")
    if pcf.verification_status != "third_party_verified":
        return _Attempt(
            False,
            f"PCF #{pcf.pcf_id} non vérifiée par tiers "
            f"(verification_status={pcf.verification_status or 'non renseigné'})",
        )
    if line.quantity is None:
        return _Attempt(False, "quantité absente sur la ligne — PCF inapplicable")
    conv = convert_units(line.quantity, line.unit, pcf.declared_unit)
    if conv is None:
        return _Attempt(
            False,
            f"unités non comparables : ligne « {line.unit or 'non renseignée'} » vs "
            f"PCF « {pcf.declared_unit or 'non renseignée'} »",
        )
    return _Attempt(
        True,
        f"PCF #{pcf.pcf_id} vérifiée par tiers, unité comparable",
        payload={
            "result_tco2e": _kg_to_t(conv.value * pcf.value_kgco2e),
            "factor_id": f"pcf:{pcf.pcf_id}",
            "factor_version": pcf.methodology or "déclarée",
            "factor_source": "PCF fournisseur (vérifiée par tiers)",
            "activity_value": line.quantity,
            "activity_unit": line.unit,
            "converted_value": conv.value,
            "converted_unit": conv.unit,
            "conversion_factor": conv.factor,
            "conversion_note": conv.note,
            "evidence_artifact_id": pcf.evidence_artifact_id,
            "source_release_id": pcf.source_release_id,
            "observation_id": pcf.observation_id,
        },
        warnings=_license_warnings(ctx.license, f"la PCF #{pcf.pcf_id}"),
    )


def _try_supplier_specific(line: LineInput, ctx: LineContext) -> _Attempt:
    """Niveau 2 — donnée SPÉCIFIQUE AU FOURNISSEUR (spécifique ou hybride).

    Deux voies, dans cet ordre :
      a) PCF auto-déclarée / non vérifiée par tiers, mais comparable ;
      b) déclaration d'INTENSITÉ GES du fournisseur appliquée à la dépense —
         hybride : donnée fournisseur × activité de la ligne.

    Une déclaration non ACCEPTÉE en revue est refusée : le gate humain de
    PR-05A ne se contourne pas depuis le calcul.
    """
    reasons: list[str] = []
    pcf = ctx.pcf

    # (a) PCF non vérifiée par tiers mais exploitable.
    if pcf is not None and pcf.value_kgco2e is not None and line.quantity is not None:
        conv = convert_units(line.quantity, line.unit, pcf.declared_unit)
        if conv is not None:
            return _Attempt(
                True,
                f"PCF #{pcf.pcf_id} spécifique fournisseur "
                f"({pcf.verification_status or 'non vérifiée'})",
                payload={
                    "result_tco2e": _kg_to_t(conv.value * pcf.value_kgco2e),
                    "factor_id": f"pcf:{pcf.pcf_id}",
                    "factor_version": pcf.methodology or "déclarée",
                    "factor_source": f"PCF fournisseur ({pcf.verification_status or 'non vérifiée'})",
                    "activity_value": line.quantity,
                    "activity_unit": line.unit,
                    "converted_value": conv.value,
                    "converted_unit": conv.unit,
                    "conversion_factor": conv.factor,
                    "conversion_note": conv.note,
                    "evidence_artifact_id": pcf.evidence_artifact_id,
                    "source_release_id": pcf.source_release_id,
                    "observation_id": pcf.observation_id,
                },
                warnings=_license_warnings(ctx.license, f"la PCF #{pcf.pcf_id}"),
            )
        reasons.append("PCF présente mais unité non comparable")

    # (b) Intensité GES déclarée par le fournisseur × dépense de la ligne.
    decl = ctx.declaration
    if decl is None:
        reasons.append("aucune déclaration fournisseur exploitable")
        return _Attempt(False, " ; ".join(reasons))
    if decl.review_status != "accepted":
        reasons.append(
            f"déclaration #{decl.declaration_id} non acceptée en revue "
            f"(review_status={decl.review_status})"
        )
        return _Attempt(False, " ; ".join(reasons))
    if decl.value is None:
        reasons.append(f"déclaration #{decl.declaration_id} sans valeur")
        return _Attempt(False, " ; ".join(reasons))
    if line.spend_amount is None:
        reasons.append("dépense absente — intensité fournisseur inapplicable")
        return _Attempt(False, " ; ".join(reasons))

    # Intensité attendue en tCO2e par million d'euros de dépense.
    conv = convert_units(line.spend_amount, line.currency or "EUR", "MEUR")
    if conv is None:
        reasons.append(
            f"devise « {line.currency or 'non renseignée'} » non convertible en MEUR"
        )
        return _Attempt(False, " ; ".join(reasons))
    return _Attempt(
        True,
        f"intensité déclarée #{decl.declaration_id} ({decl.metric_code}) appliquée à la dépense",
        payload={
            "result_tco2e": round(conv.value * decl.value, _ROUNDING),
            "factor_id": f"declaration:{decl.declaration_id}",
            "factor_version": decl.methodology or "déclarée",
            "factor_source": f"Déclaration fournisseur ({decl.metric_code})",
            "activity_value": line.spend_amount,
            "activity_unit": line.currency or "EUR",
            "converted_value": conv.value,
            "converted_unit": "MEUR",
            "conversion_factor": conv.factor,
            "conversion_note": conv.note,
            "evidence_artifact_id": decl.evidence_artifact_id,
            "source_release_id": decl.source_release_id,
            "observation_id": decl.observation_id,
        },
        warnings=_license_warnings(ctx.license, f"la déclaration #{decl.declaration_id}"),
    )


def _try_average_physical(line: LineInput, ctx: LineContext) -> _Attempt:
    """Niveau 3 — facteur PHYSIQUE moyen appliqué à une quantité.

    La masse issue de la BOM / des correspondances matières est préférée quand
    elle existe (elle décrit ce que le produit CONTIENT réellement) ; à défaut,
    la quantité de la ligne est utilisée. Le choix est tracé dans la note de
    conversion, jamais implicite.
    """
    factor = ctx.physical_factor
    if factor is None:
        return _Attempt(False, "aucun facteur physique moyen disponible pour cette ligne")

    if ctx.material_mass_kg is not None:
        conv = convert_units(ctx.material_mass_kg, "kg", factor.unit)
        origin = f"masse matière BOM ({ctx.material_label or 'matière'})"
        activity_value, activity_unit = ctx.material_mass_kg, "kg"
    elif line.quantity is not None:
        conv = convert_units(line.quantity, line.unit, factor.unit)
        origin = "quantité de la ligne d'achat"
        activity_value, activity_unit = line.quantity, line.unit
    else:
        return _Attempt(False, "ni masse matière (BOM) ni quantité sur la ligne")

    if conv is None:
        return _Attempt(
            False,
            f"unités non convertibles : {origin} « {activity_unit or 'non renseignée'} » "
            f"vs facteur « {factor.unit} »",
        )
    return _Attempt(
        True,
        f"facteur physique {factor.factor_id} appliqué à la {origin}",
        payload={
            "result_tco2e": _kg_to_t(conv.value * factor.factor_kgco2e),
            "factor_id": factor.factor_id,
            "factor_version": factor.factor_version,
            "factor_source": factor.source or "catalogue de facteurs",
            "activity_value": activity_value,
            "activity_unit": activity_unit,
            "converted_value": conv.value,
            "converted_unit": conv.unit,
            "conversion_factor": conv.factor,
            "conversion_note": f"{conv.note} — base : {origin}",
        },
    )


def _try_spend_based(line: LineInput, ctx: LineContext) -> _Attempt:
    """Niveau 4 — facteur MONÉTAIRE appliqué à la dépense (dernier recours chiffré)."""
    factor = ctx.spend_factor
    if factor is None:
        return _Attempt(False, "aucun facteur monétaire disponible pour cette catégorie")
    if line.spend_amount is None:
        return _Attempt(False, "dépense absente sur la ligne")
    conv = convert_units(line.spend_amount, line.currency or "EUR", factor.unit)
    if conv is None:
        return _Attempt(
            False,
            f"devise « {line.currency or 'non renseignée'} » non convertible vers "
            f"l'unité du facteur « {factor.unit} »",
        )
    return _Attempt(
        True,
        f"facteur monétaire {factor.factor_id} appliqué à la dépense",
        payload={
            "result_tco2e": _kg_to_t(conv.value * factor.factor_kgco2e),
            "factor_id": factor.factor_id,
            "factor_version": factor.factor_version,
            "factor_source": factor.source or "catalogue de facteurs",
            "activity_value": line.spend_amount,
            "activity_unit": line.currency or "EUR",
            "converted_value": conv.value,
            "converted_unit": conv.unit,
            "conversion_factor": conv.factor,
            "conversion_note": conv.note,
        },
    )


_ATTEMPTS = {
    "supplier_pcf_verified": _try_supplier_pcf_verified,
    "supplier_specific_hybrid": _try_supplier_specific,
    "average_physical": _try_average_physical,
    "spend_based_economic": _try_spend_based,
}


# ---------------------------------------------------------------------------
# Cascade
# ---------------------------------------------------------------------------

def compute_line(line: LineInput, ctx: LineContext) -> LineComputation:
    """Applique la hiérarchie dans l'ordre et renvoie le résultat de la ligne.

    Chaque niveau essayé laisse une trace (`method_trace`), qu'il soit retenu ou
    écarté. La `fallback_reason` d'un rang > 1 agrège les raisons des niveaux
    supérieurs écartés : impossible de descendre la hiérarchie sans dire pourquoi.
    """
    trace: list[dict[str, Any]] = []
    rejected: list[str] = []

    for method in METHOD_ORDER:
        attempt = _ATTEMPTS[method](line, ctx)
        rank = METHOD_RANKS[method]
        trace.append({
            "rank": rank,
            "method": method,
            "outcome": "selected" if attempt.ok else "rejected",
            "reason": attempt.reason,
        })
        if not attempt.ok:
            rejected.append(f"[{rank}] {method} : {attempt.reason}")
            continue

        profile = METHOD_PROFILES[method]
        payload = attempt.payload or {}
        result = payload.get("result_tco2e")
        low = high = None
        if result is not None and profile.uncertainty_pct is not None:
            delta = abs(result) * profile.uncertainty_pct / 100.0
            low = round(result - delta, _ROUNDING)
            high = round(result + delta, _ROUNDING)

        # « Aucun fallback silencieux » : dès le rang 2, la raison est obligatoire.
        fallback_reason = " | ".join(rejected) if rank > 1 else None

        return LineComputation(
            line_id=line.line_id,
            calculation_method=method,
            method_rank=rank,
            result_tco2e=result,
            factor_id=payload.get("factor_id"),
            factor_version=payload.get("factor_version"),
            factor_source=payload.get("factor_source"),
            activity_value=payload.get("activity_value"),
            activity_unit=payload.get("activity_unit"),
            converted_value=payload.get("converted_value"),
            converted_unit=payload.get("converted_unit"),
            conversion_factor=payload.get("conversion_factor"),
            conversion_note=payload.get("conversion_note"),
            uncertainty_pct=profile.uncertainty_pct,
            uncertainty_low_tco2e=low,
            uncertainty_high_tco2e=high,
            data_quality=profile.data_quality,
            data_quality_label=profile.data_quality_label,
            confidence=profile.confidence,
            data_status=profile.data_status,
            fallback_reason=fallback_reason,
            warnings=attempt.warnings,
            method_trace=tuple(trace),
            supplier_id=line.supplier_id,
            supplier_product_id=line.supplier_product_id,
            evidence_artifact_id=payload.get("evidence_artifact_id"),
            source_release_id=payload.get("source_release_id"),
            observation_id=payload.get("observation_id"),
        )

    # Niveau 5 — non résolu. La ligne est CONSERVÉE dans les résultats, sans
    # aucune valeur : ni 0, ni moyenne, ni estimation de remplacement.
    trace.append({
        "rank": 5,
        "method": "unresolved",
        "outcome": "selected",
        "reason": "aucun niveau de la hiérarchie applicable",
    })
    profile = METHOD_PROFILES["unresolved"]
    return LineComputation(
        line_id=line.line_id,
        calculation_method="unresolved",
        method_rank=5,
        result_tco2e=None,
        data_quality=profile.data_quality,
        data_quality_label=profile.data_quality_label,
        confidence=profile.confidence,
        data_status=profile.data_status,
        fallback_reason=" | ".join(rejected) or "aucune donnée d'activité exploitable",
        warnings=("Ligne non résolue : à corriger via la file de résolution.",),
        method_trace=tuple(trace),
        supplier_id=line.supplier_id,
        supplier_product_id=line.supplier_product_id,
        activity_value=line.quantity if line.quantity is not None else line.spend_amount,
        activity_unit=line.unit if line.quantity is not None else line.currency,
    )


# ---------------------------------------------------------------------------
# Agrégation d'un run (pure elle aussi)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RunAggregate:
    """Synthèse d'un run — ce qui est calculé ET ce qui ne l'est pas."""

    total_tco2e: float | None
    line_count: int
    resolved_count: int
    unresolved_count: int
    coverage_lines_pct: float
    coverage_spend_pct: float | None
    unresolved_spend_amount: float | None
    primary_data_share_pct: float
    confidence: float | None
    warnings: tuple[str, ...]
    method_counts: dict[str, int]


def aggregate_run(
    computations: list[LineComputation],
    spend_by_line: dict[int, float | None] | None = None,
) -> RunAggregate:
    """Agrège les résultats d'un run.

    `total_tco2e` est la somme des lignes RÉSOLUES uniquement, et n'est jamais
    présenté seul : `coverage_*` et `unresolved_*` l'accompagnent partout pour
    qu'un total partiel ne se lise pas comme exhaustif. La confiance du run est
    la moyenne pondérée par l'émission des confiances de ligne — une convention
    de la méthodologie versionnée, documentée comme telle.
    """
    spend_by_line = spend_by_line or {}
    total_lines = len(computations)
    resolved = [c for c in computations if c.result_tco2e is not None]
    unresolved = [c for c in computations if c.result_tco2e is None]

    total = round(sum(c.result_tco2e or 0.0 for c in resolved), _ROUNDING) if resolved else None

    total_spend = sum(v for v in spend_by_line.values() if v is not None)
    unresolved_spend = sum(
        spend_by_line.get(c.line_id) or 0.0 for c in unresolved
    )
    coverage_spend = (
        round((total_spend - unresolved_spend) / total_spend * 100.0, 4)
        if total_spend > 0 else None
    )

    primary = [c for c in computations if c.calculation_method in PRIMARY_DATA_METHODS]

    # Confiance du run : pondérée par la contribution de chaque ligne résolue.
    weight_total = sum(abs(c.result_tco2e or 0.0) for c in resolved)
    if resolved and weight_total > 0:
        confidence = round(
            sum(abs(c.result_tco2e or 0.0) * (c.confidence or 0.0) for c in resolved)
            / weight_total,
            6,
        )
    elif resolved:
        confidence = round(
            sum(c.confidence or 0.0 for c in resolved) / len(resolved), 6
        )
    else:
        confidence = None

    warnings: list[str] = []
    if unresolved:
        warnings.append(
            f"{len(unresolved)} ligne(s) non résolue(s) sur {total_lines} — "
            "total partiel, à compléter via la file de résolution."
        )
    spend_based = sum(1 for c in computations if c.calculation_method == "spend_based_economic")
    if spend_based:
        warnings.append(
            f"{spend_based} ligne(s) calculée(s) au facteur monétaire (précision faible) — "
            "collecter une donnée fournisseur pour les remplacer."
        )
    licence_flagged = sum(1 for c in computations if any("Licence" in w for w in c.warnings))
    if licence_flagged:
        warnings.append(
            f"{licence_flagged} ligne(s) utilisant une source dont l'usage dérivé "
            "n'est pas couvert par la licence — à valider avant publication."
        )

    method_counts: dict[str, int] = {}
    for c in computations:
        method_counts[c.calculation_method] = method_counts.get(c.calculation_method, 0) + 1

    return RunAggregate(
        total_tco2e=total,
        line_count=total_lines,
        resolved_count=len(resolved),
        unresolved_count=len(unresolved),
        coverage_lines_pct=round(len(resolved) / total_lines * 100.0, 4) if total_lines else 0.0,
        coverage_spend_pct=coverage_spend,
        unresolved_spend_amount=round(unresolved_spend, 4) if spend_by_line else None,
        primary_data_share_pct=round(len(primary) / total_lines * 100.0, 4) if total_lines else 0.0,
        confidence=confidence,
        warnings=tuple(warnings),
        method_counts=method_counts,
    )
