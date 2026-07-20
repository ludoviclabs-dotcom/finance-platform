"""
test_water_screening_engine.py — moteur PUR du screening hydrique (PR-08B).

AUCUNE base requise : `services/calculations/water_screening.py` est pur —
ces tests tournent dans le job `tests` standard.

Couvre : refus explicites (position non acceptée, précision insuffisante,
référentiel vide, licence sans usage dérivé), séparation risque/confiance
(stale/imprécis dégradent la CONFIANCE, jamais le risque), reproductibilité
(mêmes entrées ⇒ mêmes sorties + même empreinte), méthode géométrique nommée,
faux positif bbox éliminé, « aucune zone » ≠ « risque nul ».
"""

from __future__ import annotations

import pytest

from services.calculations.geo import METHOD_POINT_IN_POLYGON
from services.calculations.water_screening import (
    METHODOLOGY_CODE,
    METHODOLOGY_VERSION,
    WaterScreeningRefusal,
    input_fingerprint,
    run_screening,
)

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]],
}
# « L » : bbox [0,10]² mais le coin (8,8) est hors du polygone.
L_SHAPE = {
    "type": "Polygon",
    "coordinates": [[
        [0.0, 0.0], [10.0, 0.0], [10.0, 4.0], [4.0, 4.0],
        [4.0, 10.0], [0.0, 10.0], [0.0, 0.0],
    ]],
}


def _site(lat=5.0, lon=5.0, precision="exact", review_status="accepted"):
    return {
        "site_id": 1, "latitude": lat, "longitude": lon,
        "precision": precision, "review_status": review_status,
    }


def _area(area_id=1, code="basin-1", stress="high", *, boundary=None,
          data_status="verified", stale=False, derived=True, source="SRC-FICTIVE"):
    boundary = boundary or SQUARE
    # bbox dérivée de la géométrie via le module geo (comme le service).
    from services.calculations.geo import compute_bbox

    min_lat, max_lat, min_lon, max_lon = compute_bbox(boundary)
    return {
        "id": area_id, "code": code, "label": f"Zone {code}", "area_kind": "basin",
        "stress_category": stress, "data_status": data_status, "stale": stale,
        "derived_use_allowed": derived, "source_code": source,
        "bbox_min_lat": min_lat, "bbox_max_lat": max_lat,
        "bbox_min_lon": min_lon, "bbox_max_lon": max_lon,
        "boundary_geojson": boundary,
    }


# ── Refus explicites ─────────────────────────────────────────────────────────


def test_refuses_non_accepted_position():
    with pytest.raises(WaterScreeningRefusal, match="ACCEPTÉE"):
        run_screening(
            site=_site(review_status="pending"),
            candidate_areas=[_area()], total_area_count=1,
        )


def test_refuses_country_precision():
    with pytest.raises(WaterScreeningRefusal, match="précision"):
        run_screening(
            site=_site(precision="country"),
            candidate_areas=[_area()], total_area_count=1,
        )


def test_refuses_empty_referential():
    with pytest.raises(WaterScreeningRefusal, match="référentiel vide"):
        run_screening(site=_site(), candidate_areas=[], total_area_count=0)


def test_refuses_blocked_license_naming_the_source():
    with pytest.raises(WaterScreeningRefusal, match="SRC-BLOQUEE"):
        run_screening(
            site=_site(),
            candidate_areas=[
                _area(area_id=1, derived=True),
                _area(area_id=2, code="basin-2", derived=False, source="SRC-BLOQUEE"),
            ],
            total_area_count=2,
        )


# ── Appariement et méthode ───────────────────────────────────────────────────


def test_matched_area_carries_explicit_method_code():
    result = run_screening(site=_site(), candidate_areas=[_area()], total_area_count=1)
    assert result["method_code"] == METHOD_POINT_IN_POLYGON
    assert result["methodology_code"] == METHODOLOGY_CODE
    assert result["methodology_version"] == METHODOLOGY_VERSION
    assert result["matched_area_count"] == 1
    assert result["risk_category"] == "high"
    trace = result["matched"][0]
    assert trace["method_code"] == "geojson_point_in_polygon_v1"
    assert trace["prefilter_code"] == "geojson_bbox_prefilter_v1"


def test_bbox_false_positive_is_not_matched():
    """(8,8) est dans la bbox du « L » mais hors du polygone : la zone reste
    candidate (bbox_candidate=True) mais NON appariée — le pré-filtre n'est
    jamais un résultat."""
    result = run_screening(
        site=_site(lat=8.0, lon=8.0),
        candidate_areas=[_area(boundary=L_SHAPE)],
        total_area_count=1,
    )
    assert result["matched_area_count"] == 0
    assert result["risk_category"] is None
    component = result["risk_components"][0]
    assert component["bbox_candidate"] is True
    assert component["matched"] is False


def test_no_match_is_not_zero_risk():
    result = run_screening(
        site=_site(lat=8.0, lon=8.0),
        candidate_areas=[_area(boundary=L_SHAPE)],
        total_area_count=1,
    )
    assert result["risk_category"] is None
    assert result["coverage_pct"] is None
    assert any("PAS" in w and "risque nul" in w for w in result["warnings"])


def test_risk_is_max_ordinal_of_matched_areas():
    result = run_screening(
        site=_site(),
        candidate_areas=[
            _area(area_id=1, stress="low"),
            _area(area_id=2, code="basin-2", stress="extremely_high"),
            _area(area_id=3, code="basin-3", stress="medium_high"),
        ],
        total_area_count=3,
    )
    assert result["risk_category"] == "extremely_high"
    assert result["matched_area_count"] == 3


# ── Risque ≠ confiance ───────────────────────────────────────────────────────


def test_stale_data_degrades_confidence_never_risk():
    fresh = run_screening(
        site=_site(), candidate_areas=[_area(data_status="verified")], total_area_count=1,
    )
    stale = run_screening(
        site=_site(), candidate_areas=[_area(data_status="verified", stale=True)],
        total_area_count=1,
    )
    assert stale["risk_category"] == fresh["risk_category"] == "high", (
        "la fraîcheur ne modifie JAMAIS le risque"
    )
    assert stale["confidence"] < fresh["confidence"], (
        "la fraîcheur dégrade la confiance"
    )
    assert any("stale" in w for w in stale["warnings"])


def test_imprecise_position_degrades_confidence_never_risk():
    exact = run_screening(site=_site(precision="exact"),
                          candidate_areas=[_area()], total_area_count=1)
    city = run_screening(site=_site(precision="city"),
                         candidate_areas=[_area()], total_area_count=1)
    assert city["risk_category"] == exact["risk_category"]
    assert city["confidence"] < exact["confidence"]


def test_estimated_area_degrades_confidence_never_risk():
    verified = run_screening(site=_site(), candidate_areas=[_area(data_status="verified")],
                             total_area_count=1)
    inferred = run_screening(site=_site(), candidate_areas=[_area(data_status="inferred")],
                             total_area_count=1)
    assert inferred["risk_category"] == verified["risk_category"]
    assert inferred["confidence"] < verified["confidence"]


def test_confidence_trace_is_inspectable():
    result = run_screening(
        site=_site(precision="street"),
        candidate_areas=[_area(data_status="estimated")], total_area_count=1,
    )
    codes = [t["code"] for t in result["confidence_trace"]]
    assert "geocode_precision" in codes
    assert "weakest_matched_area" in codes


# ── Reproductibilité ─────────────────────────────────────────────────────────


def test_same_inputs_same_outputs_and_fingerprint():
    kwargs = dict(
        site=_site(lat=3.25, lon=7.5, precision="street"),
        candidate_areas=[
            _area(area_id=2, code="basin-2", stress="high", data_status="estimated"),
            _area(area_id=1, stress="low"),
        ],
        total_area_count=5,
        scenario_code="baseline",
    )
    a = run_screening(**kwargs)
    b = run_screening(**kwargs)
    assert a == b, "mêmes entrées ⇒ mêmes sorties, octet pour octet"
    assert a["fingerprint"] == b["fingerprint"]
    assert a["fingerprint"] == input_fingerprint(a["snapshot"])


def test_fingerprint_changes_when_inputs_change():
    base = run_screening(site=_site(), candidate_areas=[_area()], total_area_count=1)
    moved = run_screening(site=_site(lat=5.0001), candidate_areas=[_area()], total_area_count=1)
    assert base["fingerprint"] != moved["fingerprint"]
