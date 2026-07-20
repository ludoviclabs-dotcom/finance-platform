"""
features_service.py — référentiel `nature_features` (PR-09 tranche A).

Portée MIXTE tenant/globale (motif `water_risk_areas`, PR-08) : lecture =
tenant OU global, écriture tenant via l'API n'existe PAS — l'ingestion passe
EXCLUSIVEMENT par le CLI d'administration (`scripts/import_nature_features.py`)
ou un workflow protégé, JAMAIS par une requête utilisateur (même discipline
que `risk_areas_service.register_area`).

Sourçage non négociable : `source_release_id NOT NULL` en base — le service le
vérifie AVANT l'INSERT. La licence de la source est évaluée par
`license_policy.evaluate` à l'INGESTION uniquement (`allow_store` requis) —
contrairement à `water_risk_areas`, la lecture ne surface pas de champs de
licence : le mécanisme de masquage propre à ce domaine est `sensitivity`
(§6 du plan PR-09), pas la licence de la source.

MASQUAGE (règle non négociable, testée) : une ligne `confidential`/`restricted`
ne renvoie JAMAIS sa géométrie précise (`boundary_geojson`, bbox) dans la liste
standard (`list_features`) — quel que soit l'appelant. La géométrie précise
n'est disponible que via `get_feature_geometry`, réservé au routeur à un rôle
élevé (`require_admin`). Aucune génération de région approximative (pas de
référentiel géographique de repli dans ce dépôt) : la ligne masquée expose
`code`/`label`/`feature_kind`/`sensitivity` sans aucune coordonnée — jamais une
coordonnée approchée qui laisserait deviner la position réelle.
"""

from __future__ import annotations

import json
from typing import Any

from db.database import get_admin_db, get_db
from models.nature import NatureFeatureListResponse, NatureFeatureResponse
from services.calculations.geo import GeometryError, compute_bbox
from services.intelligence import license_policy

_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"
_MASKED_SENSITIVITY = ("confidential", "restricted")


class NatureFeatureError(Exception):
    """Erreur métier du référentiel `nature_features`."""


def _feature_response(row: dict[str, Any], *, withhold: bool) -> NatureFeatureResponse:
    data = {k: row.get(k) for k in NatureFeatureResponse.model_fields if k in row}
    if withhold and row.get("sensitivity") in _MASKED_SENSITIVITY:
        data["boundary_geojson"] = None
        data["bbox_min_lat"] = None
        data["bbox_max_lat"] = None
        data["bbox_min_lon"] = None
        data["bbox_max_lon"] = None
        data["geometry_withheld"] = True
    else:
        data["bbox_min_lat"] = float(row["bbox_min_lat"])
        data["bbox_max_lat"] = float(row["bbox_max_lat"])
        data["bbox_min_lon"] = float(row["bbox_min_lon"])
        data["bbox_max_lon"] = float(row["bbox_max_lon"])
        data["geometry_withheld"] = False
    return NatureFeatureResponse(**data)


# ---------------------------------------------------------------------------
# Ingestion (CLI/admin uniquement — jamais un endpoint utilisateur)
# ---------------------------------------------------------------------------

def register_feature(
    *,
    company_id: int | None,
    code: str,
    label: str,
    boundary_geojson: dict[str, Any],
    feature_kind: str = "ecosystem",
    sensitivity: str = "public",
    source_release_id: int | None,
    evidence_artifact_id: int | None = None,
    data_status: str = "estimated",
    created_by: int | None = None,
) -> NatureFeatureResponse:
    """Enregistre un élément naturel SOURCÉ. `company_id=None` = ligne GLOBALE
    (écrite via `get_admin_db` + `app.rls_bypass`, l'idiome d'écriture globale
    034/036) ; sinon ligne tenant via `get_db(company_id)`.

    Refus explicites (jamais un repli) : release absente -> refus ; licence
    sans `allow_store` -> refus ; GeoJSON invalide -> refus avec la raison
    géométrique. La bbox est calculée ici depuis la géométrie (pré-filtre
    cohérent par construction, réutilise `geo.compute_bbox` — jamais recalculée
    différemment ailleurs)."""
    if source_release_id is None:
        raise NatureFeatureError(
            "source_release_id requis : aucun élément naturel sans release source "
            "enregistrée (Evidence Kernel) — refus explicite, jamais une ligne anonyme."
        )
    if not code or not code.strip():
        raise NatureFeatureError("Code d'élément naturel requis.")
    try:
        min_lat, max_lat, min_lon, max_lon = compute_bbox(boundary_geojson)
    except GeometryError as exc:
        raise NatureFeatureError(f"Géométrie refusée : {exc}") from exc

    def _do_insert(cur) -> dict[str, Any]:
        cur.execute(
            """
            SELECT s.code AS source_code, s.active, s.automated_access_allowed,
                   s.storage_allowed, s.display_allowed, s.derived_use_allowed,
                   s.commercial_use_allowed, s.redistribution_allowed, s.attribution_text
            FROM source_releases r
            JOIN source_registry s ON s.id = r.source_id
            WHERE r.id = %s AND (r.company_id = %s OR r.company_id IS NULL)
              AND (s.company_id = %s OR s.company_id IS NULL)
            """,
            (source_release_id, company_id, company_id),
        )
        source = cur.fetchone()
        if source is None:
            raise NatureFeatureError(
                f"Release source '{source_release_id}' introuvable ou hors périmètre."
            )
        decision = license_policy.evaluate(dict(source))
        if not decision.allow_store:
            raise NatureFeatureError(
                "La licence de la source n'autorise pas la conservation de ce dataset "
                "(allow_store=false) : " + " ; ".join(decision.reasons)
            )
        cur.execute(
            """
            INSERT INTO nature_features
                (company_id, code, label, feature_kind, bbox_min_lat, bbox_max_lat,
                 bbox_min_lon, bbox_max_lon, boundary_geojson, sensitivity,
                 source_release_id, evidence_artifact_id, data_status, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                company_id, code.strip(), label, feature_kind, min_lat, max_lat,
                min_lon, max_lon, json.dumps(boundary_geojson), sensitivity,
                source_release_id, evidence_artifact_id, data_status, created_by,
            ),
        )
        return dict(cur.fetchone())

    if company_id is None:
        with get_admin_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                row = _do_insert(cur)
    else:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                row = _do_insert(cur)
    return _feature_response(row, withhold=False)


# ---------------------------------------------------------------------------
# Lecture (tenant + global) — masquage systématique des lignes sensibles
# ---------------------------------------------------------------------------

def list_features(
    *, company_id: int, feature_kind: str | None = None, limit: int = 50, offset: int = 0,
) -> NatureFeatureListResponse:
    """Liste standard : une ligne confidential/restricted perd sa géométrie
    précise ICI, avant de quitter le serveur — jamais un filtrage côté client."""
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if feature_kind is not None:
        clauses.append("feature_kind = %s")
        params.append(feature_kind)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM nature_features {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM nature_features {where} ORDER BY code, id LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    items = [_feature_response(dict(r), withhold=True) for r in rows]
    return NatureFeatureListResponse(items=items, total=total, limit=limit, offset=offset)


def get_feature_geometry(*, company_id: int, feature_id: int) -> NatureFeatureResponse:
    """Géométrie PRÉCISE d'un élément — jamais masquée ici. Réservé côté
    routeur à `require_admin` (§6 du plan : « endpoint dédié, authentifié, à
    rôle élevé », jamais une URL signée permanente)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM nature_features WHERE id = %s AND {_SCOPE_READ}",
                (feature_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise NatureFeatureError(f"Élément naturel '{feature_id}' introuvable.")
    return _feature_response(dict(row), withhold=False)


def get_feature_for_locate(*, company_id: int, feature_id: int) -> dict[str, Any]:
    """Lecture INTERNE (pas de masquage — usage exclusif par `locate_service`,
    qui a besoin de la géométrie exacte pour calculer une intersection réelle ;
    le masquage s'applique à ce qui QUITTE le serveur, pas au calcul interne)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM nature_features WHERE id = %s AND {_SCOPE_READ}",
                (feature_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise NatureFeatureError(f"Élément naturel '{feature_id}' introuvable.")
    return dict(row)


def candidate_features_for_point(
    *, company_id: int, latitude: float, longitude: float,
) -> list[dict[str, Any]]:
    """Features candidates au Locate d'un point : pré-filtre bbox EN SQL
    (`geojson_bbox_prefilter_v1` — jamais un résultat, toujours un candidat à
    confirmer par le point-dans-polygone Python, motif
    `risk_areas_service.candidate_areas_for_point`). Géométrie EXACTE incluse
    (usage interne du moteur, pas une réponse HTTP)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT * FROM nature_features
                WHERE {_SCOPE_READ}
                  AND bbox_min_lat <= %s AND bbox_max_lat >= %s
                  AND bbox_min_lon <= %s AND bbox_max_lon >= %s
                ORDER BY code, id
                """,
                (company_id, latitude, latitude, longitude, longitude),
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]
