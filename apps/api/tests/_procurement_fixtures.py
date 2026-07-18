"""
_procurement_fixtures.py — état PostgreSQL partagé pour les tests d'exposition
achats/fournisseurs (PR-05A). Pas un fichier de test (pas de préfixe `test_`,
jamais collecté par pytest) — même convention que `_intelligence_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à 030 inclus
(001-030, incluant la vue de fraîcheur 029 de PR-04 désormais mergée sur
master). Idempotent (`CREATE TABLE IF NOT EXISTS` partout) :
sûr à rappeler même si un autre module de test a déjà construit le schéma sur le
même conteneur `postgres:16` jetable.
"""

from __future__ import annotations

import pytest

from db.database import get_db

from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto

# Tables PR-05A, enfants avant parents (ordre indifférent sous
# session_replication_role=replica au teardown, mais explicite par sûreté).
PROC_TABLES = (
    "product_carbon_footprints",
    "supplier_metric_declarations",
    "material_mappings",
    "bom_items",
    "bom_versions",
    "purchase_lines",
    "purchase_imports",
    "supplier_products",
    "supplier_sites",
)


def build_procurement_db(conn) -> None:
    """DDL historique + 001-030 (inclut Evidence Kernel 028 et exposition achats 030)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "030")


@pytest.fixture(scope="module")
def procurement_schema():
    """Applique le schéma jusqu'à 030 une fois par module de test."""
    with get_db() as conn:
        build_procurement_db(conn)


@pytest.fixture(scope="module")
def two_companies_proc(procurement_schema):
    """2 companies de test dédiées PR-05A + cleanup en tear-down.

    Slugs `proc-*` pour ne jamais collisionner avec `ek-*` (Evidence Kernel) ni
    `rls-*` (test_rls_isolation.py) sur la même base CI.
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("proc-test-a", "proc-test-b"):
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
            # session_replication_role=replica désactive les triggers utilisateur
            # (immutabilité observations) ET les triggers de FK le temps du
            # nettoyage (rôle CI `postgres` = superuser). On purge les tables
            # PR-05A + Evidence Kernel (les déclarations/PCF sourcées créent des
            # observations) + suppliers/products historiques utilisés par les tests.
            cur.execute("SET session_replication_role = replica")
            for table in (*PROC_TABLES, *EK_TABLES, "suppliers", "products"):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


# ── Helpers de fabrique (fonctions normales, jamais des fixtures) ────────────

def insert_supplier(company_id: int, name: str = "Fournisseur Test") -> int:
    """Crée un fournisseur (table historique 008) pour le tenant."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO suppliers (company_id, name) VALUES (%s, %s) RETURNING id",
                (company_id, name),
            )
            return cur.fetchone()["id"]


def insert_product(company_id: int, name: str = "Produit interne") -> int:
    """Crée un produit interne (table historique `products`, DPP) pour le tenant."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO products (company_id, name) VALUES (%s, %s) RETURNING id",
                (company_id, name),
            )
            return cur.fetchone()["id"]
