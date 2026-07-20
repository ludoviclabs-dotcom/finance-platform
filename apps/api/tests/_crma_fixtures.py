"""
_crma_fixtures.py — état PostgreSQL partagé pour les tests CRMA / exposition
matières (PR-07). Pas un fichier de test (pas de préfixe `test_`, jamais
collecté par pytest) — même convention que `_intelligence_fixtures.py` et
`_procurement_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à 034 inclus (donc
le noyau Evidence Kernel 028, l'exposition achats 030 dont dépendent les liens
BOM, et le pack CRMA 034). Idempotent : sûr à rappeler même si un autre module
de test a déjà construit le schéma sur le même conteneur `postgres:16` jetable.

**Toutes les données semées ici sont FICTIVES et explicitement `estimated`.**
Aucune part de marché réelle, aucun prix réel, aucune source externe : la
prohibition « aucune donnée externe réelle ingérée » vaut aussi pour les
fixtures. Les valeurs sont choisies pour EXERCER les règles (une étape
diversifiée face à une étape ultra-concentrée), pas pour décrire le monde.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from db.database import get_db

from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto

# Tables PR-07, enfants avant parents.
CRMA_TABLES = (
    "mitigation_actions",
    "crma_article24_assessments",
    "company_material_exposures",
    "trade_or_regulatory_events",
    "recycling_routes",
    "substitutes",
    "material_market_observations",
    "material_stage_observations",
    "material_group_members",
    "material_groups",
    "processing_stages",
)

# Tables PR-05A touchées par les tests de lien BOM.
PROC_TABLES_USED = ("material_mappings", "bom_items", "bom_versions", "supplier_products", "supplier_sites")

# Matière fictive du MVP : néodyme pour aimants permanents NdFeB.
MATERIAL_ND = "test-nd"
MATERIAL_SM = "test-sm"


def build_crma_db(conn) -> None:
    """DDL historique + 001-034 (Evidence Kernel 028, achats 030, CRMA 034)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "034")


@pytest.fixture(scope="module")
def crma_schema():
    """Applique le schéma jusqu'à 034 une fois par module de test."""
    with get_db() as conn:
        build_crma_db(conn)


@pytest.fixture(scope="module")
def two_companies_crma(crma_schema):
    """2 companies de test dédiées PR-07 + cleanup en tear-down.

    Slugs `crma-*` pour ne jamais collisionner avec `ek-*` (Evidence Kernel),
    `proc-*` (PR-05A) ni `rls-*` sur la même base CI.
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("crma-test-a", "crma-test-b"):
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
            # `session_replication_role = replica` désactive les triggers
            # utilisateur (immutabilité Evidence Kernel) ET les triggers de FK
            # le temps du nettoyage (rôle CI `postgres` = superuser). L'ordre
            # enfants→parents devient donc indifférent.
            cur.execute("SET session_replication_role = replica")
            for table in (*CRMA_TABLES, *PROC_TABLES_USED, *EK_TABLES, "suppliers", "products"):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


# ── Helpers de fabrique (fonctions normales, jamais des fixtures) ────────────

def insert_source_with_license(
    company_id: int,
    code: str,
    *,
    display_allowed: bool = True,
    derived_use_allowed: bool = True,
    storage_allowed: bool = True,
    active: bool = True,
) -> tuple[int, int]:
    """Crée une source + une release publiée. Renvoie (source_id, release_id).

    Les booléens de licence sont les ENTRÉES de `license_policy.evaluate` : les
    faire varier est la seule façon honnête de tester le gating (aucun mock de
    la politique de licence — c'est elle qu'on veut éprouver).
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
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


def insert_supplier(company_id: int, name: str = "Fournisseur CRMA") -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO suppliers (company_id, name) VALUES (%s, %s) RETURNING id",
                (company_id, name),
            )
            return cur.fetchone()["id"]


def insert_product(company_id: int, name: str = "Moteur à aimants permanents") -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO products (company_id, name) VALUES (%s, %s) RETURNING id",
                (company_id, name),
            )
            return cur.fetchone()["id"]


def insert_bom_item(company_id: int, product_id: int, version: str = "v1") -> tuple[int, int]:
    """Crée une BOM (PR-05A) + un composant. Renvoie (bom_version_id, bom_item_id)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO bom_versions (company_id, product_id, version, status)
                VALUES (%s, %s, %s, 'active') RETURNING id
                """,
                (company_id, product_id, version),
            )
            bom_version_id = cur.fetchone()["id"]
            cur.execute(
                """
                INSERT INTO bom_items
                    (company_id, bom_version_id, component_code, component_name, quantity, unit)
                VALUES (%s, %s, 'AIMANT-01', 'Aimant NdFeB', 1, 'pce') RETURNING id
                """,
                (company_id, bom_version_id),
            )
            return bom_version_id, cur.fetchone()["id"]


def insert_material_mapping(company_id: int, bom_item_id: int, material_id: str = MATERIAL_ND) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO material_mappings
                    (company_id, bom_item_id, material_id, mass_value, mass_unit,
                     mapping_method, confidence, review_status)
                VALUES (%s, %s, %s, 0.5, 'kg', 'manual', 0.8, 'accepted')
                RETURNING id
                """,
                (company_id, bom_item_id, material_id),
            )
            return cur.fetchone()["id"]
