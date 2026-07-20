"""
_water_fixtures.py — état PostgreSQL partagé pour les tests géospatial & eau
(PR-08). Pas un fichier de test (pas de préfixe `test_`, jamais collecté) —
même convention que `_migration_fixtures.py` / `_crma_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à la borne
`WATER_CEILING` (fondation 036 + screening 037 : sites géolocalisés, candidats
de géocodage, ledger eau, zones de stress, screenings/cibles/actions).
`apply_upto` exécute les fichiers réels en superuser CI : le statut
`requires_owner` de 036 est une contrainte de PRODUCTION (rôle propriétaire
Neon), pas une contrainte de CI — le ledger, lui, est testé séparément
(test_migration_runner/test_migration_ledger).

**Toutes les données semées ici sont FICTIVES.** Aucune vraie zone de stress
hydrique, aucune coordonnée réelle d'usine, aucune source externe : les
géométries sont des carrés/formes de test choisis pour EXERCER les règles
(frontières, trous, faux positifs bbox), pas pour décrire le monde.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from db.database import get_db

from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto

# Borne haute du schéma eau : 037 (fondation 036 + screening/cibles/actions).
WATER_CEILING = "037"

# Tables PR-08, enfants avant parents (le teardown pose de toute façon
# session_replication_role=replica — triggers FK ET triggers d'immutabilité/
# append-only désactivés le temps du nettoyage, pattern _crma_fixtures).
WATER_TABLES = (
    "water_actions",
    "water_targets",
    "site_water_screenings",
    "water_activities",
    "water_permits",
    "water_imports",
    "water_risk_areas",
    "site_geocode_candidates",
    "sites",
)


def build_water_db(conn) -> None:
    """DDL historique + 001-<borne> (Evidence Kernel 028 inclus)."""
    apply_ddl_inline(conn)
    apply_upto(conn, WATER_CEILING)


@pytest.fixture(scope="module")
def water_schema():
    """Applique le schéma jusqu'à la borne eau une fois par module de test."""
    with get_db() as conn:
        build_water_db(conn)


@pytest.fixture(scope="module")
def two_companies_water(water_schema):
    """2 companies de test dédiées PR-08 + cleanup en tear-down.

    Slugs `water-*` pour ne jamais collisionner avec `ek-*`, `proc-*`,
    `en-*`, `crma-*` ni `rls-*` sur la même base CI.
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("water-test-a", "water-test-b"):
                cur.execute(
                    """
                    INSERT INTO companies (name, slug, plan)
                    VALUES (%s, %s, 'starter')
                    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (slug.upper(), slug),
                )
                ids.append(cur.fetchone()["id"])
    yield tuple(ids)
    with get_db() as conn:
        with conn.cursor() as cur:
            # replica : désactive triggers FK, append-only (candidats) et
            # immutabilité (screenings) le temps du nettoyage (rôle superuser CI).
            cur.execute("SET session_replication_role = replica")
            for table in (*WATER_TABLES, *EK_TABLES):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            # Lignes GLOBALES semées par ces tests (préfixes water-*/global-*) :
            # jamais couvertes par le filtre company_id ci-dessus.
            cur.execute("DELETE FROM water_risk_areas WHERE company_id IS NULL AND code LIKE 'global-%'")
            cur.execute(
                "DELETE FROM source_releases WHERE company_id IS NULL AND source_id IN "
                "(SELECT id FROM source_registry WHERE company_id IS NULL AND code LIKE 'water-%')"
            )
            cur.execute("DELETE FROM source_registry WHERE company_id IS NULL AND code LIKE 'water-%'")
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


# ── Helpers de fabrique (fonctions normales, jamais des fixtures) ────────────

def insert_site(company_id: int, name: str = "Site Eau") -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sites (company_id, name, location) VALUES (%s, %s, %s) RETURNING id",
                (company_id, name, "1 rue Fictive, Testville"),
            )
            return cur.fetchone()["id"]


def insert_source_with_release(
    company_id: int | None,
    code: str,
    *,
    display_allowed: bool = True,
    derived_use_allowed: bool = True,
    storage_allowed: bool = True,
    active: bool = True,
) -> tuple[int, int]:
    """Crée une source + une release publiée (globale si company_id=None,
    écrite alors sous rls_bypass superuser CI). Renvoie (source_id, release_id).

    Les booléens de licence sont les ENTRÉES de `license_policy.evaluate` : les
    faire varier est la seule façon honnête de tester le gating.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if company_id is None:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                """
                INSERT INTO source_registry
                    (company_id, code, publisher, title, source_type, automated_access_allowed,
                     storage_allowed, display_allowed, derived_use_allowed, commercial_use_allowed,
                     redistribution_allowed, active, attribution_text)
                VALUES (%s, %s, 'Éditeur fictif', %s, 'manual', true, %s, %s, %s, true, true, %s, %s)
                RETURNING id
                """,
                (
                    company_id, code, f"Source fictive {code}", storage_allowed,
                    display_allowed, derived_use_allowed, active,
                    f"Source fictive {code} — données de test",
                ),
            )
            source_id = cur.fetchone()["id"]
            cur.execute(
                """
                INSERT INTO source_releases
                    (source_id, company_id, release_key, checksum_sha256, status, retrieved_at)
                VALUES (%s, %s, %s, %s, 'published', %s)
                RETURNING id
                """,
                (source_id, company_id, "2026", f"sha-{code}", datetime.now(timezone.utc)),
            )
            release_id = cur.fetchone()["id"]
    return source_id, release_id


def accept_site_position(
    company_id: int, site_id: int, *, latitude: float, longitude: float,
    precision: str = "exact", reviewed_by: int = 4242,
) -> None:
    """Raccourci de fixture : pose directement une position ACCEPTÉE sur un
    site (le chemin nominal — proposer puis accepter un candidat — est testé
    séparément ; ce helper évite de le rejouer dans chaque test de screening)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE sites
                SET latitude = %s, longitude = %s, geocode_precision = %s,
                    geocode_provider = 'manual', geocode_review_status = 'accepted',
                    geocode_reviewed_by = %s, geocode_reviewed_at = now()
                WHERE id = %s AND company_id = %s
                """,
                (latitude, longitude, precision, reviewed_by, site_id, company_id),
            )


def insert_risk_area(
    company_id: int | None,
    code: str,
    release_id: int,
    *,
    boundary: dict[str, Any] | None = None,
    stress: str = "high",
    scenario: str = "baseline",
) -> int:
    """Insère une zone directement (les règles de licence/refus du SERVICE sont
    testées via risk_areas_service ; ce helper sert aux montages de screening).
    La bbox est dérivée de la géométrie, comme dans le service."""
    from services.calculations.geo import compute_bbox

    if boundary is None:
        boundary = {
            "type": "Polygon",
            "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]],
        }
    min_lat, max_lat, min_lon, max_lon = compute_bbox(boundary)
    import json as _json

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if company_id is None:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                """
                INSERT INTO water_risk_areas
                    (company_id, code, label, area_kind, scenario_code,
                     baseline_stress_category, bbox_min_lat, bbox_max_lat,
                     bbox_min_lon, bbox_max_lon, boundary_geojson, source_release_id)
                VALUES (%s, %s, %s, 'basin', %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    company_id, code, f"Zone fictive {code}", scenario, stress,
                    min_lat, max_lat, min_lon, max_lon, _json.dumps(boundary), release_id,
                ),
            )
            return cur.fetchone()["id"]
