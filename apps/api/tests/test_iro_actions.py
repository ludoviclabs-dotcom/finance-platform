"""
test_iro_actions.py — `iro_actions` (PR-10, migration 040). DB-gated (job
`migration-tests` UNIQUEMENT).

Couvre : CRUD calqué sur `mitigation_actions` (034)/`water_actions`
(037)/`nature_actions` (039) ; `expected_risk_reduction_pct` reste une
INTENTION déclarée (aucune fonction ne la soustrait d'un score — vérifié
négativement : aucune évaluation n'est modifiée par la création d'une
action) ; vocabulaire borné ; isolation tenant ; API.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.iro import FinancialAssessmentCreate, IroActionCreate
from services.auth_service import AuthUser, create_access_token
from services.iro import financial_assessment_service, iro_actions_service

from ._iro_fixtures import insert_iro

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _token_for(company_id: int, role: str = "analyst", user_id: int = 95) -> str:
    user = AuthUser(
        email=f"action-{role}-{company_id}@test.local", role=role, company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroActionsService:
    def test_create_and_list_action(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO avec action")
        action = iro_actions_service.create_action(
            company_id=cid_a, iro_id=iro_id,
            payload=IroActionCreate(
                action_type="mitigation", title="Diversifier la source d'eau",
                expected_risk_reduction_pct=30.0,
            ),
            created_by=9,
        )
        assert action.action_type == "mitigation"
        assert action.status == "planned"
        assert action.expected_risk_reduction_pct == 30.0

        listing = iro_actions_service.list_actions(company_id=cid_a, iro_id=iro_id)
        assert listing.total == 1
        assert listing.items[0].id == action.id

    def test_expected_risk_reduction_pct_never_auto_subtracted_from_a_score(self, two_companies_iro):
        """Intention déclarée : créer une action ne modifie AUCUNE composante
        d'une évaluation existante (même règle que 034/037/039)."""
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO action vs score")
        envelope = financial_assessment_service.create_financial_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=FinancialAssessmentCreate(
                likelihood=80, magnitude=80,
                transmission_chain=[{"step": 1, "mechanism": "m", "channel": "cost", "rationale": "r"}],
            ),
        )
        before = (envelope.data.likelihood, envelope.data.magnitude, envelope.data.threshold_crossed)

        iro_actions_service.create_action(
            company_id=cid_a, iro_id=iro_id,
            payload=IroActionCreate(
                action_type="mitigation", title="Action déclarée",
                expected_risk_reduction_pct=100.0,  # intention maximale
            ),
        )

        listing = financial_assessment_service.list_financial_assessments(company_id=cid_a, iro_id=iro_id)
        after = listing.items[0]
        assert (after.likelihood, after.magnitude, after.threshold_crossed) == before

    def test_list_filters_by_status(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO actions statuts")
        iro_actions_service.create_action(
            company_id=cid_a, iro_id=iro_id,
            payload=IroActionCreate(action_type="monitoring", title="A", status="planned"),
        )
        iro_actions_service.create_action(
            company_id=cid_a, iro_id=iro_id,
            payload=IroActionCreate(action_type="monitoring", title="B", status="completed"),
        )
        completed = iro_actions_service.list_actions(company_id=cid_a, iro_id=iro_id, status="completed")
        assert completed.total == 1
        assert completed.items[0].title == "B"

    def test_invalid_action_type_rejected_by_pydantic(self):
        with pytest.raises(Exception):
            IroActionCreate(action_type="not_a_type", title="X")

    def test_reduction_pct_out_of_range_rejected_by_pydantic(self):
        with pytest.raises(Exception):
            IroActionCreate(action_type="mitigation", title="X", expected_risk_reduction_pct=150.0)

    def test_create_on_unknown_iro_raises(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        with pytest.raises(iro_actions_service.IroActionError):
            iro_actions_service.create_action(
                company_id=cid_a, iro_id=999999999,
                payload=IroActionCreate(action_type="mitigation", title="X"),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroActionsIsolation:
    def test_tenant_a_cannot_create_action_on_tenant_b_iro(self, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_b, "IRO action privé B")
        with pytest.raises(iro_actions_service.IroActionError):
            iro_actions_service.create_action(
                company_id=cid_a, iro_id=iro_id,
                payload=IroActionCreate(action_type="mitigation", title="Fuite"),
            )

    def test_raw_sql_rls_blocks_cross_tenant_select(self, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO action RLS")
        iro_actions_service.create_action(
            company_id=cid_a, iro_id=iro_id,
            payload=IroActionCreate(action_type="mitigation", title="Privée"),
        )
        with get_db(company_id=cid_b) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM iro_actions WHERE iro_id = %s", (iro_id,))
                assert cur.fetchone() is None


@_skip_no_db_url
@_skip_no_psycopg2
class TestIroActionsApi:
    def test_create_action_requires_analyst(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API action")
        resp = client.post(
            f"/iro/iros/{iro_id}/actions", headers=_auth(_token_for(cid_a, role="viewer")),
            json={"action_type": "mitigation", "title": "Refusée"},
        )
        assert resp.status_code == 403

    def test_create_and_list_action_via_api(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API action 2")
        create_resp = client.post(
            f"/iro/iros/{iro_id}/actions", headers=_auth(_token_for(cid_a)),
            json={"action_type": "monitoring", "title": "Suivi trimestriel"},
        )
        assert create_resp.status_code == 201, create_resp.text

        list_resp = client.get(f"/iro/iros/{iro_id}/actions", headers=_auth(_token_for(cid_a, role="viewer")))
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] >= 1
