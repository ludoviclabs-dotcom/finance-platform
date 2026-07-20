"""
test_water_schema_not_ready.py — protection « schéma pas encore migré »
(PR-08). DB-gated (job `migration-tests` UNIQUEMENT — inscrit dans
.github/workflows/api.yml, EN DERNIER : ce module RÉINITIALISE le schéma
public à un état pré-036 (reset + 001-035) — le placer avant un module qui
suppose 036/037 casserait ce module-là).

Scénario RÉEL de production : après le merge de PR-08, Vercel déploie le code
AVANT l'application des migrations 036/037 (036 exige une étape manuelle Neon,
requires_owner). Pendant cette fenêtre :
  * chaque route NEUVE (/water/*, /sites/geo, /sites/{id}/geocode-candidates)
    doit répondre 503 avec le détail contractuel `schema_not_ready` — JAMAIS
    une erreur SQL brute (UndefinedTable/UndefinedColumn) ni un 500 ;
  * les routes EXISTANTES (GET/POST /sites — schéma 027 déjà en production)
    continuent de fonctionner À L'IDENTIQUE.

Les fixtures de ce module contrôlent EXACTEMENT les migrations appliquées
(reset + apply_upto("035")) — c'est la seule façon honnête de simuler l'état.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from services.auth_service import AuthUser, create_access_token

from ._migration_fixtures import apply_ddl_inline, apply_upto, reset_public_schema

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]


@pytest.fixture(scope="module")
def pre036_company():
    """Schéma ARRÊTÉ à 035 (036/037 jamais appliquées) + une company de test."""
    with get_db() as conn:
        reset_public_schema(conn)
        apply_ddl_inline(conn)
        apply_upto(conn, "035")
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO companies (name, slug, plan)
                VALUES ('PRE036', 'water-pre036', 'starter')
                ON CONFLICT (slug) DO UPDATE SET updated_at = now()
                RETURNING id
                """
            )
            cid = cur.fetchone()["id"]
    yield cid
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM sites WHERE company_id = %s", (cid,))
            cur.execute("DELETE FROM companies WHERE id = %s", (cid,))


def _auth(company_id: int, role: str = "analyst") -> dict:
    user = AuthUser(
        email=f"pre036-{role}@test.local", role=role, company_id=company_id, user_id=5,
    )
    token, _ = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


class TestSchemaNotReady:
    def test_water_activities_503_schema_not_ready(self, client, pre036_company):
        resp = client.get("/water/activities", headers=_auth(pre036_company))
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"] == "schema_not_ready"

    def test_water_permits_503_schema_not_ready(self, client, pre036_company):
        resp = client.get("/water/permits", headers=_auth(pre036_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_water_risk_areas_503_schema_not_ready(self, client, pre036_company):
        resp = client.get("/water/risk-areas", headers=_auth(pre036_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_water_import_write_503_schema_not_ready(self, client, pre036_company):
        resp = client.post(
            "/water/activities/import",
            headers=_auth(pre036_company),
            json={"filename": "x.csv", "csv_text": "site_id,activity_type\n"},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_sites_geo_503_schema_not_ready(self, client, pre036_company):
        """UndefinedColumn (42703) : la table `sites` existe (027) mais pas ses
        colonnes géo — la garde couvre les DEUX SQLSTATE."""
        resp = client.get("/sites/geo", headers=_auth(pre036_company))
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"] == "schema_not_ready"

    def test_geocode_candidates_503_schema_not_ready(self, client, pre036_company):
        cid = pre036_company
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sites (company_id, name) VALUES (%s, 'Site pré-036') RETURNING id",
                    (cid,),
                )
                site_id = cur.fetchone()["id"]
        resp = client.get(
            f"/sites/{site_id}/geocode-candidates", headers=_auth(cid)
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_existing_sites_routes_keep_working(self, client, pre036_company):
        """Non-régression PENDANT la fenêtre : GET/POST /sites (027)
        fonctionnent normalement sans 036."""
        cid = pre036_company
        created = client.post(
            "/sites",
            headers=_auth(cid),
            json={"name": "Site fenêtre déploiement", "location": "Testville"},
        )
        assert created.status_code == 201, created.text
        listing = client.get("/sites", headers=_auth(cid))
        assert listing.status_code == 200
        assert any(s["name"] == "Site fenêtre déploiement" for s in listing.json()["sites"])
