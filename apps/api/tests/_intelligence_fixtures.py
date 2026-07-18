"""
_intelligence_fixtures.py — état PostgreSQL partagé pour les tests Evidence
Kernel (PR-03). Pas un fichier de test (pas de préfixe `test_`, jamais
collecté par pytest) — même convention que `_migration_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à 029 inclus
(`_migration_fixtures.apply_ddl_inline` + `apply_upto("029")`) — jamais une
copie de schéma recopiée à la main. Idempotent (`CREATE TABLE IF NOT
EXISTS` / `CREATE OR REPLACE VIEW` partout) : sûr à rappeler même si un autre
module de test a déjà construit le schéma sur le même conteneur `postgres:16`
jetable. 029 (vue source_freshness) est incluse pour les tests de fraîcheur
PR-04.
"""

from __future__ import annotations

import pytest

from db.database import get_db

from ._migration_fixtures import apply_ddl_inline, apply_upto

EK_TABLES = (
    "observations",
    "claim_evidence_links",
    "evidence_artifacts",
    "ingestion_runs",
    "source_releases",
    "source_registry",
)


def build_evidence_kernel_db(conn) -> None:
    """DDL historique + 001-029 (noyau Evidence Kernel 028 + vue de fraîcheur 029)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "029")


@pytest.fixture(scope="module")
def evidence_kernel_schema():
    """Applique le schéma jusqu'à 029 une fois par module de test."""
    with get_db() as conn:
        build_evidence_kernel_db(conn)


@pytest.fixture(scope="module")
def two_companies(evidence_kernel_schema):
    """2 companies de test dédiées Evidence Kernel + cleanup en tear-down.

    Slugs `ek-*` pour ne jamais collisionner avec `rls-test-*`/`rls-p4-*`
    (test_rls_isolation.py) qui peuvent tourner dans la même base CI.
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("ek-test-a", "ek-test-b"):
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
            # Les triggers d'immutabilité (evidence_kernel_guard) REFUSENT tout
            # DELETE sur source_releases (append-only) et observations (frozen) —
            # y compris pour ce nettoyage. `session_replication_role = replica`
            # désactive les triggers utilisateur le temps du teardown (le rôle
            # CI `postgres` est superuser, seul autorisé à poser ce GUC) ; il
            # désactive aussi les triggers de FK, donc l'ordre enfants→parents
            # d'EK_TABLES devient indifférent. La connexion est jetée juste
            # après (aucune fuite de ce réglage hors du teardown).
            cur.execute("SET session_replication_role = replica")
            for table in EK_TABLES:
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


def make_source(
    cid: int,
    code: str,
    *,
    company_id: int | None = ...,
    source_type: str = "manual",
    automated_access_allowed: bool = True,
    storage_allowed: bool = True,
    display_allowed: bool = True,
    derived_use_allowed: bool = True,
    commercial_use_allowed: bool = True,
    redistribution_allowed: bool = True,
    active: bool = True,
) -> dict:
    """Ligne source_registry prête à insérer (dict pour cur.execute(%(name)s, ...)).

    `company_id=...` (sentinel) signifie "utiliser `cid`" — permet d'appeler
    explicitement `company_id=None` pour une source globale sans ambiguïté
    avec "valeur par défaut non fournie".
    """
    return {
        "company_id": cid if company_id is ... else company_id,
        "code": code,
        "publisher": "Test Publisher",
        "title": f"Source de test {code}",
        "source_type": source_type,
        "automated_access_allowed": automated_access_allowed,
        "storage_allowed": storage_allowed,
        "display_allowed": display_allowed,
        "derived_use_allowed": derived_use_allowed,
        "commercial_use_allowed": commercial_use_allowed,
        "redistribution_allowed": redistribution_allowed,
        "active": active,
    }


def insert_source(conn, row: dict) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO source_registry
                (company_id, code, publisher, title, source_type, automated_access_allowed,
                 storage_allowed, display_allowed, derived_use_allowed, commercial_use_allowed,
                 redistribution_allowed, active)
            VALUES (%(company_id)s, %(code)s, %(publisher)s, %(title)s, %(source_type)s,
                    %(automated_access_allowed)s, %(storage_allowed)s, %(display_allowed)s,
                    %(derived_use_allowed)s, %(commercial_use_allowed)s, %(redistribution_allowed)s,
                    %(active)s)
            RETURNING id
            """,
            row,
        )
        return cur.fetchone()["id"]
