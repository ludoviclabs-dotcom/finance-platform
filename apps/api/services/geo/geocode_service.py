"""
geocode_service.py — candidats de géocodage et gate de revue humaine (PR-08A).

Règle non négociable (contrats Wave 4 §2) : un géocodeur — ou une saisie
manuelle — ne fait JAMAIS autorité seul. Toute coordonnée entre en
`site_geocode_candidates` avec `status='proposed'` ; elle ne devient utilisable
pour une analyse géospatiale qu'après acceptation explicite par un analyste
(`status='accepted'`, promotion vers `sites.latitude/longitude`). La saisie
manuelle passe par le MÊME gate (`provider='manual'`,
`method_code='manual_coordinates_v1'`) — aucun raccourci.

AUCUN appel réseau, jamais : `provider`/`provider_ref` sont des MÉTADONNÉES de
provenance (audit), pas des déclencheurs. Les candidats viennent d'une saisie
manuelle ou d'une fixture.

Défense en profondeur applicative (contrats §7) : le PostgreSQL de CI se
connecte en superuser et BYPASSE la RLS (FORCE compris) — chaque requête porte
son prédicat `company_id = %s` explicite, sans quoi aucun test d'isolation ne
prouve quoi que ce soit.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.geo import (
    GeocodeCandidateCreate,
    GeocodeCandidateListResponse,
    GeocodeCandidateResponse,
    SiteGeoListResponse,
    SiteGeoResponse,
)
from services.calculations.geo import (
    METHOD_MANUAL_COORDINATES,
    GeometryError,
    validate_lat_lon,
)

# Portée tenant stricte (aucune ligne globale sur ces tables).
_SCOPE = "company_id = %s"

_CANDIDATE_COLS = (
    'id, company_id, site_id, provider, provider_ref, latitude, longitude, '
    '"precision", method_code, source_release_id, evidence_artifact_id, status, '
    'review_note, reviewed_by, reviewed_at, created_by, created_at'
)

_SITE_GEO_COLS = (
    "id, company_id, name, location, latitude, longitude, geocode_precision, "
    "geocode_provider, geocode_provider_ref, geocode_review_status, "
    "geocode_reviewed_by, geocode_reviewed_at"
)


class GeocodeError(Exception):
    """Erreur métier du gate de géocodage (introuvable, transition invalide…)."""


def _candidate_response(row: dict[str, Any]) -> GeocodeCandidateResponse:
    return GeocodeCandidateResponse(**row)


def _site_geo_response(row: dict[str, Any]) -> SiteGeoResponse:
    return SiteGeoResponse(
        **row,
        position_usable=(
            row["geocode_review_status"] == "accepted"
            and row["latitude"] is not None
            and row["longitude"] is not None
        ),
    )


def _assert_site_in_scope(cur, company_id: int, site_id: int) -> None:
    """404 sans fuite d'existence : un site d'un autre tenant est « introuvable »."""
    cur.execute(f"SELECT 1 FROM sites WHERE id = %s AND {_SCOPE}", (site_id, company_id))
    if cur.fetchone() is None:
        raise GeocodeError(f"Site '{site_id}' introuvable.")


# ---------------------------------------------------------------------------
# Proposition (même gate pour saisie manuelle et fournisseur-métadonnée)
# ---------------------------------------------------------------------------

def propose_candidate(
    *, company_id: int, site_id: int, payload: GeocodeCandidateCreate,
    created_by: int | None = None,
) -> GeocodeCandidateResponse:
    try:
        validate_lat_lon(payload.latitude, payload.longitude)
    except GeometryError as exc:
        raise GeocodeError(f"Coordonnées refusées : {exc}") from exc

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_site_in_scope(cur, company_id, site_id)
            if payload.source_release_id is not None:
                cur.execute(
                    "SELECT 1 FROM source_releases WHERE id = %s "
                    "AND (company_id = %s OR company_id IS NULL)",
                    (payload.source_release_id, company_id),
                )
                if cur.fetchone() is None:
                    raise GeocodeError(
                        f"Release source '{payload.source_release_id}' introuvable."
                    )
            cur.execute(
                f"""
                INSERT INTO site_geocode_candidates
                    (company_id, site_id, provider, provider_ref, latitude, longitude,
                     "precision", method_code, source_release_id, evidence_artifact_id,
                     status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'proposed', %s)
                RETURNING {_CANDIDATE_COLS}
                """,
                (
                    company_id, site_id, payload.provider, payload.provider_ref,
                    payload.latitude, payload.longitude, payload.precision,
                    METHOD_MANUAL_COORDINATES, payload.source_release_id,
                    payload.evidence_artifact_id, created_by,
                ),
            )
            return _candidate_response(cur.fetchone())


def list_candidates(
    *, company_id: int, site_id: int, status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> GeocodeCandidateListResponse:
    clauses = [_SCOPE, "site_id = %s"]
    params: list[Any] = [company_id, site_id]
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_site_in_scope(cur, company_id, site_id)
            cur.execute(f"SELECT COUNT(*) AS c FROM site_geocode_candidates {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT {_CANDIDATE_COLS} FROM site_geocode_candidates {where} "
                "ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return GeocodeCandidateListResponse(
        items=[_candidate_response(r) for r in rows], total=total, limit=limit, offset=offset,
    )


# ---------------------------------------------------------------------------
# Revue humaine — acceptation = promotion vers sites.latitude/longitude
# ---------------------------------------------------------------------------

def review_candidate(
    *, company_id: int, site_id: int, candidate_id: int, accept: bool,
    reviewed_by: int, note: str | None = None,
) -> GeocodeCandidateResponse:
    """Accepte ou rejette un candidat `proposed`. L'acceptation promeut la
    position vers `sites` (latitude/longitude/précision/provenance) et pose
    `geocode_review_status='accepted'` avec le réviseur identifié. Le rejet ne
    touche jamais à `sites`. Un candidat déjà revu n'est pas re-révisable
    (append-only — proposer un NOUVEAU candidat pour corriger)."""
    if reviewed_by is None:
        raise GeocodeError("Identité du réviseur requise.")
    target = "accepted" if accept else "rejected"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_site_in_scope(cur, company_id, site_id)
            cur.execute(
                f"SELECT {_CANDIDATE_COLS} FROM site_geocode_candidates "
                f"WHERE id = %s AND site_id = %s AND {_SCOPE}",
                (candidate_id, site_id, company_id),
            )
            candidate = cur.fetchone()
            if candidate is None:
                raise GeocodeError(f"Candidat de géocodage '{candidate_id}' introuvable.")
            if candidate["status"] != "proposed":
                raise GeocodeError(
                    f"Candidat '{candidate_id}' déjà revu ({candidate['status']}) — "
                    "proposer un nouveau candidat pour corriger, jamais réécrire."
                )
            cur.execute(
                f"""
                UPDATE site_geocode_candidates
                SET status = %s, review_note = %s, reviewed_by = %s, reviewed_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING {_CANDIDATE_COLS}
                """,
                (target, note, reviewed_by, candidate_id, company_id),
            )
            updated = cur.fetchone()
            if accept:
                cur.execute(
                    f"""
                    UPDATE sites
                    SET latitude = %s, longitude = %s, geocode_precision = %s,
                        geocode_provider = %s, geocode_provider_ref = %s,
                        geocode_review_status = 'accepted',
                        geocode_reviewed_by = %s, geocode_reviewed_at = now(),
                        updated_at = now()
                    WHERE id = %s AND {_SCOPE}
                    """,
                    (
                        updated["latitude"], updated["longitude"], updated["precision"],
                        updated["provider"], updated["provider_ref"], reviewed_by,
                        site_id, company_id,
                    ),
                )
    return _candidate_response(updated)


def flag_site_position(
    *, company_id: int, site_id: int, reviewed_by: int, note: str | None = None,
) -> SiteGeoResponse:
    """Marque la position COURANTE d'un site `flagged` (doute) : elle reste
    visible (traçabilité) mais redevient inutilisable pour tout calcul — le
    gate `accepted` est le seul état utilisable."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_site_in_scope(cur, company_id, site_id)
            cur.execute(
                f"""
                UPDATE sites
                SET geocode_review_status = 'flagged',
                    geocode_reviewed_by = %s, geocode_reviewed_at = now(), updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING {_SITE_GEO_COLS}
                """,
                (reviewed_by, site_id, company_id),
            )
            row = cur.fetchone()
    return _site_geo_response(row)


# ---------------------------------------------------------------------------
# Lectures — le gate s'applique AUSSI ici (position_usable)
# ---------------------------------------------------------------------------

def list_sites_geo(
    *, company_id: int, limit: int = 50, offset: int = 0,
) -> SiteGeoListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM sites WHERE {_SCOPE}", (company_id,))
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT {_SITE_GEO_COLS} FROM sites WHERE {_SCOPE} "
                "ORDER BY name LIMIT %s OFFSET %s",
                (company_id, limit, offset),
            )
            rows = cur.fetchall()
    return SiteGeoListResponse(
        items=[_site_geo_response(r) for r in rows], total=total, limit=limit, offset=offset,
    )


def get_accepted_position(*, company_id: int, site_id: int) -> dict[str, Any]:
    """Position ACCEPTÉE d'un site — la SEULE lecture que le screening (tranche
    B) a le droit d'utiliser. Refus EXPLICITE (jamais silencieux, jamais une
    position par défaut) si le site n'est pas géocodé-accepté."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SITE_GEO_COLS} FROM sites WHERE id = %s AND {_SCOPE}",
                (site_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise GeocodeError(f"Site '{site_id}' introuvable.")
    if row["geocode_review_status"] != "accepted" or row["latitude"] is None or row["longitude"] is None:
        raise GeocodeError(
            f"Position du site '{site_id}' non utilisable : statut de revue "
            f"'{row['geocode_review_status']}' — une analyse géospatiale exige une "
            "position ACCEPTÉE par un analyste (aucun screening sur une position incertaine)."
        )
    return {
        "site_id": row["id"],
        "name": row["name"],
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "precision": row["geocode_precision"],
        "reviewed_by": row["geocode_reviewed_by"],
        "reviewed_at": row["geocode_reviewed_at"],
    }
