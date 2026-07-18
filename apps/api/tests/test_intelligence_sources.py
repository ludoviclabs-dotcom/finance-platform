"""
test_intelligence_sources.py — source_registry : CRUD, unicité de code, RLS
globale/tenant, et license_policy (PR-03).

license_policy est pur (aucune I/O) — tests toujours actifs, pas DB-gated.
Le reste (source_service, RLS) est DB-gated comme test_rls_isolation.py.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.intelligence import SourceCreate, SourceUpdate
from services.intelligence import license_policy, source_service

from ._intelligence_fixtures import insert_source, make_source

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ── license_policy — pur, jamais skippé ──────────────────────────────────


_OPEN_SOURCE = {
    "active": True,
    "automated_access_allowed": True,
    "storage_allowed": True,
    "display_allowed": True,
    "derived_use_allowed": True,
    "commercial_use_allowed": True,
    "redistribution_allowed": True,
    "attribution_text": "CC-BY 4.0",
}


class TestLicensePolicy:
    def test_fully_open_source_allows_everything_no_reason(self):
        decision = license_policy.evaluate(_OPEN_SOURCE)
        assert decision.allow_ingest is True
        assert decision.allow_store is True
        assert decision.allow_display is True
        assert decision.allow_derived_use is True
        assert decision.reasons == []

    def test_inactive_source_blocks_ingest_store_display(self):
        decision = license_policy.evaluate({**_OPEN_SOURCE, "active": False})
        assert decision.allow_ingest is False
        assert decision.allow_store is False
        assert decision.allow_display is False
        assert any("désactivée" in r for r in decision.reasons)

    def test_automated_access_denied_blocks_ingest_only(self):
        decision = license_policy.evaluate({**_OPEN_SOURCE, "automated_access_allowed": False})
        assert decision.allow_ingest is False
        assert decision.allow_store is True
        assert decision.allow_display is True

    def test_storage_denied_blocks_store_only(self):
        decision = license_policy.evaluate({**_OPEN_SOURCE, "storage_allowed": False})
        assert decision.allow_store is False
        assert decision.allow_ingest is True

    def test_display_without_attribution_warns(self):
        decision = license_policy.evaluate({**_OPEN_SOURCE, "attribution_text": None})
        assert any("attribution_text" in w for w in decision.warnings)

    def test_missing_keys_treated_as_false_never_a_crash(self):
        """Aucun jugement silencieux : une source mal formée (clés absentes)
        n'autorise rien par défaut plutôt que de lever ou de tout permettre."""
        decision = license_policy.evaluate({})
        assert decision.allow_ingest is False
        assert decision.allow_store is False
        assert decision.allow_display is False
        assert decision.allow_derived_use is False
        assert decision.reasons  # au moins une raison structurée, jamais vide silencieusement


# ── source_service — CRUD, DB-gated ──────────────────────────────────────


@_skip_no_db_url
@_skip_no_psycopg2
class TestSourceServiceCrud:
    def test_create_get_list_source(self, two_companies):
        cid_a, _ = two_companies
        created = source_service.create_source(
            company_id=cid_a,
            payload=SourceCreate(code=f"crud-{cid_a}", publisher="Pub", title="Titre", source_type="manual"),
            created_by=None,
        )
        assert created.company_id == cid_a
        assert created.active is True

        fetched = source_service.get_source(company_id=cid_a, source_id=created.id)
        assert fetched.id == created.id
        assert fetched.title == "Titre"

        items, total = source_service.list_sources(company_id=cid_a, limit=200)
        assert any(i.id == created.id for i in items)
        assert total >= 1

    def test_duplicate_code_same_tenant_rejected(self, two_companies):
        cid_a, _ = two_companies
        payload = SourceCreate(code=f"dup-{cid_a}", publisher="Pub", title="T", source_type="manual")
        source_service.create_source(company_id=cid_a, payload=payload, created_by=None)
        with pytest.raises(source_service.SourceError):
            source_service.create_source(company_id=cid_a, payload=payload, created_by=None)

    def test_same_code_different_tenants_allowed(self, two_companies):
        cid_a, cid_b = two_companies
        code = f"shared-{cid_a}-{cid_b}"
        a = source_service.create_source(
            company_id=cid_a,
            payload=SourceCreate(code=code, publisher="P", title="T", source_type="manual"),
            created_by=None,
        )
        b = source_service.create_source(
            company_id=cid_b,
            payload=SourceCreate(code=code, publisher="P", title="T", source_type="manual"),
            created_by=None,
        )
        assert a.id != b.id

    def test_update_source_partial(self, two_companies):
        cid_a, _ = two_companies
        created = source_service.create_source(
            company_id=cid_a,
            payload=SourceCreate(code=f"upd-{cid_a}", publisher="P", title="Old", source_type="manual"),
            created_by=None,
        )
        updated = source_service.update_source(
            company_id=cid_a, source_id=created.id, payload=SourceUpdate(title="New"),
        )
        assert updated.title == "New"
        assert updated.publisher == "P"  # inchangé — PATCH partiel

    def test_deactivate_source(self, two_companies):
        cid_a, _ = two_companies
        created = source_service.create_source(
            company_id=cid_a,
            payload=SourceCreate(code=f"deact-{cid_a}", publisher="P", title="T", source_type="manual"),
            created_by=None,
        )
        deactivated = source_service.deactivate_source(company_id=cid_a, source_id=created.id)
        assert deactivated.active is False

    def test_get_nonexistent_source_raises(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(source_service.SourceError):
            source_service.get_source(company_id=cid_a, source_id=999_999_999)

    def test_update_source_out_of_tenant_scope_raises(self, two_companies):
        """Tenter un PATCH depuis le mauvais tenant doit échouer comme 'introuvable'
        (RLS filtre la ligne avant même l'UPDATE — jamais une fuite d'existence)."""
        cid_a, cid_b = two_companies
        created = source_service.create_source(
            company_id=cid_a,
            payload=SourceCreate(code=f"scope-{cid_a}", publisher="P", title="T", source_type="manual"),
            created_by=None,
        )
        with pytest.raises(source_service.SourceError):
            source_service.update_source(
                company_id=cid_b, source_id=created.id, payload=SourceUpdate(title="Hijack"),
            )


# ── RLS — lecture globale/tenant, écriture strictement tenant ────────────


@_skip_no_db_url
@_skip_no_psycopg2
class TestSourceRegistryRls:
    def test_rls_enabled_and_forced_on_all_evidence_kernel_tables(self):
        tables = (
            "source_registry", "source_releases", "evidence_artifacts",
            "ingestion_runs", "observations", "claim_evidence_links",
        )
        with get_db() as conn:
            with conn.cursor() as cur:
                for t in tables:
                    cur.execute(
                        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = %s", (t,)
                    )
                    row = cur.fetchone()
                    assert row is not None, f"table '{t}' introuvable"
                    assert row["relrowsecurity"], f"RLS non activée sur '{t}'"
                    assert row["relforcerowsecurity"], f"FORCE RLS absent sur '{t}'"
                    cur.execute(
                        "SELECT COUNT(*) AS c FROM pg_policies WHERE tablename = %s", (t,)
                    )
                    assert cur.fetchone()["c"] > 0, f"aucune policy sur '{t}'"

    def test_tenant_a_cannot_see_tenant_b_source(self, two_companies):
        cid_a, cid_b = two_companies
        with get_db(company_id=cid_b) as conn:
            b_id = insert_source(conn, make_source(cid_b, f"rls-b-{cid_b}"))
        items, _ = source_service.list_sources(company_id=cid_a, limit=200)
        assert all(s.id != b_id for s in items)

    def test_tenant_sees_global_source(self, two_companies):
        cid_a, _ = two_companies
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET app.rls_bypass = 'on'")
            global_id = insert_source(conn, make_source(None, f"global-{cid_a}", company_id=None))
        items, _ = source_service.list_sources(company_id=cid_a, limit=500)
        assert any(s.id == global_id for s in items)

    def test_service_never_creates_global_source_for_tenant(self, two_companies):
        """Un tenant ne peut pas créer de source globale : `create_source` force
        toujours `company_id = tenant`, il n'existe aucun chemin de service pour
        écrire une ligne `company_id IS NULL`.

        La policy RLS d'écriture (`WITH CHECK company_id = tenant`, jamais NULL)
        reste la garantie de dernier recours EN BASE, mais elle n'est vérifiable
        qu'avec une connexion NON-superuser : le PostgreSQL de CI tourne en
        `postgres` (superuser), qui bypasse toute RLS. L'existence de la policy
        d'insertion est vérifiée structurellement par `_probe_028`
        (migration_probes) ; son effet réel l'est en staging sous carbonco_app."""
        cid_a, _ = two_companies
        created = source_service.create_source(
            company_id=cid_a,
            payload=SourceCreate(code=f"never-global-{cid_a}", publisher="P", title="T", source_type="manual"),
            created_by=None,
        )
        assert created.company_id == cid_a
        assert created.company_id is not None

    def test_rls_bypass_can_write_global_source(self, two_companies):
        cid_a, _ = two_companies
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET app.rls_bypass = 'on'")
            row_id = insert_source(conn, make_source(None, f"bypass-global-{cid_a}", company_id=None))
        assert row_id is not None

    def test_source_type_check_constraint_rejects_unknown_value(self, two_companies):
        cid_a, _ = two_companies
        with pytest.raises(Exception):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO source_registry (company_id, code, publisher, title, source_type) "
                        "VALUES (%s, %s, 'P', 'T', 'invalid_type')",
                        (cid_a, f"badtype-{cid_a}"),
                    )
