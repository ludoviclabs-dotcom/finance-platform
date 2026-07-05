"""Tests T2.1 — pièces justificatives par datapoint.

Couvre (sans DB) :
  - evidence_guard : détection de type par magic bytes, taille, vide
  - evidence_service.active_evidence : reconstruction attach/revoke (fonction pure)

Le flux complet attach/list/revoke (DB + stockage) est testé sous
skipif(DATABASE_URL absent) — vert sans Neon en CI.
"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from services import evidence_service
from services.storage import evidence_key
from utils.evidence_guard import MAX_EVIDENCE_BYTES, check_evidence_bytes

# ── Fixtures de contenu (magic bytes réels) ──────────────────────────────────
PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPG = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 16


# ── evidence_guard ───────────────────────────────────────────────────────────

class TestEvidenceGuard:
    def test_accepts_pdf(self) -> None:
        assert check_evidence_bytes(PDF, "doc.pdf") == ("pdf", "application/pdf")

    def test_accepts_png(self) -> None:
        assert check_evidence_bytes(PNG, "img.png") == ("png", "image/png")

    def test_accepts_jpeg(self) -> None:
        assert check_evidence_bytes(JPG, "photo.jpg") == ("jpg", "image/jpeg")

    def test_detection_ignores_extension(self) -> None:
        # Un PDF déguisé en .png reste détecté comme PDF (on ne fait pas confiance au nom).
        assert check_evidence_bytes(PDF, "fake.png")[0] == "pdf"

    def test_rejects_empty(self) -> None:
        with pytest.raises(HTTPException) as exc:
            check_evidence_bytes(b"", "vide.pdf")
        assert exc.value.status_code == 400

    def test_rejects_unknown_type(self) -> None:
        with pytest.raises(HTTPException) as exc:
            check_evidence_bytes(b"GIF89a-not-allowed", "anim.gif")
        assert exc.value.status_code == 400

    def test_rejects_oversize(self) -> None:
        big = PDF + b"\x00" * (MAX_EVIDENCE_BYTES + 1)
        with pytest.raises(HTTPException) as exc:
            check_evidence_bytes(big, "gros.pdf")
        assert exc.value.status_code == 413


# ── active_evidence (reconstruction pure) ────────────────────────────────────

def _attach_event(eid: int, when: datetime, sha: str, filename: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=eid,
        computed_at=when,
        hash_self=f"hash{eid}",
        meta={
            "kind": evidence_service.EVIDENCE_ATTACH,
            "target_fact_id": 1,
            "evidence": {"sha256": sha, "filename": filename, "size": 10, "storage_key": f"k/{sha}"},
        },
    )


def _revoke_event(eid: int, when: datetime, sha: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=eid,
        computed_at=when,
        hash_self=f"hash{eid}",
        meta={"kind": evidence_service.EVIDENCE_REVOKE, "target_sha256": sha},
    )


class TestActiveEvidence:
    def test_empty(self) -> None:
        assert evidence_service.active_evidence([]) == []

    def test_single_attach(self) -> None:
        t0 = datetime(2026, 6, 13, tzinfo=timezone.utc)
        pieces = evidence_service.active_evidence([_attach_event(1, t0, "a" * 64, "a.pdf")])
        assert len(pieces) == 1
        assert pieces[0]["sha256"] == "a" * 64
        assert pieces[0]["event_id"] == 1

    def test_attach_then_revoke_removes(self) -> None:
        t0 = datetime(2026, 6, 13, tzinfo=timezone.utc)
        events = [
            _attach_event(1, t0, "a" * 64, "a.pdf"),
            _attach_event(2, t0 + timedelta(minutes=1), "b" * 64, "b.png"),
            _revoke_event(3, t0 + timedelta(minutes=2), "a" * 64),
        ]
        pieces = evidence_service.active_evidence(events)
        shas = {p["sha256"] for p in pieces}
        assert shas == {"b" * 64}

    def test_order_independent(self) -> None:
        # Même résultat quel que soit l'ordre d'arrivée (tri chronologique interne).
        t0 = datetime(2026, 6, 13, tzinfo=timezone.utc)
        events = [
            _revoke_event(3, t0 + timedelta(minutes=2), "a" * 64),
            _attach_event(1, t0, "a" * 64, "a.pdf"),
            _attach_event(2, t0 + timedelta(minutes=1), "b" * 64, "b.png"),
        ]
        pieces = evidence_service.active_evidence(events)
        assert {p["sha256"] for p in pieces} == {"b" * 64}


# ── list_evidence : URL de téléchargement proxy (remplace signed_url) ───────

class TestListEvidenceDownloadUrl:
    def test_default_template_targets_facts_route(self, monkeypatch) -> None:
        t0 = datetime(2026, 6, 13, tzinfo=timezone.utc)
        events = [_attach_event(1, t0, "a" * 64, "a.pdf")]
        monkeypatch.setattr(evidence_service.facts_service, "get_trail", lambda **kw: events)

        pieces = evidence_service.list_evidence(company_id=1, code="carbon.scope1Tco2e")
        assert pieces[0]["url"] == f"/facts/carbon.scope1Tco2e/evidence/{'a' * 64}/download"

    def test_custom_template_for_auditor_route(self, monkeypatch) -> None:
        t0 = datetime(2026, 6, 13, tzinfo=timezone.utc)
        events = [_attach_event(1, t0, "a" * 64, "a.pdf")]
        monkeypatch.setattr(evidence_service.facts_service, "get_trail", lambda **kw: events)

        pieces = evidence_service.list_evidence(
            company_id=1,
            code="carbon.scope1Tco2e",
            url_template="/auditor/public/tok123/evidence/carbon.scope1Tco2e/{sha256}/download",
        )
        assert pieces[0]["url"] == f"/auditor/public/tok123/evidence/carbon.scope1Tco2e/{'a' * 64}/download"

    def test_sign_false_omits_url(self, monkeypatch) -> None:
        t0 = datetime(2026, 6, 13, tzinfo=timezone.utc)
        events = [_attach_event(1, t0, "a" * 64, "a.pdf")]
        monkeypatch.setattr(evidence_service.facts_service, "get_trail", lambda **kw: events)

        pieces = evidence_service.list_evidence(company_id=1, code="carbon.scope1Tco2e", sign=False)
        assert "url" not in pieces[0]


# ── get_evidence_file : anti-IDOR (coeur de la protection) ──────────────────

class TestGetEvidenceFile:
    """Remplace signed_url() : lit le fichier serveur-side, jamais un lien direct.

    La storage_key fait foi sur la company propriétaire — même si le filtre
    amont (list_evidence/get_trail) laissait passer une pièce par erreur, la
    vérification sur la storage_key doit à elle seule bloquer l'accès."""

    SHA = "a" * 64

    def _piece(self, company_id: int, fact_id: int = 5, sha: str | None = None) -> dict:
        sha = sha or self.SHA
        return {
            "sha256": sha,
            "filename": "f.pdf",
            "size": 10,
            "content_type": "application/pdf",
            "storage_key": evidence_key(company_id, fact_id, sha, "pdf"),
        }

    def test_happy_path_streams_bytes_and_content_type(self, monkeypatch) -> None:
        piece = self._piece(company_id=1)
        monkeypatch.setattr(evidence_service, "list_evidence", lambda **kw: [piece])
        storage = MagicMock()
        storage.get.return_value = b"pdf-bytes"
        monkeypatch.setattr(evidence_service, "get_storage", lambda: storage)

        data, content_type = evidence_service.get_evidence_file(
            company_id=1, code="carbon.scope1Tco2e", sha256=self.SHA,
        )
        assert data == b"pdf-bytes"
        assert content_type == "application/pdf"
        storage.get.assert_called_once_with(piece["storage_key"])

    def test_unknown_sha_not_found(self, monkeypatch) -> None:
        monkeypatch.setattr(evidence_service, "list_evidence", lambda **kw: [self._piece(company_id=1)])
        with pytest.raises(evidence_service.EvidenceError):
            evidence_service.get_evidence_file(company_id=1, code="carbon.scope1Tco2e", sha256="b" * 64)

    def test_cross_company_not_visible_upstream(self, monkeypatch) -> None:
        # get_trail est filtré par company_id : demander depuis une AUTRE company
        # ne retrouve simplement aucune pièce active — 1re barrière.
        monkeypatch.setattr(evidence_service, "list_evidence", lambda **kw: [])
        with pytest.raises(evidence_service.EvidenceError):
            evidence_service.get_evidence_file(company_id=2, code="carbon.scope1Tco2e", sha256=self.SHA)

    def test_storage_key_mismatch_blocked_even_if_upstream_filter_fails(self, monkeypatch) -> None:
        # Garde-fou indépendant (2e barrière) : la pièce "fuit" par hypothèse
        # d'un bug amont, mais sa storage_key pointe vers une AUTRE company —
        # get_evidence_file() doit refuser malgré tout, et NE JAMAIS toucher
        # au storage (storage.get ne doit pas être appelé).
        piece = self._piece(company_id=999)
        monkeypatch.setattr(evidence_service, "list_evidence", lambda **kw: [piece])
        storage = MagicMock()
        monkeypatch.setattr(evidence_service, "get_storage", lambda: storage)

        with pytest.raises(evidence_service.EvidenceError):
            evidence_service.get_evidence_file(company_id=1, code="carbon.scope1Tco2e", sha256=self.SHA)
        storage.get.assert_not_called()

    def test_falls_back_to_extension_mime_when_content_type_missing(self, monkeypatch) -> None:
        piece = self._piece(company_id=1)
        piece["content_type"] = None
        monkeypatch.setattr(evidence_service, "list_evidence", lambda **kw: [piece])
        storage = MagicMock()
        storage.get.return_value = b"x"
        monkeypatch.setattr(evidence_service, "get_storage", lambda: storage)

        _, content_type = evidence_service.get_evidence_file(
            company_id=1, code="carbon.scope1Tco2e", sha256=self.SHA,
        )
        assert content_type == "application/pdf"  # dérivé de filename="f.pdf"


# ── /facts/{code}/evidence/{sha256}/download — garde HTTP (sans DB) ─────────

class TestDownloadEvidenceRouteGuards:
    def test_requires_auth(self, client) -> None:
        r = client.get(f"/facts/carbon.scope1Tco2e/evidence/{'a' * 64}/download")
        assert r.status_code in (401, 403)


# ── Flux complet (DB + stockage) — nécessite Neon ────────────────────────────

@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestEvidenceRoundtrip:
    def test_attach_list_revoke(self, tmp_path) -> None:
        os.environ["STORAGE_BACKEND"] = "local"
        os.environ["STORAGE_LOCAL_PATH"] = str(tmp_path)
        from services import facts_service

        company_id = 99123
        code = "carbon.scope1Tco2e"
        facts_service.emit_fact(
            company_id=company_id, code=code, value=1234.5, unit="tCO2e",
            source_path="upload:test", ef_id=None,
        )
        sha = hashlib.sha256(PDF).hexdigest()
        res = evidence_service.attach_evidence(
            company_id=company_id, code=code, data=PDF, filename="f.pdf",
            ext="pdf", content_type="application/pdf", uploaded_by="t@e.fr",
        )
        assert res["sha256"] == sha
        active = evidence_service.list_evidence(company_id=company_id, code=code, sign=False)
        assert any(p["sha256"] == sha for p in active)
        evidence_service.revoke_evidence(
            company_id=company_id, code=code, sha256=sha, revoked_by="t@e.fr",
        )
        active2 = evidence_service.list_evidence(company_id=company_id, code=code, sign=False)
        assert not any(p["sha256"] == sha for p in active2)
        assert facts_service.verify_chain(company_id).ok

    def test_download_blocks_cross_company_and_404s_after_revoke(self, tmp_path) -> None:
        """get_evidence_file() bout à bout, avec une vraie DB (RLS incluse) :
        la company A lit sa propre pièce, la company B n'y a jamais accès
        (IDOR), et la pièce révoquée redevient introuvable pour tout le monde."""
        os.environ["STORAGE_BACKEND"] = "local"
        os.environ["STORAGE_LOCAL_PATH"] = str(tmp_path)
        from services import facts_service

        company_a, company_b = 99125, 99126
        code = "carbon.scope1Tco2e"
        facts_service.emit_fact(
            company_id=company_a, code=code, value=42.0, unit="tCO2e",
            source_path="upload:test", ef_id=None,
        )
        sha = hashlib.sha256(PDF).hexdigest()
        evidence_service.attach_evidence(
            company_id=company_a, code=code, data=PDF, filename="f.pdf",
            ext="pdf", content_type="application/pdf", uploaded_by="a@e.fr",
        )

        data, content_type = evidence_service.get_evidence_file(
            company_id=company_a, code=code, sha256=sha,
        )
        assert data == PDF
        assert content_type == "application/pdf"

        with pytest.raises(evidence_service.EvidenceError):
            evidence_service.get_evidence_file(company_id=company_b, code=code, sha256=sha)

        evidence_service.revoke_evidence(
            company_id=company_a, code=code, sha256=sha, revoked_by="a@e.fr",
        )
        with pytest.raises(evidence_service.EvidenceError):
            evidence_service.get_evidence_file(company_id=company_a, code=code, sha256=sha)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestDownloadEvidenceRouteRoundtrip:
    """Bout en bout HTTP (les deux contextes d'auth) — nécessite une vraie DB
    pour dépasser la garde `db_available()` sur les routeurs facts.py."""

    def test_facts_route_happy_path(self, tmp_path, client, analyst_token) -> None:
        os.environ["STORAGE_BACKEND"] = "local"
        os.environ["STORAGE_LOCAL_PATH"] = str(tmp_path)
        from services import facts_service

        code = "carbon.scope1Tco2e"
        facts_service.emit_fact(
            company_id=1, code=code, value=1.0, unit="tCO2e",
            source_path="upload:test", ef_id=None,
        )
        sha = hashlib.sha256(PDF).hexdigest()
        evidence_service.attach_evidence(
            company_id=1, code=code, data=PDF, filename="f.pdf",
            ext="pdf", content_type="application/pdf", uploaded_by="a@e.fr",
        )

        r = client.get(
            f"/facts/{code}/evidence/{sha}/download",
            headers={"Authorization": f"Bearer {analyst_token}"},
        )
        assert r.status_code == 200
        assert r.content == PDF
        assert r.headers["content-type"] == "application/pdf"

    def test_auditor_route_happy_path_and_unknown_token_404(self, tmp_path, client, admin_token) -> None:
        os.environ["STORAGE_BACKEND"] = "local"
        os.environ["STORAGE_LOCAL_PATH"] = str(tmp_path)
        from services import auditor_service, facts_service

        code = "carbon.scope1Tco2e"
        facts_service.emit_fact(
            company_id=1, code=code, value=1.0, unit="tCO2e",
            source_path="upload:test", ef_id=None,
        )
        sha = hashlib.sha256(PDF).hexdigest()
        evidence_service.attach_evidence(
            company_id=1, code=code, data=PDF, filename="f.pdf",
            ext="pdf", content_type="application/pdf", uploaded_by="a@e.fr",
        )
        invite = auditor_service.create_invite(company_id=1, created_by="admin@e.fr")

        r = client.get(f"/auditor/public/{invite['token']}/evidence/{code}/{sha}/download")
        assert r.status_code == 200
        assert r.content == PDF

        r404 = client.get(f"/auditor/public/{'0' * 64}/evidence/{code}/{sha}/download")
        assert r404.status_code == 404


class TestStorageKeyPersistence:
    """Revue Codex : storage_key = valeur RENVOYÉE par put() (URL Blob en prod),
    pas la clé relative pré-upload — sinon get()/signed_url() échouent en vercel-blob."""

    def test_stores_put_return_value(self) -> None:
        from unittest.mock import MagicMock, patch

        from services import facts_service

        target = SimpleNamespace(id=5, value=1.0, unit="t", ef_id=None)
        blob_url = "https://store.public.blob.vercel-storage.com/org/1/evidence/5/x.pdf"
        storage = MagicMock()
        storage.put.return_value = blob_url
        event = SimpleNamespace(id=10, hash_self="h")

        with patch.object(evidence_service, "_latest_fact", return_value=target), \
             patch.object(evidence_service, "get_storage", return_value=storage), \
             patch.object(facts_service, "emit_fact", return_value=event):
            res = evidence_service.attach_evidence(
                company_id=1, code="carbon.scope1Tco2e", data=PDF,
                filename="f.pdf", ext="pdf", content_type="application/pdf",
                uploaded_by="u@e.fr",
            )
        assert res["storage_key"] == blob_url
        # put() reçoit la clé relative validée (pas l'URL)
        assert storage.put.call_args.args[0].startswith("org/1/evidence/5/")
