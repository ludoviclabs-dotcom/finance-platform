"""
services/calculations/geo.py — moteur géométrique PUR (PR-08), sans PostGIS.

RÉUTILISABLE tel quel par PR-09 (biodiversité) — ne jamais recopier ce module.
Pur au sens strict du dossier `services/calculations/` : aucune I/O, aucune
base, aucune horloge, aucun réseau — entièrement déterministe et testable sans
PostgreSQL.

Décision géospatiale validée (traçabilité PR-08) : PAS de PostGIS. Les
coordonnées canoniques sont latitude/longitude (NUMERIC en base, float ici) ;
les zones sont des GeoJSON `Polygon`/`MultiPolygon` (anneaux intérieurs/trous
inclus) accompagnés d'une boîte englobante (bbox). La bbox est un PRÉ-FILTRE
UNIQUEMENT : après elle, un vrai point-dans-polygone déterministe s'exécute sur
le GeoJSON. Chaque résultat géométrique porte son `method_code` explicite —
jamais présenté comme ST_Intersects/PostGIS (optimisation future optionnelle).

CONVENTION DE FRONTIÈRE (documentée, testée, non négociable) : ray-casting
pair/impair avec **frontière = intérieur** (`on-boundary = inside`). Un site
exactement sur une arête ou un sommet d'une zone de stress hydrique est traité
comme DANS la zone — choix de précaution : le screening le signale pour revue
humaine plutôt que de l'exclure silencieusement. Cela vaut aussi pour la
frontière d'un TROU (anneau intérieur) : un point sur le bord d'un trou touche
le polygone, donc il est dedans.

GeoJSON (RFC 7946) : les positions sont [longitude, latitude] — l'inversion
est le bug géospatial classique ; ce module convertit UNE fois, ici, et expose
partout des signatures (lat, lon) explicites.
"""

from __future__ import annotations

import math
from typing import Any

# Codes de méthode géométrique — vocabulaire FERMÉ, aligné sur les CHECK des
# migrations 036/037. Jamais un libellé libre.
METHOD_POINT_IN_POLYGON = "geojson_point_in_polygon_v1"
METHOD_BBOX_PREFILTER = "geojson_bbox_prefilter_v1"
METHOD_MANUAL_COORDINATES = "manual_coordinates_v1"

GEO_METHOD_CODES = (
    METHOD_POINT_IN_POLYGON,
    METHOD_BBOX_PREFILTER,
    METHOD_MANUAL_COORDINATES,
)


class GeometryError(Exception):
    """Géométrie invalide ou hors bornes — toujours explicite, jamais un repli."""


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_lat_lon(latitude: float, longitude: float) -> None:
    """Refuse toute coordonnée non finie ou hors bornes WGS84 — explicitement."""
    if not (isinstance(latitude, (int, float)) and isinstance(longitude, (int, float))):
        raise GeometryError("Coordonnées requises : latitude et longitude numériques.")
    lat = float(latitude)
    lon = float(longitude)
    if not (math.isfinite(lat) and math.isfinite(lon)):
        raise GeometryError("Coordonnées invalides : latitude/longitude non finies.")
    if lat < -90 or lat > 90:
        raise GeometryError(f"Latitude {lat} hors bornes [-90, 90].")
    if lon < -180 or lon > 180:
        raise GeometryError(f"Longitude {lon} hors bornes [-180, 180].")


def _validate_ring(ring: Any, *, what: str) -> list[tuple[float, float]]:
    """Valide un anneau GeoJSON (liste de positions [lon, lat], fermé) et le
    normalise en liste de tuples (lon, lat) SANS le point de fermeture."""
    if not isinstance(ring, list) or len(ring) < 4:
        raise GeometryError(
            f"{what} : anneau GeoJSON invalide — au moins 4 positions requises "
            "(anneau fermé, premier point répété en dernier)."
        )
    pts: list[tuple[float, float]] = []
    for pos in ring:
        if not isinstance(pos, list) or len(pos) < 2:
            raise GeometryError(f"{what} : position GeoJSON invalide (attendu [lon, lat]).")
        lon, lat = float(pos[0]), float(pos[1])
        if not (math.isfinite(lon) and math.isfinite(lat)):
            raise GeometryError(f"{what} : position non finie dans l'anneau.")
        if lat < -90 or lat > 90 or lon < -180 or lon > 180:
            raise GeometryError(
                f"{what} : position ({lat}, {lon}) hors bornes WGS84 "
                "(rappel GeoJSON : ordre [longitude, latitude])."
            )
        pts.append((lon, lat))
    if pts[0] != pts[-1]:
        raise GeometryError(f"{what} : anneau non fermé (premier point != dernier point).")
    return pts[:-1]  # sans le point de fermeture répété


def normalize_boundary(boundary_geojson: dict[str, Any]) -> list[list[list[tuple[float, float]]]]:
    """Valide un GeoJSON `Polygon` ou `MultiPolygon` et le normalise en
    liste de polygones ; chaque polygone = liste d'anneaux (le premier est
    l'anneau extérieur, les suivants sont des trous) ; chaque anneau = liste de
    tuples (lon, lat) sans point de fermeture.

    Tout autre type ou toute structure invalide est REFUSÉ avec raison —
    jamais ignoré, jamais réparé silencieusement.
    """
    if not isinstance(boundary_geojson, dict):
        raise GeometryError("boundary_geojson : objet GeoJSON requis (Polygon ou MultiPolygon).")
    gtype = boundary_geojson.get("type")
    coords = boundary_geojson.get("coordinates")
    if gtype == "Polygon":
        polygons_raw = [coords]
    elif gtype == "MultiPolygon":
        polygons_raw = coords
    else:
        raise GeometryError(
            f"boundary_geojson : type '{gtype}' non supporté — seuls Polygon et "
            "MultiPolygon sont admis (jamais de repli silencieux sur un autre type)."
        )
    if not isinstance(polygons_raw, list) or not polygons_raw:
        raise GeometryError("boundary_geojson : coordinates absentes ou vides.")

    polygons: list[list[list[tuple[float, float]]]] = []
    for p_idx, rings_raw in enumerate(polygons_raw):
        if not isinstance(rings_raw, list) or not rings_raw:
            raise GeometryError(f"boundary_geojson : polygone {p_idx} sans anneau extérieur.")
        rings = [
            _validate_ring(ring, what=f"boundary_geojson polygone {p_idx} anneau {r_idx}")
            for r_idx, ring in enumerate(rings_raw)
        ]
        polygons.append(rings)
    return polygons


# ---------------------------------------------------------------------------
# Boîte englobante — PRÉ-FILTRE uniquement (method_code dédié)
# ---------------------------------------------------------------------------

def compute_bbox(boundary_geojson: dict[str, Any]) -> tuple[float, float, float, float]:
    """Boîte englobante (min_lat, max_lat, min_lon, max_lon) d'un GeoJSON
    Polygon/MultiPolygon — dérivée déterministe de la géométrie, calculée UNE
    fois à l'enregistrement de la zone (jamais recalculée différemment ailleurs)."""
    polygons = normalize_boundary(boundary_geojson)
    lats = [lat for rings in polygons for ring in rings for (_lon, lat) in ring]
    lons = [lon for rings in polygons for ring in rings for (lon, _lat) in ring]
    return (min(lats), max(lats), min(lons), max(lons))


def point_in_bbox(
    latitude: float,
    longitude: float,
    *,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
) -> bool:
    """PRÉ-FILTRE bbox (bornes incluses — cohérent avec « frontière = intérieur »).

    Un `True` ici n'est JAMAIS un résultat d'appartenance : il sélectionne les
    candidats pour le vrai point-dans-polygone (`point_in_boundary`). Le code de
    méthode `geojson_bbox_prefilter_v1` ne doit apparaître qu'en trace de
    pré-filtre, jamais comme méthode d'un résultat final.
    """
    validate_lat_lon(latitude, longitude)
    return (
        float(min_lat) <= float(latitude) <= float(max_lat)
        and float(min_lon) <= float(longitude) <= float(max_lon)
    )


# ---------------------------------------------------------------------------
# Point-dans-polygone exact (ray casting, frontière = intérieur)
# ---------------------------------------------------------------------------

def _point_on_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> bool:
    """True si (px, py) est EXACTEMENT sur le segment [A, B] (colinéarité par
    produit vectoriel nul + appartenance au rectangle du segment). Arithmétique
    flottante directe, sans epsilon : la convention de frontière couvre les
    points exactement représentables (sommets, arêtes horizontales/verticales,
    milieux exacts) — un point « presque » sur l'arête relève du cas général."""
    cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    if cross != 0.0:
        return False
    return min(ax, bx) <= px <= max(ax, bx) and min(ay, by) <= py <= max(ay, by)


def _point_in_ring(lon: float, lat: float, ring: list[tuple[float, float]]) -> tuple[bool, bool]:
    """(inside, on_boundary) pour un anneau fermé (sans point de fermeture).

    Ray casting pair/impair : rayon horizontal vers +longitude. La règle des
    demi-intervalles (`ay > lat` XOR `by > lat`) garantit qu'un sommet traversé
    n'est jamais compté deux fois. La frontière est détectée séparément et
    AVANT le comptage (convention : frontière = intérieur, gérée par l'appelant).
    """
    on_boundary = False
    inside = False
    n = len(ring)
    for i in range(n):
        ax, ay = ring[i]
        bx, by = ring[(i + 1) % n]
        if _point_on_segment(lon, lat, ax, ay, bx, by):
            on_boundary = True
        if (ay > lat) != (by > lat):
            # Intersection du rayon horizontal avec l'arête [A,B].
            x_cross = ax + (lat - ay) * (bx - ax) / (by - ay)
            if lon < x_cross:
                inside = not inside
    return inside, on_boundary


def point_in_boundary(
    latitude: float, longitude: float, boundary_geojson: dict[str, Any]
) -> bool:
    """Point-dans-polygone EXACT et déterministe sur un GeoJSON Polygon/
    MultiPolygon, trous inclus — `method_code = geojson_point_in_polygon_v1`.

    Convention de frontière (documentée en tête de module, testée) :
    **frontière = intérieur**. Concrètement :
      * point sur une arête ou un sommet de l'anneau extérieur → DANS la zone ;
      * point strictement dans un trou (anneau intérieur) → HORS de la zone ;
      * point sur le BORD d'un trou → il touche le polygone → DANS la zone.
    MultiPolygon : dans la zone dès qu'un de ses polygones le contient.
    """
    validate_lat_lon(latitude, longitude)
    lat = float(latitude)
    lon = float(longitude)
    for rings in normalize_boundary(boundary_geojson):
        outer_inside, outer_boundary = _point_in_ring(lon, lat, rings[0])
        if outer_boundary:
            return True
        if not outer_inside:
            continue
        in_hole = False
        for hole in rings[1:]:
            hole_inside, hole_boundary = _point_in_ring(lon, lat, hole)
            if hole_boundary:
                # Le bord d'un trou appartient au polygone (frontière = intérieur).
                return True
            if hole_inside:
                in_hole = True
                break
        if not in_hole:
            return True
    return False


def match_point_to_area(
    latitude: float,
    longitude: float,
    *,
    bbox_min_lat: float,
    bbox_max_lat: float,
    bbox_min_lon: float,
    bbox_max_lon: float,
    boundary_geojson: dict[str, Any],
) -> dict[str, Any]:
    """Appartenance d'un point à UNE zone : pré-filtre bbox PUIS point-dans-
    polygone exact. Retourne une trace inspectable — jamais un booléen opaque :

        {
          "matched": bool,             # le résultat (point-dans-polygone exact)
          "bbox_candidate": bool,      # le point a-t-il passé le pré-filtre ?
          "method_code": "geojson_point_in_polygon_v1",
          "prefilter_code": "geojson_bbox_prefilter_v1",
        }

    Un point hors bbox est `matched=False` SANS exécuter le point-dans-polygone
    (c'est le rôle du pré-filtre) — correct par construction : la bbox englobe
    la géométrie, donc hors bbox ⇒ hors polygone. Un point DANS la bbox n'est
    jamais conclu par elle : le point-dans-polygone tranche (les faux positifs
    de bbox sont éliminés ici, prouvé par test).
    """
    bbox_candidate = point_in_bbox(
        latitude, longitude,
        min_lat=bbox_min_lat, max_lat=bbox_max_lat,
        min_lon=bbox_min_lon, max_lon=bbox_max_lon,
    )
    matched = False
    if bbox_candidate:
        matched = point_in_boundary(latitude, longitude, boundary_geojson)
    return {
        "matched": matched,
        "bbox_candidate": bbox_candidate,
        "method_code": METHOD_POINT_IN_POLYGON,
        "prefilter_code": METHOD_BBOX_PREFILTER,
    }
