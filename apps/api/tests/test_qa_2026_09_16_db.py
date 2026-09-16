"""
test_qa_2026_09_16_db.py — DB-gated (job migration-tests, PostgreSQL réel).

Preuves du rapport QA du 16/09/2026 qui exigent une vraie base :
  - B-03 : un admin d'organisation ne voit ni ne gère une autre organisation ;
    l'administrateur de plateforme (PLATFORM_ADMIN_EMAILS) le peut ;
  - B-04 : un import est réellement persisté (plus de KeyError sur un
    RealDictCursor), versionné, cloisonné, visible de cache_status ;
  - M-11 : l'inbox de revue ne lève plus (statut enum casté) ;
  - m-02 : anti-rejeu TOTP en base (migration 044) ;
  - m-03 : le jeton rafraîchi conserve `uid` ;
  - B-07 : le cron évalue les règles de chaque organisation, une seule fois.

Pas de PostgreSQL local (contrainte du chantier) => prouvé en CI uniquement.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from db.database import db_available, get_db
from db.migration_probes import verify_object
from main import app
from services import auth_service, review_service, snapshot_cache, totp_service
from services.audit_service import log_event
from services.auth_service import AuthUser, _pwd_context

from ._migration_fixtures import apply_ddl_inline, apply_upto

pytestmark = pytest.mark.skipif(not db_available(), reason="PostgreSQL requis (DB-gated)")

CEILING = "044"
NEW_AUDIT_TYPES = ("2fa_disable", "admin_user_change", "admin_company_change")
SERVICE_TOKEN = "cron-service-token-qa-0123456789"
STRONG_PASSWORD = "Motdepasse-QA-2026!"


@pytest.fixture(scope="module")
def qa_schema():
    with get_db() as conn:
        with conn.cursor() as cur:
            # audit_events peut contenir des types ÉLARGIS laissés par un module
            # précédent : `apply_upto` rejoue la contrainte ÉTROITE de 011 (piège
            # documenté, cf. test_demo_seed) → purge avant reconstruction.
            cur.execute("SELECT to_regclass('public.audit_events') AS reg")
            if cur.fetchone()["reg"] is not None:
                cur.execute("SET session_replication_role = replica")
                cur.execute("DELETE FROM audit_events")
                cur.execute("SET session_replication_role = origin")
        apply_ddl_inline(conn)
        apply_upto(conn, CEILING)
    yield
    with get_db() as conn:
        with conn.cursor() as cur:
            # Les modules suivants rejouent des contraintes plus étroites.
            cur.execute("DELETE FROM audit_events WHERE event_type = ANY(%s)", (list(NEW_AUDIT_TYPES),))


def _token(user: dict) -> str:
    token, _ = auth_service.create_access_token(AuthUser(
        email=user["email"], role=user["role"], company_id=user["company_id"], user_id=user["id"],
    ))
    return token


def _auth(user: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user)}"}


@pytest.fixture()
def tenants(qa_schema):
    """Deux organisations, chacune avec un admin et un analyste."""
    suffix = uuid.uuid4().hex[:8]
    out: dict[str, dict] = {}
    company_ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for key in ("a", "b"):
                cur.execute(
                    "INSERT INTO companies (name, slug, plan) VALUES (%s, %s, 'starter') RETURNING id",
                    (f"QA {key.upper()} {suffix}", f"qa-{key}-{suffix}"),
                )
                cid = cur.fetchone()["id"]
                company_ids.append(cid)
                out[f"company_{key}"] = cid
                for role in ("admin", "analyst"):
                    email = f"{role}-{key}-{suffix}@qa.example.com"
                    cur.execute(
                        "INSERT INTO users (company_id, email, password_hash, role) "
                        "VALUES (%s, %s, %s, %s) RETURNING id",
                        (cid, email, _pwd_context.hash(STRONG_PASSWORD), role),
                    )
                    out[f"{role}_{key}"] = {
                        "id": cur.fetchone()["id"], "email": email, "role": role, "company_id": cid,
                    }
    yield out
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
            for table in ("alert_notifications", "alert_rules", "snapshots", "datapoint_reviews",
                          "audit_events"):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (company_ids,))
            cur.execute("DELETE FROM users WHERE company_id = ANY(%s)", (company_ids,))
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (company_ids,))
            cur.execute("SET session_replication_role = origin")


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def test_044_objects_are_present(qa_schema) -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            assert verify_object(cur, "044") is True


# ---------------------------------------------------------------------------
# B-03 — cloisonnement admin
# ---------------------------------------------------------------------------

class TestAdminTenantScoping:
    def test_org_admin_only_sees_its_organisation(self, client, tenants, monkeypatch) -> None:
        monkeypatch.delenv("PLATFORM_ADMIN_EMAILS", raising=False)
        admin_a = tenants["admin_a"]
        companies = client.get("/admin/companies", headers=_auth(admin_a)).json()
        assert [c["id"] for c in companies] == [tenants["company_a"]]
        users = client.get("/admin/users", headers=_auth(admin_a)).json()
        assert {u["company_id"] for u in users} == {tenants["company_a"]}
        assert client.get(f"/admin/users?company_id={tenants['company_b']}",
                          headers=_auth(admin_a)).status_code == 403
        assert client.get(f"/admin/companies/{tenants['company_b']}",
                          headers=_auth(admin_a)).status_code == 404

    def test_org_admin_cannot_touch_another_organisation(self, client, tenants, monkeypatch) -> None:
        monkeypatch.delenv("PLATFORM_ADMIN_EMAILS", raising=False)
        admin_a, analyst_b = tenants["admin_a"], tenants["analyst_b"]
        create_elsewhere = client.post("/admin/users", headers=_auth(admin_a), json={
            "company_id": tenants["company_b"], "email": f"x-{uuid.uuid4().hex[:6]}@qa.example.com",
            "password": STRONG_PASSWORD, "role": "admin",
        })
        assert create_elsewhere.status_code == 403
        assert client.patch(f"/admin/users/{analyst_b['id']}", headers=_auth(admin_a),
                            json={"role": "admin"}).status_code == 404
        assert client.delete(f"/admin/users/{analyst_b['id']}",
                             headers=_auth(admin_a)).status_code == 404
        assert client.post("/admin/companies", headers=_auth(admin_a), json={
            "name": "Pirate", "slug": f"pirate-{uuid.uuid4().hex[:6]}",
        }).status_code == 403
        assert client.delete(f"/admin/companies/{tenants['company_b']}",
                             headers=_auth(admin_a)).status_code == 403
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT role FROM users WHERE id = %s", (analyst_b["id"],))
                assert cur.fetchone()["role"] == "analyst"

    def test_org_admin_manages_its_own_users(self, client, tenants, monkeypatch) -> None:
        monkeypatch.delenv("PLATFORM_ADMIN_EMAILS", raising=False)
        admin_a = tenants["admin_a"]
        email = f"new-{uuid.uuid4().hex[:6]}@qa.example.com"
        weak = client.post("/admin/users", headers=_auth(admin_a),
                           json={"email": email, "password": "Admin2024!"})
        assert weak.status_code == 422
        created = client.post("/admin/users", headers=_auth(admin_a),
                              json={"email": email, "password": STRONG_PASSWORD})
        assert created.status_code == 201, created.text
        assert created.json()["company_id"] == tenants["company_a"]
        # Le dernier admin actif ne peut pas se rétrograder.
        demote = client.patch(f"/admin/users/{admin_a['id']}", headers=_auth(admin_a),
                              json={"role": "analyst"})
        assert demote.status_code == 409
        # Changer un plan reste un geste plateforme ; le nom, non.
        assert client.patch(f"/admin/companies/{tenants['company_a']}", headers=_auth(admin_a),
                            json={"plan": "enterprise"}).status_code == 403
        assert client.patch(f"/admin/companies/{tenants['company_a']}", headers=_auth(admin_a),
                            json={"name": "QA A renommée"}).status_code == 200
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT event_type FROM audit_events WHERE company_id = %s "
                    "AND event_type IN ('admin_user_change', 'admin_company_change')",
                    (tenants["company_a"],),
                )
                assert {r["event_type"] for r in cur.fetchall()} == {
                    "admin_user_change", "admin_company_change",
                }

    def test_password_change_revokes_sessions(self, client, tenants, monkeypatch) -> None:
        monkeypatch.delenv("PLATFORM_ADMIN_EMAILS", raising=False)
        analyst_a = tenants["analyst_a"]
        auth_service.create_refresh_token(AuthUser(
            email=analyst_a["email"], role="analyst", company_id=analyst_a["company_id"],
        ))
        resp = client.patch(f"/admin/users/{analyst_a['id']}", headers=_auth(tenants["admin_a"]),
                            json={"password": "Aaaaaaaaaaaa-1"})
        assert resp.status_code == 200
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) AS n FROM refresh_tokens WHERE user_id = %s AND NOT revoked",
                            (analyst_a["id"],))
                assert cur.fetchone()["n"] == 0

    def test_platform_admin_spans_organisations(self, client, tenants, monkeypatch) -> None:
        admin_a = tenants["admin_a"]
        monkeypatch.setenv("PLATFORM_ADMIN_EMAILS", admin_a["email"])
        users_b = client.get(f"/admin/users?company_id={tenants['company_b']}", headers=_auth(admin_a))
        assert users_b.status_code == 200
        assert {u["company_id"] for u in users_b.json()} == {tenants["company_b"]}
        ids = {c["id"] for c in client.get("/admin/companies", headers=_auth(admin_a)).json()}
        assert {tenants["company_a"], tenants["company_b"]} <= ids
        # …mais une adresse de plateforme ne peut pas être créée par un admin ordinaire.
        monkeypatch.setenv("PLATFORM_ADMIN_EMAILS", f"{admin_a['email']},root@qa.example.com")
        reserved = client.post("/admin/users", headers=_auth(tenants["admin_b"]),
                               json={"email": "root@qa.example.com", "password": STRONG_PASSWORD,
                                     "role": "admin"})
        assert reserved.status_code == 403


# ---------------------------------------------------------------------------
# B-04 — persistance des snapshots
# ---------------------------------------------------------------------------

class TestSnapshotPersistence:
    def test_write_read_version_and_isolation(self, tenants) -> None:
        a, b = tenants["company_a"], tenants["company_b"]
        first = snapshot_cache.write_snapshot("carbon", {"carbon": {"totalS123Tco2e": 1}},
                                              company_id=a, source="user_upload")
        second = snapshot_cache.write_snapshot("carbon", {"carbon": {"totalS123Tco2e": 2}},
                                               company_id=a, source="user_upload")
        assert first["id"] and second["version"] == first["version"] + 1
        assert snapshot_cache.read_snapshot("carbon", company_id=a)["carbon"]["totalS123Tco2e"] == 2
        assert snapshot_cache.read_snapshot("carbon", company_id=b) is None
        status = snapshot_cache.cache_status(company_id=a)
        assert status["carbon"]["exists"] is True and status["carbon"]["stale"] is False
        assert snapshot_cache.cache_status(company_id=b)["carbon"] == {"exists": False}
        history = snapshot_cache.read_snapshot_history("carbon", company_id=a)
        assert [h["version"] for h in history][:2] == [second["version"], first["version"]]
        snapshot_cache.invalidate("carbon", company_id=a)
        assert snapshot_cache.read_snapshot("carbon", company_id=a) is None

    def test_organisation_without_import_gets_no_demo_data(self, client, tenants) -> None:
        resp = client.get("/carbon/snapshot", headers=_auth(tenants["analyst_b"]))
        assert resp.status_code == 404
        assert resp.json()["detail"]["error"] == "no_snapshot"

    def test_history_is_scoped_to_the_token(self, client, tenants) -> None:
        snapshot_cache.write_snapshot("carbon", {"carbon": {}}, company_id=tenants["company_a"])
        own = client.get("/history/carbon", headers=_auth(tenants["analyst_a"])).json()
        other = client.get("/history/carbon", headers=_auth(tenants["analyst_b"])).json()
        assert own["available"] and len(own["entries"]) >= 1
        assert other["entries"] == []
        entry_id = own["entries"][0]["id"]
        assert client.get(f"/history/carbon/{entry_id}",
                          headers=_auth(tenants["analyst_b"])).status_code == 404


# ---------------------------------------------------------------------------
# M-11 — inbox de revue
# ---------------------------------------------------------------------------

def test_review_inbox_filters_on_enum_statuses(client, tenants) -> None:
    a = tenants["company_a"]
    with get_db(company_id=a) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO datapoint_reviews (company_id, fact_code, status) VALUES "
                "(%s, 'CC.GES.SCOPE1', 'proposed'), (%s, 'CC.GES.SCOPE3', 'frozen')",
                (a, a),
            )
    items = review_service.inbox(company_id=a)
    assert [i.fact_code for i in items] == ["CC.GES.SCOPE1"]
    resp = client.get("/reviews/inbox", headers=_auth(tenants["analyst_a"]))
    assert resp.status_code == 200, resp.text
    frozen = client.get("/reviews/inbox?statuses=frozen", headers=_auth(tenants["analyst_a"]))
    assert [i["fact_code"] for i in frozen.json()["items"]] == ["CC.GES.SCOPE3"]


# ---------------------------------------------------------------------------
# m-02 / m-03 / M-13 — authentification
# ---------------------------------------------------------------------------

def test_totp_step_can_only_be_claimed_once(qa_schema) -> None:
    email = f"totp-{uuid.uuid4().hex[:8]}@qa.example.com"
    assert totp_service._claim_step(email, 55_555) is True
    assert totp_service._claim_step(email, 55_555) is False
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_totp_used_steps WHERE user_email = %s", (email,))


def test_refreshed_token_keeps_uid(tenants) -> None:
    analyst = tenants["analyst_a"]
    with TestClient(app) as fresh:
        login = fresh.post("/auth/login", json={"email": analyst["email"], "password": STRONG_PASSWORD})
        assert login.status_code == 200, login.text
        refreshed = fresh.post("/auth/refresh")
        assert refreshed.status_code == 200, refreshed.text
        user = auth_service.decode_token(refreshed.json()["accessToken"])
        assert user is not None and user.user_id == analyst["id"]


def test_new_audit_types_are_accepted_after_044(tenants) -> None:
    log_event("2fa_disable", "2FA désactivée — test", user="qa@example.com",
              company_id=tenants["company_a"])
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM audit_events WHERE company_id = %s "
                        "AND event_type = '2fa_disable'", (tenants["company_a"],))
            assert cur.fetchone()["n"] == 1


# ---------------------------------------------------------------------------
# B-07 — évaluation des alertes par le cron
# ---------------------------------------------------------------------------

def test_cron_evaluates_each_organisation_once(client, tenants, monkeypatch) -> None:
    monkeypatch.setenv("CRON_SERVICE_TOKEN", SERVICE_TOKEN)
    rule = {"name": "Donnée manquante", "domain": "vsme", "field_path": "vsme.energieMwh",
            "operator": "eq", "mode": "missing"}
    ids = []
    for key in ("a", "b"):
        created = client.post("/alerts/rules", json=rule, headers=_auth(tenants[f"analyst_{key}"]))
        assert created.status_code == 201, created.text
        ids.append(created.json()["id"])
    first = client.post("/alerts/evaluate", headers={"Authorization": f"Bearer {SERVICE_TOKEN}"})
    assert first.status_code == 200, first.text
    fired = {a["rule_id"] for a in first.json()["alerts"]}
    assert set(ids) <= fired
    second = client.post("/alerts/evaluate", headers={"Authorization": f"Bearer {SERVICE_TOKEN}"})
    assert not (set(ids) & {a["rule_id"] for a in second.json()["alerts"]})
    # Un analyste n'évalue que sa propre organisation.
    own = client.post("/alerts/evaluate", headers=_auth(tenants["analyst_b"])).json()
    assert {a["rule_id"] for a in own["alerts"]} <= {ids[1]}
