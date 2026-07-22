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

# 043 : le seed peuple désormais les tables MODULE 2 (ressources) — 042/043 requises.
CEILING = "043"

_ALL_TENANT_TABLES = (
    # MODULE 2 (PR-M2D) — enfants -> parents (teardown sous session_replication_role=replica).
    "resource_assessment_dimensions", "resource_assessment_runs",
    "company_resource_exposure_links", "purchase_lines", "purchase_imports",
    "energy_activities", "resource_supply_observations", "resource_sector_uses",
    "resource_regulatory_statuses", "resource_aliases", "resource_catalog",
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


def test_resource_seed_idempotent_scoped_and_stable(clean_demo):
    """MODULE 2 (PR-M2D) : le seed ressources peuple le tenant démo, est idempotent
    (re-seed => aucun doublon, run NON recréé car input_hash identique), les valeurs
    reproduisent le moteur RÉEL (parité), et rien n'est écrit en global."""
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            assert cid is not None
            first = {
                t: _count(cur, t, cid)
                for t in ("resource_catalog", "resource_supply_observations",
                          "company_resource_exposure_links")
            }
            cur.execute(
                "SELECT count(*) AS n FROM resource_assessment_runs WHERE company_id = %s AND status <> 'superseded'",
                (cid,),
            )
            first_runs = cur.fetchone()["n"]
            # Toutes NOS ressources sont tenant-scoped : le slug pilote existe pour le
            # tenant démo, jamais en global (company_id IS NULL).
            cur.execute("SELECT count(*) AS n FROM resource_catalog WHERE company_id = %s AND slug = 'silicon-metal'", (cid,))
            assert cur.fetchone()["n"] == 1
            cur.execute("SELECT count(*) AS n FROM resource_catalog WHERE company_id IS NULL AND slug = 'silicon-metal'")
            assert cur.fetchone()["n"] == 0
            # Parité moteur : le run silicium reproduit EXACTEMENT les valeurs canoniques.
            cur.execute(
                """SELECT r.risk_score, r.confidence, r.observed_hhi, r.input_hash
                   FROM resource_assessment_runs r JOIN resource_catalog c ON c.id = r.resource_id
                   WHERE r.company_id = %s AND c.slug = 'silicon-metal' AND r.status <> 'superseded'""",
                (cid,),
            )
            run = cur.fetchone()
            assert run is not None
            assert abs(float(run["risk_score"]) - 70.58) < 0.05
            assert abs(float(run["confidence"]) - 79.4) < 0.05
            assert abs(float(run["observed_hhi"]) - 6239.67) < 0.05
            hash1 = run["input_hash"]
    assert first["resource_catalog"] == 5
    assert first["resource_supply_observations"] == 21
    assert first["company_resource_exposure_links"] == 8
    assert first_runs == 5

    # Re-seed : idempotent (aucun doublon ; run non recréé car input_hash stable).
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            second = {t: _count(cur, t, cid) for t in first}
            cur.execute(
                "SELECT count(*) AS n FROM resource_assessment_runs WHERE company_id = %s AND status <> 'superseded'",
                (cid,),
            )
            second_runs = cur.fetchone()["n"]
            cur.execute(
                """SELECT r.input_hash FROM resource_assessment_runs r JOIN resource_catalog c ON c.id = r.resource_id
                   WHERE r.company_id = %s AND c.slug = 'silicon-metal' AND r.status <> 'superseded'""",
                (cid,),
            )
            hash2 = cur.fetchone()["input_hash"]
    assert second == first          # aucun doublon d'entrées
    assert second_runs == first_runs == 5   # aucun run superseded en plus (calcul stable)
    assert hash2 == hash1           # empreinte figée => reproductibilité


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
            # Ressource MODULE 2 du voisin : NE DOIT PAS être touchée par le reset démo.
            cur.execute(
                """INSERT INTO resource_catalog (company_id, slug, name, primary_family, data_status)
                   VALUES (%s,'neighbor-resource','Neighbor resource','other','manual')""",
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
            # MODULE 2 : ressources + assessments du tenant démo vidés.
            assert _count(cur, "resource_catalog", demo_cid) == 0
            assert _count(cur, "resource_assessment_runs", demo_cid) == 0
            assert _count(cur, "company_resource_exposure_links", demo_cid) == 0
            # Tenant voisin intact (IRO ET ressource).
            assert _count(cur, "iros", other) == 1
            assert _count(cur, "resource_catalog", other) == 1


def test_reset_refuses_without_yes(clean_demo):
    assert demo_seed.run(dry_run=False, scenario_name="asterion-motion-v1") == 0
    # Sans --yes : refus (code 4), rien supprimé.
    assert demo_reset.run(dry_run=False, assume_yes=False) == 4
    with get_db() as conn:
        with conn.cursor() as cur:
            cid = _cid(cur, DEMO_TENANT_SLUG)
            assert _count(cur, "iros", cid) == 1
