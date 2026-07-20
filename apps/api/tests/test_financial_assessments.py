"""
test_financial_assessments.py — `financial_assessments` (PR-10, migration
040). DB-gated (job `migration-tests` UNIQUEMENT).

Couvre : `likelihood`/`magnitude` en DEUX colonnes séparées (jamais
multipliées) ; `transmission_chain` JAMAIS un chiffre unique — chaîne
structurée, non vide, chaque étape porte `channel`+`rationale` (Pydantic ET
CHECK SQL pour la non-vacuité) ; `primary_channel` dérivé du premier maillon ;
`threshold_crossed` INDICATIF ; isolation tenant ; réponse API sans champ
combiné.
"""

from __future__ import annotations

import os

import pytest
from pydantic import ValidationError

from db.database import db_available, get_db
from models.iro import FinancialAssessmentCreate, TransmissionStep
from services.auth_service import AuthUser, create_access_token
from services.iro import financial_assessment_service, iro_service

from ._iro_fixtures import insert_iro

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")

_ONE_STEP = [
    {"step": 1, "mechanism": "Hausse du coût de traitement de l'eau", "channel": "cost",
     "rationale": "Stress hydrique élevé signalé par le screening PR-08."},
]


def _token_for(company_id: int, role: str = "analyst", user_id: int = 93) -> str:
    user = AuthUser(
        email=f"fin-{role}-{company_id}@test.local", role=role, company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# PUR — validation Pydantic de la chaîne de transmission (aucune DB)
# ---------------------------------------------------------------------------

class TestTransmissionChainValidation:
    def test_empty_transmission_chain_is_rejected(self):
        with pytest.raises(ValidationError):
            FinancialAssessmentCreate(transmission_chain=[])

    def test_step_missing_channel_is_rejected(self):
        with pytest.raises(ValidationError):
            TransmissionStep(step=1, mechanism="x", rationale="y")  # channel manquant

    def test_step_missing_rationale_is_rejected(self):
        with pytest.raises(ValidationError):
            TransmissionStep(step=1, mechanism="x", channel="cost")  # rationale manquant

    def test_step_empty_rationale_is_rejected(self):
        with pytest.raises(ValidationError):
            TransmissionStep(step=1, mechanism="x", channel="cost", rationale="")

    def test_step_unknown_channel_is_rejected(self):
        with pytest.raises(ValidationError):
            TransmissionStep(step=1, mechanism="x", channel="not_a_channel", rationale="y")

    def test_valid_multi_step_chain_is_accepted(self):
        payload = FinancialAssessmentCreate(transmission_chain=[
            {"step": 1, "mechanism": "a", "channel": "cost", "rationale": "r1"},
            {"step": 2, "mechanism": "b", "channel": "asset_value", "rationale": "r2",
             "estimated_amount_eur": 15000.0},
        ])
        assert len(payload.transmission_chain) == 2
        assert payload.transmission_chain[1].estimated_amount_eur == 15000.0


# ---------------------------------------------------------------------------
# DB-gated
# ---------------------------------------------------------------------------

@_skip_no_db_url
@_skip_no_psycopg2
class TestFinancialAssessmentCreation:
    def test_create_stores_two_separate_columns_and_full_chain(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Financier stress hydrique")
        envelope = financial_assessment_service.create_financial_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=FinancialAssessmentCreate(
                likelihood=70, magnitude=80, confidence=50, transmission_chain=_ONE_STEP,
            ),
        )
        row = envelope.data
        assert (row.likelihood, row.magnitude) == (70, 80)  # jamais multipliés
        assert row.primary_channel == "cost"
        assert len(row.transmission_chain) == 1
        assert row.transmission_chain[0].channel == "cost"
        assert row.threshold_crossed is True

    def test_primary_channel_derived_from_first_step_by_step_order(self, two_companies_iro):
        """`primary_channel` suit le PREMIER maillon par ordre de `step`, pas
        l'ordre d'apparition dans la requête."""
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Financier multi-étapes")
        out_of_order = [
            {"step": 2, "mechanism": "b", "channel": "asset_value", "rationale": "r2"},
            {"step": 1, "mechanism": "a", "channel": "revenue", "rationale": "r1"},
        ]
        envelope = financial_assessment_service.create_financial_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=FinancialAssessmentCreate(transmission_chain=out_of_order),
        )
        assert envelope.data.primary_channel == "revenue"
        assert [s.step for s in envelope.data.transmission_chain] == [1, 2]

    def test_threshold_crossed_false_when_below_threshold(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Financier faible")
        envelope = financial_assessment_service.create_financial_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=FinancialAssessmentCreate(likelihood=10, magnitude=20, transmission_chain=_ONE_STEP),
        )
        assert envelope.data.threshold_crossed is False

    def test_create_advances_iro_status_to_assessed(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO financier à évaluer", status="candidate")
        financial_assessment_service.create_financial_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=FinancialAssessmentCreate(transmission_chain=_ONE_STEP),
        )
        assert iro_service.get_iro(company_id=cid_a, iro_id=iro_id).status == "assessed"

    def test_db_check_rejects_empty_transmission_chain_via_raw_sql(self, two_companies_iro):
        """Défense en profondeur : même en contournant Pydantic, le CHECK SQL
        `financial_assessments_transmission_chain_check` refuse un tableau vide."""
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Financier CHECK direct")
        with pytest.raises(Exception, match="financial_assessments_transmission_chain_check"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO financial_assessments (company_id, iro_id, transmission_chain) "
                        "VALUES (%s, %s, '[]'::jsonb)",
                        (cid_a, iro_id),
                    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestFinancialAssessmentIsolation:
    def test_tenant_a_cannot_assess_tenant_b_iro(self, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_b, "IRO financier privé B")
        with pytest.raises(iro_service.IroError):
            financial_assessment_service.create_financial_assessment(
                company_id=cid_a, iro_id=iro_id,
                payload=FinancialAssessmentCreate(transmission_chain=_ONE_STEP),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestFinancialAssessmentApi:
    def test_post_financial_assessment_requires_analyst(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API financier")
        resp = client.post(
            f"/iro/iros/{iro_id}/financial-assessment", headers=_auth(_token_for(cid_a, role="viewer")),
            json={"transmission_chain": _ONE_STEP},
        )
        assert resp.status_code == 403

    def test_post_financial_assessment_rejects_empty_chain_with_422(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API financier vide")
        resp = client.post(
            f"/iro/iros/{iro_id}/financial-assessment", headers=_auth(_token_for(cid_a)),
            json={"transmission_chain": []},
        )
        assert resp.status_code == 422

    def test_post_financial_assessment_envelope_shape(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API financier 2")
        resp = client.post(
            f"/iro/iros/{iro_id}/financial-assessment", headers=_auth(_token_for(cid_a)),
            json={"likelihood": 70, "magnitude": 75, "transmission_chain": _ONE_STEP},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert set(body.keys()) == {"data", "meta", "evidence"}
        assert body["data"]["primary_channel"] == "cost"
        assert len(body["data"]["transmission_chain"]) == 1
        assert body["meta"]["method"]["code"] == "CC-IRO-FINANCIAL"
