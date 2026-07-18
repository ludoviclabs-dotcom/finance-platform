"""
_energy_fixtures.py — état PostgreSQL partagé pour les tests Énergie & Scope 2
(PR-06A). Pas un fichier de test (pas de préfixe `test_`, jamais collecté) —
même convention que `_migration_fixtures.py` / `_intelligence_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à 031 inclus (donc
001-028 + 031 ; 029/030 appartiennent à des branches sœurs non mergées). Crée
deux companies dédiées (`en-test-a/b`) + un site par tenant, avec cleanup en
tear-down. Idempotent (`CREATE TABLE IF NOT EXISTS`) : sûr à rappeler même si un
autre module de test a déjà construit le schéma sur le même conteneur jetable.
"""

from __future__ import annotations

import pytest

from db.database import get_db

from ._migration_fixtures import apply_ddl_inline, apply_upto

# Ordre enfants → parents (respecté par sécurité ; le teardown pose de toute
# façon session_replication_role=replica qui désactive les triggers de FK).
ENERGY_TABLES = (
    "instrument_allocations",
    "energy_factor_metadata",
    "energy_activities",
    "contractual_instruments",
    "energy_meters",
)


def build_energy_db(conn) -> None:
    """DDL historique + 001-031 (inclut le noyau Evidence Kernel 028 et la
    fondation énergie 031)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "031")


@pytest.fixture(scope="module")
def energy_schema():
    """Applique le schéma jusqu'à 031 une fois par module de test."""
    with get_db() as conn:
        build_energy_db(conn)


@pytest.fixture(scope="module")
def energy_companies(energy_schema):
    """2 companies dédiées énergie + 1 site chacune + cleanup en tear-down.

    Renvoie un dict `{a, b, site_a, site_b}`. Slugs `en-*` pour ne jamais
    collisionner avec `ek-*` (Evidence Kernel) ou `rls-*` (test_rls_isolation)
    dans la même base CI.
    """
    ids: list[int] = []
    sites: dict[str, int] = {}
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("en-test-a", "en-test-b"):
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
    cid_a, cid_b = ids
    for key, cid in (("site_a", cid_a), ("site_b", cid_b)):
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sites (company_id, name)
                    VALUES (%s, %s)
                    ON CONFLICT (company_id, name) DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (cid, f"Site {key}"),
                )
                sites[key] = cur.fetchone()["id"]

    yield {"a": cid_a, "b": cid_b, "site_a": sites["site_a"], "site_b": sites["site_b"]}

    with get_db() as conn:
        with conn.cursor() as cur:
            # session_replication_role=replica : désactive triggers utilisateur
            # (dont l'anti-double-allocation) ET triggers de FK le temps du
            # cleanup (rôle superuser requis, disponible en CI). Connexion jetée
            # juste après — aucune fuite de ce réglage.
            cur.execute("SET session_replication_role = replica")
            for table in ENERGY_TABLES:
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM sites WHERE company_id = ANY(%s)", (ids,))
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))
