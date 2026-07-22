"""
test_resources_regulatory.py — Module 2, statuts réglementaires + API de lecture
(PR-M2A). DB-gated (job `migration-tests` UNIQUEMENT).

Couvre : statut NON EXCLUSIF (plusieurs régimes coexistent, aucun booléen),
source obligatoire pour `confirmed`, isolation tenant, filtre par régime, et le
flux API de lecture (catalogue / fiche / réglementation / usages, 404 sans fuite,
401 sans auth).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available
from models.resources import ResourceCatalogCreate, ResourceRegulatoryStatusCreate
from services.auth_service import AuthUser, create_access_token
from services.resources import catalog_service, regulatory_service

from ._resources_fixtures import GLOBAL_SLUG, insert_source_with_license

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(
    not db_available(), reason="psycopg2/PostgreSQL non disponible"
)


def _token_for(company_id: int, role: str = "analyst", user_id: int = 77) -> str:
    user = AuthUser(
        email=f"res-{role}-{company_id}@test.local", role=role,
        company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@_skip_no_db_url
@_skip_no_psycopg2
class TestRegulatoryStatusNonExclusive:
    """Le statut est une LISTE de régimes, jamais un booléen : critique CRMA ET
    dans le périmètre EUDR peuvent coexister."""

    def test_resource_can_hold_multiple_regimes_simultaneously(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-multi", name="RM")
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-multi",
            payload=ResourceRegulatoryStatusCreate(
                regime="crma", regulation_ref="Reg (UE) 2024/1252",
                list_or_annex="Annexe II — Critique", listing_status="listed",
            ),
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-multi",
            payload=ResourceRegulatoryStatusCreate(
                regime="eudr", regulation_ref="Reg (UE) 2023/1115", listing_status="in_scope",
            ),
        )
        statuses = regulatory_service.list_statuses(company_id=cid_a, slug="res-reg-multi")
        regimes = {s.regime for s in statuses.items}
        assert {"crma", "eudr"} <= regimes  # les deux coexistent — non exclusif

    def test_regime_filter(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-filter", name="RF")
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-filter",
            payload=ResourceRegulatoryStatusCreate(regime="crma", listing_status="not_listed"),
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-filter",
            payload=ResourceRegulatoryStatusCreate(regime="reach", listing_status="in_force"),
        )
        only_crma = regulatory_service.list_statuses(
            company_id=cid_a, slug="res-reg-filter", regime="crma"
        )
        assert only_crma.total == 1
        assert only_crma.items[0].regime == "crma"

    def test_counted_in_catalog_detail(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-count", name="RC")
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-count",
            payload=ResourceRegulatoryStatusCreate(regime="clp", listing_status="in_force"),
        )
        detail = catalog_service.get_detail(company_id=cid_a, slug="res-reg-count")
        assert detail.regulations_count == 1


@_skip_no_db_url
@_skip_no_psycopg2
class TestRegulatorySourceDiscipline:
    """Aucune classification `confirmed` sans release (garde service + CHECK SQL)."""

    def test_confirmed_without_source_is_rejected(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-nosrc", name="RN")
        )
        with pytest.raises(regulatory_service.ResourceRegulatoryError, match="requiert une release"):
            regulatory_service.create_status(
                company_id=cid_a, slug="res-reg-nosrc",
                payload=ResourceRegulatoryStatusCreate(
                    regime="crma", listing_status="listed", certainty="confirmed",
                ),
            )

    def test_probable_without_source_is_allowed(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-prob", name="RP")
        )
        created = regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-prob",
            payload=ResourceRegulatoryStatusCreate(
                regime="crma", listing_status="listed", certainty="probable",
            ),
        )
        assert created.certainty == "probable"
        assert created.source_release_id is None

    def test_confirmed_with_source_is_accepted(self, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-ok", name="RO")
        )
        _, release_id = insert_source_with_license(cid_a, "RES-REG-SRC")
        created = regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-ok",
            payload=ResourceRegulatoryStatusCreate(
                regime="crma", regulation_ref="Reg (UE) 2024/1252", list_or_annex="Annexe I + II",
                listing_status="listed", certainty="confirmed", source_release_id=release_id,
            ),
        )
        assert created.certainty == "confirmed"
        assert created.source_release_id == release_id

    def test_statuses_are_tenant_isolated(self, two_companies_resources):
        cid_a, cid_b = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-reg-iso", name="RI")
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-reg-iso",
            payload=ResourceRegulatoryStatusCreate(regime="euratom", listing_status="in_force"),
        )
        # Le tenant B ne voit pas la ressource tenant de A → résolution 404.
        with pytest.raises(catalog_service.ResourceCatalogError, match="introuvable"):
            regulatory_service.list_statuses(company_id=cid_b, slug="res-reg-iso")


@_skip_no_db_url
@_skip_no_psycopg2
class TestApiReadEndpoints:
    """Flux API de lecture (get_current_user, pagination {items,total,limit,offset})."""

    def test_catalog_requires_auth(self, client, two_companies_resources):
        assert client.get("/resources/catalog").status_code in (401, 403)

    def test_catalog_lists_global_resource(self, client, two_companies_resources):
        cid_a, _ = two_companies_resources
        resp = client.get("/resources/catalog?limit=200", headers=_auth(_token_for(cid_a)))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert set(body) == {"items", "total", "limit", "offset"}
        assert any(i["slug"] == GLOBAL_SLUG for i in body["items"])

    def test_catalog_detail_and_children_endpoints(self, client, two_companies_resources):
        cid_a, _ = two_companies_resources
        catalog_service.create_resource(
            company_id=cid_a, payload=ResourceCatalogCreate(slug="res-api-host", name="API host")
        )
        regulatory_service.create_status(
            company_id=cid_a, slug="res-api-host",
            payload=ResourceRegulatoryStatusCreate(regime="crma", listing_status="listed"),
        )
        headers = _auth(_token_for(cid_a))
        detail = client.get("/resources/catalog/res-api-host", headers=headers)
        assert detail.status_code == 200, detail.text
        assert detail.json()["regulations_count"] == 1
        regs = client.get("/resources/catalog/res-api-host/regulations", headers=headers)
        assert regs.status_code == 200
        assert regs.json()["items"][0]["regime"] == "crma"
        aliases = client.get("/resources/catalog/res-api-host/aliases", headers=headers)
        assert aliases.status_code == 200
        uses = client.get("/resources/catalog/res-api-host/uses", headers=headers)
        assert uses.status_code == 200

    def test_unknown_slug_returns_404_without_leak(self, client, two_companies_resources):
        cid_a, _ = two_companies_resources
        resp = client.get("/resources/catalog/res-nope", headers=_auth(_token_for(cid_a)))
        assert resp.status_code == 404
        assert "introuvable" in resp.json()["detail"]
