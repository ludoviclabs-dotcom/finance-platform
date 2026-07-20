"""
services/calculations/nature_locate.py — moteur PUR de l'intersection
site x élément naturel (PR-09 tranche A, « Locate »).

Pur au sens strict du dossier `services/calculations/` : aucune I/O, aucune
base, aucune horloge, aucun réseau — mêmes entrées ⇒ mêmes sorties, octet pour
octet (empreinte comprise). L'orchestration (lecture du site, des features
candidates, persistance des lignes `site_nature_intersections`) vit dans
`services/nature/locate_service.py`.

RÉUTILISATION DU MOTEUR GÉOMÉTRIQUE PR-08 — NE JAMAIS DUPLIQUER. Ce module
n'implémente AUCUN calcul géométrique lui-même : `compute_intersection` importe
et appelle `services.calculations.geo.match_point_to_area` (bbox pré-filtre +
point-dans-polygone exact, frontière = intérieur — convention documentée et
testée dans `geo.py`). Si un besoin géométrique nouveau apparaissait, la bonne
réponse serait d'ÉTENDRE `geo.py`, jamais de recopier sa logique ici.

RÈGLE NON NÉGOCIABLE : une intersection est un FAIT géométrique, jamais une
conclusion. `compute_intersection` ne retourne ni risque, ni score, ni
recommandation — seulement `matched`/`bbox_candidate`/`method_code` et une
trace reproductible (`snapshot`/`fingerprint`). L'interprétation (dépendance,
impact, risque) est un geste humain distinct, porté par d'autres tables
(`nature_dependencies`, `nature_impacts`, puis `nature_risks` en 039).
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from services.calculations.geo import (
    METHOD_POINT_IN_POLYGON,
    match_point_to_area,
)


def build_input_snapshot(*, site: dict[str, Any], feature: dict[str, Any]) -> dict[str, Any]:
    """Snapshot d'entrée CANONIQUE (trié, sans horloge) — gelé en base par le
    trigger d'immutabilité 038, il rend l'intersection rejouable et auditable
    (même technique que `water_screening.build_input_snapshot`, adaptée à une
    paire site/feature plutôt qu'à un run multi-zones)."""
    return {
        "site": {
            "site_id": site["site_id"],
            "latitude": float(site["latitude"]),
            "longitude": float(site["longitude"]),
            "precision": site.get("precision"),
        },
        "feature": {
            "feature_id": feature["id"],
            "code": feature["code"],
            "feature_kind": feature.get("feature_kind"),
            "sensitivity": feature.get("sensitivity"),
            "boundary_sha256": hashlib.sha256(
                json.dumps(feature["boundary_geojson"], sort_keys=True,
                           separators=(",", ":")).encode("utf-8")
            ).hexdigest(),
        },
    }


def input_fingerprint(snapshot: dict[str, Any]) -> str:
    """Empreinte déterministe du snapshot (précédent water_screening/scope2
    `input_fingerprint`) : deux calculs de même empreinte doivent porter le
    même résultat — c'est la preuve de reproductibilité exigée par PR-09."""
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_intersection(
    *, site: dict[str, Any], feature: dict[str, Any],
) -> dict[str, Any]:
    """Intersection PURE et déterministe d'UN site avec UNE `nature_features`.

    `site` : {site_id, latitude, longitude, precision}.
    `feature` : ligne `nature_features` enrichie ({id, code, feature_kind,
    sensitivity, bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon,
    boundary_geojson}).

    Retourne {matched, bbox_candidate, method_code, prefilter_code, snapshot,
    fingerprint} — jamais un score, jamais une conclusion. `method_code` est
    TOUJOURS `geo.METHOD_POINT_IN_POLYGON` en pratique : `match_point_to_area`
    ne retourne jamais `geojson_bbox_prefilter_v1` comme méthode finale (c'est
    un code de PRÉ-FILTRE — voir `geo.py`, `point_in_bbox` docstring), il est
    seulement admis dans le CHECK de `site_nature_intersections` par cohérence
    avec le vocabulaire fermé de 037/geo.py.
    """
    trace = match_point_to_area(
        float(site["latitude"]), float(site["longitude"]),
        bbox_min_lat=float(feature["bbox_min_lat"]),
        bbox_max_lat=float(feature["bbox_max_lat"]),
        bbox_min_lon=float(feature["bbox_min_lon"]),
        bbox_max_lon=float(feature["bbox_max_lon"]),
        boundary_geojson=feature["boundary_geojson"],
    )
    snapshot = build_input_snapshot(site=site, feature=feature)
    return {
        "matched": trace["matched"],
        "bbox_candidate": trace["bbox_candidate"],
        "method_code": trace["method_code"],
        "prefilter_code": trace["prefilter_code"],
        "snapshot": snapshot,
        "fingerprint": input_fingerprint(snapshot),
    }


__all__ = [
    "METHOD_POINT_IN_POLYGON",
    "build_input_snapshot",
    "compute_intersection",
    "input_fingerprint",
]
