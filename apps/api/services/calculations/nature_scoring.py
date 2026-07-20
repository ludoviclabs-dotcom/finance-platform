"""
services/calculations/nature_scoring.py — moteur PUR risque/opportunité
nature (PR-09 tranche B, « Assess »).

Pur au sens strict du dossier : aucune I/O, aucune base, aucune horloge,
aucun réseau — mêmes entrées ⇒ mêmes sorties, octet pour octet (empreinte
comprise). L'orchestration (lecture des dépendances/impacts/intersections
ACCEPTÉS, persistance) vit dans `services/nature/risk_service.py` et
`services/nature/opportunity_service.py`.

RÈGLE NON NÉGOCIABLE (motif `services/crma/scoring.py`, PR-07, repris à
l'identique — contrats Wave 4 §6) : une composante SANS donnée est
`available=False` et EXCLUE du calcul (poids renormalisés parmi les
composantes disponibles) — jamais comptée à zéro. `risk_score`/
`opportunity_score` valent `None` si AUCUNE composante n'est calculable :
mieux vaut l'absence de score qu'un nombre inventé. La CONFIANCE reste
calculée dans ce cas (elle vaudra logiquement très peu) — c'est précisément
son rôle. Risque (ou opportunité), aléa (`likelihood`) et confiance sont
TROIS grandeurs indépendantes, jamais fusionnées :

  - `risk_score`/`opportunity_score` : dérivés des données (dépendances,
    impacts, intersections ACCEPTÉES) — un calcul déterministe.
  - `likelihood` : un JUGEMENT humain, jamais inféré ici. Ce module l'accepte
    en entrée et le fait traverser tel quel (aucune dérivation depuis
    `risk_score`) — dériver une probabilité d'occurrence à partir d'une
    intensité serait une fausse indépendance (les deux redeviendraient un
    seul nombre déguisé en deux colonnes).
  - `confidence` : solidité du socle (composantes calculables + couverture de
    revue humaine). Ne dit RIEN du niveau de risque/opportunité.

Composantes RISQUE : `dependency_exposure` (dépendances ACCEPTÉES, le palier
le plus critique — sélection, jamais une moyenne, motif
`_stage_concentration_component`), `impact_severity` (impacts négatifs
ACCEPTÉS), `site_sensitivity` (intersections ACCEPTÉES et appariées,
sensibilité de l'élément naturel touché). Composantes OPPORTUNITÉ :
`positive_impact_potential` (impacts positifs ACCEPTÉS), `dependency_leverage`
(une dépendance forte est aussi un levier d'investissement — TNFD ne présente
pas dépendances et opportunités comme deux univers disjoints).

Aucune conclusion automatique : ces fonctions ne lisent QUE ce qu'un humain a
déjà ACCEPTÉ (review_status='accepted', filtré par l'appelant AVANT d'entrer
ici) — une ligne 'pending'/'flagged' n'entre jamais dans un score.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

METHODOLOGY_CODE_RISK = "CC-NATURE-RISK"
METHODOLOGY_CODE_OPPORTUNITY = "CC-NATURE-OPPORTUNITY"
METHODOLOGY_VERSION = "0.1.0"

# Palier qualitatif -> valeur 0-100 (motif _SEVERITY_RISK, scoring.py PR-07).
QUALITATIVE_VALUE: dict[str, float] = {
    "low": 20.0,
    "medium": 45.0,
    "high": 75.0,
    "critical": 95.0,
}

# Sensibilité d'un élément naturel intersecté, par type (vocabulaire 038).
FEATURE_KIND_VALUE: dict[str, float] = {
    "protected_area": 85.0,
    "kba": 90.0,
    "ecosystem": 50.0,
    "other": 30.0,
}

NOMINAL_WEIGHTS_RISK: dict[str, float] = {
    "dependency_exposure": 0.4,
    "impact_severity": 0.4,
    "site_sensitivity": 0.2,
}

NOMINAL_WEIGHTS_OPPORTUNITY: dict[str, float] = {
    "positive_impact_potential": 0.6,
    "dependency_leverage": 0.4,
}


def _component(
    code: str, label: str, *, available: bool, value: float | None = None,
    rationale: str = "",
) -> dict[str, Any]:
    return {
        "code": code, "label": label, "available": available,
        "value": value, "weight": 0.0, "contribution": 0.0, "rationale": rationale,
    }


def _qualitative_component(
    code: str, label: str, levels: list[str], value_map: dict[str, float],
    *, empty_rationale: str, found_rationale: Any,
) -> dict[str, Any]:
    """Composante qualitative : sélectionne le palier le PLUS critique parmi
    `levels` (jamais une moyenne — motif `_stage_concentration_component`,
    scoring.py). `levels` vide -> composante indisponible, jamais un 0."""
    if not levels:
        return _component(code, label, available=False, rationale=empty_rationale)
    worst = max(levels, key=lambda lvl: value_map.get(lvl, 0.0))
    return _component(
        code, label, available=True, value=value_map.get(worst, 0.0),
        rationale=found_rationale(worst),
    )


def compute_component_score(
    components: list[dict[str, Any]], weights: dict[str, float],
) -> tuple[float | None, list[str]]:
    """Agrège des composantes en un score 0-100 — renormalisation générique
    (motif `crma/scoring.py::compute_score`, généralisé au-delà de CRMA).
    Mute `components` en place (weight/contribution), comme son précédent."""
    available = [c for c in components if c["available"] and c["value"] is not None]
    total_weight = sum(weights[c["code"]] for c in available)
    warnings: list[str] = []
    score: float | None = None
    if available and total_weight > 0:
        for c in components:
            if c["available"] and c["value"] is not None:
                c["weight"] = round(weights[c["code"]] / total_weight, 4)
                c["contribution"] = round(c["value"] * c["weight"], 4)
        score = round(sum(c["contribution"] for c in available), 2)
    else:
        warnings.append(
            "Aucune composante calculable : score non produit (un score inventé "
            "serait pire qu'une absence de score)."
        )
    missing = [c["code"] for c in components if not c["available"]]
    if missing:
        warnings.append(
            "Composantes exclues faute de données ACCEPTÉES (poids renormalisés, "
            "jamais comptées comme zéro) : " + ", ".join(missing) + "."
        )
    return score, warnings


def _confidence_components(
    components: list[dict[str, Any]], *, total_rows: int, accepted_rows: int,
) -> list[dict[str, Any]]:
    """Composantes de CONFIANCE — n'entrent JAMAIS dans le score. Couvrent la
    disponibilité des composantes de calcul ET la couverture de revue humaine
    (une donnée encore 'pending' n'alimente pas le score mais existe — sa
    part dans le total dégrade la confiance, jamais le score)."""
    available = sum(1 for c in components if c["available"])
    component_coverage = available / len(components) if components else 0.0
    review_coverage = (accepted_rows / total_rows) if total_rows else 0.0
    return [
        {
            "code": "component_coverage", "label": "Composantes calculables",
            "value": round(component_coverage, 4), "weight": 0.5,
            "rationale": f"{available} composante(s) disponible(s) sur {len(components)}.",
        },
        {
            "code": "review_coverage", "label": "Couverture de revue humaine",
            "value": round(review_coverage, 4), "weight": 0.5,
            "rationale": (
                f"{accepted_rows} ligne(s) ACCEPTÉE(s) sur {total_rows} disponible(s) "
                "pour ce périmètre (dépendances + impacts + intersections)."
            ),
        },
    ]


def _confidence(
    components: list[dict[str, Any]], *, total_rows: int, accepted_rows: int,
) -> tuple[float, list[dict[str, Any]]]:
    conf_components = _confidence_components(
        components, total_rows=total_rows, accepted_rows=accepted_rows,
    )
    conf_weight = sum(c["weight"] for c in conf_components)
    confidence = round(
        sum(c["value"] * c["weight"] for c in conf_components) / conf_weight * 100, 2
    ) if conf_weight else 0.0
    return confidence, conf_components


def build_input_snapshot(
    *, dependencies: list[dict[str, Any]], impacts: list[dict[str, Any]],
    intersections: list[dict[str, Any]], likelihood: str | None,
) -> dict[str, Any]:
    """Snapshot d'entrée CANONIQUE (trié, sans horloge, JSON-serializable) —
    rend le calcul rejouable et auditable (motif `water_screening`/
    `scope2` `input_snapshot`)."""
    return {
        "dependencies": sorted(
            ({"id": d["id"], "dependency_level": d["dependency_level"]} for d in dependencies),
            key=lambda x: x["id"],
        ),
        "impacts": sorted(
            (
                {"id": i["id"], "impact_kind": i["impact_kind"],
                 "magnitude_qualitative": i["magnitude_qualitative"]}
                for i in impacts
            ),
            key=lambda x: x["id"],
        ),
        "intersections": sorted(
            (
                {"id": s["id"], "feature_kind": s.get("feature_kind"), "matched": bool(s.get("matched"))}
                for s in intersections
            ),
            key=lambda x: x["id"],
        ),
        "likelihood": likelihood,
    }


def input_fingerprint(snapshot: dict[str, Any]) -> str:
    """Empreinte déterministe du snapshot — deux calculs de même empreinte
    doivent porter le même résultat (preuve de reproductibilité)."""
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def score_risk(
    *,
    dependencies: list[dict[str, Any]],
    impacts: list[dict[str, Any]],
    intersections: list[dict[str, Any]],
    total_rows: int,
    accepted_rows: int,
    likelihood: str | None = None,
) -> dict[str, Any]:
    """Score de RISQUE — `dependencies`/`impacts`/`intersections` sont déjà
    filtrés par l'appelant à `review_status='accepted'` (ce module ne relit
    jamais un statut de revue, il fait confiance à son entrée telle que
    documentée par l'orchestrateur)."""
    dep_levels = [d["dependency_level"] for d in dependencies]
    imp_levels = [i["magnitude_qualitative"] for i in impacts if i.get("impact_kind") == "negative"]
    sens_kinds = [s["feature_kind"] for s in intersections if s.get("matched") and s.get("feature_kind")]

    components = [
        _qualitative_component(
            "dependency_exposure", "Exposition aux dépendances", dep_levels, QUALITATIVE_VALUE,
            empty_rationale="Aucune dépendance ACCEPTÉE rattachée à ce périmètre.",
            found_rationale=lambda lvl: f"Dépendance ACCEPTÉE la plus critique : '{lvl}'.",
        ),
        _qualitative_component(
            "impact_severity", "Sévérité des impacts négatifs", imp_levels, QUALITATIVE_VALUE,
            empty_rationale="Aucun impact négatif ACCEPTÉ rattaché à ce périmètre.",
            found_rationale=lambda lvl: f"Impact négatif ACCEPTÉ le plus sévère : '{lvl}'.",
        ),
        _qualitative_component(
            "site_sensitivity", "Sensibilité des zones intersectées", sens_kinds, FEATURE_KIND_VALUE,
            empty_rationale="Aucune intersection ACCEPTÉE et appariée avec un élément naturel.",
            found_rationale=lambda kind: f"Élément naturel le plus sensible intersecté : '{kind}'.",
        ),
    ]
    score, warnings = compute_component_score(components, NOMINAL_WEIGHTS_RISK)
    confidence, conf_components = _confidence(components, total_rows=total_rows, accepted_rows=accepted_rows)
    snapshot = build_input_snapshot(
        dependencies=dependencies, impacts=impacts, intersections=intersections, likelihood=likelihood,
    )
    return {
        "risk_score": score,
        "likelihood": likelihood,
        "confidence": confidence,
        "components": components,
        "confidence_components": conf_components,
        "warnings": warnings,
        "methodology_code": METHODOLOGY_CODE_RISK,
        "methodology_version": METHODOLOGY_VERSION,
        "snapshot": snapshot,
        "fingerprint": input_fingerprint(snapshot),
    }


def score_opportunity(
    *,
    dependencies: list[dict[str, Any]],
    impacts: list[dict[str, Any]],
    total_rows: int,
    accepted_rows: int,
    likelihood: str | None = None,
) -> dict[str, Any]:
    """Score d'OPPORTUNITÉ — même discipline que `score_risk`, direction
    opposée. Une dépendance forte n'est pas QUE un risque : elle signale aussi
    où un investissement de préservation aurait le plus de valeur (motif TNFD
    LEAP, `dependency_leverage`)."""
    pos_levels = [i["magnitude_qualitative"] for i in impacts if i.get("impact_kind") == "positive"]
    dep_levels = [d["dependency_level"] for d in dependencies]

    components = [
        _qualitative_component(
            "positive_impact_potential", "Potentiel d'impact positif", pos_levels, QUALITATIVE_VALUE,
            empty_rationale="Aucun impact positif ACCEPTÉ rattaché à ce périmètre.",
            found_rationale=lambda lvl: f"Impact positif ACCEPTÉ le plus élevé : '{lvl}'.",
        ),
        _qualitative_component(
            "dependency_leverage", "Levier sur une dépendance existante", dep_levels, QUALITATIVE_VALUE,
            empty_rationale="Aucune dépendance ACCEPTÉE rattachée à ce périmètre.",
            found_rationale=lambda lvl: f"Dépendance ACCEPTÉE la plus critique (levier) : '{lvl}'.",
        ),
    ]
    score, warnings = compute_component_score(components, NOMINAL_WEIGHTS_OPPORTUNITY)
    confidence, conf_components = _confidence(components, total_rows=total_rows, accepted_rows=accepted_rows)
    snapshot = build_input_snapshot(
        dependencies=dependencies, impacts=impacts, intersections=[], likelihood=likelihood,
    )
    return {
        "opportunity_score": score,
        "likelihood": likelihood,
        "confidence": confidence,
        "components": components,
        "confidence_components": conf_components,
        "warnings": warnings,
        "methodology_code": METHODOLOGY_CODE_OPPORTUNITY,
        "methodology_version": METHODOLOGY_VERSION,
        "snapshot": snapshot,
        "fingerprint": input_fingerprint(snapshot),
    }
