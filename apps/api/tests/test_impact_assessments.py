"""
test_impact_assessments.py — `impact_assessments` (PR-10, migration 040).
DB-gated (job `migration-tests` UNIQUEMENT).

Couvre : composantes scale/scope/irremediability/likelihood en QUATRE
colonnes séparées (jamais fusionnées) ; `threshold_crossed` INDICATIF calculé
par une règle OR transparente, jamais une décision ; `is_actual=true` refuse
`likelihood` (service ET CHECK SQL, défense en profondeur) ; `time_horizon`
borné à short/medium/long ; progression `iros.status` vers `assessed` ;
isolation tenant ; réponse API sans champ combiné.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.iro import ImpactAssessmentCreate
from services.auth_service import AuthUser, create_access_token
from services.iro import impact_assessment_service, iro_service

from ._iro_fixtures import insert_iro

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _token_for(company_id: int, role: str = "analyst", user_id: int = 92) -> str:
    user = AuthUser(
        email=f"impact-{role}-{company_id}@test.local", role=role, company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@_skip_no_db_url
@_skip_no_psycopg2
class TestImpactAssessmentCreation:
    def test_create_stores_four_separate_severity_columns(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Impact biodiversité")
        envelope = impact_assessment_service.create_impact_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=ImpactAssessmentCreate(
                polarity="negative", scale=80, scope=70, irremediability=90, likelihood=40, confidence=60,
            ),
            prepared_by=5,
        )
        row = envelope.data
        # QUATRE colonnes distinctes, jamais combinées.
        assert (row.scale, row.scope, row.irremediability, row.likelihood) == (80, 70, 90, 40)
        assert row.confidence == 60
        assert row.threshold_crossed is True  # scale/scope/irremediability >= 66
        assert {c.code for c in row.components} == {"scale", "scope", "irremediability", "likelihood"}

    def test_threshold_crossed_false_when_all_severity_below_threshold(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Impact mineur")
        envelope = impact_assessment_service.create_impact_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=ImpactAssessmentCreate(polarity="negative", scale=10, scope=20, irremediability=5),
        )
        assert envelope.data.threshold_crossed is False

    def test_missing_components_are_excluded_not_zero(self, two_companies_iro):
        """Une composante non renseignée est EXCLUE de la règle OR, jamais
        comptée comme sous le seuil par défaut (available=False)."""
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Impact partiel")
        envelope = impact_assessment_service.create_impact_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=ImpactAssessmentCreate(polarity="negative", scale=90),
        )
        by_code = {c.code: c for c in envelope.data.components}
        assert by_code["scale"].available is True
        assert by_code["scope"].available is False
        assert by_code["irremediability"].available is False
        assert envelope.data.threshold_crossed is True  # scale seul suffit

    def test_actual_impact_rejects_a_likelihood_value(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Impact avéré")
        with pytest.raises(impact_assessment_service.ImpactAssessmentError):
            impact_assessment_service.create_impact_assessment(
                company_id=cid_a, iro_id=iro_id,
                payload=ImpactAssessmentCreate(polarity="negative", is_actual=True, likelihood=50),
            )

    def test_actual_impact_without_likelihood_is_accepted(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Impact avéré propre")
        envelope = impact_assessment_service.create_impact_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=ImpactAssessmentCreate(polarity="negative", is_actual=True, scale=50),
        )
        assert envelope.data.is_actual is True
        assert envelope.data.likelihood is None

    def test_db_check_rejects_actual_impact_with_likelihood_via_raw_sql(self, two_companies_iro):
        """Défense en profondeur : même en contournant le service, le CHECK
        SQL `impact_assessments_likelihood_actual_check` refuse la ligne."""
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Impact CHECK direct")
        with pytest.raises(Exception, match="impact_assessments_likelihood_actual_check"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO impact_assessments (company_id, iro_id, polarity, is_actual, likelihood) "
                        "VALUES (%s, %s, 'negative', true, 50)",
                        (cid_a, iro_id),
                    )

    def test_invalid_time_horizon_rejected_by_pydantic(self):
        with pytest.raises(Exception):
            ImpactAssessmentCreate(polarity="negative", time_horizon="very_long")

    def test_db_check_rejects_invalid_time_horizon_via_raw_sql(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "Horizon invalide")
        with pytest.raises(Exception, match="impact_assessments_time_horizon_check"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO impact_assessments (company_id, iro_id, polarity, time_horizon) "
                        "VALUES (%s, %s, 'negative', 'very_long')",
                        (cid_a, iro_id),
                    )

    def test_create_advances_iro_status_to_assessed(self, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO à évaluer", status="candidate")
        impact_assessment_service.create_impact_assessment(
            company_id=cid_a, iro_id=iro_id,
            payload=ImpactAssessmentCreate(polarity="negative", scale=10),
        )
        assert iro_service.get_iro(company_id=cid_a, iro_id=iro_id).status == "assessed"

    def test_create_on_unknown_iro_raises(self, two_companies_iro):
        # `assert_iro_in_scope` (iro_service) lève AVANT toute écriture — même
        # garde-fou que le reste des services enfants (motif `_assert_in_scope`
        # de `services/nature/actions_service.py`).
        cid_a, _ = two_companies_iro
        with pytest.raises(iro_service.IroError):
            impact_assessment_service.create_impact_assessment(
                company_id=cid_a, iro_id=999999999,
                payload=ImpactAssessmentCreate(polarity="negative", scale=10),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestImpactAssessmentIsolation:
    def test_tenant_a_cannot_assess_tenant_b_iro(self, two_companies_iro):
        cid_a, cid_b = two_companies_iro
        iro_id = insert_iro(cid_b, "IRO privé B")
        with pytest.raises(iro_service.IroError):
            impact_assessment_service.create_impact_assessment(
                company_id=cid_a, iro_id=iro_id,
                payload=ImpactAssessmentCreate(polarity="negative", scale=10),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestImpactAssessmentApi:
    def test_post_impact_assessment_requires_analyst(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API impact")
        resp = client.post(
            f"/iro/iros/{iro_id}/impact-assessment", headers=_auth(_token_for(cid_a, role="viewer")),
            json={"polarity": "negative", "scale": 80},
        )
        assert resp.status_code == 403

    def test_post_impact_assessment_envelope_shape(self, client, two_companies_iro):
        cid_a, _ = two_companies_iro
        iro_id = insert_iro(cid_a, "IRO API impact 2")
        resp = client.post(
            f"/iro/iros/{iro_id}/impact-assessment", headers=_auth(_token_for(cid_a)),
            json={"polarity": "negative", "scale": 80, "scope": 20, "confidence": 55},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert set(body.keys()) == {"data", "meta", "evidence"}
        assert body["data"]["scale"] == 80
        assert body["data"]["scope"] == 20
        assert body["meta"]["method"]["code"] == "CC-IRO-IMPACT"
        assert body["meta"]["quality"]["confidence"] == 55
