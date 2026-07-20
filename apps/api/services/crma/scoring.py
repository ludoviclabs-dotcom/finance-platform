"""
scoring.py — **CarbonCo Material Exposure Score** (PR-07), calcul PUR.

Aucun accès base, aucun I/O, aucun LLM : des entrées explicites, une sortie
typée, un résultat reproductible. C'est délibéré — la méthode doit être
testable et auditable sans PostgreSQL, et rejouable à l'identique pour un même
instantané d'entrées (`input_snapshot`, contrats §4).

===============================================================================
CE QUE CE SCORE N'EST PAS
===============================================================================
Ce n'est **pas un score officiel de l'Union européenne**, ni une notation
réglementaire CRMA, ni un avis de conformité. C'est une méthode CarbonCo,
versionnée (`CC-MATERIAL-EXPOSURE` / `0.1.0`), dont chaque composante reste
inspectable. `DISCLAIMER` est attaché à chaque résultat produit et sérialisé
dans l'export Article 24.

===============================================================================
LES DEUX RÈGLES STRUCTURANTES
===============================================================================

**1. Le risque et la confiance ne se mélangent jamais.**
`risk_score` dit l'intensité du risque ; `confidence` dit à quel point les
données disponibles permettent d'y croire. Ce sont deux sorties séparées, avec
deux jeux de composantes séparés (`components` / `confidence_components`).
Aucune ligne de ce module ne multiplie l'une par l'autre. Une donnée absente,
périmée ou bloquée par une licence dégrade la CONFIANCE — jamais le risque, car
« on ne sait pas » n'est pas « il n'y a pas de risque ».

**2. La concentration se calcule PAR ÉTAPE, et les étapes ne se mélangent pas.**
L'extraction n'est jamais moyennée avec le raffinage ou la transformation :
ce sont des marchés différents, avec des acteurs et des géographies
différentes. En agréger la moyenne produirait un chiffre qui ne décrit aucun
marché réel. La composante `stage_concentration` prend donc le **maximum** sur
les étapes — c'est-à-dire qu'elle SÉLECTIONNE une étape (le maillon le plus
concentré, dont le `stage_code` est reporté) au lieu de FUSIONNER les étapes.
Le détail par étape reste disponible dans `stage_concentrations`. Même geste
pour `third_country_dependency`.

===============================================================================
COMPOSANTES DE RISQUE (poids nominaux)
===============================================================================
    stage_concentration        0.30   concentration géographique de l'étape la plus concentrée
    third_country_dependency   0.15   dépendance aux pays hors UE, étape la plus dépendante
    supplier_dependency        0.15   concentration des fournisseurs du tenant
    substitutability           0.10   maturité de la meilleure alternative connue
    recycling_potential        0.10   maturité et contenu recyclé de la meilleure filière
    stock_coverage             0.10   couverture de stock en jours
    regulatory_events          0.10   sévérité des événements commerciaux/réglementaires actifs

Une composante SANS DONNÉE est marquée `available=False` et **exclue** du
calcul, les poids restants étant renormalisés. Elle n'est jamais comptée à
zéro : compter « pas de substitut connu » comme « risque nul de substitution »
inverserait le sens de l'information. Corollaire assumé : moins il y a de
composantes disponibles, plus la `confidence` baisse.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from models.crma import (
    ConfidenceComponent,
    CountryShare,
    MaterialExposureScore,
    ScoreComponent,
    StageConcentration,
    ValueChainResponse,
)

METHODOLOGY_CODE = "CC-MATERIAL-EXPOSURE"
METHODOLOGY_VERSION = "0.1.0"

DISCLAIMER = (
    "CarbonCo Material Exposure Score — méthode CarbonCo versionnée "
    f"({METHODOLOGY_CODE} {METHODOLOGY_VERSION}). Ce score n'est PAS un score "
    "officiel de l'Union européenne ni une notation réglementaire CRMA. "
    "Le risque et la confiance sont deux grandeurs distinctes : une confiance "
    "faible signale des données lacunaires, pas un risque faible."
)

# Ordre canonique de la chaîne de valeur (MVP aimants permanents), miroir des
# lignes globales semées par la migration 034.
STAGE_ORDER: dict[str, int] = {
    "extraction": 10,
    "separation": 20,
    "refining": 30,
    "metal_alloy": 40,
    "powder": 50,
    "magnet": 60,
    "component": 70,
    "product": 80,
}

# Étapes amont extractives — jamais comparées aux étapes de transformation.
UPSTREAM_STAGES = frozenset({"extraction", "separation"})

# Codes pays de l'Union européenne (ISO 3166-1 alpha-2), pour la composante
# « dépendance pays tiers ». Liste structurelle, pas une donnée externe.
EU_COUNTRY_CODES = frozenset({
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
    "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
    "SE", "SI", "SK",
})

NOMINAL_WEIGHTS: dict[str, float] = {
    "stage_concentration": 0.30,
    "third_country_dependency": 0.15,
    "supplier_dependency": 0.15,
    "substitutability": 0.10,
    "recycling_potential": 0.10,
    "stock_coverage": 0.10,
    "regulatory_events": 0.10,
}

_COMPONENT_LABELS: dict[str, str] = {
    "stage_concentration": "Concentration géographique (par étape)",
    "third_country_dependency": "Dépendance pays tiers (hors UE)",
    "supplier_dependency": "Dépendance fournisseurs",
    "substitutability": "Substituabilité",
    "recycling_potential": "Potentiel de recyclage",
    "stock_coverage": "Couverture de stock",
    "regulatory_events": "Événements commerciaux et réglementaires",
}

# Maturité -> risque résiduel (plus la filière est mature, plus le risque baisse).
_MATURITY_RISK: dict[str, float] = {
    "mature": 10.0,
    "commercial": 30.0,
    "pilot": 60.0,
    "research": 85.0,
}

_SEVERITY_RISK: dict[str, float] = {
    "critical": 95.0,
    "high": 75.0,
    "medium": 45.0,
    "low": 20.0,
}

# Qualité relative d'un `data_status` pour la CONFIANCE (jamais pour le risque).
_STATUS_QUALITY: dict[str, float] = {
    "verified": 1.0,
    "manual": 0.7,
    "estimated": 0.5,
    "inferred": 0.3,
}


class ScoringError(Exception):
    """Entrée de calcul invalide (méthode incohérente, part hors bornes…)."""


# ---------------------------------------------------------------------------
# Concentration par étape
# ---------------------------------------------------------------------------

def compute_stage_concentration(
    *,
    stage_code: str,
    rows: list[dict],
    stage_label: str | None = None,
    stage_order: int | None = None,
    is_upstream: bool | None = None,
) -> StageConcentration:
    """Concentration géographique d'UNE étape (HHI sur les parts pays).

    `rows` : lignes `material_stage_observations` d'une SEULE étape. Le
    mélange d'étapes est impossible par construction — la fonction ne reçoit
    qu'un `stage_code` et lève si une ligne en porte un autre.

    Les parts sont renormalisées sur `observed_total_pct` (les données peuvent
    être incomplètes : si l'on n'a que 60 % du marché documenté, un acteur à
    30 points pèse 50 % du CONNU). L'incomplétude n'est pas dissimulée : elle
    est reportée telle quelle dans `observed_total_pct` et fait baisser la
    confiance en aval.
    """
    shares: list[CountryShare] = []
    status_mix: dict[str, int] = {}
    reference_year: int | None = None

    for row in rows:
        row_stage = row.get("stage_code")
        if row_stage is not None and row_stage != stage_code:
            raise ScoringError(
                f"Observation d'étape '{row_stage}' fournie pour l'étape '{stage_code}' — "
                "les étapes ne se mélangent jamais."
            )
        share = row.get("share_pct")
        if share is None:
            continue
        share_f = float(share)
        if share_f < 0 or share_f > 100:
            raise ScoringError(
                f"Part pays hors bornes ({share_f}) pour {row.get('country_code')} à l'étape {stage_code}."
            )
        status = str(row.get("data_status") or "estimated")
        status_mix[status] = status_mix.get(status, 0) + 1
        if reference_year is None and row.get("reference_year") is not None:
            reference_year = int(row["reference_year"])
        shares.append(
            CountryShare(
                country_code=str(row.get("country_code") or "??"),
                share_pct=share_f,
                data_status=status,  # type: ignore[arg-type]
                source_release_id=row.get("source_release_id"),
            )
        )

    observed_total = sum(s.share_pct for s in shares)
    hhi_pct: float | None = None
    top_country: str | None = None
    top_share: float | None = None

    if shares and observed_total > 0:
        ordered = sorted(shares, key=lambda s: s.share_pct, reverse=True)
        top_country = ordered[0].country_code
        top_share = ordered[0].share_pct
        # HHI sur les parts renormalisées au total observé -> [1/n, 1] -> %.
        hhi_pct = round(sum((s.share_pct / observed_total) ** 2 for s in shares) * 100, 2)

    return StageConcentration(
        stage_code=stage_code,
        stage_label=stage_label,
        stage_order=stage_order if stage_order is not None else STAGE_ORDER.get(stage_code),
        is_upstream=is_upstream if is_upstream is not None else stage_code in UPSTREAM_STAGES,
        reference_year=reference_year,
        country_shares=sorted(shares, key=lambda s: s.share_pct, reverse=True),
        observed_total_pct=round(observed_total, 2),
        top_country_code=top_country,
        top_country_share_pct=top_share,
        hhi_pct=hhi_pct,
        country_count=len(shares),
        data_status_mix=status_mix,
    )


def build_value_chain(
    *,
    material_id: str,
    observation_rows: list[dict],
    stages: list[dict],
    reference_year: int | None = None,
) -> ValueChainResponse:
    """Chaîne de valeur complète : une `StageConcentration` PAR étape.

    Les observations sont partitionnées par `stage_code` AVANT tout calcul —
    aucune addition ne traverse une frontière d'étape. Les étapes sans donnée
    sont rendues quand même (concentration nulle, `country_count=0`) pour que
    l'absence de donnée soit visible plutôt que silencieuse.
    """
    by_stage: dict[str, list[dict]] = {}
    for row in observation_rows:
        by_stage.setdefault(str(row["stage_code"]), []).append(row)

    ordered_stages = sorted(stages, key=lambda s: s.get("stage_order") or STAGE_ORDER.get(s["code"], 999))
    result: list[StageConcentration] = []
    for stage in ordered_stages:
        code = str(stage["code"])
        result.append(
            compute_stage_concentration(
                stage_code=code,
                rows=by_stage.get(code, []),
                stage_label=stage.get("label"),
                stage_order=stage.get("stage_order"),
                is_upstream=stage.get("is_upstream"),
            )
        )

    return ValueChainResponse(
        material_id=material_id,
        reference_year=reference_year,
        stages=result,
        stages_with_data=sum(1 for s in result if s.country_count > 0),
        stages_total=len(result),
    )


def third_country_share(concentration: StageConcentration) -> float | None:
    """Part hors UE d'UNE étape, renormalisée au total observé de cette étape."""
    if not concentration.country_shares or concentration.observed_total_pct <= 0:
        return None
    non_eu = sum(
        s.share_pct for s in concentration.country_shares
        if s.country_code.upper() not in EU_COUNTRY_CODES
    )
    return round(non_eu / concentration.observed_total_pct * 100, 2)


def herfindahl_pct(shares: list[float]) -> float | None:
    """HHI en % sur une liste de parts quelconques (renormalisées à leur somme)."""
    positive = [s for s in shares if s is not None and s > 0]
    total = sum(positive)
    if not positive or total <= 0:
        return None
    return round(sum((s / total) ** 2 for s in positive) * 100, 2)


# ---------------------------------------------------------------------------
# Composantes de risque
# ---------------------------------------------------------------------------

def _unavailable(code: str, why: str, stage_code: str | None = None) -> ScoreComponent:
    return ScoreComponent(
        code=code,
        label=_COMPONENT_LABELS.get(code, code),
        available=False,
        rationale=why,
        stage_code=stage_code,
    )


def _stage_concentration_component(concentrations: list[StageConcentration]) -> ScoreComponent:
    """Étape la PLUS concentrée — sélection, pas fusion.

    On prend le maximum des HHI par étape : le résultat est la valeur d'UNE
    étape identifiée (`stage_code`), pas une moyenne inter-étapes. Moyenner
    l'extraction et le raffinage produirait un chiffre ne décrivant aucun
    marché réel (interdit — gate de la Phase 6).
    """
    scored = [c for c in concentrations if c.hhi_pct is not None]
    if not scored:
        return _unavailable(
            "stage_concentration",
            "Aucune part pays observée sur aucune étape de la chaîne de valeur.",
        )
    worst = max(scored, key=lambda c: c.hhi_pct or 0.0)
    label = worst.stage_label or worst.stage_code
    return ScoreComponent(
        code="stage_concentration",
        label=_COMPONENT_LABELS["stage_concentration"],
        available=True,
        risk_value=round(worst.hhi_pct or 0.0, 2),
        raw_value=worst.hhi_pct,
        raw_unit="HHI %",
        stage_code=worst.stage_code,
        rationale=(
            f"Étape la plus concentrée : {label} (HHI {worst.hhi_pct} %, "
            f"premier pays {worst.top_country_code} à {worst.top_country_share_pct} %, "
            f"{worst.country_count} pays observés couvrant {worst.observed_total_pct} % du marché). "
            "Valeur d'une seule étape — aucune moyenne entre extraction et transformation."
        ),
    )


def _third_country_component(concentrations: list[StageConcentration]) -> ScoreComponent:
    """Étape la plus dépendante de pays tiers — sélection, pas fusion."""
    pairs = [(c, third_country_share(c)) for c in concentrations]
    scored = [(c, v) for c, v in pairs if v is not None]
    if not scored:
        return _unavailable(
            "third_country_dependency",
            "Aucune part pays observée — dépendance hors UE inconnue.",
        )
    worst, value = max(scored, key=lambda p: p[1] or 0.0)
    label = worst.stage_label or worst.stage_code
    return ScoreComponent(
        code="third_country_dependency",
        label=_COMPONENT_LABELS["third_country_dependency"],
        available=True,
        risk_value=round(value or 0.0, 2),
        raw_value=value,
        raw_unit="% hors UE",
        stage_code=worst.stage_code,
        rationale=(
            f"Étape la plus dépendante de pays tiers : {label} "
            f"({value} % du marché observé hors Union européenne)."
        ),
    )


def _supplier_component(supplier_shares: list[float] | None) -> ScoreComponent:
    if not supplier_shares:
        return _unavailable(
            "supplier_dependency",
            "Aucune part fournisseur renseignée dans les expositions du tenant.",
        )
    hhi = herfindahl_pct(supplier_shares)
    if hhi is None:
        return _unavailable(
            "supplier_dependency",
            "Parts fournisseurs toutes nulles ou absentes.",
        )
    return ScoreComponent(
        code="supplier_dependency",
        label=_COMPONENT_LABELS["supplier_dependency"],
        available=True,
        risk_value=hhi,
        raw_value=hhi,
        raw_unit="HHI %",
        rationale=(
            f"Concentration des approvisionnements du tenant sur {len(supplier_shares)} "
            f"fournisseur(s) (HHI {hhi} %)."
        ),
    )


def _substitutability_component(substitutes: list[dict] | None) -> ScoreComponent:
    if not substitutes:
        return _unavailable(
            "substitutability",
            "Aucun substitut recensé — absence de donnée, PAS absence de substitut.",
        )
    best = min(
        substitutes,
        key=lambda s: _MATURITY_RISK.get(str(s.get("maturity") or "research"), 85.0),
    )
    maturity = str(best.get("maturity") or "research")
    risk = _MATURITY_RISK.get(maturity, 85.0)
    penalty = best.get("performance_penalty_pct")
    if penalty is not None:
        # Une alternative qui dégrade la performance ne remplace qu'en partie :
        # le risque résiduel remonte proportionnellement à la pénalité.
        risk = min(100.0, risk + float(penalty) * 0.3)
    return ScoreComponent(
        code="substitutability",
        label=_COMPONENT_LABELS["substitutability"],
        available=True,
        risk_value=round(risk, 2),
        raw_value=round(risk, 2),
        raw_unit="risque résiduel",
        stage_code=best.get("stage_code"),
        rationale=(
            f"Meilleure alternative connue : {best.get('substitute_material_id')} "
            f"(maturité « {maturity} »"
            + (f", pénalité de performance {penalty} %" if penalty is not None else "")
            + f") parmi {len(substitutes)} substitut(s) recensé(s)."
        ),
    )


def _recycling_component(routes: list[dict] | None) -> ScoreComponent:
    if not routes:
        return _unavailable(
            "recycling_potential",
            "Aucune filière de recyclage recensée — absence de donnée, PAS absence de filière.",
        )
    best = min(
        routes,
        key=lambda r: _MATURITY_RISK.get(str(r.get("maturity") or "research"), 85.0),
    )
    maturity = str(best.get("maturity") or "research")
    risk = _MATURITY_RISK.get(maturity, 85.0)
    recycled = best.get("recycled_content_pct")
    if recycled is not None:
        # Un contenu recyclé effectif réduit la dépendance primaire.
        risk = max(0.0, risk - float(recycled) * 0.5)
    return ScoreComponent(
        code="recycling_potential",
        label=_COMPONENT_LABELS["recycling_potential"],
        available=True,
        risk_value=round(risk, 2),
        raw_value=round(risk, 2),
        raw_unit="risque résiduel",
        stage_code=best.get("output_stage_code"),
        rationale=(
            f"Meilleure filière : « {best.get('label') or best.get('route_code')} » "
            f"(maturité « {maturity} »"
            + (f", contenu recyclé {recycled} %" if recycled is not None else "")
            + f", réinjection à l'étape « {best.get('output_stage_code') or 'non précisée'} ») "
            f"parmi {len(routes)} filière(s)."
        ),
    )


def _stock_component(stock_coverage_days: float | None) -> ScoreComponent:
    if stock_coverage_days is None:
        return _unavailable(
            "stock_coverage",
            "Couverture de stock non renseignée.",
        )
    days = float(stock_coverage_days)
    # 180 jours de couverture -> risque résiduel 10 ; 0 jour -> 100. Linéaire.
    risk = max(10.0, 100.0 - (min(days, 180.0) / 180.0) * 90.0)
    return ScoreComponent(
        code="stock_coverage",
        label=_COMPONENT_LABELS["stock_coverage"],
        available=True,
        risk_value=round(risk, 2),
        raw_value=days,
        raw_unit="jours",
        rationale=(
            f"Couverture de stock de {days:g} jour(s) — un stock de 180 jours "
            "ramène cette composante à son plancher (10)."
        ),
    )


def _events_component(events: list[dict] | None, as_of: date) -> ScoreComponent:
    """Événements ACTIFS à la date d'analyse.

    Aucun événement enregistré => composante INDISPONIBLE, pas « risque nul » :
    ne rien avoir consigné ne prouve pas qu'il ne se passe rien.
    """
    if not events:
        return _unavailable(
            "regulatory_events",
            "Aucun événement commercial ou réglementaire enregistré — "
            "absence de donnée, PAS absence d'événement.",
        )
    active: list[dict] = []
    for event in events:
        starts = event.get("effective_from")
        ends = event.get("effective_to")
        if starts is not None and starts > as_of:
            continue
        if ends is not None and ends < as_of:
            continue
        active.append(event)

    if not active:
        return ScoreComponent(
            code="regulatory_events",
            label=_COMPONENT_LABELS["regulatory_events"],
            available=True,
            risk_value=10.0,
            raw_value=0.0,
            raw_unit="événements actifs",
            rationale=(
                f"{len(events)} événement(s) recensé(s), aucun actif au {as_of.isoformat()} — "
                "risque résiduel plancher (le registre a bien été consulté)."
            ),
        )

    worst = max(active, key=lambda e: _SEVERITY_RISK.get(str(e.get("severity") or "medium"), 45.0))
    severity = str(worst.get("severity") or "medium")
    return ScoreComponent(
        code="regulatory_events",
        label=_COMPONENT_LABELS["regulatory_events"],
        available=True,
        risk_value=_SEVERITY_RISK.get(severity, 45.0),
        raw_value=float(len(active)),
        raw_unit="événements actifs",
        stage_code=worst.get("stage_code"),
        rationale=(
            f"{len(active)} événement(s) actif(s) au {as_of.isoformat()} ; le plus sévère : "
            f"« {worst.get('title')} » ({worst.get('event_type')}, sévérité « {severity} »"
            + (f", {worst.get('country_code')}" if worst.get("country_code") else "")
            + ")."
        ),
    )


# ---------------------------------------------------------------------------
# Confiance — dimension SÉPARÉE
# ---------------------------------------------------------------------------

def _confidence_components(
    *,
    concentrations: list[StageConcentration],
    components: list[ScoreComponent],
    as_of: date,
    license_blocked_count: int,
    market_observations_count: int,
) -> list[ConfidenceComponent]:
    """Composantes de CONFIANCE — n'entrent JAMAIS dans `risk_score`.

    Elles mesurent la qualité du socle documentaire : couverture des étapes,
    qualité des statuts de donnée, nombre de composantes de risque réellement
    calculables, fraîcheur, et accès licencié.
    """
    out: list[ConfidenceComponent] = []

    stages_with_data = sum(1 for c in concentrations if c.country_count > 0)
    stage_cov = stages_with_data / len(concentrations) if concentrations else 0.0
    out.append(ConfidenceComponent(
        code="stage_coverage",
        label="Couverture des étapes",
        value=round(stage_cov, 4),
        weight=0.30,
        rationale=(
            f"{stages_with_data} étape(s) documentée(s) sur {len(concentrations)} "
            "dans la chaîne de valeur."
        ),
    ))

    status_counts: dict[str, int] = {}
    for concentration in concentrations:
        for status, count in concentration.data_status_mix.items():
            status_counts[status] = status_counts.get(status, 0) + count
    total_obs = sum(status_counts.values())
    if total_obs:
        quality = sum(
            _STATUS_QUALITY.get(status, 0.3) * count for status, count in status_counts.items()
        ) / total_obs
    else:
        quality = 0.0
    out.append(ConfidenceComponent(
        code="data_quality",
        label="Qualité des statuts de donnée",
        value=round(quality, 4),
        weight=0.25,
        rationale=(
            f"{total_obs} observation(s) de part pays, répartition {status_counts or '{}'} "
            "(verified 1.0 · manual 0.7 · estimated 0.5 · inferred 0.3)."
        ),
    ))

    available = sum(1 for c in components if c.available)
    comp_cov = available / len(NOMINAL_WEIGHTS) if NOMINAL_WEIGHTS else 0.0
    out.append(ConfidenceComponent(
        code="component_coverage",
        label="Composantes de risque calculables",
        value=round(comp_cov, 4),
        weight=0.20,
        rationale=f"{available} composante(s) disponible(s) sur {len(NOMINAL_WEIGHTS)}.",
    ))

    years = [c.reference_year for c in concentrations if c.reference_year is not None]
    if years:
        age = max(0, as_of.year - max(years))
        freshness = max(0.0, 1.0 - age * 0.2)  # -20 % de confiance par année d'écart
        rationale = f"Donnée de référence la plus récente : {max(years)} (écart {age} an(s))."
    else:
        freshness = 0.0
        rationale = "Aucune année de référence disponible."
    out.append(ConfidenceComponent(
        code="freshness",
        label="Fraîcheur des données",
        value=round(freshness, 4),
        weight=0.15,
        rationale=rationale,
    ))

    if market_observations_count == 0:
        license_value = 0.5
        license_rationale = "Aucune donnée de marché disponible pour cette matière."
    elif license_blocked_count == 0:
        license_value = 1.0
        license_rationale = (
            f"{market_observations_count} observation(s) de marché, toutes exploitables "
            "au regard de leur licence."
        )
    else:
        license_value = max(
            0.0, 1.0 - license_blocked_count / market_observations_count
        )
        license_rationale = (
            f"{license_blocked_count} observation(s) de marché sur {market_observations_count} "
            "inutilisables faute de droit d'usage dérivé — la confiance baisse, le risque non."
        )
    out.append(ConfidenceComponent(
        code="license_access",
        label="Accès licencié aux données de marché",
        value=round(license_value, 4),
        weight=0.10,
        rationale=license_rationale,
    ))

    return out


# ---------------------------------------------------------------------------
# Score complet
# ---------------------------------------------------------------------------

def compute_score(
    *,
    material_id: str,
    stage_concentrations: list[StageConcentration],
    supplier_shares: list[float] | None = None,
    substitutes: list[dict] | None = None,
    recycling_routes: list[dict] | None = None,
    stock_coverage_days: float | None = None,
    events: list[dict] | None = None,
    as_of: date | None = None,
    license_blocked_count: int = 0,
    market_observations_count: int = 0,
    calculated_at: datetime | None = None,
) -> MaterialExposureScore:
    """Calcule le **CarbonCo Material Exposure Score** — pur et reproductible.

    Renvoie `risk_score=None` si AUCUNE composante n'est disponible : mieux vaut
    l'absence de score qu'un nombre inventé. `confidence` reste calculée dans ce
    cas (elle vaudra logiquement très peu) — c'est précisément son rôle.
    """
    as_of = as_of or date.today()

    components: list[ScoreComponent] = [
        _stage_concentration_component(stage_concentrations),
        _third_country_component(stage_concentrations),
        _supplier_component(supplier_shares),
        _substitutability_component(substitutes),
        _recycling_component(recycling_routes),
        _stock_component(stock_coverage_days),
        _events_component(events, as_of),
    ]

    available = [c for c in components if c.available and c.risk_value is not None]
    total_weight = sum(NOMINAL_WEIGHTS[c.code] for c in available)

    warnings: list[str] = []
    risk_score: float | None = None

    if available and total_weight > 0:
        for component in components:
            if component.available and component.risk_value is not None:
                # Renormalisation : les poids des composantes indisponibles sont
                # redistribués, jamais comptés comme un risque nul.
                component.weight = round(NOMINAL_WEIGHTS[component.code] / total_weight, 4)
                component.contribution = round(component.risk_value * component.weight, 4)
        risk_score = round(sum(c.contribution for c in available), 2)
    else:
        warnings.append(
            "Aucune composante de risque calculable : score non produit "
            "(un score inventé serait pire qu'une absence de score)."
        )

    missing = [c for c in components if not c.available]
    if missing:
        warnings.append(
            "Composantes exclues faute de données (poids renormalisés, jamais comptées "
            "comme risque nul) : " + ", ".join(f"{c.code}" for c in missing) + "."
        )

    if license_blocked_count:
        warnings.append(
            f"{license_blocked_count} observation(s) de marché écartée(s) du calcul : "
            "la licence de la source n'autorise pas l'usage dérivé (allow_derived_use=false)."
        )

    documented = sum(1 for c in stage_concentrations if c.country_count > 0)
    coverage_pct = round(documented / len(stage_concentrations) * 100, 2) if stage_concentrations else 0.0
    if documented and documented < len(stage_concentrations):
        undocumented = [c.stage_code for c in stage_concentrations if c.country_count == 0]
        warnings.append(
            "Étapes sans donnée de concentration : " + ", ".join(undocumented) + "."
        )

    conf_components = _confidence_components(
        concentrations=stage_concentrations,
        components=components,
        as_of=as_of,
        license_blocked_count=license_blocked_count,
        market_observations_count=market_observations_count,
    )
    conf_weight = sum(c.weight for c in conf_components)
    confidence = round(
        sum(c.value * c.weight for c in conf_components) / conf_weight * 100, 2
    ) if conf_weight else 0.0

    # Les moteurs du risque : composantes disponibles triées par contribution
    # décroissante. C'est une VUE des composantes, pas un calcul supplémentaire.
    drivers = sorted(available, key=lambda c: c.contribution, reverse=True)

    return MaterialExposureScore(
        material_id=material_id,
        methodology_code=METHODOLOGY_CODE,
        methodology_version=METHODOLOGY_VERSION,
        risk_score=risk_score,
        confidence=confidence,
        coverage_pct=coverage_pct,
        components=components,
        confidence_components=conf_components,
        drivers=drivers,
        warnings=warnings,
        stage_concentrations=stage_concentrations,
        disclaimer=DISCLAIMER,
        calculated_at=calculated_at or datetime.now(timezone.utc),
    )
