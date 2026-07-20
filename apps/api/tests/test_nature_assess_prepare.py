"""
test_nature_assess_prepare.py — risques, opportunités, actions et brouillons
TNFD (PR-09 tranche B, migration 039). DB-gated (job `migration-tests`
UNIQUEMENT — inscrit dans .github/workflows/api.yml).

Couvre : migration 039 applicable après 038 ; RLS + défense en profondeur
(isolation tenant sur les 4 tables) ; scoring risque/opportunité (composantes
inspectables, `risk_score`/`likelihood`/`confidence` TROIS colonnes
indépendantes, jamais un score fabriqué sur donnée absente) ; gate de revue ;
actions (ancrage obligatoire, intention jamais appliquée automatiquement) ;
brouillons TNFD (toujours `is_official_tnfd_disclosure=False`, verrouillé en
base) ; progression LEAP jusqu'à `completed` (039 débloque `prepare`) ; API
(auth, pagination, 404 sans fuite).
"""

from __future__ import annotations

import itertools
import os

import pytest

from db.database import db_available, get_db
from models.nature import (
    LeapAssessmentCreate,
    NatureActionCreate,
    NatureDependencyCreate,
    NatureImpactCreate,
    OpportunityCalculateRequest,
    RiskCalculateRequest,
    TnfdDisclosureDraftCreate,
)
from services.auth_service import AuthUser, create_access_token
from services.nature import (
    actions_service,
    dependencies_service,
    disclosure_service,
    impacts_service,
    leap_service,
    opportunity_service,
    risk_service,
)

from ._nature_fixtures import insert_site

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
    ),
    pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible"),
]


def _token_for(company_id: int, role: str = "analyst", user_id: int = 88) -> str:
    user = AuthUser(
        email=f"nature-assess-{role}-{company_id}@test.local", role=role,
        company_id=company_id, user_id=user_id,
    )
    token, _ = create_access_token(user)
    return token


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


_site_name_counter = itertools.count(1)


def _assessment_with_accepted_dependency(company_id: int, *, dependency_level: str = "high"):
    """Monte un dossier LEAP en 'evaluate' avec un site rattaché et UNE
    dépendance ACCEPTÉE — le socle minimal pour un score non nul.

    Nom de site UNIQUE à chaque appel : `sites` porte une contrainte
    `sites_company_name_uniq (company_id, name)` et `two_companies_nature`
    est un fixture de portée MODULE (les deux mêmes companies servent à TOUS
    les tests de ce fichier) — un nom fixe entrerait en collision dès le
    deuxième test qui appelle ce helper pour la même company."""
    site_id = insert_site(company_id, f"Site assess-prepare {next(_site_name_counter)}")
    assessment = leap_service.create_assessment(
        company_id=company_id, payload=LeapAssessmentCreate(label="Dossier assess", site_ids=[site_id]),
    )
    leap_service.advance_phase(company_id=company_id, assessment_id=assessment.id, target_phase="evaluate")
    dep = dependencies_service.create_dependency(
        company_id=company_id,
        payload=NatureDependencyCreate(
            site_id=site_id, ecosystem_service="freshwater", dependency_level=dependency_level,
        ),
    )
    dependencies_service.review_dependency(company_id=company_id, dependency_id=dep.id, accept=True, reviewed_by=1)
    return assessment, site_id, dep


class TestNatureRiskScoring:
    def test_calculate_persists_and_returns_envelope(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)

        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque test", site_id=site_id),
            calculated_by=7,
        )
        assert envelope.data.risk_score is not None
        assert envelope.data.likelihood is None
        assert envelope.meta.method.code == "CC-NATURE-RISK"
        assert envelope.meta.quality.confidence is not None

        fetched = risk_service.get_risk(company_id=cid_a, risk_id=envelope.data.risk_id)
        assert fetched.review_status == "pending"
        assert fetched.risk_score == envelope.data.risk_score

    def test_calculate_with_no_accepted_data_yields_null_score(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier vide"),
        )
        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque vide"),
        )
        assert envelope.data.risk_score is None, "aucune donnée ACCEPTÉE : jamais un score inventé"

    def test_risk_score_and_confidence_are_independent_columns_in_db(self, two_companies_nature):
        """Preuve DB directe : `risk_score` et `confidence` sont deux
        colonnes SQL distinctes avec deux CHECK indépendants — pas une
        colonne combinée."""
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque colonnes", site_id=site_id),
        )
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT risk_score, likelihood, confidence FROM nature_risks WHERE id = %s",
                    (envelope.data.risk_id,),
                )
                row = cur.fetchone()
        assert row["risk_score"] is not None
        assert row["likelihood"] is None
        assert row["confidence"] is not None

    def test_review_gate(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque revue", site_id=site_id),
        )
        reviewed = risk_service.review_risk(
            company_id=cid_a, risk_id=envelope.data.risk_id, accept=True, reviewed_by=3,
        )
        assert reviewed.review_status == "accepted"
        with pytest.raises(risk_service.NatureRiskError, match="déjà revu"):
            risk_service.review_risk(company_id=cid_a, risk_id=envelope.data.risk_id, accept=True, reviewed_by=3)

    def test_reproducibility_same_scope_same_fingerprint(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        first = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Run 1", site_id=site_id),
        )
        second = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Run 2", site_id=site_id),
        )
        assert first.data.input_fingerprint == second.data.input_fingerprint
        assert first.data.risk_score == second.data.risk_score

    def test_isolated_between_tenants(self, two_companies_nature):
        cid_a, cid_b = two_companies_nature
        assessment_b, site_b, _dep = _assessment_with_accepted_dependency(cid_b)
        risk_service.calculate(
            company_id=cid_b,
            payload=RiskCalculateRequest(assessment_id=assessment_b.id, title="Risque B", site_id=site_b),
        )
        listing_a = risk_service.list_risks(company_id=cid_a, assessment_id=assessment_b.id)
        assert listing_a.total == 0, "A ne voit jamais les risques de B (assessment_id hors périmètre)"


class TestNatureOpportunityScoring:
    def test_calculate_from_positive_impact(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        site_id = insert_site(cid_a, "Site opportunité")
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier opp", site_ids=[site_id]),
        )
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="evaluate")
        impact = impacts_service.create_impact(
            company_id=cid_a,
            payload=NatureImpactCreate(
                site_id=site_id, pressure_type="water_use", impact_kind="positive",
                magnitude_qualitative="high",
            ),
        )
        impacts_service.review_impact(company_id=cid_a, impact_id=impact.id, accept=True, reviewed_by=2)

        envelope = opportunity_service.calculate(
            company_id=cid_a,
            payload=OpportunityCalculateRequest(assessment_id=assessment.id, title="Opportunité test", site_id=site_id),
        )
        assert envelope.data.opportunity_score is not None

    def test_no_accepted_data_yields_null_score(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier opp vide"),
        )
        envelope = opportunity_service.calculate(
            company_id=cid_a,
            payload=OpportunityCalculateRequest(assessment_id=assessment.id, title="Opp vide"),
        )
        assert envelope.data.opportunity_score is None

    def test_never_conflated_with_risk_table(self, two_companies_nature):
        """Une opportunité et un risque du MÊME dossier restent dans des
        tables séparées — aucune jointure implicite, aucun champ partagé au
        niveau catalogue au-delà du bookkeeping générique."""
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque", site_id=site_id),
        )
        opportunity_service.calculate(
            company_id=cid_a,
            payload=OpportunityCalculateRequest(assessment_id=assessment.id, title="Opportunité", site_id=site_id),
        )
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM nature_risks LIMIT 1")
                risk_cols = {d.name for d in cur.description}
                cur.execute("SELECT * FROM nature_opportunities LIMIT 1")
                opp_cols = {d.name for d in cur.description}
        assert "opportunity_score" not in risk_cols
        assert "risk_score" not in opp_cols


class TestNatureActions:
    def test_action_requires_anchor(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        with pytest.raises(actions_service.NatureActionError, match="ancrage"):
            actions_service.create_action(
                company_id=cid_a,
                payload=NatureActionCreate(action_type="restoration", title="Action orpheline"),
            )

    def test_action_anchored_to_risk_never_auto_reduces_score(self, two_companies_nature):
        """`expected_risk_reduction_pct` est une INTENTION déclarée — créer
        l'action ne modifie JAMAIS `nature_risks.risk_score`."""
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque à atténuer", site_id=site_id),
        )
        before = risk_service.get_risk(company_id=cid_a, risk_id=envelope.data.risk_id).risk_score

        actions_service.create_action(
            company_id=cid_a,
            payload=NatureActionCreate(
                action_type="restoration", title="Restauration zone humide",
                risk_id=envelope.data.risk_id, expected_risk_reduction_pct=40.0,
            ),
        )
        after = risk_service.get_risk(company_id=cid_a, risk_id=envelope.data.risk_id).risk_score
        assert before == after, "une action déclarée ne soustrait JAMAIS automatiquement un score"

    def test_review_gate(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier action"),
        )
        action = actions_service.create_action(
            company_id=cid_a,
            payload=NatureActionCreate(
                action_type="habitat_protection", title="Protection habitat", assessment_id=assessment.id,
            ),
        )
        assert action.review_status == "pending"
        reviewed = actions_service.review_action(company_id=cid_a, action_id=action.id, accept=True, reviewed_by=4)
        assert reviewed.review_status == "accepted"


class TestTnfdDisclosureDrafts:
    def test_draft_is_never_official(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        draft = disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon 2026"),
        )
        assert draft.is_official_tnfd_disclosure is False
        assert "N'EST PAS" in draft.disclaimer
        assert draft.status == "draft"
        assert len(draft.sections) >= 3

    def test_draft_sections_reflect_real_state_not_invented(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier sans donnée"),
        )
        draft = disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon vide"),
        )
        dep_section = next(s for s in draft.sections if s.section_code == "dependencies")
        assert "Aucune" in dep_section.content

    def test_official_flag_cannot_be_forced_true_at_db_level(self, two_companies_nature):
        """Preuve DB directe : le CHECK 039 refuse toute ligne
        `is_official_tnfd_disclosure=true`, même via un accès direct
        contournant le service."""
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        draft = disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon"),
        )
        with pytest.raises(Exception, match="tnfd_disclosure_drafts_never_certified_check"):
            with get_db(company_id=cid_a) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE tnfd_disclosure_drafts SET is_official_tnfd_disclosure = true WHERE id = %s",
                        (draft.id,),
                    )

    def test_review_requires_reviewed_by(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        draft = disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon revue"),
        )
        with pytest.raises(disclosure_service.NatureDisclosureError, match="identifié"):
            disclosure_service.review(company_id=cid_a, draft_id=draft.id, approve=True, reviewed_by=0)

    def test_approved_draft_still_not_official_and_status_vocabulary_excludes_published(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        draft = disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon approuvé"),
        )
        approved = disclosure_service.review(company_id=cid_a, draft_id=draft.id, approve=True, reviewed_by=9)
        assert approved.status == "approved"
        assert approved.is_official_tnfd_disclosure is False, "approuvé en interne ≠ certifié TNFD"
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint "
                    "WHERE conname = 'tnfd_disclosure_drafts_status_check'"
                )
                definition = cur.fetchone()["def"]
        assert "published" not in definition, "aucune publication automatique n'est même représentable"


class TestLeapPhaseCompletion:
    def test_advance_to_prepare_requires_accepted_risk_or_opportunity(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="assess")

        with pytest.raises(leap_service.NatureLeapError, match="ACCEPTÉ"):
            leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="prepare")

        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque phase", site_id=site_id),
        )
        risk_service.review_risk(company_id=cid_a, risk_id=envelope.data.risk_id, accept=True, reviewed_by=5)
        advanced = leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="prepare")
        assert advanced.phase == "prepare"

    def test_advance_to_completed_requires_disclosure_draft(self, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="assess")
        envelope = risk_service.calculate(
            company_id=cid_a,
            payload=RiskCalculateRequest(assessment_id=assessment.id, title="Risque completion", site_id=site_id),
        )
        risk_service.review_risk(company_id=cid_a, risk_id=envelope.data.risk_id, accept=True, reviewed_by=5)
        leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="prepare")

        with pytest.raises(leap_service.NatureLeapError, match="brouillon"):
            leap_service.advance_phase(company_id=cid_a, assessment_id=assessment.id, target_phase="completed")

        disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon final"),
        )
        completed = leap_service.advance_phase(
            company_id=cid_a, assessment_id=assessment.id, target_phase="completed",
        )
        assert completed.phase == "completed"


class TestNatureAssessPrepareApiAndIsolation:
    def test_risks_require_auth(self, client):
        assert client.get("/nature/risks").status_code == 401

    def test_calculate_risk_requires_analyst(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        resp = client.post(
            "/nature/risks/calculate",
            headers=_auth(_token_for(cid_a, role="viewer")),
            json={"assessment_id": 1, "title": "x"},
        )
        assert resp.status_code == 403

    def test_disclosure_draft_review_requires_admin(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        draft = disclosure_service.assemble_draft(
            company_id=cid_a,
            payload=TnfdDisclosureDraftCreate(assessment_id=assessment.id, title="Brouillon API"),
        )
        analyst_resp = client.post(
            f"/nature/disclosure-drafts/{draft.id}/review",
            headers=_auth(_token_for(cid_a, role="analyst")), json={"accept": True},
        )
        assert analyst_resp.status_code == 403

        admin_resp = client.post(
            f"/nature/disclosure-drafts/{draft.id}/review",
            headers=_auth(_token_for(cid_a, role="admin")), json={"accept": True},
        )
        assert admin_resp.status_code == 200
        assert admin_resp.json()["is_official_tnfd_disclosure"] is False

    def test_risk_404_does_not_leak_cross_tenant(self, client, two_companies_nature):
        cid_a, cid_b = two_companies_nature
        assessment_b, site_b, _dep = _assessment_with_accepted_dependency(cid_b)
        envelope = risk_service.calculate(
            company_id=cid_b,
            payload=RiskCalculateRequest(assessment_id=assessment_b.id, title="Risque B API", site_id=site_b),
        )
        resp = client.get(
            f"/nature/risks/{envelope.data.risk_id}", headers=_auth(_token_for(cid_a)),
        )
        assert resp.status_code == 404

    def test_calculate_and_list_via_api(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment, site_id, _dep = _assessment_with_accepted_dependency(cid_a)
        token = _token_for(cid_a)
        created = client.post(
            "/nature/risks/calculate", headers=_auth(token),
            json={"assessment_id": assessment.id, "title": "Risque via API", "site_id": site_id},
        )
        assert created.status_code == 200, created.text
        body = created.json()
        assert "data" in body and "meta" in body and "evidence" in body
        assert body["meta"]["method"]["code"] == "CC-NATURE-RISK"

        listing = client.get(f"/nature/risks?assessment_id={assessment.id}&limit=1", headers=_auth(token))
        assert listing.status_code == 200
        listing_body = listing.json()
        assert listing_body["total"] >= 1
        assert listing_body["limit"] == 1

    def test_actions_pagination(self, client, two_companies_nature):
        cid_a, _ = two_companies_nature
        assessment = leap_service.create_assessment(
            company_id=cid_a, payload=LeapAssessmentCreate(label="Dossier pagination"),
        )
        token = _token_for(cid_a)
        for i in range(3):
            client.post(
                "/nature/actions", headers=_auth(token),
                json={
                    "action_type": "restoration",
                    "title": f"Action {i}", "assessment_id": assessment.id,
                },
            )
        resp = client.get(
            f"/nature/actions?assessment_id={assessment.id}&limit=2", headers=_auth(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert len(body["items"]) == 2
