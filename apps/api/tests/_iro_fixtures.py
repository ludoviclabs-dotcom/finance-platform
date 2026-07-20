"""
_iro_fixtures.py — état PostgreSQL partagé pour les tests IRO / double
matérialité (PR-10). Pas un fichier de test (pas de préfixe `test_`, jamais
collecté) — même convention que `_water_fixtures.py`/`_nature_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à la borne
`IRO_CEILING` (registre IRO 040 : iros, impact_assessments,
financial_assessments, materiality_decisions, iro_actions,
disclosure_mappings). `apply_upto` exécute les fichiers réels en superuser
CI — 040 n'est PAS `requires_owner` (tables neuves uniquement), donc aucune
distinction production/CI à documenter ici (à la différence de
`_water_fixtures.py`).

Contrairement à CRMA/eau/nature, les SIX tables IRO sont TENANT STRICT dès le
départ (`company_id BIGINT NOT NULL`, aucune ligne globale — un IRO est par
nature propre à un tenant) : pas de lignes `company_id IS NULL` à nettoyer au
teardown, contrairement à `_water_fixtures.py`/`_nature_fixtures.py` (zones/
éléments naturels globaux).

**Toutes les données semées ici sont FICTIVES.**
"""

from __future__ import annotations

from typing import Any

import pytest

from db.database import get_db

from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto

# Borne haute du schéma IRO : 040 (registre IRO / double matérialité, PR-10).
IRO_CEILING = "040"

# Tables PR-10, enfants avant parents (le teardown pose de toute façon
# session_replication_role=replica — triggers FK ET le trigger append-only de
# materiality_decisions désactivés le temps du nettoyage, pattern
# _water_fixtures/_nature_fixtures/_crma_fixtures).
IRO_TABLES = (
    "disclosure_mappings",
    "iro_actions",
    "materiality_decisions",
    "financial_assessments",
    "impact_assessments",
    "iros",
)


def build_iro_db(conn) -> None:
    """DDL historique + 001-<borne> (Evidence Kernel 028 inclus — les preuves
    complémentaires d'un IRO passent par `claim_link_service`/
    `evidence_artifacts`)."""
    apply_ddl_inline(conn)
    apply_upto(conn, IRO_CEILING)


@pytest.fixture(scope="module")
def iro_schema():
    """Applique le schéma jusqu'à la borne IRO une fois par module de test."""
    with get_db() as conn:
        build_iro_db(conn)


@pytest.fixture(scope="module")
def two_companies_iro(iro_schema):
    """2 companies de test dédiées PR-10 + cleanup en tear-down.

    Slugs `iro-*` pour ne jamais collisionner avec `ek-*`, `proc-*`, `en-*`,
    `crma-*`, `rls-*`, `water-*` ni `nature-*` sur la même base CI.
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("iro-test-a", "iro-test-b"):
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
            # replica : désactive triggers FK et le trigger append-only de
            # materiality_decisions le temps du nettoyage (rôle superuser CI).
            cur.execute("SET session_replication_role = replica")
            for table in (*IRO_TABLES, *EK_TABLES):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            # audit_events : nettoyer les lignes 'materiality_decision' de ce
            # module AVANT que le module DB-gated suivant ne rejoue
            # apply_upto("040") — le rejeu réapplique 011/012 dans l'ordre
            # AVANT 040, donc réduit temporairement audit_eventtype_check à
            # sa définition étroite pré-040 ; une ligne 'materiality_decision'
            # encore présente à ce moment ferait échouer ce DROP+ADD
            # (CheckViolation), découvert en CI (round-trip, traçabilité §15).
            cur.execute("DELETE FROM audit_events WHERE company_id = ANY(%s)", (ids,))
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


# ── Helpers de fabrique (fonctions normales, jamais des fixtures) ────────────

def insert_iro(
    company_id: int,
    title: str = "IRO fictif",
    *,
    iro_type: str = "risk",
    topic_code: str | None = "WR-1",
    origin_domain: str = "manual",
    origin_reference: str | None = None,
    status: str = "candidate",
    created_by: int | None = None,
) -> int:
    """Insère un IRO directement (les règles de création/transition du
    SERVICE sont testées via `iro_service` ; ce helper sert aux montages des
    évaluations/décisions/actions qui présupposent un IRO existant)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO iros
                    (company_id, title, iro_type, topic_code, origin_domain,
                     origin_reference, status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    company_id, title, iro_type, topic_code, origin_domain,
                    origin_reference, status, created_by,
                ),
            )
            return cur.fetchone()["id"]


def insert_impact_assessment(
    company_id: int,
    iro_id: int,
    *,
    polarity: str = "negative",
    is_actual: bool = False,
    scale: int | None = 70,
    scope: int | None = 60,
    irremediability: int | None = 40,
    likelihood: int | None = 50,
    confidence: int | None = 60,
    components: list[dict[str, Any]] | None = None,
    threshold_crossed: bool | None = True,
) -> int:
    """Insère une évaluation d'impact directement — les règles de calcul/
    validation du SERVICE sont testées via `impact_assessment_service`."""
    import json

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO impact_assessments
                    (company_id, iro_id, polarity, is_actual, scale, scope,
                     irremediability, likelihood, confidence, components,
                     threshold_crossed, calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    company_id, iro_id, polarity, is_actual, scale, scope,
                    irremediability, likelihood, confidence,
                    json.dumps(components or []), threshold_crossed,
                ),
            )
            return cur.fetchone()["id"]


def insert_financial_assessment(
    company_id: int,
    iro_id: int,
    *,
    likelihood: int | None = 50,
    magnitude: int | None = 70,
    confidence: int | None = 55,
    transmission_chain: list[dict[str, Any]] | None = None,
    primary_channel: str = "cost",
    threshold_crossed: bool | None = True,
) -> int:
    """Insère une évaluation financière directement — les règles de
    validation de `transmission_chain` sont testées via
    `financial_assessment_service`."""
    import json

    chain = transmission_chain or [
        {"step": 1, "mechanism": "Hausse de coût fictive", "channel": "cost",
         "rationale": "Donnée de test."},
    ]
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO financial_assessments
                    (company_id, iro_id, likelihood, magnitude, confidence,
                     transmission_chain, primary_channel, threshold_crossed,
                     calculated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    company_id, iro_id, likelihood, magnitude, confidence,
                    json.dumps(chain), primary_channel, threshold_crossed,
                ),
            )
            return cur.fetchone()["id"]
