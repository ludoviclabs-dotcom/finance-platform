"""
test_nature_schema_not_ready.py — protection « schéma pas encore migré »
(PR-09). DB-gated (job `migration-tests` UNIQUEMENT — inscrit dans
.github/workflows/api.yml, EN DERNIER avec `test_water_schema_not_ready.py` :
ce module RÉINITIALISE le schéma public (deux bornes : pré-038 = reset +
001-037, pré-039 = reset + 001-038) — le placer avant un module qui suppose
038/039 casserait ce module-là. Les DEUX fichiers de reset (celui-ci et
`test_water_schema_not_ready.py`) partagent la même contrainte d'ordre ; ce
fichier est enregistré APRÈS `test_water_schema_not_ready.py` dans `api.yml`.

Scénario RÉEL de production : après le merge de PR-09, Vercel déploie le code
AVANT l'application des migrations 038/039 (le ledger applique dans l'ordre,
036 exige toujours une étape manuelle Neon en amont). Pendant CHACUNE des
deux fenêtres (pré-038, puis pré-039 une fois 038 posée) :
  * chaque route NEUVE (/nature/*) doit répondre 503 avec le détail
    contractuel `schema_not_ready` — JAMAIS une erreur SQL brute
    (UndefinedTable/UndefinedColumn) ni un 500 ;
  * les routes EXISTANTES (/water/*, /sites) continuent de fonctionner à
    l'identique (non-régression, déjà couverte par test_water_schema_not_ready.py
    — non répétée ici).

Les fixtures de ce module contrôlent EXACTEMENT les migrations appliquées
(reset + apply_upto("037") ou apply_upto("038")) — c'est la seule façon
honnête de simuler l'état."""

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
def pre038_company():
    """Schéma ARRÊTÉ à 037 (038 jamais appliquée) + une company de test."""
    with get_db() as conn:
        reset_public_schema(conn)
        apply_ddl_inline(conn)
        apply_upto(conn, "037")
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO companies (name, slug, plan)
                VALUES ('PRE038', 'nature-pre038', 'starter')
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
        email=f"pre038-{role}@test.local", role=role, company_id=company_id, user_id=5,
    )
    token, _ = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


class TestSchemaNotReady:
    def test_nature_features_503_schema_not_ready(self, client, pre038_company):
        resp = client.get("/nature/features", headers=_auth(pre038_company))
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_feature_geometry_503_schema_not_ready(self, client, pre038_company):
        resp = client.get(
            "/nature/features/1/geometry", headers=_auth(pre038_company, role="admin"),
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_dependencies_503_schema_not_ready(self, client, pre038_company):
        resp = client.get("/nature/dependencies", headers=_auth(pre038_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_impacts_503_schema_not_ready(self, client, pre038_company):
        resp = client.get("/nature/impacts", headers=_auth(pre038_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_leap_assessments_503_schema_not_ready(self, client, pre038_company):
        resp = client.get("/nature/leap-assessments", headers=_auth(pre038_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_leap_assessment_create_503_schema_not_ready(self, client, pre038_company):
        resp = client.post(
            "/nature/leap-assessments", headers=_auth(pre038_company), json={"label": "x"},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_locate_endpoint_503_schema_not_ready(self, client, pre038_company):
        cid = pre038_company
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sites (company_id, name) VALUES (%s, 'Site pré-038') RETURNING id",
                    (cid,),
                )
                site_id = cur.fetchone()["id"]
        resp = client.post(
            f"/nature/sites/{site_id}/locate", headers=_auth(cid), json={},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_existing_sites_routes_keep_working(self, client, pre038_company):
        """Non-régression PENDANT la fenêtre : GET/POST /sites (027) et les
        routes eau déjà migrées (036/037) fonctionnent normalement sans 038."""
        cid = pre038_company
        created = client.post(
            "/sites", headers=_auth(cid), json={"name": "Site fenêtre PR-09", "location": "Testville"},
        )
        assert created.status_code == 201, created.text
        listing = client.get("/sites", headers=_auth(cid))
        assert listing.status_code == 200
        assert any(s["name"] == "Site fenêtre PR-09" for s in listing.json()["sites"])


# ── Tranche B (039) : fenêtre 038 posée, 039 pas encore appliquée ──────────


@pytest.fixture(scope="module")
def pre039_company():
    """Schéma ARRÊTÉ à 038 (039 jamais appliquée) + une company de test.
    038 EST posée ici — les routes tranche A (features/dependencies/...)
    doivent fonctionner normalement, seules les routes tranche B (risks/
    opportunities/actions/disclosure-drafts) doivent répondre 503."""
    with get_db() as conn:
        reset_public_schema(conn)
        apply_ddl_inline(conn)
        apply_upto(conn, "038")
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO companies (name, slug, plan)
                VALUES ('PRE039', 'nature-pre039', 'starter')
                ON CONFLICT (slug) DO UPDATE SET updated_at = now()
                RETURNING id
                """
            )
            cid = cur.fetchone()["id"]
    yield cid
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM leap_assessments WHERE company_id = %s", (cid,))
            cur.execute("DELETE FROM sites WHERE company_id = %s", (cid,))
            cur.execute("DELETE FROM companies WHERE id = %s", (cid,))


class TestSchemaNotReadyTrancheB:
    def test_nature_risks_503_schema_not_ready(self, client, pre039_company):
        resp = client.get("/nature/risks", headers=_auth(pre039_company))
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"] == "schema_not_ready"

    def test_calculate_risk_503_schema_not_ready(self, client, pre039_company):
        resp = client.post(
            "/nature/risks/calculate", headers=_auth(pre039_company),
            json={"assessment_id": 1, "title": "x"},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_opportunities_503_schema_not_ready(self, client, pre039_company):
        resp = client.get("/nature/opportunities", headers=_auth(pre039_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_nature_actions_503_schema_not_ready(self, client, pre039_company):
        resp = client.get("/nature/actions", headers=_auth(pre039_company))
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_disclosure_drafts_503_schema_not_ready(self, client, pre039_company):
        resp = client.post(
            "/nature/disclosure-drafts", headers=_auth(pre039_company),
            json={"assessment_id": 1, "title": "x"},
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "schema_not_ready"

    def test_tranche_a_routes_keep_working_once_038_is_applied(self, client, pre039_company):
        """Non-régression : 038 EST posée dans cette fenêtre — features/
        dependencies/leap-assessments (tranche A) fonctionnent déjà
        normalement, seule la tranche B (039) manque encore."""
        cid = pre039_company
        created = client.post(
            "/nature/leap-assessments", headers=_auth(cid), json={"label": "Dossier fenêtre 039"},
        )
        assert created.status_code == 201, created.text
        listing = client.get("/nature/leap-assessments", headers=_auth(cid))
        assert listing.status_code == 200
