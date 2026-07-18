"""
test_intelligence_api.py — API HTTP /intelligence/* : auth requise,
permissions analyst/viewer, pagination, isolation tenant de bout en bout,
absence de fuite d'existence cross-tenant (404, jamais 403), filtres
observations. PR-03, DB-gated (utilise le `client` TestClient de conftest.py).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from services.auth_service import AuthUser, create_access_token

from ._intelligence_fixtures import insert_source, make_source

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _token_for(company_id: int, role: str = "analyst") -> str:
    """Émet un JWT directement (sans passer par /auth/login) pour un tenant
    synthétique — permet de tester l'isolation entre deux `company_id`
    arbitraires sans dépendre des utilisateurs démo (tous dans 'carbonco')."""
    user = AuthUser(email=f"ek-{role}-{company_id}@test.local", role=role, company_id=company_id)
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@_skip_no_db_url
@_skip_no_psycopg2
class TestIntelligenceApiAuthAndPermissions:
    def test_list_sources_requires_auth(self, client):
        resp = client.get("/intelligence/sources")
        assert resp.status_code == 401

    def test_list_sources_with_valid_token_ok(self, client, two_companies):
        cid_a, _ = two_companies
        resp = client.get("/intelligence/sources", headers=_auth(_token_for(cid_a)))
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body and "total" in body

    def test_create_source_requires_analyst_not_viewer(self, client, two_companies):
        cid_a, _ = two_companies
        resp = client.post(
            "/intelligence/sources",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={"code": f"api-perm-{cid_a}", "publisher": "P", "title": "T", "source_type": "manual"},
        )
        assert resp.status_code == 403

    def test_create_source_as_analyst_succeeds(self, client, two_companies):
        cid_a, _ = two_companies
        resp = client.post(
            "/intelligence/sources",
            headers=_auth(_token_for(cid_a, role="analyst")),
            json={"code": f"api-create-{cid_a}", "publisher": "P", "title": "T", "source_type": "manual"},
        )
        assert resp.status_code == 201
        assert resp.json()["code"] == f"api-create-{cid_a}"

    def test_create_observation_requires_analyst(self, client, two_companies):
        cid_a, _ = two_companies
        resp = client.post(
            "/intelligence/observations",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={
                "subject_type": "material", "subject_key": "X", "metric_code": "m",
                "numeric_value": 1.0, "source_release_id": 1, "data_status": "estimated",
            },
        )
        assert resp.status_code == 403


@_skip_no_db_url
@_skip_no_psycopg2
class TestIntelligenceApiPaginationAndFilters:
    def test_sources_list_respects_limit(self, client, two_companies):
        cid_a, _ = two_companies
        token = _token_for(cid_a)
        for i in range(3):
            client.post(
                "/intelligence/sources", headers=_auth(token),
                json={"code": f"page-{cid_a}-{i}", "publisher": "P", "title": "T", "source_type": "manual"},
            )
        resp = client.get(
            "/intelligence/sources", headers=_auth(token), params={"limit": 2, "offset": 0},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) <= 2
        assert body["limit"] == 2

    def test_observations_filter_by_subject_key(self, client, two_companies):
        cid_a, _ = two_companies
        token = _token_for(cid_a)
        source = client.post(
            "/intelligence/sources", headers=_auth(token),
            json={
                "code": f"api-obs-src-{cid_a}", "publisher": "P", "title": "T", "source_type": "manual",
                "automated_access_allowed": True, "storage_allowed": True,
            },
        ).json()
        release = client.post(
            f"/intelligence/sources/{source['id']}/releases", headers=_auth(token),
            json={"release_key": "v1", "checksum_sha256": "a" * 64},
        ).json()
        client.post(
            "/intelligence/observations", headers=_auth(token),
            json={
                "subject_type": "material", "subject_key": "REE-NdFeB-API", "metric_code": "price",
                "numeric_value": 1.0, "source_release_id": release["id"], "data_status": "estimated",
            },
        )
        resp = client.get(
            "/intelligence/observations", headers=_auth(token), params={"subject_key": "REE-NdFeB-API"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert all(o["subject_key"] == "REE-NdFeB-API" for o in body["items"])


@_skip_no_db_url
@_skip_no_psycopg2
class TestIntelligenceApiTenantIsolation:
    def test_source_created_by_a_not_visible_to_b_404_not_403(self, client, two_companies):
        cid_a, cid_b = two_companies
        created = client.post(
            "/intelligence/sources", headers=_auth(_token_for(cid_a)),
            json={"code": f"iso-{cid_a}", "publisher": "P", "title": "T", "source_type": "manual"},
        ).json()

        resp_b = client.get(f"/intelligence/sources/{created['id']}", headers=_auth(_token_for(cid_b)))
        assert resp_b.status_code == 404  # jamais 403 — pas de fuite d'existence cross-tenant

    def test_release_created_by_a_not_visible_to_b(self, client, two_companies):
        cid_a, cid_b = two_companies
        token_a = _token_for(cid_a)
        source = client.post(
            "/intelligence/sources", headers=_auth(token_a),
            json={"code": f"iso-rel-{cid_a}", "publisher": "P", "title": "T", "source_type": "manual"},
        ).json()
        release = client.post(
            f"/intelligence/sources/{source['id']}/releases", headers=_auth(token_a),
            json={"release_key": "v1", "checksum_sha256": "b" * 64},
        ).json()

        resp_b = client.get(f"/intelligence/releases/{release['id']}", headers=_auth(_token_for(cid_b)))
        assert resp_b.status_code == 404

    def test_global_source_visible_to_both_tenants(self, client, two_companies):
        """Une source globale (company_id NULL, posée via rls_bypass — geste
        admin hors API dans PR-03) doit rester lisible par n'importe quel
        tenant authentifié."""
        cid_a, cid_b = two_companies
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SET app.rls_bypass = 'on'")
            global_id = insert_source(conn, make_source(None, f"api-global-{cid_a}-{cid_b}", company_id=None))

        for cid in (cid_a, cid_b):
            resp = client.get(f"/intelligence/sources/{global_id}", headers=_auth(_token_for(cid)))
            assert resp.status_code == 200, f"source globale invisible pour company_id={cid}"

    def test_observation_created_by_a_not_visible_to_b(self, client, two_companies):
        cid_a, cid_b = two_companies
        token_a = _token_for(cid_a)
        source = client.post(
            "/intelligence/sources", headers=_auth(token_a),
            json={
                "code": f"iso-obs-src-{cid_a}", "publisher": "P", "title": "T", "source_type": "manual",
                "automated_access_allowed": True, "storage_allowed": True,
            },
        ).json()
        release = client.post(
            f"/intelligence/sources/{source['id']}/releases", headers=_auth(token_a),
            json={"release_key": "v1", "checksum_sha256": "c" * 64},
        ).json()
        observation = client.post(
            "/intelligence/observations", headers=_auth(token_a),
            json={
                "subject_type": "material", "subject_key": "SECRET-A", "metric_code": "m",
                "numeric_value": 1.0, "source_release_id": release["id"], "data_status": "estimated",
            },
        ).json()

        resp_b = client.get(
            f"/intelligence/observations/{observation['id']}", headers=_auth(_token_for(cid_b)),
        )
        assert resp_b.status_code == 404
