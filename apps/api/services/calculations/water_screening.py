"""
services/calculations/water_screening.py — moteur PUR du screening hydrique
(PR-08 tranche B).

Pur au sens strict du dossier : aucune I/O, aucune base, aucune horloge, aucun
réseau — mêmes entrées ⇒ mêmes sorties, octet pour octet (empreinte comprise).
L'orchestration (lecture du site, des zones, des licences, persistance) vit
dans `services/water/screening_service.py`.

RÈGLES NON NÉGOCIABLES matérialisées ici :

1. **Refus explicites, jamais silencieux.** Chaque condition invalide lève
   `WaterScreeningRefusal` avec sa raison : position non `accepted`, précision
   insuffisante (`country`), référentiel vide, licence sans usage dérivé sur
   une zone candidate. Aucun repli, aucune valeur par défaut.
2. **Risque ≠ confiance.** `risk_category` (ordinal, issu des zones appariées)
   et `confidence` (0-100, solidité du socle) sont calculés SÉPARÉMENT. Une
   donnée périmée ou une position imprécise DÉGRADE LA CONFIANCE, jamais le
   risque (ni à la hausse ni à la baisse) — précédent CRMA (contrats §6).
3. **Méthode géométrique nommée.** bbox = pré-filtre
   (`geojson_bbox_prefilter_v1`), appartenance = point-dans-polygone exact
   (`geojson_point_in_polygon_v1`, frontière = intérieur — convention du
   module `geo`). Jamais présentée comme ST_Intersects.
4. **« Aucune zone appariée » ≠ « risque nul ».** `risk_category=None` avec un
   warning explicite — le référentiel peut simplement ne pas couvrir ce point.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from services.calculations.geo import (
    METHOD_POINT_IN_POLYGON,
    match_point_to_area,
)

METHODOLOGY_CODE = "CC-WATER-SCREENING"
METHODOLOGY_VERSION = "1.0.0"

# Ordre ordinal des catégories de stress (vocabulaire du référentiel 036).
STRESS_ORDER = {
    "low": 1,
    "low_medium": 2,
    "medium_high": 3,
    "high": 4,
    "extremely_high": 5,
}

# Confiance de base selon la précision de géocodage ACCEPTÉE. `country` est
# absent À DESSEIN : un centroïde de pays dans un polygone de bassin n'a aucun
# sens — refus explicite, pas une confiance très basse.
PRECISION_BASE_CONFIDENCE = {
    "exact": 90,
    "street": 80,
    "manual": 65,
    "city": 50,
}

# Pénalités de confiance par qualité de donnée de zone (le maillon le plus
# faible parmi les zones appariées s'applique — jamais une moyenne qui
# masquerait une zone douteuse).
DATA_STATUS_PENALTY = {
    "verified": 0,
    "estimated": 10,
    "manual": 10,
    "inferred": 20,
}
STALE_PENALTY = 15
MIN_CONFIDENCE = 5


class WaterScreeningRefusal(Exception):
    """Screening REFUSÉ — la raison est le message, toujours explicite."""


def build_input_snapshot(
    *, site: dict[str, Any], candidate_areas: list[dict[str, Any]], scenario_code: str,
) -> dict[str, Any]:
    """Snapshot d'entrée CANONIQUE (trié, sans horloge) — gelé en base par le
    trigger d'immutabilité 037, il rend le run rejouable et auditable."""
    return {
        "methodology_code": METHODOLOGY_CODE,
        "methodology_version": METHODOLOGY_VERSION,
        "scenario_code": scenario_code,
        "site": {
            "site_id": site["site_id"],
            "latitude": float(site["latitude"]),
            "longitude": float(site["longitude"]),
            "precision": site.get("precision"),
            "review_status": site.get("review_status", "accepted"),
        },
        "candidate_areas": sorted(
            (
                {
                    "area_id": a["id"],
                    "code": a["code"],
                    "stress_category": a["stress_category"],
                    "data_status": a.get("data_status", "estimated"),
                    "stale": bool(a.get("stale", False)),
                    "derived_use_allowed": bool(a.get("derived_use_allowed", False)),
                    "source_code": a.get("source_code"),
                    "boundary_sha256": hashlib.sha256(
                        json.dumps(a["boundary_geojson"], sort_keys=True,
                                   separators=(",", ":")).encode("utf-8")
                    ).hexdigest(),
                }
                for a in candidate_areas
            ),
            key=lambda x: x["area_id"],
        ),
    }


def input_fingerprint(snapshot: dict[str, Any]) -> str:
    """Empreinte déterministe du snapshot (précédent scope2 `input_fingerprint`) :
    deux runs de même empreinte doivent porter le même résultat."""
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def run_screening(
    *,
    site: dict[str, Any],
    candidate_areas: list[dict[str, Any]],
    total_area_count: int,
    scenario_code: str = "baseline",
) -> dict[str, Any]:
    """Screening PUR d'un site contre les zones candidates (pré-filtrées bbox
    côté SQL — re-vérifiées ici, le pré-filtre n'est jamais cru sur parole).

    `site` : {site_id, latitude, longitude, precision, review_status}.
    `candidate_areas` : lignes water_risk_areas enrichies par l'orchestrateur
    ({id, code, label, area_kind, stress_category, data_status, bbox_*,
    boundary_geojson, derived_use_allowed, source_code, stale}).
    `total_area_count` : nombre TOTAL de zones du scénario dans le périmètre
    (candidates ou non) — 0 = référentiel vide = refus.

    Retourne un dict {snapshot, fingerprint, method_code, risk_category,
    matched, risk_components, confidence, coverage_pct, warnings} — entièrement
    déterministe.
    """
    # ── Refus 1 : gate de géocodage (jamais de screening sur une position
    # incertaine — la double vérification, en plus de get_accepted_position).
    if site.get("review_status") != "accepted":
        raise WaterScreeningRefusal(
            f"Screening refusé : position du site '{site.get('site_id')}' en statut "
            f"'{site.get('review_status')}' — seule une position ACCEPTÉE par un "
            "analyste est utilisable."
        )
    if site.get("latitude") is None or site.get("longitude") is None:
        raise WaterScreeningRefusal(
            f"Screening refusé : site '{site.get('site_id')}' sans coordonnées."
        )

    # ── Refus 2 : précision insuffisante.
    precision = site.get("precision")
    if precision not in PRECISION_BASE_CONFIDENCE:
        raise WaterScreeningRefusal(
            f"Screening refusé : précision de géocodage '{precision}' insuffisante "
            "pour une intersection de polygone (précisions admises : "
            f"{', '.join(sorted(PRECISION_BASE_CONFIDENCE))}). Une position au "
            "centroïde d'un pays dans un bassin versant serait un résultat inventé."
        )

    # ── Refus 3 : référentiel vide — « pas de donnée » n'est PAS « pas de risque ».
    if total_area_count == 0:
        raise WaterScreeningRefusal(
            f"Screening refusé : aucune zone de stress hydrique enregistrée pour le "
            f"scénario '{scenario_code}' — impossible de screener contre un "
            "référentiel vide (ce ne serait pas un risque nul, ce serait une "
            "absence de donnée)."
        )

    # ── Refus 4 : licence — usage dérivé requis sur TOUTE zone candidate.
    blocked = sorted(
        {a.get("source_code") or f"zone:{a['code']}"
         for a in candidate_areas if not a.get("derived_use_allowed", False)}
    )
    if blocked:
        raise WaterScreeningRefusal(
            "Screening refusé : la licence des sources suivantes n'autorise pas "
            "l'usage dérivé (allow_derived_use=false) : " + ", ".join(blocked) + ". "
            "Exclure silencieusement ces zones fausserait le résultat — le refus "
            "est global et explicite."
        )

    lat = float(site["latitude"])
    lon = float(site["longitude"])

    # ── Appariement : bbox (pré-filtre, re-vérifié) puis PIP exact.
    matched: list[dict[str, Any]] = []
    components: list[dict[str, Any]] = []
    for area in sorted(candidate_areas, key=lambda a: a["id"]):
        trace = match_point_to_area(
            lat, lon,
            bbox_min_lat=float(area["bbox_min_lat"]),
            bbox_max_lat=float(area["bbox_max_lat"]),
            bbox_min_lon=float(area["bbox_min_lon"]),
            bbox_max_lon=float(area["bbox_max_lon"]),
            boundary_geojson=area["boundary_geojson"],
        )
        component = {
            "area_id": area["id"],
            "code": area["code"],
            "label": area.get("label"),
            "area_kind": area.get("area_kind", "basin"),
            "stress_category": area["stress_category"],
            "data_status": area.get("data_status", "estimated"),
            "stale": bool(area.get("stale", False)),
            "source_code": area.get("source_code"),
            "bbox_candidate": trace["bbox_candidate"],
            "matched": trace["matched"],
            "method_code": trace["method_code"],
            "prefilter_code": trace["prefilter_code"],
        }
        components.append(component)
        if trace["matched"]:
            matched.append(component)

    # ── RISQUE : maximum ordinal des zones APPARIÉES — indépendant de la
    # confiance, de la fraîcheur et de la précision (elles ne le modifient
    # JAMAIS, dans aucun sens).
    risk_category: str | None = None
    if matched:
        risk_category = max(matched, key=lambda c: STRESS_ORDER[c["stress_category"]])[
            "stress_category"
        ]

    # ── CONFIANCE : base (précision) - maillon le plus faible (statut/fraîcheur
    # des zones appariées). Trace inspectable, jamais un nombre opaque.
    base = PRECISION_BASE_CONFIDENCE[precision]
    confidence_trace: list[dict[str, Any]] = [
        {"code": "geocode_precision", "value": base,
         "rationale": f"précision de géocodage acceptée : {precision}"},
    ]
    penalty = 0
    for c in matched:
        p = DATA_STATUS_PENALTY.get(c["data_status"], DATA_STATUS_PENALTY["inferred"])
        if c["stale"]:
            p += STALE_PENALTY
        penalty = max(penalty, p)
    if matched and penalty:
        confidence_trace.append({
            "code": "weakest_matched_area", "value": -penalty,
            "rationale": "pénalité du maillon le plus faible parmi les zones "
                         "appariées (statut de donnée, fraîcheur)",
        })
    confidence = max(MIN_CONFIDENCE, base - penalty)

    # ── Couverture et warnings (jamais silencieux).
    warnings: list[str] = []
    if precision == "city":
        warnings.append(
            "précision 'city' : position approximative — confiance dégradée, "
            "faire vérifier la position exacte du site."
        )
    for c in matched:
        if c["stale"]:
            warnings.append(
                f"zone '{c['code']}' : données périmées (stale) — la confiance est "
                "dégradée, le risque n'est PAS modifié."
            )
        if c["data_status"] != "verified":
            warnings.append(
                f"zone '{c['code']}' : donnée '{c['data_status']}' (non vérifiée)."
            )
    if matched:
        coverage_pct: float | None = 100.0
    else:
        coverage_pct = None
        warnings.append(
            "aucune zone du référentiel n'apparie ce site — ceci ne signifie PAS "
            "un risque nul : la couverture du référentiel à cet endroit est inconnue."
        )

    snapshot = build_input_snapshot(
        site=site, candidate_areas=candidate_areas, scenario_code=scenario_code,
    )
    return {
        "snapshot": snapshot,
        "fingerprint": input_fingerprint(snapshot),
        "methodology_code": METHODOLOGY_CODE,
        "methodology_version": METHODOLOGY_VERSION,
        "method_code": METHOD_POINT_IN_POLYGON,
        "scenario_code": scenario_code,
        "risk_category": risk_category,
        "matched": matched,
        "risk_components": components,
        "candidate_area_count": len(candidate_areas),
        "matched_area_count": len(matched),
        "confidence": confidence,
        "confidence_trace": confidence_trace,
        "coverage_pct": coverage_pct,
        "warnings": warnings,
    }
