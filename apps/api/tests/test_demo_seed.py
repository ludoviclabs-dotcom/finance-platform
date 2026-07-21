"""
test_demo_seed.py — DB-gated (job migration-tests, PostgreSQL réel).

Prouve le cycle de vie du tenant de démonstration Asterion :
  - seed idempotent (re-seed => aucun doublon) ;
  - le pipeline IA RÉEL (mode demo) sur l'IRO seedé produit les statuts
    déterministes attendus (partially_supported / contradicted / unsupported) ;
  - reset tenant-only (vide le tenant démo, conserve sa coquille, ne touche PAS
    un autre tenant) ;
  - aucun appel réseau, aucun coût.

Pas de PostgreSQL local (contrainte du chantier) => prouvé en CI uniquement.
"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

import demo_reset  # noqa: E402
import demo_seed  # noqa: E402

from db.database import db_available, get_db  # noqa: E402
from services.auth_service import DEMO_TENANT_SLUG  # noqa: E402

from ._migration_fixtures import apply_ddl_inline, apply_upto  # noqa: E402

# DB-gated : skippé sans PostgreSQL (job `tests` mode /tmp) — seul `migration-tests`
# l'exécute, comme les autres tests DB-gated (test_ai_review_ledger, etc.).
pytestmark = pytest.mark.skipif(not db_available(), reason="PostgreSQL requis (DB-gated)")

CEILING = "041"

_ALL_TENANT_TABLES = (
    "ai_citations", "ai_claims", "ai_review_decisions", "ai_runs",
    "claim_evidence_links", "observations", "evidence_artifacts",
    "source_releases", "source_registry", "materiality_decisions",
    "iro_actions", "disclosure_mappings", "impact_assessments",
    "financial_assessments", "iros", "suppliers", "sites",
)


@pytest.fixture(scope="module")
def demo_schema():
    with get_db() as conn:
        with conn.cursor() as cur:
            # `audit_events` peut contenir des types ÉLARGIS (040 materiality_decision,
            # 041 ai_review_decision) laissés par un module DB-gated précédent dans le
            # MÊME Postgres CI. `apply_upto` rejoue la contrainte ÉTROITE de 011
            # (audit_eventtype_check) qui échouerait sur ces lignes -> purge avant
            # reconstruction (piège documenté du chantier).
            cur.execute("SELECT to_regclass('public.audit_events') AS reg")
            if cur.fetchone()["reg"] is not None:
                cur.execute("SET session_replication_role = replica")
                cur.execute("DELETE FROM audit_events")
                cur.execute("SET session_replication_role = origin")
        apply_ddl_inline(conn)
        apply_upto(conn, CEILING)


def _cid(cur, slug: str) -> int | None:
    cur.execute("SELECT id FROM companies WHERE slug = %s", (slug,))
    row = cur.fetchone()
    return row["id"] if row else None


def _count(cur, table: str, cid: int) -> int:
    cur.execute(f"SELECT count(*) AS n FROM {table} WHERE company_id = %s", (cid,))
    return cur.fetchone()["n"]


@pytest.fixture(scope="function")
def clean_demo(demo_schema):
    """Garantit un tenant démo absent au départ et nettoyé au teardown, + purge
    d'un éventuel tenant d'isolation."""
    yield
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
            for slug in (DEMO_TENANT_SLUG, "other-real-tenant"):
                cid = _cid(cur, slug)
                if cid is None:
                    continue
                for table in _ALL_TENANT_TABLES:
                    cur.execute(f"DELETE FROM {table} WHERE company_id = %s", (cid,))
                cur.execute("DELETE FROM users WHERE company_id = %s", (cid,))
                cur.execute("DELETE FROM companies WHERE id = %s", (cid,))
            cur.execute("SET session_replication_role = origin")


def test_seed_is_idempotent_and_populates_evidence(clean_demo):
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            assert cid is not None
            first = {t: _count(cur, t, cid) for t in ("evidence_artifacts", "claim_evidence_links", "iros", "observations")}
    assert first["iros"] == 1
    assert first["evidence_artifacts"] >= 4
    assert first["claim_evidence_links"] == 4
    assert first["observations"] >= 10

    # Re-seed : idempotent, aucun doublon.
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            second = {t: _count(cur, t, cid) for t in first}
    assert second == first


def test_seeded_iro_drives_real_ai_review_statuses(clean_demo):
    from services.intelligence.ai import review_service

    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            cur.execute("SELECT id FROM iros WHERE company_id = %s", (cid,))
            iro_id = cur.fetchone()["id"]

    result = review_service.run_review(
        company_id=cid, use_case="iro_review", subject_key=str(iro_id), created_by=None,
    )
    statuses = {c.support_status for c in result.claims}
    assert "partially_supported" in statuses  # dépendance estimée
    assert "contradicted" in statuses          # recyclé 80% vs 35% prouvé
    assert "unsupported" in statuses           # fournisseur alternatif sans preuve
    # Le run est journalisé, coût nul (mode demo).
    assert result.run.provider == "demo"
    assert (result.run.cost_estimate or 0.0) == 0.0


def test_reset_is_tenant_scoped_and_keeps_shell(clean_demo):
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0

    # Tenant réel voisin : NE DOIT PAS être touché par le reset démo.
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO companies (name, slug, plan) VALUES ('Autre','other-real-tenant','pro') RETURNING id",
            )
            other = cur.fetchone()["id"]
            cur.execute(
                """INSERT INTO iros (company_id, title, iro_type, origin_domain, status)
                   VALUES (%s,'IRO réel voisin','risk','manual','candidate')""",
                (other,),
            )

    assert demo_reset.run(dry_run=False, assume_yes=True) == 0

    with get_db() as conn:
        with conn.cursor() as cur:
            demo_cid = _cid(cur, DEMO_TENANT_SLUG)
            # Coquille conservée (company toujours là), données vidées.
            assert demo_cid is not None
            assert _count(cur, "iros", demo_cid) == 0
            assert _count(cur, "evidence_artifacts", demo_cid) == 0
            assert _count(cur, "claim_evidence_links", demo_cid) == 0
            # Tenant voisin intact.
            assert _count(cur, "iros", other) == 1


def test_reset_refuses_without_yes(clean_demo):
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    # Sans --yes : refus (code 4), rien supprimé.
    assert demo_reset.run(dry_run=False, assume_yes=False) == 4
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            assert _count(cur, "iros", cid) == 1
