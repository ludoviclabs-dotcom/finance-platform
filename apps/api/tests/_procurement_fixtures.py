"""
_procurement_fixtures.py — état PostgreSQL partagé pour les tests d'exposition
achats/fournisseurs (PR-05A). Pas un fichier de test (pas de préfixe `test_`,
jamais collecté par pytest) — même convention que `_intelligence_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à 032 inclus
(001-032 : vue de fraîcheur 029 de PR-04, exposition achats 030 de PR-05A,
fondation énergie 031 de PR-06A, moteur Scope 3 achats 032 de PR-05B — toutes
mergées ou portées par cette branche). Idempotent (`CREATE TABLE IF NOT EXISTS`
partout) : sûr à rappeler même si un autre module de test a déjà construit le
schéma sur le même conteneur `postgres:16` jetable.
"""

from __future__ import annotations

import pytest

from db.database import get_db

from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto

# Tables PR-05A + PR-05B, enfants avant parents (ordre indifférent sous
# session_replication_role=replica au teardown, mais explicite par sûreté).
PROC_TABLES = (
    "procurement_hotspot_selections",
    "procurement_line_results",
    "procurement_calculation_runs",
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

# Tables historiques touchées indirectement par les tests PR-05B :
# `export_packages` (Evidence Pack d'un run), `facts_events` (scellement à
# l'approbation d'un run), `supplier_campaigns` + tokens (campagne créée depuis
# un hotspot). Purgées au teardown pour ne pas polluer les autres modules qui
# partagent le même conteneur CI.
PROC_SIDE_EFFECT_TABLES = (
    "export_packages",
    "facts_events",
    "supplier_questionnaire_tokens",
    "supplier_answers",
    "supplier_campaigns",
)


def build_procurement_db(conn) -> None:
    """DDL historique + 001-032 (Evidence Kernel 028, exposition achats 030,
    énergie 031, moteur Scope 3 achats & hotspots 032)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "032")


@pytest.fixture(scope="module")
def procurement_schema():
    """Applique le schéma jusqu'à 032 une fois par module de test."""
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
            for table in (
                *PROC_TABLES, *PROC_SIDE_EFFECT_TABLES, *EK_TABLES, "suppliers", "products",
            ):
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


# ── Helpers PR-05B (moteur Scope 3) ──────────────────────────────────────────

def insert_supplier_product(
    company_id: int, supplier_id: int, product_code: str, *,
    product_name: str | None = None, category_code: str | None = None,
    origin_country: str | None = None,
) -> int:
    """Crée un produit fournisseur (030) — cible du mapping automatique d'import."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO supplier_products
                    (company_id, supplier_id, product_code, product_name, category_code,
                     origin_country)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (company_id, supplier_id, product_code, product_name, category_code,
                 origin_country),
            )
            return cur.fetchone()["id"]


def insert_pcf(
    company_id: int, supplier_product_id: int, *, value_kgco2e: float,
    declared_unit: str = "kg", verification_status: str = "third_party_verified",
    data_status: str = "verified", evidence_artifact_id: int | None = None,
    source_release_id: int | None = None,
) -> int:
    """Crée une PCF produit (030) — niveau 1 de la hiérarchie si vérifiée par tiers."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO product_carbon_footprints
                    (company_id, supplier_product_id, value_kgco2e, declared_unit,
                     verification_status, data_status, evidence_artifact_id, source_release_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (company_id, supplier_product_id, value_kgco2e, declared_unit,
                 verification_status, data_status, evidence_artifact_id, source_release_id),
            )
            return cur.fetchone()["id"]


def insert_declaration(
    company_id: int, supplier_id: int, *, metric_code: str, value: float,
    unit: str = "tCO2e/M€", review_status: str = "accepted",
) -> int:
    """Crée une déclaration fournisseur (030) — niveau 2 si acceptée en revue."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO supplier_metric_declarations
                    (company_id, supplier_id, metric_code, value, unit, review_status)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (company_id, supplier_id, metric_code, value, unit, review_status),
            )
            return cur.fetchone()["id"]


def insert_emission_factor(
    *, ef_code: str, category: str, factor_kgco2e: float, unit: str,
    version: str = "v-test", label: str | None = None,
) -> None:
    """Ajoute un facteur au catalogue GLOBAL `emission_factors` (001, sans
    company_id). Idempotent sur (ef_code, version) — rejouable entre modules de
    test partageant le même conteneur."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO emission_factors
                    (ef_code, label, category, factor_kgco2e, unit, version, source)
                VALUES (%s, %s, %s, %s, %s, %s, 'TEST')
                ON CONFLICT (ef_code, version) DO NOTHING
                """,
                (ef_code, label or ef_code, category, factor_kgco2e, unit, version),
            )


def cleanup_emission_factors(versions: tuple[str, ...] = ("v-test",)) -> None:
    """Retire les facteurs de test du catalogue global (il n'a pas de company_id,
    donc le cleanup par tenant ne le couvre pas)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM emission_factors WHERE version = ANY(%s)", (list(versions),))
