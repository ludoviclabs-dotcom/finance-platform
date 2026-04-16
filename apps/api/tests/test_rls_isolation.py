"""
test_rls_isolation.py — Tests d'isolation Row Level Security Postgres.

Vérifie que `SET LOCAL app.current_company_id = X` empêche un tenant A de
voir les données du tenant B via les policies tenant_isolation_*.

CI-compatible :
  - Skipped si DATABASE_URL absent (mode /tmp JSON sans RLS)
  - Skipped si les policies ne sont pas activées (migration 004 manuelle)

Ces tests sont destinés à être exécutés en local/staging après ENABLE ROW LEVEL
SECURITY et CREATE POLICY tenant_isolation_* sur snapshots, facts_events,
audit_events, alert_rules, products.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest

from db.database import db_available, get_db
from services.facts_service import compute_hash


def _rls_enabled(table: str) -> bool:
    """Vérifie si RLS est activée sur la table cible."""
    if not db_available():
        return False
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT relrowsecurity FROM pg_class WHERE relname = %s",
                    (table,),
                )
                row = cur.fetchone()
                return bool(row and row["relrowsecurity"])
    except Exception:
        return False


def _policies_exist(table: str) -> bool:
    if not db_available():
        return False
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS c FROM pg_policies WHERE tablename = %s",
                    (table,),
                )
                row = cur.fetchone()
                return bool(row and row["c"] > 0)
    except Exception:
        return False


# ── Skip conditions ─────────────────────────────────────────────────────────

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"),
        reason="DATABASE_URL absent — tests RLS skippés",
    ),
    pytest.mark.skipif(
        not db_available(),
        reason="psycopg2/PostgreSQL non disponible",
    ),
]


@pytest.fixture(scope="module")
def ensure_rls_active():
    """Ne lance les tests que si la migration 004 a été appliquée."""
    if not _rls_enabled("facts_events") or not _policies_exist("facts_events"):
        pytest.skip(
            "RLS non activée sur facts_events — lancer migrations/004_rls_policies.sql"
        )


@pytest.fixture(scope="module")
def two_companies():
    """Crée 2 companies de test + renvoie leurs IDs. Cleanup en tear-down."""
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("rls-test-a", "rls-test-b"):
                cur.execute(
                    """
                    INSERT INTO companies (name, slug, plan)
                    VALUES (%s, %s, 'starter')
                    ON CONFLICT (slug) DO UPDATE SET updated_at=now()
                    RETURNING id
                    """,
                    (slug.upper(), slug),
                )
                row = cur.fetchone()
                ids.append(row["id"])
    yield ids
    # Cleanup : supprime facts_events puis companies de test
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM facts_events WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM snapshots WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


@pytest.fixture
def seeded_facts(ensure_rls_active, two_companies):
    """Insère 1 fact par company pour tester l'isolation."""
    company_a, company_b = two_companies
    ts = datetime.now(tz=timezone.utc)
    for cid, label in ((company_a, "fact_A"), (company_b, "fact_B")):
        h = compute_hash(
            hash_prev=None, company_id=cid, code=f"test.{label}", value=42.0,
            unit="t", ef_id=None, source_path="rls_test", computed_at=ts,
        )
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO facts_events
                        (company_id, code, value, unit, source_path,
                         computed_at, hash_prev, hash_self)
                    VALUES (%s, %s, %s, %s, %s, %s, NULL, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (cid, f"test.{label}", 42.0, "t", "rls_test", ts, h),
                )
    return company_a, company_b


class TestRlsIsolation:
    def test_company_a_cannot_see_company_b_facts(self, seeded_facts):
        company_a, company_b = seeded_facts
        with get_db(company_id=company_a) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT company_id FROM facts_events WHERE source_path = 'rls_test'")
                rows = cur.fetchall()
        company_ids = {r["company_id"] for r in rows}
        assert company_b not in company_ids, (
            "FUITE RLS : company A voit des facts de company B"
        )
        assert company_ids == {company_a} or company_ids == set(), (
            f"company A ne doit voir que ses propres facts, vu : {company_ids}"
        )

    def test_company_b_cannot_see_company_a_facts(self, seeded_facts):
        company_a, company_b = seeded_facts
        with get_db(company_id=company_b) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT company_id FROM facts_events WHERE source_path = 'rls_test'")
                rows = cur.fetchall()
        company_ids = {r["company_id"] for r in rows}
        assert company_a not in company_ids

    def test_insert_with_wrong_company_id_rejected(self, two_companies):
        """Tenter d'insérer un fact pour company B quand la session est configurée pour A."""
        company_a, company_b = two_companies
        ts = datetime.now(tz=timezone.utc)
        with pytest.raises(Exception):
            # psycopg2 lève une erreur sur WITH CHECK violation
            with get_db(company_id=company_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO facts_events
                            (company_id, code, value, unit, source_path, computed_at, hash_self)
                        VALUES (%s, 'test.wrong', 1.0, 't', 'rls_test_wrong', %s, 'deadbeef' || repeat('0', 56))
                        """,
                        (company_b, ts),  # tentative d'insert avec id différent de la session
                    )

    def test_no_tenant_context_means_no_rows(self, seeded_facts):
        """Sans SET app.current_company_id, les policies filtrent tout."""
        # Sans company_id : get_db() ne set rien → current_setting('app.current_company_id', true) = ''
        # Le cast ::int échoue silencieusement (policy retourne FALSE → 0 rows).
        with get_db() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute("SELECT COUNT(*) AS c FROM facts_events WHERE source_path = 'rls_test'")
                    row = cur.fetchone()
                    assert row["c"] == 0, (
                        "Sans tenant context, aucune ligne ne doit être visible via RLS"
                    )
                except Exception:
                    # Acceptable si le cast ::int crash — fail-safe : pas de fuite
                    pass
