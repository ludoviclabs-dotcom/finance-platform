"""
test_intelligence_freshness.py — fraîcheur des sources + endpoints PR-04.

Trois couches :
  - Logique de fraîcheur (âge/péremption/licence) : PURE, toujours exécutée.
  - Service `freshness_service` sur la vue 029 : DB-gated (migration-tests).
  - API (auth/health) : assertions AGNOSTIQUES au mode (/tmp ou PostgreSQL) —
    gating d'auth (401/403) et structure publique de /health/intelligence, qui
    tiennent que la base soit configurée ou non. JWT mintés directement (comme
    test_intelligence_api.py) pour ne dépendre d'aucun utilisateur seedé.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest

from db.database import db_available, get_db
from services.auth_service import AuthUser, create_access_token
from services.intelligence import freshness_service
from services.intelligence.freshness_service import STALE_AFTER_DAYS, _to_freshness

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _view_row(**over) -> dict:
    row = {
        "source_id": 1, "company_id": None, "code": "SRC", "publisher": "Pub",
        "title": "Titre", "source_type": "file", "active": True,
        "automated_access_allowed": True, "storage_allowed": True,
        "commercial_use_allowed": False, "redistribution_allowed": False,
        "derived_use_allowed": True, "display_allowed": True, "attribution_text": "CC",
        "last_release_id": 10, "last_release_key": "2026-06-30",
        "last_release_status": "published",
        "last_release_at": datetime(2026, 6, 30, tzinfo=timezone.utc),
        "published_release_count": 1, "total_release_count": 1,
    }
    row.update(over)
    return row


# ── Logique de fraîcheur — pure ────────────────────────────────────────────

class TestFreshnessLogic:
    def test_recent_release_not_stale(self):
        now = datetime(2026, 7, 15, tzinfo=timezone.utc)  # 15 j après release
        fr = _to_freshness(_view_row(), now)
        assert fr.age_days == 15
        assert fr.is_stale is False
        assert fr.has_release is True
        assert fr.license_ok is True

    def test_old_release_is_stale(self):
        now = datetime(2026, 6, 30, tzinfo=timezone.utc)
        old = now.replace(year=2025)  # ~365 j
        fr = _to_freshness(_view_row(last_release_at=old), now)
        assert fr.age_days is not None and fr.age_days > STALE_AFTER_DAYS
        assert fr.is_stale is True

    def test_no_release_has_no_age_not_stale(self):
        now = datetime(2026, 7, 15, tzinfo=timezone.utc)
        fr = _to_freshness(
            _view_row(last_release_id=None, last_release_at=None, last_release_status=None,
                      published_release_count=0, total_release_count=0),
            now,
        )
        assert fr.has_release is False
        assert fr.age_days is None
        assert fr.is_stale is False

    def test_license_anomaly_when_storage_denied(self):
        now = datetime(2026, 7, 15, tzinfo=timezone.utc)
        fr = _to_freshness(_view_row(storage_allowed=False), now)
        assert fr.license_ok is False
        assert any("storage_allowed" in r for r in fr.license_reasons)

    def test_inactive_source_license_ko(self):
        now = datetime(2026, 7, 15, tzinfo=timezone.utc)
        fr = _to_freshness(_view_row(active=False), now)
        assert fr.license_ok is False


# ── freshness_service sur la vue 029 — DB-gated ────────────────────────────

@pytest.fixture(scope="module")
def demo_freshness(evidence_kernel_schema):
    """Importe la source démo globale, la nettoie en tear-down."""
    from services.intelligence.snapshot_migration import import_snapshot

    from .test_snapshot_migration import _cleanup_demo_globals, _MemStorage

    _cleanup_demo_globals()
    result = import_snapshot(publish=True, connection_factory=get_db, storage=_MemStorage())
    yield result
    _cleanup_demo_globals()


@_skip_no_db_url
@_skip_no_psycopg2
class TestFreshnessServiceDb:
    _NOW = datetime(2026, 7, 15, tzinfo=timezone.utc)

    def test_tenant_sees_global_demo_freshness(self, demo_freshness, two_companies):
        cid_a, _ = two_companies
        items, total = freshness_service.list_source_freshness(company_id=cid_a, limit=200, now=self._NOW)
        assert total >= 1
        demo = next((f for f in items if f.code == "CARBONCO_DEMO_SNAPSHOT"), None)
        assert demo is not None
        assert demo.company_id is None
        assert demo.has_release is True
        assert demo.last_release_status == "published"
        assert demo.license_ok is True

    def test_freshness_isolation_tenant_a_not_b(self, demo_freshness, two_companies):
        """Défense en profondeur : une source de B n'apparaît pas dans la
        fraîcheur vue par A (prédicat de périmètre explicite, tient même sous
        superuser CI qui bypasse la RLS)."""
        from ._intelligence_fixtures import insert_source, make_source

        cid_a, cid_b = two_companies
        with get_db(company_id=cid_b) as conn:
            insert_source(conn, make_source(cid_b, f"fresh-b-{cid_b}"))
        items_a, _ = freshness_service.list_source_freshness(company_id=cid_a, limit=500, now=self._NOW)
        assert all(not f.code.startswith(f"fresh-b-{cid_b}") for f in items_a)

    def test_get_out_of_scope_source_returns_none(self, demo_freshness, two_companies):
        cid_a, _ = two_companies
        assert freshness_service.get_source_freshness(
            company_id=cid_a, source_id=999_000_111, now=self._NOW
        ) is None

    def test_intelligence_health_lists_global_demo_only(self, demo_freshness):
        health = freshness_service.intelligence_health(now=self._NOW)
        assert health.source_count >= 1
        codes = {s.code for s in health.sources}
        assert "CARBONCO_DEMO_SNAPSHOT" in codes
        # aucune source tenant (company_id NULL uniquement) : le health public
        # ne remonte que du global — vérifié par l'absence d'un code tenant.
        assert all("fresh-b-" not in c for c in codes)


# ── API — auth/health, agnostique au mode ───────────────────────────────────

def _token(role: str = "admin", company_id: int = 4242) -> dict:
    user = AuthUser(email=f"pr04-{role}@test.local", role=role, company_id=company_id)
    token, _ = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


_PUBLIC_HEALTH_KEYS = {
    "status", "checked_at", "source_count", "stale_count",
    "license_anomaly_count", "sources", "db",
}
_PUBLIC_SOURCE_KEYS = {
    "code", "last_release_at", "age_days", "last_release_status", "is_stale", "license_ok",
}


class TestIntelligenceHealthEndpoint:
    def test_health_intelligence_200_and_public_shape(self, client):
        resp = client.get("/health/intelligence")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == _PUBLIC_HEALTH_KEYS
        assert body["status"] in ("ok", "degraded", "empty")
        # Aucun secret ni champ interne ne fuit dans les lignes publiques.
        for s in body["sources"]:
            assert set(s.keys()) <= _PUBLIC_SOURCE_KEYS


class TestReleaseTransitionAuth:
    def test_publish_requires_auth(self, client):
        assert client.post("/intelligence/releases/1/publish").status_code == 401

    def test_validate_requires_auth(self, client):
        assert client.post("/intelligence/releases/1/validate").status_code == 401

    def test_supersede_requires_auth(self, client):
        assert client.post("/intelligence/releases/1/supersede").status_code == 401

    def test_publish_forbidden_for_analyst(self, client):
        resp = client.post("/intelligence/releases/1/publish", headers=_token(role="analyst"))
        assert resp.status_code == 403  # require_admin

    def test_publish_admin_passes_auth_gate(self, client):
        """Admin franchit la gate d'auth : le code n'est jamais 401/403 (ensuite
        503 en mode /tmp faute de base, ou 404/200 en mode PostgreSQL)."""
        resp = client.post("/intelligence/releases/999999/publish", headers=_token(role="admin"))
        assert resp.status_code not in (401, 403)


class TestFreshnessEndpointAuth:
    def test_source_freshness_requires_auth(self, client):
        assert client.get("/intelligence/sources/1/freshness").status_code == 401
