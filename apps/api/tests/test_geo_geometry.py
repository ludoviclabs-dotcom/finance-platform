"""
test_geo_geometry.py — moteur géométrique pur (PR-08, sans PostGIS).

AUCUNE base requise : `services/calculations/geo.py` est pur (pas d'I/O, pas
d'horloge) — ces tests tournent dans le job `tests` standard.

Couvre la matrice obligatoire de la mission PR-08 :
Polygon, MultiPolygon, anneau intérieur (trou), point-sur-frontière (arête ET
sommet — convention documentée : frontière = intérieur), faux positif de bbox
éliminé par le point-dans-polygone exact, refus explicites (GeoJSON invalide,
coordonnées hors bornes), déterminisme, et absence de toute référence PostGIS
dans les migrations 036/037.
"""

from __future__ import annotations

import pytest

from services.calculations.geo import (
    METHOD_BBOX_PREFILTER,
    METHOD_MANUAL_COORDINATES,
    METHOD_POINT_IN_POLYGON,
    GeometryError,
    compute_bbox,
    match_point_to_area,
    normalize_boundary,
    point_in_bbox,
    point_in_boundary,
    validate_lat_lon,
)

# ── Fixtures géométriques (pures, fictives) ──────────────────────────────────
# Carré [0,10]x[0,10] (lon, lat) avec un trou [4,6]x[4,6].
SQUARE = {
    "type": "Polygon",
    "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]],
}
SQUARE_WITH_HOLE = {
    "type": "Polygon",
    "coordinates": [
        [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]],
        [[4.0, 4.0], [6.0, 4.0], [6.0, 6.0], [4.0, 6.0], [4.0, 4.0]],
    ],
}
# Deux carrés disjoints : [0,2]² et [8,10]².
MULTI = {
    "type": "MultiPolygon",
    "coordinates": [
        [[[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0], [0.0, 0.0]]],
        [[[8.0, 8.0], [10.0, 8.0], [10.0, 10.0], [8.0, 10.0], [8.0, 8.0]]],
    ],
}
# Triangle NON CONVEXE au sens du piège bbox : un « L » — la bbox couvre
# [0,10]x[0,10] mais le coin (8,8) est HORS du polygone.
L_SHAPE = {
    "type": "Polygon",
    "coordinates": [[
        [0.0, 0.0], [10.0, 0.0], [10.0, 4.0], [4.0, 4.0],
        [4.0, 10.0], [0.0, 10.0], [0.0, 0.0],
    ]],
}


# ── Codes de méthode ─────────────────────────────────────────────────────────


def test_method_codes_are_the_frozen_vocabulary():
    assert METHOD_POINT_IN_POLYGON == "geojson_point_in_polygon_v1"
    assert METHOD_BBOX_PREFILTER == "geojson_bbox_prefilter_v1"
    assert METHOD_MANUAL_COORDINATES == "manual_coordinates_v1"


# ── validate_lat_lon ─────────────────────────────────────────────────────────


def test_validate_lat_lon_accepts_bounds_and_rejects_out_of_range():
    validate_lat_lon(90, 180)
    validate_lat_lon(-90, -180)
    with pytest.raises(GeometryError):
        validate_lat_lon(90.0001, 0)
    with pytest.raises(GeometryError):
        validate_lat_lon(0, -180.0001)
    with pytest.raises(GeometryError):
        validate_lat_lon(float("nan"), 0)


# ── Polygon simple ───────────────────────────────────────────────────────────


def test_point_inside_simple_polygon():
    assert point_in_boundary(5.0, 5.0, SQUARE) is True


def test_point_outside_simple_polygon():
    assert point_in_boundary(15.0, 5.0, SQUARE) is False
    assert point_in_boundary(-1.0, 5.0, SQUARE) is False


# ── Frontière : arête ET sommet → DEDANS (convention documentée) ─────────────


def test_point_on_edge_is_inside_by_convention():
    # Milieu d'une arête verticale (lon=10) et d'une arête horizontale (lat=0).
    assert point_in_boundary(5.0, 10.0, SQUARE) is True
    assert point_in_boundary(0.0, 5.0, SQUARE) is True


def test_point_on_vertex_is_inside_by_convention():
    assert point_in_boundary(0.0, 0.0, SQUARE) is True
    assert point_in_boundary(10.0, 10.0, SQUARE) is True


def test_point_on_hole_boundary_is_inside_by_convention():
    """Le bord d'un trou appartient au polygone — un site exactement sur la
    frontière intérieure touche la zone, donc il est DANS la zone."""
    assert point_in_boundary(4.0, 5.0, SQUARE_WITH_HOLE) is True  # arête du trou
    assert point_in_boundary(4.0, 4.0, SQUARE_WITH_HOLE) is True  # sommet du trou


# ── Trou (anneau intérieur) ──────────────────────────────────────────────────


def test_point_strictly_inside_hole_is_outside():
    assert point_in_boundary(5.0, 5.0, SQUARE_WITH_HOLE) is False


def test_point_between_outer_ring_and_hole_is_inside():
    assert point_in_boundary(2.0, 2.0, SQUARE_WITH_HOLE) is True
    assert point_in_boundary(8.0, 8.0, SQUARE_WITH_HOLE) is True


# ── MultiPolygon ─────────────────────────────────────────────────────────────


def test_multipolygon_inside_either_part():
    assert point_in_boundary(1.0, 1.0, MULTI) is True
    assert point_in_boundary(9.0, 9.0, MULTI) is True


def test_multipolygon_between_parts_is_outside():
    assert point_in_boundary(5.0, 5.0, MULTI) is False


# ── bbox : pré-filtre, jamais un résultat ────────────────────────────────────


def test_compute_bbox_derives_from_geometry():
    assert compute_bbox(SQUARE) == (0.0, 10.0, 0.0, 10.0)
    assert compute_bbox(MULTI) == (0.0, 10.0, 0.0, 10.0)


def test_bbox_false_positive_is_eliminated_by_exact_point_in_polygon():
    """LE test du pré-filtre : (lat=8, lon=8) est DANS la bbox du « L » mais
    HORS du polygone — la bbox seule aurait produit un faux positif, le
    point-dans-polygone exact l'élimine."""
    min_lat, max_lat, min_lon, max_lon = compute_bbox(L_SHAPE)
    assert point_in_bbox(8.0, 8.0, min_lat=min_lat, max_lat=max_lat,
                         min_lon=min_lon, max_lon=max_lon) is True
    assert point_in_boundary(8.0, 8.0, L_SHAPE) is False

    trace = match_point_to_area(
        8.0, 8.0,
        bbox_min_lat=min_lat, bbox_max_lat=max_lat,
        bbox_min_lon=min_lon, bbox_max_lon=max_lon,
        boundary_geojson=L_SHAPE,
    )
    assert trace["bbox_candidate"] is True
    assert trace["matched"] is False
    assert trace["method_code"] == METHOD_POINT_IN_POLYGON
    assert trace["prefilter_code"] == METHOD_BBOX_PREFILTER


def test_point_outside_bbox_short_circuits_without_false_negative_risk():
    """Hors bbox ⇒ hors polygone (la bbox englobe la géométrie) : le
    pré-filtre peut conclure `matched=False` sans exécuter le PIP."""
    trace = match_point_to_area(
        50.0, 50.0,
        bbox_min_lat=0.0, bbox_max_lat=10.0, bbox_min_lon=0.0, bbox_max_lon=10.0,
        boundary_geojson=SQUARE,
    )
    assert trace["bbox_candidate"] is False
    assert trace["matched"] is False


def test_match_inside_reports_matched_with_explicit_method():
    trace = match_point_to_area(
        2.0, 2.0,
        bbox_min_lat=0.0, bbox_max_lat=10.0, bbox_min_lon=0.0, bbox_max_lon=10.0,
        boundary_geojson=L_SHAPE,
    )
    assert trace["matched"] is True
    assert trace["method_code"] == METHOD_POINT_IN_POLYGON


# ── Déterminisme ─────────────────────────────────────────────────────────────


def test_point_in_boundary_is_deterministic():
    results = {point_in_boundary(3.7, 9.1, L_SHAPE) for _ in range(50)}
    assert len(results) == 1


# ── Refus explicites (jamais de repli silencieux) ────────────────────────────


def test_normalize_boundary_rejects_non_polygon_types():
    with pytest.raises(GeometryError):
        normalize_boundary({"type": "Point", "coordinates": [0.0, 0.0]})
    with pytest.raises(GeometryError):
        normalize_boundary({"type": "LineString", "coordinates": [[0, 0], [1, 1]]})
    with pytest.raises(GeometryError):
        normalize_boundary({"type": "Polygon"})  # coordinates absentes


def test_normalize_boundary_rejects_unclosed_or_short_rings():
    with pytest.raises(GeometryError):
        normalize_boundary({
            "type": "Polygon",
            "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]]],  # non fermé
        })
    with pytest.raises(GeometryError):
        normalize_boundary({
            "type": "Polygon",
            "coordinates": [[[0.0, 0.0], [10.0, 0.0], [0.0, 0.0]]],  # < 4 positions
        })


def test_normalize_boundary_rejects_out_of_range_positions():
    with pytest.raises(GeometryError):
        normalize_boundary({
            "type": "Polygon",
            # lat 95 hors bornes — rappel : GeoJSON est [lon, lat].
            "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 95.0], [0.0, 0.0]]],
        })


def test_point_in_boundary_rejects_invalid_point():
    with pytest.raises(GeometryError):
        point_in_boundary(999.0, 0.0, SQUARE)


# ── Décision validée : AUCUN PostGIS (assertion sur les fichiers réels) ──────


def test_pr08_migrations_contain_no_postgis_reference():
    """Décision géospatiale gelée (traçabilité PR-08) : les migrations 036/037
    ne contiennent AUCUNE référence PostGIS — pas d'extension, pas de type
    geography/geometry, pas de fonction ST_*. La géométrie est portée par
    latitude/longitude NUMERIC + bbox + boundary_geojson JSONB, évaluée par ce
    module pur. PostGIS reste une optimisation future OPTIONNELLE (migration
    dédiée), jamais une dépendance implicite."""
    from pathlib import Path

    migrations_dir = Path(__file__).parent.parent / "db" / "migrations"
    files = sorted(p.name for p in migrations_dir.glob("03[67]_*.sql"))
    assert "036_geospatial_sites_water.sql" in files
    for name in files:
        text = (migrations_dir / name).read_text(encoding="utf-8").lower()
        # « postgis » n'apparaît que pour DOCUMENTER la décision de ne pas
        # l'utiliser — jamais dans une instruction exécutable.
        for line in text.splitlines():
            code = line.split("--", 1)[0]
            assert "postgis" not in code, f"{name} : référence PostGIS exécutable interdite"
            assert "create extension" not in code, f"{name} : CREATE EXTENSION interdit"
            assert " geography(" not in code, f"{name} : type geography interdit"
            assert " geometry(" not in code, f"{name} : type geometry interdit"
            assert "st_intersects" not in code and "st_contains" not in code, (
                f"{name} : fonction PostGIS interdite"
            )
