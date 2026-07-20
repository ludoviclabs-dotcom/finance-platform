"""
risk_areas_service.py — référentiel de zones de stress hydrique (PR-08A).

Portée MIXTE tenant/globale (motif 034) : lecture = tenant OU global, écriture
tenant via l'API n'existe PAS — l'ingestion passe EXCLUSIVEMENT par le CLI
d'administration (`scripts/import_water_risk_areas.py`) ou un workflow GitHub
Actions protégé, JAMAIS par une requête utilisateur (plan PR-08 §7 :
« aucun endpoint d'écriture exposé aux utilisateurs pour ce référentiel »).

Sourçage non négociable : `source_release_id NOT NULL` en base — le service le
vérifie AVANT l'INSERT pour donner une raison lisible plutôt qu'une erreur de
contrainte. La licence de la source est évaluée par `license_policy.evaluate` :
`allow_store` requis pour ingérer ; `allow_display`/`allow_derived_use` sont
surfacés à la lecture (jamais dénormalisés — une licence peut changer) et une
catégorie de stress non affichable est RETIRÉE côté serveur
(`value_withheld=True`, précédent market_observations PR-07).

La géométrie est validée par le moteur PUR `services/calculations/geo.py`
(Polygon/MultiPolygon, trous inclus) et la bbox est DÉRIVÉE de la géométrie —
jamais saisie à la main, donc jamais incohérente avec elle.
"""

from __future__ import annotations

import json
from typing import Any

from db.database import get_admin_db, get_db
from models.water import WaterRiskAreaListResponse, WaterRiskAreaResponse
from services.calculations.geo import GeometryError, compute_bbox
from services.intelligence import license_policy

_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"

# Colonnes de licence lues sur source_registry (même liste que stage_service).
_LICENSE_COLUMNS = (
    "active", "automated_access_allowed", "storage_allowed", "commercial_use_allowed",
    "redistribution_allowed", "derived_use_allowed", "display_allowed", "attribution_text",
)


class WaterRiskAreaError(Exception):
    """Erreur métier du référentiel de zones de stress hydrique."""


def _license_for_release(cur, *, company_id: int | None, release_id: int) -> tuple[Any, dict[str, Any] | None]:
    """Décision de licence de la source portant une release, ou (None, None)."""
    cur.execute(
        f"""
        SELECT s.code AS source_code, r.release_key,
               r.retrieved_at AS release_retrieved_at,
               {", ".join("s." + c for c in _LICENSE_COLUMNS)}
        FROM source_releases r
        JOIN source_registry s ON s.id = r.source_id
        WHERE r.id = %s
          AND (r.company_id = %s OR r.company_id IS NULL)
          AND (s.company_id = %s OR s.company_id IS NULL)
        """,
        (release_id, company_id, company_id),
    )
    source = cur.fetchone()
    if source is None:
        return None, None
    return license_policy.evaluate(dict(source)), dict(source)


def _area_response(
    row: dict[str, Any], decision: Any, source: dict[str, Any] | None,
) -> WaterRiskAreaResponse:
    """Applique le droit d'affichage AVANT de construire la réponse : une
    catégorie de stress non affichable ne quitte jamais le serveur."""
    data = {k: row.get(k) for k in WaterRiskAreaResponse.model_fields if k in row}
    for k in ("bbox_min_lat", "bbox_max_lat", "bbox_min_lon", "bbox_max_lon"):
        data[k] = float(row[k])
    data["source_code"] = (source or {}).get("source_code")
    data["display_allowed"] = bool(decision.allow_display) if decision else False
    data["derived_use_allowed"] = bool(decision.allow_derived_use) if decision else False
    data["license_reasons"] = list(decision.reasons) if decision else ["licence source introuvable"]
    data["attribution_text"] = (source or {}).get("attribution_text")
    data["value_withheld"] = False
    if decision is None or not decision.allow_display:
        data["baseline_stress_category"] = None
        data["value_withheld"] = True
    return WaterRiskAreaResponse(**data)


# ---------------------------------------------------------------------------
# Ingestion (CLI/admin uniquement — jamais un endpoint utilisateur)
# ---------------------------------------------------------------------------

def register_area(
    *,
    company_id: int | None,
    code: str,
    label: str,
    boundary_geojson: dict[str, Any],
    baseline_stress_category: str,
    source_release_id: int | None,
    area_kind: str = "basin",
    scenario_code: str = "baseline",
    horizon_year: int | None = None,
    evidence_artifact_id: int | None = None,
    data_status: str = "estimated",
    created_by: int | None = None,
) -> WaterRiskAreaResponse:
    """Enregistre une zone SOURCÉE. `company_id=None` = ligne GLOBALE (écrite
    via `get_admin_db` + `app.rls_bypass`, l'idiome d'écriture globale 034) ;
    sinon ligne tenant via `get_db(company_id)`.

    Refus explicites (jamais un repli) : release absente → refus ; licence sans
    `allow_store` → refus ; GeoJSON invalide → refus avec la raison géométrique.
    La bbox est calculée ici depuis la géométrie (pré-filtre cohérent par
    construction)."""
    if source_release_id is None:
        raise WaterRiskAreaError(
            "source_release_id requis : aucune zone de stress hydrique sans release "
            "source enregistrée (Evidence Kernel) — refus explicite, pas de zone anonyme."
        )
    if not code or not code.strip():
        raise WaterRiskAreaError("Code de zone requis.")
    try:
        min_lat, max_lat, min_lon, max_lon = compute_bbox(boundary_geojson)
    except GeometryError as exc:
        raise WaterRiskAreaError(f"Géométrie refusée : {exc}") from exc

    def _do_insert(cur) -> dict[str, Any]:
        decision, _source = _license_for_release(
            cur, company_id=company_id, release_id=source_release_id
        )
        if decision is None:
            raise WaterRiskAreaError(
                f"Release source '{source_release_id}' introuvable ou hors périmètre."
            )
        if not decision.allow_store:
            raise WaterRiskAreaError(
                "La licence de la source n'autorise pas la conservation de ce dataset "
                "(allow_store=false) : " + " ; ".join(decision.reasons)
            )
        cur.execute(
            """
            INSERT INTO water_risk_areas
                (company_id, code, label, area_kind, scenario_code, horizon_year,
                 baseline_stress_category, bbox_min_lat, bbox_max_lat, bbox_min_lon,
                 bbox_max_lon, boundary_geojson, source_release_id,
                 evidence_artifact_id, data_status, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                company_id, code.strip(), label, area_kind, scenario_code, horizon_year,
                baseline_stress_category, min_lat, max_lat, min_lon, max_lon,
                json.dumps(boundary_geojson), source_release_id,
                evidence_artifact_id, data_status, created_by,
            ),
        )
        row = dict(cur.fetchone())
        return {"row": row, "decision": decision, "source": _source}

    if company_id is None:
        # Écriture GLOBALE : rls_bypass posé en SET LOCAL (portée transaction),
        # connexion admin — même geste que le semis des étapes 034.
        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                out = _do_insert(cur)
    else:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                out = _do_insert(cur)
    return _area_response(out["row"], out["decision"], out["source"])


# ---------------------------------------------------------------------------
# Lecture (tenant + global) — licence surfacée
# ---------------------------------------------------------------------------

def list_areas(
    *, company_id: int, scenario_code: str | None = None, area_kind: str | None = None,
    limit: int = 50, offset: int = 0,
) -> WaterRiskAreaListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if scenario_code is not None:
        clauses.append("scenario_code = %s")
        params.append(scenario_code)
    if area_kind is not None:
        clauses.append("area_kind = %s")
        params.append(area_kind)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM water_risk_areas {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM water_risk_areas {where} ORDER BY code, id LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
            items: list[WaterRiskAreaResponse] = []
            for r in rows:
                decision, source = _license_for_release(
                    cur, company_id=company_id, release_id=r["source_release_id"]
                )
                items.append(_area_response(dict(r), decision, source))
    return WaterRiskAreaListResponse(items=items, total=total, limit=limit, offset=offset)


def candidate_areas_for_point(
    *, company_id: int, latitude: float, longitude: float, scenario_code: str = "baseline",
) -> list[dict[str, Any]]:
    """Zones candidates au screening d'un point : pré-filtre bbox EN SQL
    (`geojson_bbox_prefilter_v1` — jamais un résultat, toujours un candidat à
    confirmer par le point-dans-polygone Python). Retourne les lignes brutes
    AVEC leur décision de licence — le moteur de screening (tranche B) tranche
    les refus, jamais ce helper."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT * FROM water_risk_areas
                WHERE {_SCOPE_READ}
                  AND scenario_code = %s
                  AND bbox_min_lat <= %s AND bbox_max_lat >= %s
                  AND bbox_min_lon <= %s AND bbox_max_lon >= %s
                ORDER BY code, id
                """,
                (company_id, scenario_code, latitude, latitude, longitude, longitude),
            )
            rows = cur.fetchall()
            out: list[dict[str, Any]] = []
            for r in rows:
                decision, source = _license_for_release(
                    cur, company_id=company_id, release_id=r["source_release_id"]
                )
                area = dict(r)
                area["license_decision"] = decision
                area["source_code"] = (source or {}).get("source_code")
                area["attribution_text"] = (source or {}).get("attribution_text")
                area["release_retrieved_at"] = (source or {}).get("release_retrieved_at")
                out.append(area)
    return out
