"""
test_resources_catalog.py — Module 2, fondation catalogue (PR-M2A).

DB-gated : lecture globale + isolation tenant, source obligatoire pour
`verified`, pont d'alias legacy (D-2), usages sectoriels, et RLS gen-2
(ENABLE+FORCE, policies par commande, écriture jamais globale).

Skippés sans `DATABASE_URL` (mode /tmp) — le job CI `migration-tests` de
`.github/workflows/api.yml` est le seul à les exécuter contre un vrai PostgreSQL.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.resources import (
    ResourceAliasCreate,
    ResourceCatalogCreate,
    ResourceSectorUseCreate,
)
from services.resources import catalog_service

from ._resources_fixtures import (
    GLOBAL_SLUG,
    RESOURCES_TABLES,
    insert_source_with_license,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(
    not db_available(), reason="psycopg2/PostgreSQL non disponible"
)


@_skip_no_db_url
@_skip_no_psycopg2
class TestGlobalReadAndTenantScope:
    """Ressources globales en lecture ; lignes tenant strictement isolées."""

    def test_global_resource_is_visible_to_both_tenants(self, two_companies_resources):
        cid_a, cid_b = two_companies_resources
        slugs_a = {i.slug for i in catalog_service.list_catalog(company_id=cid_a, limit=200).items}
        slugs_b = {i.slug for i in catalog_service.list_catalog(company_id=cid_b, limit=200).items}
        assert GLOBAL_SLUG in slugs_a
        assert GLOBAL_SLUG in slugs_b

    def test_global_resource_detail_is_readable(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        detail = catalog_service.get_detail(company_id=cid_a, slug=GLOBAL_SLUG)
        assert detail.company_id is None  # ligne globale
        assert detail.primary_family == "industrial_gas"

    def test_tenant_resource_is_isolated_but_global_still_shared(self, two_companies_resources):
        cid_a, cid_b = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a,
            payload=ResourceCatalogCreate(slug="res-iso-a", name="Isolated A"),
        )
        slugs_a = {i.slug for i in catalog_service.list_catalog(company_id=cid_a, limit=200).items}
        slugs_b = {i.slug for i in catalog_service.list_catalog(company_id=cid_b, limit=200).items}
        assert "res-iso-a" in slugs_a
        assert "res-iso-a" not in slugs_b
        assert GLOBAL_SLUG in slugs_b  # le global reste partagé

    def test_unknown_slug_is_not_found(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        with pytest.raises(catalog_service.ResourceCatalogError, match="introuvable"):
            catalog_service.get_detail(company_id=cid_a, slug="res-does-not-exist")

    def test_family_filter(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a,
            payload=ResourceCatalogCreate(
                slug="res-wood", name="Wood", primary_family="biomass_fibre"
            ),
        )
        biomass = catalog_service.list_catalog(
            company_id=cid_a, family="biomass_fibre", limit=200
        )
        assert all(i.primary_family == "biomass_fibre" for i in biomass.items)
        assert any(i.slug == "res-wood" for i in biomass.items)


@_skip_no_db_url
@_skip_no_psycopg2
class TestCatalogSourceDiscipline:
    """Sourcé-ou-avoué : aucune ressource `verified` sans release."""

    def test_verified_without_source_is_rejected(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        with pytest.raises(catalog_service.ResourceCatalogError, match="requiert une release"):
            catalog_service.create_resource(
                company_id=cid_a,
                payload=ResourceCatalogCreate(
                    slug="res-verified-nosrc", name="No source", data_status="verified"
                ),
            )

    def test_verified_with_source_is_accepted(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        _, release_id = insert_source_with_license(cid_a, "RES-CAT-SRC")
        created = catalog_service.create_resource(
            company_id=cid_a,
            payload=ResourceCatalogCreate(
                slug="res-verified-ok", name="Sourced", data_status="verified",
                source_release_id=release_id,
            ),
        )
        assert created.data_status == "verified"
        assert created.source_release_id == release_id

    def test_duplicate_slug_rejected(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-dup", name="Dup")
        )
        with pytest.raises(catalog_service.ResourceCatalogError, match="déjà existante"):
            catalog_service.create_resource(
                company_id=cid_a, payload=ResourceCatalogCreate(slug="res-dup", name="Dup bis")
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestLegacyAliasBridge:
    """D-2 : les anciens material_id restent atteignables via un alias, jamais supprimés."""

    def test_legacy_material_id_resolves_to_resource(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-alias-host", name="Alias host")
        )
        catalog_service.create_alias(
            company_id=cid_a, slug="res-alias-host",
            payload=ResourceAliasCreate(alias_kind="legacy_material_id", alias_value="test-legacy-nd"),
        )
        found = catalog_service.find_by_legacy_material_id(
            company_id=cid_a, material_id="test-legacy-nd"
        )
        assert found is not None
        assert found.slug == "res-alias-host"

    def test_unknown_legacy_id_returns_none(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        assert catalog_service.find_by_legacy_material_id(
            company_id=cid_a, material_id="never-mapped"
        ) is None

    def test_aliases_listed_and_counted_in_detail(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-alias-count", name="AC")
        )
        catalog_service.create_alias(
            company_id=cid_a, slug="res-alias-count",
            payload=ResourceAliasCreate(alias_kind="cas", alias_value="7440-59-7"),
        )
        aliases = catalog_service.list_aliases(company_id=cid_a, slug="res-alias-count")
        assert aliases.total == 1
        assert aliases.items[0].alias_kind == "cas"
        detail = catalog_service.get_detail(company_id=cid_a, slug="res-alias-count")
        assert detail.aliases_count == 1

    def test_duplicate_alias_rejected(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-alias-dup", name="AD")
        )
        payload = ResourceAliasCreate(alias_kind="internal", alias_value="INT-1")
        catalog_service.create_alias(company_id=cid_a, slug="res-alias-dup", payload=payload)
        with pytest.raises(catalog_service.ResourceCatalogError, match="déjà rattaché"):
            catalog_service.create_alias(company_id=cid_a, slug="res-alias-dup", payload=payload)


@_skip_no_db_url
@_skip_no_psycopg2
class TestSectorUses:
    def test_sector_use_created_and_listed(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-uses-host", name="UH")
        )
        catalog_service.create_sector_use(
            company_id=cid_a, slug="res-uses-host",
            payload=ResourceSectorUseCreate(
                sector_code="semiconductors", use_label="Refroidissement & atmosphère inerte"
            ),
        )
        uses = catalog_service.list_sector_uses(company_id=cid_a, slug="res-uses-host")
        assert uses.total == 1
        assert uses.items[0].use_label == "Refroidissement & atmosphère inerte"

    def test_verified_sector_use_without_source_rejected(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-uses-src", name="US")
        )
        with pytest.raises(catalog_service.ResourceCatalogError, match="requiert une release"):
            catalog_service.create_sector_use(
                company_id=cid_a, slug="res-uses-src",
                payload=ResourceSectorUseCreate(use_label="Aérospatial", data_status="verified"),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestRlsAndDefenseInDepth:
    """RLS gen-2 posée ; en CI (superuser) elle est bypassée, donc le prédicat
    applicatif tient. Les deux sont vérifiés séparément (comme PR-07)."""

    def test_rls_is_enabled_and_forced_on_every_resource_table(self, resources_schema):
        with get_db() as conn:
            with conn.cursor() as cur:
                for table in RESOURCES_TABLES:
                    cur.execute(
                        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = %s",
                        (table,),
                    )
                    row = cur.fetchone()
                    assert row is not None, f"{table} absente"
                    assert row["relrowsecurity"], f"{table} sans ENABLE RLS"
                    assert row["relforcerowsecurity"], f"{table} sans FORCE RLS"

    def test_each_command_has_its_own_policy(self, resources_schema):
        with get_db() as conn:
            with conn.cursor() as cur:
                for table in RESOURCES_TABLES:
                    cur.execute(
                        "SELECT cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = %s",
                        (table,),
                    )
                    cmds = {r["cmd"] for r in cur.fetchall()}
                    assert "ALL" not in cmds, f"{table} utilise une policy ALL unique"
                    assert {"SELECT", "INSERT", "UPDATE", "DELETE"} <= cmds, f"{table}: {cmds}"

    def test_write_policies_never_allow_global_rows(self, resources_schema):
        """L'écriture ne doit JAMAIS accepter `company_id IS NULL` : un tenant ne
        crée pas de ligne globale (aucune écriture globale par un tenant)."""
        with get_db() as conn:
            with conn.cursor() as cur:
                for table in RESOURCES_TABLES:
                    cur.execute(
                        """
                        SELECT policyname, with_check FROM pg_policies
                        WHERE schemaname = 'public' AND tablename = %s
                          AND cmd IN ('INSERT', 'UPDATE') AND with_check IS NOT NULL
                        """,
                        (table,),
                    )
                    for row in cur.fetchall():
                        assert "company_id IS NULL" not in row["with_check"], (
                            f"{table}.{row['policyname']} autorise l'écriture d'une ligne globale"
                        )
