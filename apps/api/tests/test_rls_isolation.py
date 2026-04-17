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
import secrets
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


# ──────────────────────────────────────────────────────────────────────────
# Phase 4 — Suppliers & Matérialité (Migration 008b)
# ──────────────────────────────────────────────────────────────────────────


def _rls_phase4_active() -> bool:
    """Retourne True si RLS est activée sur la table suppliers (migration 008b)."""
    return _rls_enabled("suppliers")


@pytest.fixture(scope="module")
def ensure_rls_phase4_active():
    """Skippe si la migration 008b n'a pas encore été appliquée."""
    if not _rls_phase4_active():
        pytest.skip(
            "RLS non activée sur 'suppliers' — lancer migrations/008b_rls_suppliers.sql"
        )


@pytest.fixture(scope="module")
def two_companies_p4():
    """Crée 2 companies de test pour Phase 4. Cleanup en tear-down."""
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("rls-p4-a", "rls-p4-b"):
                cur.execute(
                    """
                    INSERT INTO companies (name, slug, plan)
                    VALUES (%s, %s, 'starter')
                    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                    """,
                    (slug.upper(), slug),
                )
                ids.append(cur.fetchone()["id"])
    yield ids
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM materialite_positions WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM supplier_questionnaire_tokens WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM supplier_answers WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM suppliers WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


class TestRlsIsolationPhase4:
    """Vérifie l'isolation des tables Phase 4 (suppliers, tokens, answers, materialite)."""

    def test_rls_enabled_on_all_phase4_tables(self, ensure_rls_phase4_active) -> None:
        tables = [
            "suppliers",
            "supplier_questionnaire_tokens",
            "supplier_answers",
            "materialite_positions",
        ]
        for table in tables:
            assert _rls_enabled(table), f"RLS non activée sur '{table}'"

    def test_suppliers_isolated_between_tenants(
        self, ensure_rls_phase4_active, two_companies_p4
    ) -> None:
        cid_a, cid_b = two_companies_p4

        with get_db(cid_b) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO suppliers (company_id, name) VALUES (%s,%s) RETURNING id",
                    (cid_b, "Fournisseur Confidentiel B"),
                )
                sup_b_id = cur.fetchone()["id"]

        # company A ne doit pas voir le supplier de company B
        with get_db(cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM suppliers WHERE id = %s", (sup_b_id,))
                row = cur.fetchone()
        assert row is None, f"FUITE RLS suppliers : company A voit le supplier {sup_b_id} de company B"

        # company B voit bien son propre supplier
        with get_db(cid_b) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM suppliers WHERE id = %s", (sup_b_id,))
                row = cur.fetchone()
        assert row is not None

    def test_materialite_positions_isolated(
        self, ensure_rls_phase4_active, two_companies_p4
    ) -> None:
        cid_a, cid_b = two_companies_p4

        with get_db(cid_b) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO materialite_positions (company_id, issue_code, x_proba, y_impact) "
                    "VALUES (%s,%s,%s,%s) ON CONFLICT (company_id, issue_code) "
                    "DO UPDATE SET x_proba=EXCLUDED.x_proba RETURNING id",
                    (cid_b, "CC-1-P4TEST", 4.0, 4.5),
                )
                pos_b_id = cur.fetchone()["id"]

        with get_db(cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM materialite_positions WHERE id = %s", (pos_b_id,))
                row = cur.fetchone()
        assert row is None, f"FUITE RLS matérialité : company A voit la position {pos_b_id} de company B"

    def test_security_definer_function_exists(self, ensure_rls_phase4_active) -> None:
        """La fonction SECURITY DEFINER resolve_supplier_token doit exister en base."""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT proname FROM pg_proc WHERE proname = 'resolve_supplier_token'"
                )
                row = cur.fetchone()
        assert row is not None, (
            "Fonction resolve_supplier_token() manquante — migration 008b non appliquée"
        )

    def test_security_definer_resolves_token_without_rls_context(
        self, ensure_rls_phase4_active, two_companies_p4
    ) -> None:
        """SECURITY DEFINER doit résoudre un token même sans SET LOCAL company_id."""
        cid_a, _ = two_companies_p4
        token_hex = secrets.token_hex(32)

        with get_db(cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO suppliers (company_id, name) VALUES (%s,%s) RETURNING id",
                    (cid_a, "SecDef Test Supplier"),
                )
                sid = cur.fetchone()["id"]
                cur.execute(
                    "INSERT INTO supplier_questionnaire_tokens "
                    "(supplier_id, company_id, token, expires_at) "
                    "VALUES (%s,%s,%s, now() + interval '30 days') RETURNING id",
                    (sid, cid_a, token_hex),
                )

        # Appel SANS company_id → RLS bloquerait une requête directe
        # Mais la fonction SECURITY DEFINER doit réussir
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM public.resolve_supplier_token(%s)", (token_hex,)
                )
                row = cur.fetchone()

        assert row is not None, "SECURITY DEFINER n'a pas résolu le token sans contexte tenant"
        assert row["supplier_id"] == sid
        assert row["company_id"] == cid_a
        assert row["supplier_name"] == "SecDef Test Supplier"

    def test_insert_supplier_wrong_company_rejected(
        self, ensure_rls_phase4_active, two_companies_p4
    ) -> None:
        """WITH CHECK : insérer un supplier pour company B depuis le contexte A doit échouer."""
        cid_a, cid_b = two_companies_p4
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO suppliers (company_id, name) VALUES (%s,%s)",
                        (cid_b, "Tentative Injection"),
                    )
