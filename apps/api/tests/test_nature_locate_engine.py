"""
test_nature_locate_engine.py — moteur PUR du Locate (PR-09 tranche A).

Aucune base requise (comme `test_geo_geometry.py`/`test_water_screening_engine.py`)
— `services/calculations/nature_locate.py` est un module pur. Couvre :
Polygon, MultiPolygon, faux positif bbox, reproductibilité (même empreinte
pour mêmes entrées), et une PREUVE explicite que le moteur géométrique PR-08
(`services.calculations.geo`) est RÉUTILISÉ, jamais réimplémenté.
"""

from __future__ import annotations

import inspect

from services.calculations import geo, nature_locate

_SQUARE = {
    "type": "Polygon",
    "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]],
}

_MULTI = {
    "type": "MultiPolygon",
    "coordinates": [
        [[[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0], [0.0, 0.0]]],
        [[[20.0, 20.0], [24.0, 20.0], [24.0, 24.0], [20.0, 24.0], [20.0, 20.0]]],
    ],
}


def _feature(boundary: dict, *, feature_id: int = 1, code: str = "F1") -> dict:
    min_lat, max_lat, min_lon, max_lon = geo.compute_bbox(boundary)
    return {
        "id": feature_id,
        "code": code,
        "feature_kind": "ecosystem",
        "sensitivity": "public",
        "bbox_min_lat": min_lat,
        "bbox_max_lat": max_lat,
        "bbox_min_lon": min_lon,
        "bbox_max_lon": max_lon,
        "boundary_geojson": boundary,
    }


def _site(lat: float, lon: float) -> dict:
    return {"site_id": 42, "latitude": lat, "longitude": lon, "precision": "exact"}


class TestGeoEngineReuse:
    """Preuve explicite : nature_locate.py N'IMPLÉMENTE PAS de géométrie —
    il importe et appelle `services.calculations.geo`."""

    def test_module_imports_geo_engine(self):
        source = inspect.getsource(nature_locate)
        assert "from services.calculations.geo import" in source
        assert "match_point_to_area" in source

    def test_compute_intersection_delegates_to_match_point_to_area(self):
        fn_source = inspect.getsource(nature_locate.compute_intersection)
        assert "match_point_to_area(" in fn_source

    def test_no_reimplemented_point_in_polygon_primitives(self):
        """Aucune fonction de bas niveau du moteur géométrique (ray-casting,
        test de segment) n'est redéfinie dans ce module — la seule source de
        vérité géométrique reste `services/calculations/geo.py`."""
        source = inspect.getsource(nature_locate)
        for forbidden in ("def _point_in_ring", "def _point_on_segment", "def point_in_boundary",
                          "def normalize_boundary", "def compute_bbox"):
            assert forbidden not in source, (
                f"{forbidden} ne doit JAMAIS être redéfini ici — réutiliser geo.py"
            )

    def test_method_code_constant_is_the_shared_one(self):
        assert nature_locate.METHOD_POINT_IN_POLYGON is geo.METHOD_POINT_IN_POLYGON


class TestComputeIntersection:
    def test_polygon_match_inside(self):
        feature = _feature(_SQUARE)
        result = nature_locate.compute_intersection(site=_site(5.0, 5.0), feature=feature)
        assert result["bbox_candidate"] is True
        assert result["matched"] is True
        assert result["method_code"] == geo.METHOD_POINT_IN_POLYGON

    def test_polygon_no_match_outside_bbox(self):
        """Hors bbox : `bbox_candidate=False` ET `matched=False` SANS exécuter
        le point-dans-polygone (contrat `match_point_to_area`, geo.py)."""
        feature = _feature(_SQUARE)
        result = nature_locate.compute_intersection(site=_site(50.0, 50.0), feature=feature)
        assert result["bbox_candidate"] is False
        assert result["matched"] is False

    def test_multipolygon_match_in_second_polygon(self):
        """Un point dans le SECOND polygone d'un MultiPolygon est bien
        apparié — preuve que le MultiPolygon (pas seulement Polygon) est géré,
        via `geo.normalize_boundary`, réutilisé tel quel."""
        feature = _feature(_MULTI, feature_id=2, code="F2")
        result = nature_locate.compute_intersection(site=_site(22.0, 22.0), feature=feature)
        assert result["bbox_candidate"] is True
        assert result["matched"] is True

    def test_multipolygon_bbox_candidate_but_not_matched_between_parts(self):
        """Un point dans la bbox GLOBALE du MultiPolygon (qui englobe les deux
        parties) mais hors des deux polygones réels : bbox_candidate=True,
        matched=False — le pré-filtre n'est jamais un résultat final."""
        feature = _feature(_MULTI, feature_id=2, code="F2")
        result = nature_locate.compute_intersection(site=_site(10.0, 10.0), feature=feature)
        assert result["bbox_candidate"] is True
        assert result["matched"] is False

    def test_never_a_score_only_geometric_fact_keys(self):
        """Le résultat ne porte AUCUN champ de risque/score/confiance — une
        intersection est un fait, jamais une conclusion (règle non
        négociable PR-09)."""
        feature = _feature(_SQUARE)
        result = nature_locate.compute_intersection(site=_site(5.0, 5.0), feature=feature)
        forbidden_keys = {"risk", "risk_score", "confidence", "score", "severity"}
        assert not (forbidden_keys & set(result.keys()))


class TestReproducibility:
    def test_same_inputs_produce_same_fingerprint(self):
        feature = _feature(_SQUARE)
        site = _site(5.0, 5.0)
        first = nature_locate.compute_intersection(site=site, feature=feature)
        second = nature_locate.compute_intersection(site=dict(site), feature=dict(feature))
        assert first["fingerprint"] == second["fingerprint"]
        assert first["matched"] == second["matched"]
        assert first["snapshot"] == second["snapshot"]

    def test_different_site_position_changes_fingerprint(self):
        feature = _feature(_SQUARE)
        a = nature_locate.compute_intersection(site=_site(5.0, 5.0), feature=feature)
        b = nature_locate.compute_intersection(site=_site(6.0, 6.0), feature=feature)
        assert a["fingerprint"] != b["fingerprint"]

    def test_fingerprint_is_sha256_hex(self):
        feature = _feature(_SQUARE)
        result = nature_locate.compute_intersection(site=_site(5.0, 5.0), feature=feature)
        assert len(result["fingerprint"]) == 64
        int(result["fingerprint"], 16)  # lève ValueError si pas hexadécimal
