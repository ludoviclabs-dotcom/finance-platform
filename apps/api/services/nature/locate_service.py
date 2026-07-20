"""
locate_service.py — orchestration du Locate (PR-09 tranche A).

Le CALCUL est pur (`services/calculations/nature_locate.py`, qui appelle
`services.calculations.geo.match_point_to_area` — jamais réimplémenté ici) ;
ce module fait l'I/O : lecture de la position ACCEPTÉE du site (gate
`geocode_service.get_accepted_position`, la seule lecture autorisée — même
discipline que `screening_service` PR-08), features candidates (pré-filtre
bbox SQL via `features_service.candidate_features_for_point`), persistance
des lignes IMMUABLES `site_nature_intersections` (trigger 038).

RÈGLE NON NÉGOCIABLE : une intersection est un FAIT, jamais une conclusion.
Ce module ne calcule ni ne stocke aucun risque — voir `nature_dependencies`/
`nature_impacts` pour l'interprétation humaine, et `nature_risks` (039) pour
un score, explicitement séparé de la confiance.

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

import json
from typing import Any

from db.database import get_db
from models.nature import (
    SiteNatureIntersectionListResponse,
    SiteNatureIntersectionResponse,
)
from services.calculations.nature_locate import compute_intersection
from services.geo import geocode_service
from services.nature import features_service

_SCOPE = "company_id = %s"


class NatureLocateError(Exception):
    """Erreur métier du Locate (position non exploitable, cible introuvable)."""


def _intersection_response(row: dict[str, Any]) -> SiteNatureIntersectionResponse:
    data = {k: row[k] for k in SiteNatureIntersectionResponse.model_fields if k in row}
    return SiteNatureIntersectionResponse(**data)


def locate_site(
    *, company_id: int, site_id: int, computed_by: int | None = None,
) -> list[SiteNatureIntersectionResponse]:
    """Calcule/rafraîchit les intersections d'UN site contre le référentiel
    `nature_features` accessible au tenant. Chaque candidat bbox produit une
    NOUVELLE ligne (recalcul = nouvelles lignes, jamais une réécriture —
    précédent `site_water_screenings`) ; `review_status` redémarre à `pending`
    à chaque calcul : une revue humaine antérieure ne couvre pas un nouveau
    fait géométrique, même identique en apparence."""
    try:
        position = geocode_service.get_accepted_position(company_id=company_id, site_id=site_id)
    except geocode_service.GeocodeError as exc:
        raise NatureLocateError(str(exc)) from exc

    candidates = features_service.candidate_features_for_point(
        company_id=company_id, latitude=position["latitude"], longitude=position["longitude"],
    )
    site = {
        "site_id": site_id,
        "latitude": position["latitude"],
        "longitude": position["longitude"],
        "precision": position["precision"],
    }

    results: list[SiteNatureIntersectionResponse] = []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            for feature in candidates:
                trace = compute_intersection(site=site, feature=feature)
                cur.execute(
                    """
                    INSERT INTO site_nature_intersections
                        (company_id, site_id, feature_id, method_code, bbox_candidate,
                         matched, input_snapshot, input_fingerprint, computed_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        company_id, site_id, feature["id"], trace["method_code"],
                        trace["bbox_candidate"], trace["matched"],
                        json.dumps(trace["snapshot"]), trace["fingerprint"],
                        computed_by,
                    ),
                )
                row = dict(cur.fetchone())
                row["feature_code"] = feature.get("code")
                row["feature_kind"] = feature.get("feature_kind")
                results.append(_intersection_response(row))
    return results


def list_intersections(
    *, company_id: int, site_id: int | None = None, matched: bool | None = None,
    limit: int = 50, offset: int = 0,
) -> SiteNatureIntersectionListResponse:
    clauses = [f"i.{_SCOPE}"]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("i.site_id = %s")
        params.append(site_id)
    if matched is not None:
        clauses.append("i.matched = %s")
        params.append(matched)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM site_nature_intersections i {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"""
                SELECT i.*, f.code AS feature_code, f.feature_kind AS feature_kind
                FROM site_nature_intersections i
                JOIN nature_features f ON f.id = i.feature_id
                {where}
                ORDER BY i.computed_at DESC, i.id DESC LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return SiteNatureIntersectionListResponse(
        items=[_intersection_response(dict(r)) for r in rows],
        total=total, limit=limit, offset=offset,
    )


def review_intersection(
    *, company_id: int, intersection_id: int, accept: bool, reviewed_by: int | None = None,
) -> SiteNatureIntersectionResponse:
    """Gate `pending -> accepted/flagged`. Un seul geste par ligne (recalculer
    produit une nouvelle ligne à revoir, jamais une re-revue de l'ancienne)."""
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM site_nature_intersections WHERE id = %s AND {_SCOPE}",
                (intersection_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureLocateError(f"Intersection '{intersection_id}' introuvable.")
            if row["review_status"] != "pending":
                raise NatureLocateError(
                    f"Intersection '{intersection_id}' déjà revue ({row['review_status']}) — "
                    "seule une ligne 'pending' est revue."
                )
            cur.execute(
                f"""
                UPDATE site_nature_intersections
                SET review_status = %s, reviewed_by = %s, reviewed_at = now(), updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING *
                """,
                (target, reviewed_by, intersection_id, company_id),
            )
            updated = dict(cur.fetchone())
            cur.execute("SELECT code, feature_kind FROM nature_features WHERE id = %s", (updated["feature_id"],))
            feature = cur.fetchone()
    updated["feature_code"] = feature["code"] if feature else None
    updated["feature_kind"] = feature["feature_kind"] if feature else None
    return _intersection_response(updated)
