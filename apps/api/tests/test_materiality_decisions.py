"""
test_materiality_decisions.py — `materiality_decisions` (PR-10, migration
040). DB-gated (job `migration-tests` UNIQUEMENT).

Couvre le cœur non négociable de la PR (plan §6) : décision HUMAINE
obligatoire (`decided_by` jamais nul), refusée sans évaluation préalable
(motif `article24_service.review()`), APPEND-ONLY (une redécision INSÈRE,
n'écrase jamais — prouvé par une tentative directe d'UPDATE/DELETE SQL,
refusée par le trigger `trg_materiality_decisions_guard`), `POST .../decide`
réservé à `require_admin` (jamais `require_analyst` seul), et chaque décision
auditée via `audit_service.log_event`.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.iro import MaterialityDecisionCreate
from services import audit_service
from services.auth_service import AuthUser, create_access_token
from services.iro import iro_service, materiality_decision_service

from ._iro_fixtures import insert_financial_assessment, insert_iro

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _token_for(company_id: int, role: str = "admin", user_id: int = 94) -> str:
    user = AuthUser(
        email=f"decide-{role}-{company_id}@test.local", role=role, company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@_skip_no_db_url
@_skip_no_psycopg2
class TestMaterialityDecisionGate:
    def test_decide_without_decided_by_raises(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO sans décideur")
        insert_financial_assessment(cid_a, iro_id)
        with pytest.raises(materiality_decision_service.MaterialityDecisionError, match="decided_by"):
            materiality_decision_service.decide(
                company_id=cid_a, iro_id=iro_id,
                payload=MaterialityDecisionCreate(is_material=True, basis="financial", justification="J"),
                decided_by=None,
            )

    def test_decide_without_any_assessment_is_refused(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO jamais évalué")
        with pytest.raises(materiality_decision_service.MaterialityDecisionError, match="évaluation"):
            materiality_decision_service.decide(
                company_id=cid_a, iro_id=iro_id,
                payload=MaterialityDecisionCreate(is_material=True, basis="financial", justification="J"),
                decided_by=42,
            )

    def test_decide_with_at_least_one_assessment_succeeds(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO évalué")
        insert_financial_assessment(cid_a, iro_id)
        decision = materiality_decision_service.decide(
            company_id=cid_a, iro_id=iro_id,
            payload=MaterialityDecisionCreate(is_material=True, basis="financial", justification="Motif clair"),
            decided_by=42,
        )
        assert decision.decided_by == 42
        assert decision.is_material is True
        assert decision.basis == "financial"
        assert decision.supersedes_id is None
        assert iro_service.get_iro(company_id=cid_a, iro_id=iro_id).status == "decided"

    def test_empty_justification_rejected_by_pydantic(self):
        with pytest.raises(Exception):
            MaterialityDecisionCreate(is_material=True, basis="financial", justification="")

    def test_invalid_basis_rejected_by_pydantic(self):
        with pytest.raises(Exception):
            MaterialityDecisionCreate(is_material=True, basis="both_and_more", justification="J")


@_skip_no_db_url
@_skip_no_psycopg2
class TestMaterialityDecisionAppendOnly:
    def test_redecision_inserts_a_new_row_with_supersedes_id(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO redécidé")
        insert_financial_assessment(cid_a, iro_id)
        first = materiality_decision_service.decide(
            company_id=cid_a, iro_id=iro_id,
            payload=MaterialityDecisionCreate(is_material=False, basis="financial", justification="Pas matériel"),
            decided_by=1,
        )
        second = materiality_decision_service.decide(
            company_id=cid_a, iro_id=iro_id,
            payload=MaterialityDecisionCreate(is_material=True, basis="both", justification="Nouvelle analyse"),
            decided_by=2,
        )
        assert second.id != first.id
        assert second.supersedes_id == first.id

        history = materiality_decision_service.list_decisions(company_id=cid_a, iro_id=iro_id)
        assert history.total == 2
        assert history.items[0].id == second.id  # le plus récent en tête
        # L'ancienne décision reste INTACTE — jamais réécrite.
        original_reloaded = next(d for d in history.items if d.id == first.id)
        assert original_reloaded.is_material is False
        assert original_reloaded.justification == "Pas matériel"

    def test_raw_update_on_a_decision_is_refused(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO immuable update")
        insert_financial_assessment(cid_a, iro_id)
        decision = materiality_decision_service.decide(
            company_id=cid_a, iro_id=iro_id,
            payload=MaterialityDecisionCreate(is_material=True, basis="financial", justification="J"),
            decided_by=1,
        )
        with pytest.raises(Exception, match="materiality_decisions"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE materiality_decisions SET is_material = false WHERE id = %s", (decision.id,),
                    )

    def test_raw_delete_on_a_decision_is_refused(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO immuable delete")
        insert_financial_assessment(cid_a, iro_id)
        decision = materiality_decision_service.decide(
            company_id=cid_a, iro_id=iro_id,
            payload=MaterialityDecisionCreate(is_material=True, basis="financial", justification="J"),
            decided_by=1,
        )
        with pytest.raises(Exception, match="materiality_decisions"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM materiality_decisions WHERE id = %s", (decision.id,))


@_skip_no_db_url
@_skip_no_psycopg2
class TestMaterialityDecisionAudit:
    def test_decide_logs_an_audit_event(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO audité")
        insert_financial_assessment(cid_a, iro_id)
        materiality_decision_service.decide(
            company_id=cid_a, iro_id=iro_id,
            payload=MaterialityDecisionCreate(is_material=True, basis="financial", justification="Audité"),
            decided_by=77,
        )
        events = audit_service.get_events(limit=50, event_type="materiality_decision", company_id=cid_a)
        assert any(f"IRO #{iro_id}" in e.get("title", "") for e in events)


@_skip_no_db_url
@_skip_no_psycopg2
class TestMaterialityDecisionApi:
    def test_decide_requires_admin_not_analyst(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API décision refus")
        insert_financial_assessment(cid_a, iro_id)
        resp = client.post(
            f"/iro/iros/{iro_id}/decide", headers=_auth(_token_for(cid_a, role="analyst")),
            json={"is_material": True, "basis": "financial", "justification": "Tentative analyst"},
        )
        assert resp.status_code == 403

    def test_decide_succeeds_for_admin(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API décision admin")
        insert_financial_assessment(cid_a, iro_id)
        resp = client.post(
            f"/iro/iros/{iro_id}/decide", headers=_auth(_token_for(cid_a, role="admin")),
            json={"is_material": True, "basis": "financial", "justification": "Décision admin"},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["is_material"] is True
        assert body["decided_by"] is not None

    def test_decide_without_prior_assessment_returns_400(self, client, two_companies_iro):
        # `http_error()` route lexicale (routers/_errors.py) : le message
        # métier contient "requise" ("évaluation ... est requise") -> 400,
        # pas 409 (conflit) ni 404 (introuvable).
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API sans évaluation")
        resp = client.post(
            f"/iro/iros/{iro_id}/decide", headers=_auth(_token_for(cid_a, role="admin")),
            json={"is_material": True, "basis": "financial", "justification": "Sans évaluation"},
        )
        assert resp.status_code == 400

    def test_get_decisions_history_via_api(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API historique")
        insert_financial_assessment(cid_a, iro_id)
        client.post(
            f"/iro/iros/{iro_id}/decide", headers=_auth(_token_for(cid_a, role="admin")),
            json={"is_material": False, "basis": "financial", "justification": "Premier passage"},
        )
        client.post(
            f"/iro/iros/{iro_id}/decide", headers=_auth(_token_for(cid_a, role="admin")),
            json={"is_material": True, "basis": "both", "justification": "Deuxième passage"},
        )
        resp = client.get(f"/iro/iros/{iro_id}/decisions", headers=_auth(_token_for(cid_a, role="viewer")))
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert body["items"][0]["supersedes_id"] == body["items"][1]["id"]
