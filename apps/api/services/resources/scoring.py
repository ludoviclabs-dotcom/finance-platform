"""
scoring.py — Moteur d'exposition ressources (PR-M2B), calcul PUR.

Aucun accès base, aucun I/O, aucun LLM : entrées explicites, sortie typée,
résultat reproductible. Réutilise la MÉTHODE de `services/crma/scoring.py`
(HHI par étape, risque≠confiance, manquant≠zéro, renormalisation), au barème
canonique **DOJ 0-10000** propre au Module 2 (METHODOLOGY_AND_ALGORITHMS.md
§B.1 ; monopole = 10000, quatre parts égales = 2500). `services/crma/scoring.py`
n'est PAS modifié (défaut CRMA 0-100 préservé) — la formule HHI (somme des
carrés des parts) est un standard, recomputée ici au barème du module.

RÈGLES STRUCTURANTES (identiques CRMA) :
1. **Risque ≠ confiance.** Deux sorties séparées, jamais multipliées. Une donnée
   absente/périmée/bloquée dégrade la CONFIANCE, jamais le risque.
2. **La concentration se calcule PAR ÉTAPE.** Jamais de moyenne inter-étapes :
   `stage_concentration` SÉLECTIONNE l'étape la plus concentrée.
3. **Manquant ≠ zéro.** Une composante sans donnée est `available=False`,
   exclue, les poids restants renormalisés — jamais comptée risque nul.
4. **Données obligatoires manquantes ⇒ pas d'indice global.** Si aucune
   observation de part pays n'existe, `risk_score=None` (jamais inventé).
5. **Reproductibilité.** `input_hash` (sha256 déterministe du snapshot d'entrée) :
   deux calculs de même empreinte donnent le même résultat.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date
from typing import Any

from models.resources import ResourceAssessmentResult, ResourceDimension

METHODOLOGY_CODE = "CC-RESOURCE-EXPOSURE"
METHODOLOGY_VERSION = "0.1.0"
HHI_SCALE = 10000.0

# En dessous de ce % de marché documenté à l'étape retenue, le HHI est publié
# mais SIGNALÉ (garde de couverture) — la confiance baisse, le risque non.
MIN_STAGE_COVERAGE_PCT = 50.0

DISCLAIMER = (
    "CarbonCo Resource Exposure Score — méthode CarbonCo versionnée "
    f"({METHODOLOGY_CODE} {METHODOLOGY_VERSION}). Ce score n'est PAS un score "
    "officiel de l'Union européenne ni une notation réglementaire. Le risque et "
    "la confiance sont deux grandeurs distinctes : une confiance faible signale "
    "des données lacunaires, pas un risque faible."
)

EU_COUNTRY_CODES = frozenset({
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "EL",
    "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
    "SE", "SI", "SK",
})

# Poids nominaux de RISQUE (somme 1). stage_concentration est OBLIGATOIRE.
NOMINAL_WEIGHTS: dict[str, float] = {
    "stage_concentration": 0.35,
    "third_country_dependency": 0.20,
    "supplier_dependency": 0.20,
    "substitutability": 0.15,
    "stock_coverage": 0.10,
}
MANDATORY_RISK_COMPONENTS = ("stage_concentration",)

# Poids nominaux de CONFIANCE (somme 1).
CONFIDENCE_WEIGHTS: dict[str, float] = {
    "market_coverage": 0.30,
    "data_quality": 0.20,
    "component_coverage": 0.15,
    "evidence_coverage": 0.15,
    "freshness": 0.10,
    "license_access": 0.10,
}

_MATURITY_RISK: dict[str, float] = {
    "mature": 10.0, "commercial": 30.0, "pilot": 60.0, "research": 85.0,
}
_STATUS_QUALITY: dict[str, float] = {
    "verified": 1.0, "manual": 0.7, "estimated": 0.5, "inferred": 0.3,
}

_SENSITIVITY_DELTA = 0.20


class ResourceScoringError(Exception):
    """Entrée de calcul invalide (part hors bornes, étapes mélangées, unités incompatibles…)."""


# ---------------------------------------------------------------------------
# HHI et concentration par étape
# ---------------------------------------------------------------------------

def herfindahl(shares: list[float], *, scale: float = HHI_SCALE) -> float | None:
    """HHI au barème `scale` (0-10000 par défaut) sur des parts renormalisées à
    leur somme. `None` si aucune part positive. Monopole → `scale` ; n parts
    égales → `scale`/n."""
    positive = [s for s in shares if s is not None and s > 0]
    total = sum(positive)
    if not positive or total <= 0:
        return None
    return round(sum((s / total) ** 2 for s in positive) * scale, 2)


def compute_stage(stage_code: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Concentration d'UNE étape : HHI (0-10000), couverture, part manquante,
    dépendance hors-UE. Lève si une ligne porte une autre étape, une part hors
    bornes, ou des unités de volume incompatibles."""
    shares: list[tuple[str, float, str, int | None]] = []  # (country, value, status, year)
    volume_units: set[str] = set()
    uses_share = False
    uses_volume = False
    years: set[int] = set()

    for row in rows:
        row_stage = row.get("stage_code")
        if row_stage is not None and row_stage != stage_code:
            raise ResourceScoringError(
                f"Observation d'étape '{row_stage}' fournie pour l'étape '{stage_code}' — "
                "les étapes ne se mélangent jamais."
            )
        if row.get("reference_year") is not None:
            years.add(int(row["reference_year"]))
        country = str(row.get("country_code") or "??")
        status = str(row.get("data_status") or "estimated")
        share = row.get("share_pct")
        volume = row.get("volume_value")
        if share is not None:
            uses_share = True
            share_f = float(share)
            if share_f < 0 or share_f > 100:
                raise ResourceScoringError(
                    f"Part pays hors bornes ({share_f}) pour {country} à l'étape {stage_code}."
                )
            shares.append((country, share_f, status, row.get("reference_year")))
        elif volume is not None:
            uses_volume = True
            volume_units.add(str(row.get("volume_unit") or ""))
            shares.append((country, float(volume), status, row.get("reference_year")))

    # Années différentes non mélangées dans un même HHI d'étape.
    if len(years) > 1:
        raise ResourceScoringError(
            f"Observations d'années différentes ({sorted(years)}) mélangées à l'étape "
            f"'{stage_code}' — un HHI se calcule sur une seule année de référence."
        )
    # Unités : soit tout en part (%), soit tout en volume d'une SEULE unité.
    if uses_share and uses_volume:
        raise ResourceScoringError(
            f"Unités incompatibles à l'étape '{stage_code}' : mélange de parts (%) et de volumes."
        )
    if uses_volume and len({u for u in volume_units if u}) > 1:
        raise ResourceScoringError(
            f"Unités incompatibles à l'étape '{stage_code}' : volumes en {sorted(volume_units)}."
        )

    values = [v for _c, v, _s, _y in shares]
    hhi = herfindahl(values)
    observed_total = round(sum(values), 4) if shares else 0.0
    # La couverture n'a de sens qu'en parts de marché (%). En volume, la part du
    # monde couverte est inconnue → couverture non déterminée.
    coverage_pct: float | None
    missing_share_pct: float | None
    if uses_share:
        coverage_pct = round(min(observed_total, 100.0), 2)
        missing_share_pct = round(max(0.0, 100.0 - observed_total), 2)
    else:
        coverage_pct = None
        missing_share_pct = None

    top_country = None
    if shares:
        top = max(shares, key=lambda t: t[1])
        top_country = top[0]

    non_eu_pct = None
    if shares and observed_total > 0:
        non_eu = sum(v for c, v, _s, _y in shares if c.upper() not in EU_COUNTRY_CODES)
        non_eu_pct = round(non_eu / observed_total * 100.0, 2)

    status_mix: dict[str, int] = {}
    sourced = 0
    for row in rows:
        st = str(row.get("data_status") or "estimated")
        status_mix[st] = status_mix.get(st, 0) + 1
        if row.get("source_release_id") is not None:
            sourced += 1

    return {
        "stage_code": stage_code,
        "hhi": hhi,
        "observed_total": observed_total,
        "coverage_pct": coverage_pct,
        "missing_share_pct": missing_share_pct,
        "top_country": top_country,
        "non_eu_pct": non_eu_pct,
        "country_count": len(shares),
        "status_mix": status_mix,
        "reference_year": next(iter(years)) if years else None,
        "is_share_based": uses_share,
        "sourced_count": sourced,
        "obs_count": len(rows),
        "source_release_ids": sorted({
            int(r["source_release_id"]) for r in rows if r.get("source_release_id") is not None
        }),
    }


# ---------------------------------------------------------------------------
# input_hash (reproductibilité)
# ---------------------------------------------------------------------------

def compute_input_hash(
    *, resource_slug: str, observations: list[dict], supplier_shares: list[float],
    substitutes: list[dict], stock_coverage_days: float | None, as_of: date,
    market_total: int, market_blocked: int,
) -> str:
    """Empreinte déterministe des ENTRÉES (pas du moment du calcul). Deux calculs
    de mêmes entrées ⇒ même empreinte ⇒ même résultat (test de reproductibilité)."""
    canon_obs = sorted(
        [
            {
                "stage": o.get("stage_code"), "country": o.get("country_code"),
                "metric": o.get("metric_code"), "share": o.get("share_pct"),
                "volume": o.get("volume_value"), "unit": o.get("volume_unit"),
                "year": o.get("reference_year"), "status": o.get("data_status"),
                "release": o.get("source_release_id"),
            }
            for o in observations
        ],
        key=lambda d: (str(d["stage"]), str(d["country"]), str(d["metric"]), str(d["year"])),
    )
    canon_subs = sorted(
        [{"maturity": s.get("maturity"), "penalty": s.get("performance_penalty_pct")}
         for s in substitutes],
        key=lambda d: (str(d["maturity"]), str(d["penalty"])),
    )
    payload = {
        "methodology": [METHODOLOGY_CODE, METHODOLOGY_VERSION],
        "resource": resource_slug,
        "observations": canon_obs,
        "supplier_shares": sorted(round(float(s), 6) for s in supplier_shares),
        "substitutes": canon_subs,
        "stock_coverage_days": stock_coverage_days,
        "as_of": as_of.isoformat(),
        "market": [market_total, market_blocked],
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Composantes de risque
# ---------------------------------------------------------------------------

def _dim(kind: str, code: str, **kw) -> ResourceDimension:
    return ResourceDimension(kind=kind, dimension_code=code, **kw)


def _stage_concentration_dim(stages: list[dict]) -> ResourceDimension:
    scored = [s for s in stages if s["hhi"] is not None]
    if not scored:
        return _dim(
            "risk", "stage_concentration", available=False,
            rationale="Aucune part pays observée sur aucune étape — indice non calculable.",
        )
    worst = max(scored, key=lambda s: s["hhi"])
    warn = ""
    if worst["coverage_pct"] is not None and worst["coverage_pct"] < MIN_STAGE_COVERAGE_PCT:
        warn = (
            f" ⚠ couverture faible ({worst['coverage_pct']} % du marché documenté) — "
            "HHI à interpréter avec prudence."
        )
    return _dim(
        "risk", "stage_concentration", available=True,
        risk_value=round((worst["hhi"] or 0.0) / 100.0, 2),
        raw_value=worst["hhi"], raw_unit="HHI (0-10000)", stage_code=worst["stage_code"],
        rationale=(
            f"Étape la plus concentrée : {worst['stage_code']} (HHI {worst['hhi']}, "
            f"premier pays {worst['top_country']}, {worst['country_count']} pays observés)."
            + warn
        ),
        detail={
            "observed_hhi": worst["hhi"],
            "coverage_pct": worst["coverage_pct"],
            "missing_share_pct": worst["missing_share_pct"],
            "top_country": worst["top_country"],
        },
        source_release_ids=worst["source_release_ids"],
    )


def _third_country_dim(stages: list[dict]) -> ResourceDimension:
    scored = [s for s in stages if s.get("non_eu_pct") is not None]
    if not scored:
        return _dim(
            "risk", "third_country_dependency", available=False,
            rationale="Aucune part pays observée — dépendance hors UE inconnue.",
        )
    worst = max(scored, key=lambda s: s["non_eu_pct"])
    return _dim(
        "risk", "third_country_dependency", available=True,
        risk_value=round(worst["non_eu_pct"], 2), raw_value=worst["non_eu_pct"],
        raw_unit="% hors UE", stage_code=worst["stage_code"],
        rationale=(
            f"Étape la plus dépendante de pays tiers : {worst['stage_code']} "
            f"({worst['non_eu_pct']} % du marché observé hors Union européenne). "
            "« Part hors UE », pas un score de risque-pays."
        ),
    )


def _supplier_dim(supplier_shares: list[float]) -> ResourceDimension:
    if not supplier_shares:
        return _dim(
            "risk", "supplier_dependency", available=False,
            rationale="Aucune part fournisseur renseignée dans les expositions du tenant.",
        )
    hhi = herfindahl(supplier_shares)
    if hhi is None:
        return _dim(
            "risk", "supplier_dependency", available=False,
            rationale="Parts fournisseurs toutes nulles.",
        )
    return _dim(
        "risk", "supplier_dependency", available=True,
        risk_value=round(hhi / 100.0, 2), raw_value=hhi, raw_unit="HHI (0-10000)",
        rationale=f"Concentration des approvisionnements du tenant sur "
                  f"{len(supplier_shares)} fournisseur(s) (HHI {hhi}).",
    )


def _substitutability_dim(substitutes: list[dict]) -> ResourceDimension:
    if not substitutes:
        return _dim(
            "risk", "substitutability", available=False,
            rationale="Aucun substitut recensé — absence de donnée, PAS absence de substitut.",
        )
    best = min(substitutes, key=lambda s: _MATURITY_RISK.get(str(s.get("maturity") or "research"), 85.0))
    maturity = str(best.get("maturity") or "research")
    penalty = best.get("performance_penalty_pct")
    residual = _MATURITY_RISK.get(maturity, 85.0)
    if penalty is not None:
        residual = min(100.0, residual + float(penalty) * 0.3)
    # Sous-valeurs SÉPARÉES (maturité vs pénalité), jamais fusionnées en un opaque.
    return _dim(
        "risk", "substitutability", available=True,
        risk_value=round(residual, 2), raw_value=round(residual, 2), raw_unit="risque résiduel",
        rationale=(
            f"Meilleure alternative : maturité « {maturity} »"
            + (f", pénalité de performance {penalty} %" if penalty is not None else "")
            + f" ({len(substitutes)} substitut(s) recensé(s))."
        ),
        detail={"maturity": maturity, "penalty_pct": penalty,
                "maturity_residual": _MATURITY_RISK.get(maturity, 85.0)},
    )


def _stock_dim(stock_coverage_days: float | None) -> ResourceDimension:
    if stock_coverage_days is None:
        return _dim(
            "risk", "stock_coverage", available=False,
            rationale="Couverture de stock non renseignée.",
        )
    days = float(stock_coverage_days)
    risk = max(10.0, 100.0 - (min(days, 180.0) / 180.0) * 90.0)
    return _dim(
        "risk", "stock_coverage", available=True,
        risk_value=round(risk, 2), raw_value=days, raw_unit="jours",
        rationale=f"Couverture de stock de {days:g} jour(s) (180 j ramène au plancher 10).",
    )


# ---------------------------------------------------------------------------
# Composantes de confiance (SÉPARÉES du risque)
# ---------------------------------------------------------------------------

def _confidence_dims(
    *, stages: list[dict], risk_dims: list[ResourceDimension], as_of: date,
    market_total: int, market_blocked: int,
) -> list[ResourceDimension]:
    out: list[ResourceDimension] = []

    # market_coverage : couverture de marché de l'étape retenue (garde de couverture).
    scored = [s for s in stages if s["hhi"] is not None and s.get("coverage_pct") is not None]
    if scored:
        worst = max(scored, key=lambda s: s["hhi"])
        cov = (worst["coverage_pct"] or 0.0) / 100.0
        rationale = f"Marché documenté à l'étape retenue : {worst['coverage_pct']} %."
    else:
        cov = 0.5 if any(s["hhi"] is not None for s in stages) else 0.0
        rationale = "Couverture de marché non déterminée (données en volume ou absentes)."
    out.append(_dim("confidence", "market_coverage", available=True,
                    raw_value=round(cov, 4), weight=CONFIDENCE_WEIGHTS["market_coverage"],
                    rationale=rationale))

    # data_quality : mix des data_status de toutes les observations.
    counts: dict[str, int] = {}
    for s in stages:
        for st, n in s["status_mix"].items():
            counts[st] = counts.get(st, 0) + n
    total = sum(counts.values())
    quality = (sum(_STATUS_QUALITY.get(st, 0.3) * n for st, n in counts.items()) / total) if total else 0.0
    out.append(_dim("confidence", "data_quality", available=True, raw_value=round(quality, 4),
                    weight=CONFIDENCE_WEIGHTS["data_quality"],
                    rationale=f"{total} observation(s), répartition {counts or '{}'}."))

    # component_coverage : composantes de risque calculables.
    available = sum(1 for d in risk_dims if d.available)
    comp = available / len(NOMINAL_WEIGHTS) if NOMINAL_WEIGHTS else 0.0
    out.append(_dim("confidence", "component_coverage", available=True, raw_value=round(comp, 4),
                    weight=CONFIDENCE_WEIGHTS["component_coverage"],
                    rationale=f"{available} composante(s) de risque disponible(s) sur {len(NOMINAL_WEIGHTS)}."))

    # evidence_coverage : part des observations portant une source_release_id.
    sourced = sum(s["sourced_count"] for s in stages)
    obs = sum(s["obs_count"] for s in stages)
    ev = (sourced / obs) if obs else 0.0
    out.append(_dim("confidence", "evidence_coverage", available=True, raw_value=round(ev, 4),
                    weight=CONFIDENCE_WEIGHTS["evidence_coverage"],
                    rationale=f"{sourced}/{obs} observation(s) sourcée(s) (source_release_id)."))

    # freshness : écart d'année de la donnée la plus récente.
    years = [s["reference_year"] for s in stages if s.get("reference_year") is not None]
    if years:
        age = max(0, as_of.year - max(years))
        fresh = max(0.0, 1.0 - age * 0.2)
        rationale = f"Donnée la plus récente : {max(years)} (écart {age} an(s))."
    else:
        fresh = 0.0
        rationale = "Aucune année de référence disponible."
    out.append(_dim("confidence", "freshness", available=True, raw_value=round(fresh, 4),
                    weight=CONFIDENCE_WEIGHTS["freshness"], rationale=rationale))

    # license_access : part des données de marché exploitables (licence).
    if market_total == 0:
        lic = 0.5
        rationale = "Aucune donnée de marché sous licence en jeu."
    elif market_blocked == 0:
        lic = 1.0
        rationale = f"{market_total} donnée(s) de marché, toutes exploitables."
    else:
        lic = max(0.0, 1.0 - market_blocked / market_total)
        rationale = (f"{market_blocked}/{market_total} donnée(s) de marché inutilisables "
                     "(usage dérivé non licencié) — la confiance baisse, le risque non.")
    out.append(_dim("confidence", "license_access", available=True, raw_value=round(lic, 4),
                    weight=CONFIDENCE_WEIGHTS["license_access"], rationale=rationale))

    return out


# ---------------------------------------------------------------------------
# Composite + sensibilité
# ---------------------------------------------------------------------------

def _composite_risk(risk_dims: list[ResourceDimension]) -> float | None:
    """Somme pondérée renormalisée sur les composantes disponibles. `None` si une
    composante OBLIGATOIRE manque (aucun indice global inventé)."""
    for code in MANDATORY_RISK_COMPONENTS:
        if not any(d.dimension_code == code and d.available for d in risk_dims):
            return None
    available = [d for d in risk_dims if d.available and d.risk_value is not None]
    total_weight = sum(NOMINAL_WEIGHTS[d.dimension_code] for d in available)
    if not available or total_weight <= 0:
        return None
    score = 0.0
    for d in available:
        d.weight = round(NOMINAL_WEIGHTS[d.dimension_code] / total_weight, 4)
        d.contribution = round((d.risk_value or 0.0) * d.weight, 4)
        score += d.contribution
    return round(score, 2)


def _sensitivity(risk_dims: list[ResourceDimension], baseline: float) -> dict[str, Any]:
    """OAT sur les poids des composantes disponibles : δ=±20 %, renormalisation
    identique au composite, on mesure le déplacement du score. Montre la
    fragilité, ne valide pas le modèle."""
    available = [d for d in risk_dims if d.available and d.risk_value is not None]
    tornado: list[dict[str, Any]] = []
    max_abs = 0.0
    for target in available:
        deltas = []
        for sign in (1.0, -1.0):
            weights = {
                d.dimension_code: NOMINAL_WEIGHTS[d.dimension_code] * (1.0 + sign * _SENSITIVITY_DELTA)
                if d is target else NOMINAL_WEIGHTS[d.dimension_code]
                for d in available
            }
            tw = sum(weights.values())
            perturbed = round(sum((d.risk_value or 0.0) * (weights[d.dimension_code] / tw) for d in available), 2)
            deltas.append(perturbed - baseline)
        worst = max(deltas, key=abs)
        max_abs = max(max_abs, abs(worst))
        tornado.append({"dimension_code": target.dimension_code, "abs_delta": round(abs(worst), 2)})
    tornado.sort(key=lambda t: t["abs_delta"], reverse=True)
    return {
        "delta_pct": _SENSITIVITY_DELTA,
        "band": {"low": round(baseline - max_abs, 2), "high": round(baseline + max_abs, 2)},
        "tornado": tornado,
    }


# ---------------------------------------------------------------------------
# Assessment complet
# ---------------------------------------------------------------------------

def assess(
    *,
    resource_slug: str,
    observation_rows: list[dict[str, Any]],
    supplier_shares: list[float] | None = None,
    substitutes: list[dict[str, Any]] | None = None,
    stock_coverage_days: float | None = None,
    as_of: date | None = None,
    market_total: int = 0,
    market_blocked: int = 0,
) -> ResourceAssessmentResult:
    """Calcule le Resource Exposure Score — pur et reproductible."""
    as_of = as_of or date.today()
    supplier_shares = supplier_shares or []
    substitutes = substitutes or []

    by_stage: dict[str, list[dict]] = {}
    for row in observation_rows:
        by_stage.setdefault(str(row["stage_code"]), []).append(row)
    stages = [compute_stage(code, rows) for code, rows in sorted(by_stage.items())]

    risk_dims = [
        _stage_concentration_dim(stages),
        _third_country_dim(stages),
        _supplier_dim(supplier_shares),
        _substitutability_dim(substitutes),
        _stock_dim(stock_coverage_days),
    ]
    risk_score = _composite_risk(risk_dims)

    conf_dims = _confidence_dims(
        stages=stages, risk_dims=risk_dims, as_of=as_of,
        market_total=market_total, market_blocked=market_blocked,
    )
    cw = sum(d.weight or 0.0 for d in conf_dims)
    confidence = round(
        sum((d.raw_value or 0.0) * (d.weight or 0.0) for d in conf_dims) / cw * 100.0, 2
    ) if cw else 0.0

    warnings: list[str] = []
    if risk_score is None:
        warnings.append(
            "Aucune donnée obligatoire de concentration disponible : indice global non produit "
            "(un indice inventé serait pire qu'une absence d'indice)."
        )
    missing = [d.dimension_code for d in risk_dims if not d.available]
    if missing:
        warnings.append(
            "Composantes exclues faute de données (poids renormalisés, jamais comptées "
            "risque nul) : " + ", ".join(missing) + "."
        )

    # En-têtes du run : étape la plus concentrée (headline).
    scored_stages = [s for s in stages if s["hhi"] is not None]
    worst = max(scored_stages, key=lambda s: s["hhi"]) if scored_stages else None
    observed_hhi = worst["hhi"] if worst else None
    coverage_pct = worst["coverage_pct"] if worst else None
    missing_share_pct = worst["missing_share_pct"] if worst else None
    if worst and worst["coverage_pct"] is not None and worst["coverage_pct"] < MIN_STAGE_COVERAGE_PCT:
        warnings.append(
            f"Couverture de marché faible à l'étape retenue ({worst['coverage_pct']} %) : "
            "HHI publié mais signalé, confiance dégradée."
        )

    drivers = sorted(
        [{"dimension_code": d.dimension_code, "contribution": d.contribution, "stage_code": d.stage_code}
         for d in risk_dims if d.available and d.contribution is not None],
        key=lambda t: t["contribution"], reverse=True,
    )
    sensitivity = _sensitivity(risk_dims, risk_score) if risk_score is not None else None

    input_hash = compute_input_hash(
        resource_slug=resource_slug, observations=observation_rows, supplier_shares=supplier_shares,
        substitutes=substitutes, stock_coverage_days=stock_coverage_days, as_of=as_of,
        market_total=market_total, market_blocked=market_blocked,
    )

    return ResourceAssessmentResult(
        risk_score=risk_score, confidence=confidence, coverage_pct=coverage_pct,
        observed_hhi=observed_hhi, missing_share_pct=missing_share_pct,
        methodology_code=METHODOLOGY_CODE, methodology_version=METHODOLOGY_VERSION,
        input_hash=input_hash, dimensions=[*risk_dims, *conf_dims], drivers=drivers,
        warnings=warnings, sensitivity=sensitivity, disclaimer=DISCLAIMER,
    )
