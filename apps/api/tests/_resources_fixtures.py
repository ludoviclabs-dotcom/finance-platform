"""
_resources_fixtures.py — état PostgreSQL partagé pour les tests Module 2
(fondation catalogue, PR-M2A). Pas un fichier de test (pas de préfixe `test_`,
jamais collecté par pytest) — même convention que `_crma_fixtures.py`.

Applique le DDL historique + les `.sql` RÉELS jusqu'à 042 inclus (donc le noyau
Evidence Kernel 028 dont dépendent les `source_release_id`, et la fondation
catalogue 042). Idempotent : sûr à rappeler sur le même conteneur `postgres:16`.

**Toutes les données semées ici sont FICTIVES.** Aucune classification
réglementaire réelle, aucune source externe : la prohibition « aucune donnée
externe réelle ingérée » vaut aussi pour les fixtures.
"""

from __future__ import annotations

import pytest

from db.database import get_db

from ._crma_fixtures import (
    insert_source_with_license,  # noqa: F401 (réexporté aux tests)
)
from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto

# Tables PR-M2A, enfants avant parents (ordre de nettoyage).
RESOURCES_TABLES = (
    "resource_sector_uses",
    "resource_regulatory_statuses",
    "resource_aliases",
    "resource_catalog",
)

# Tables PR-M2B (043), enfants avant parents.
RESOURCES_M2B_TABLES = (
    "resource_assessment_dimensions",
    "resource_assessment_runs",
    "company_resource_exposure_links",
    "resource_supply_observations",
)

# Ressource GLOBALE (company_id NULL) pré-semée pour tester la lecture globale +
# le refus d'écriture globale par un tenant. Slug distinctif pour un nettoyage sûr.
GLOBAL_SLUG = "restest-global-helium"


def build_resources_db(conn) -> None:
    """DDL historique + 001-043 (Evidence Kernel 028, CRMA 034 pour le pont
    substituts, fondation catalogue 042, expositions & assessments 043)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "043")


@pytest.fixture(scope="module")
def resources_schema():
    """Applique le schéma jusqu'à 043 une fois par module de test."""
    with get_db() as conn:
        build_resources_db(conn)


def seed_global_supply(resource_slug: str, rows: list[dict]) -> None:
    """Sème des observations de supply GLOBALES (company_id NULL) via
    `app.rls_bypass` — pour tester la lecture globale des observations. `rows` :
    dicts {stage_code, country_code, share_pct, reference_year, metric_code?}."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                "SELECT id FROM resource_catalog WHERE slug = %s AND company_id IS NULL",
                (resource_slug,),
            )
            found = cur.fetchone()
            if found is None:
                return
            rid = found["id"]
            for r in rows:
                cur.execute(
                    """
                    INSERT INTO resource_supply_observations
                        (company_id, resource_id, stage_code, country_code, metric_code,
                         share_pct, reference_year, data_status)
                    VALUES (NULL, %s, %s, %s, %s, %s, %s, 'estimated')
                    ON CONFLICT DO NOTHING
                    """,
                    (rid, r["stage_code"], r["country_code"], r.get("metric_code", "production"),
                     r["share_pct"], r["reference_year"]),
                )


def _seed_global_resource(slug: str) -> None:
    """Sème une ressource canonique GLOBALE via l'idiome d'écriture globale
    (`app.rls_bypass='on'`) — la seule voie autorisée pour une ligne
    `company_id IS NULL`, jamais un tenant."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                """
                INSERT INTO resource_catalog
                    (company_id, slug, name, name_fr, primary_family, data_status)
                VALUES (NULL, %s, 'Global Helium (test)', 'Hélium (test global)',
                        'industrial_gas', 'estimated')
                ON CONFLICT DO NOTHING
                """,
                (slug,),
            )


@pytest.fixture(scope="module")
def two_companies_resources(resources_schema):
    """2 companies de test dédiées PR-M2A + 1 ressource globale + cleanup.

    Slugs `res-*` pour ne jamais collisionner avec `crma-*`/`ek-*`/`proc-*` sur
    la même base CI."""
    _seed_global_resource(GLOBAL_SLUG)
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("res-test-a", "res-test-b"):
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
            # `session_replication_role = replica` désactive triggers utilisateur
            # ET cascades FK le temps du nettoyage (CI superuser). L'ordre
            # enfants→parents est donc explicite ci-dessous.
            cur.execute("SET session_replication_role = replica")
            for table in (*RESOURCES_M2B_TABLES, *RESOURCES_TABLES, *EK_TABLES):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            # Observations de supply GLOBALES de test (rattachées à la ressource globale).
            cur.execute(
                "DELETE FROM resource_supply_observations WHERE resource_id IN "
                "(SELECT id FROM resource_catalog WHERE slug = %s AND company_id IS NULL)",
                (GLOBAL_SLUG,),
            )
            # Ligne(s) globale(s) de test : nettoyées par slug (enfants d'abord).
            cur.execute(
                "DELETE FROM resource_aliases WHERE resource_id IN "
                "(SELECT id FROM resource_catalog WHERE slug = %s AND company_id IS NULL)",
                (GLOBAL_SLUG,),
            )
            cur.execute(
                "DELETE FROM resource_regulatory_statuses WHERE resource_id IN "
                "(SELECT id FROM resource_catalog WHERE slug = %s AND company_id IS NULL)",
                (GLOBAL_SLUG,),
            )
            cur.execute(
                "DELETE FROM resource_sector_uses WHERE resource_id IN "
                "(SELECT id FROM resource_catalog WHERE slug = %s AND company_id IS NULL)",
                (GLOBAL_SLUG,),
            )
            cur.execute(
                "DELETE FROM resource_catalog WHERE slug = %s AND company_id IS NULL",
                (GLOBAL_SLUG,),
            )
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))
