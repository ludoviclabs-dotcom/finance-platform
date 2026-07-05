"""Tests T2.2 — rôle « Auditeur invité ».

Sans DB (mode /tmp en CI) :
  - invite_status : active / revoked / expired (fonction pure)
  - endpoints publics → 404 si token non résolu (pas de DB)
  - require_admin protège la création
  - write-protection : aucun endpoint d'écriture sous /auditor/public

Le flux complet (create → resolve → access → revoke) est sous skipif(DATABASE_URL).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from services import auditor_service

client = TestClient(app)


# ── invite_status (pur) ──────────────────────────────────────────────────────

class TestInviteStatus:
    def test_active(self) -> None:
        inv = {"expires_at": datetime.now(tz=timezone.utc) + timedelta(days=10), "revoked_at": None}
        assert auditor_service.invite_status(inv) == "active"

    def test_revoked(self) -> None:
        inv = {"expires_at": datetime.now(tz=timezone.utc) + timedelta(days=10),
               "revoked_at": datetime.now(tz=timezone.utc)}
        assert auditor_service.invite_status(inv) == "revoked"

    def test_expired(self) -> None:
        inv = {"expires_at": datetime.now(tz=timezone.utc) - timedelta(days=1), "revoked_at": None}
        assert auditor_service.invite_status(inv) == "expired"


# ── Endpoints publics : token non résolu → 404 (mode /tmp) ───────────────────

class TestPublicNoDb:
    def test_view_unknown_token_404(self) -> None:
        r = client.get("/auditor/public/" + "0" * 64)
        assert r.status_code == 404

    def test_trail_unknown_token_404(self) -> None:
        r = client.get("/auditor/public/" + "0" * 64 + "/trail/carbon.scope1Tco2e")
        assert r.status_code == 404

    def test_evidence_download_unknown_token_404(self) -> None:
        r = client.get(
            "/auditor/public/" + "0" * 64 + "/evidence/carbon.scope1Tco2e/" + "a" * 64 + "/download"
        )
        assert r.status_code == 404

    def test_evidence_download_rejects_malformed_sha256(self) -> None:
        # Validé avant toute résolution de token — 400 même avec un token bidon.
        r = client.get(
            "/auditor/public/" + "0" * 64 + "/evidence/carbon.scope1Tco2e/not-a-sha256/download"
        )
        assert r.status_code == 400


# ── Garde admin ──────────────────────────────────────────────────────────────

class TestAdminGuard:
    def test_create_requires_auth(self) -> None:
        r = client.post("/auditor/invite", json={"email": "a@b.fr"})
        assert r.status_code in (401, 403)

    def test_list_requires_auth(self) -> None:
        r = client.get("/auditor/invites")
        assert r.status_code in (401, 403)


# ── Write-protection : /auditor/public est GET-only ──────────────────────────

class TestNoWriteSurface:
    def test_public_routes_are_read_only(self) -> None:
        write_methods = {"POST", "PUT", "PATCH", "DELETE"}
        for route in app.routes:
            path = getattr(route, "path", "")
            methods = getattr(route, "methods", set()) or set()
            if path.startswith("/auditor/public"):
                assert not (methods & write_methods), f"{path} expose une écriture : {methods}"


# ── Flux complet (DB requise) ────────────────────────────────────────────────

@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestAuditorRoundtrip:
    def test_create_resolve_revoke(self) -> None:
        company_id = 99124
        inv = auditor_service.create_invite(
            company_id=company_id, email="auditor@cabinet.fr", created_by="admin@e.fr",
        )
        token = inv["token"]
        assert len(token) == 64

        resolved = auditor_service.resolve_invite(token)
        assert resolved is not None
        assert auditor_service.invite_status(resolved) == "active"

        auditor_service.record_access(token=token, company_id=company_id, source="test")

        assert auditor_service.revoke_invite(company_id=company_id, token=token) is True
        resolved2 = auditor_service.resolve_invite(token)
        assert auditor_service.invite_status(resolved2) == "revoked"
