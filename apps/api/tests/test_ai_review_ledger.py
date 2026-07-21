"""
test_ai_review_ledger.py — tests DB-gated (job `migration-tests`) du journal IA
PR-11 : pipeline complet UC-1, exclusion sensibilité/licence/citations inventées,
isolation RLS tenant A/B, immutabilité (append-only), décision humaine + geste
create_iro, provider indisponible journalisé.

Postgres réel requis (conteneur CI). Le provider est un STUB injecté : aucun
appel modèle, aucun coût. Toutes les données sont fictives (`_ai_review_fixtures`).
"""

from __future__ import annotations

import pytest

from db.database import db_available, get_db
from models.ai_review import (
    ModelCitation,
    ModelClaim,
    ModelResult,
    ReviewDecisionCreate,
)
from services.intelligence.ai import review_decision_service, review_service
from services.intelligence.ai.provider import GenerateResult, ProviderUnavailable

pytestmark = pytest.mark.skipif(not db_available(), reason="PostgreSQL requis (DB-gated)")


def _stub(cited_per_claim, *, unavailable=False):
    """Provider factice : une liste de listes de ref_id (un claim par sous-liste)."""
    def _p(_request):
        if unavailable:
            raise ProviderUnavailable("stub provider down")
        claims = [
            ModelClaim(
                claim_text=f"claim {i}", output_label="REVIEW_REQUIRED",
                citations=[ModelCitation(ref_id=r) for r in rids],
            )
            for i, rids in enumerate(cited_per_claim)
        ]
        return GenerateResult(
            result=ModelResult(claims=claims), provider="demo", model="demo",
            tokens_input=10, tokens_output=5, cost_estimate=0.0, latency_ms=1,
        )
    return _p


def test_pipeline_excludes_sensitive_blocked_and_invented(ai_env):
    cid, iid = ai_env["cid_a"], ai_env["iro_id"]
    normal = f"artifact:{ai_env['normal_id']}"
    conf = f"artifact:{ai_env['conf_id']}"
    blocked = f"artifact:{ai_env['blocked_id']}"
    derived = f"artifact:{ai_env['derived_id']}"
    stub = _stub([[normal], ["artifact:999999"], [conf], [blocked], [derived]])

    res = review_service.run_review(
        company_id=cid, use_case="iro_review", subject_key=str(iid),
        created_by=91, provider_fn=stub,
    )
    assert res.run.status == "succeeded"
    assert res.run.model_version == "demo"  # version provider persistée (P2)
    # Seule la preuve normale est citée et persistée.
    persisted = [c for claim in res.claims for c in claim.citations]
    assert len(persisted) == 1 and persisted[0].internal_id == ai_env["normal_id"]
    # Le claim citant la preuve normale : grounded ; les autres : unsupported.
    by_idx = {c.claim_index: c for c in res.claims}
    assert by_idx[0].support_status in ("supported", "partially_supported")
    assert by_idx[1].support_status == "unsupported"  # inventée
    assert by_idx[2].support_status == "unsupported"  # confidentielle exclue du pack
    assert by_idx[3].support_status == "unsupported"  # licence bloquante (display) exclue
    assert by_idx[4].support_status == "unsupported"  # derived_use bloqué exclu (P1)

    # allowed_reference_ids (audit) ne contient JAMAIS confidentiel/bloqué/derived.
    with get_db(company_id=cid) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT allowed_reference_ids FROM ai_runs WHERE id=%s", (res.run.id,))
            allowed = cur.fetchone()["allowed_reference_ids"]
            cur.execute(
                "SELECT COUNT(*) AS c FROM ai_citations WHERE run_id=%s AND internal_id IN (%s,%s,%s)",
                (res.run.id, ai_env["conf_id"], ai_env["blocked_id"], ai_env["derived_id"]),
            )
            leaked = cur.fetchone()["c"]
    ids = {r["internal_id"] for r in allowed}
    assert ai_env["conf_id"] not in ids and ai_env["blocked_id"] not in ids
    assert ai_env["derived_id"] not in ids
    assert ai_env["normal_id"] in ids
    assert leaked == 0


def test_rls_tenant_b_cannot_see_tenant_a_run(ai_env):
    cid_a, cid_b, iid = ai_env["cid_a"], ai_env["cid_b"], ai_env["iro_id"]
    res = review_service.run_review(
        company_id=cid_a, use_case="iro_review", subject_key=str(iid),
        created_by=91, provider_fn=_stub([[f"artifact:{ai_env['normal_id']}"]]),
    )
    with pytest.raises(review_service.AiReviewError):
        review_service.get_run_detail(company_id=cid_b, run_id=res.run.id)
    assert review_service.list_runs(company_id=cid_b).total == 0
    assert review_service.list_runs(company_id=cid_a).total >= 1


def test_ledger_is_append_only(ai_env):
    cid, iid = ai_env["cid_a"], ai_env["iro_id"]
    res = review_service.run_review(
        company_id=cid, use_case="iro_review", subject_key=str(iid),
        created_by=91, provider_fn=_stub([[f"artifact:{ai_env['normal_id']}"]]),
    )
    claim_id = res.claims[0].id
    # ai_claims frozen : UPDATE et DELETE refusés.
    with pytest.raises(Exception, match="ai_review_ledger"):
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE ai_claims SET claim_text='x' WHERE id=%s", (claim_id,))
    with pytest.raises(Exception, match="ai_review_ledger"):
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM ai_claims WHERE id=%s", (claim_id,))
    # ai_runs : provenance immuable (UPDATE provider refusé) mais review_status OK.
    with pytest.raises(Exception, match="ai_review_ledger"):
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE ai_runs SET provider='x' WHERE id=%s", (res.run.id,))
    with get_db(company_id=cid) as conn:  # celui-ci doit PASSER (transition légale).
        with conn.cursor() as cur:
            cur.execute("UPDATE ai_runs SET review_status='approved' WHERE id=%s", (res.run.id,))


def test_decision_accept_creates_iro_candidate_and_append_only(ai_env):
    from services.iro import iro_service

    cid, iid = ai_env["cid_a"], ai_env["iro_id"]
    res = review_service.run_review(
        company_id=cid, use_case="iro_review", subject_key=str(iid),
        created_by=91, provider_fn=_stub([[f"artifact:{ai_env['normal_id']}"]]),
    )
    decision = review_decision_service.record(
        company_id=cid, run_id=res.run.id, reviewer_id=91,
        payload=ReviewDecisionCreate(
            decision="accept", justification="Preuves suffisantes.",
            modified_output={"create_iro": {"title": "IRO promu", "iro_type": "opportunity"}},
        ),
    )
    assert decision.business_effect is not None
    new_iro = iro_service.get_iro(company_id=cid, iro_id=decision.business_effect["iro_id"])
    assert new_iro.status == "candidate"  # jamais 'decided' : create_iro force candidate.
    assert review_service.get_run_row(company_id=cid, run_id=res.run.id).review_status == "approved"

    # ai_review_decisions append-only : UPDATE/DELETE refusés.
    with pytest.raises(Exception, match="ai_review_ledger"):
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE ai_review_decisions SET decision='reject' WHERE id=%s",
                            (decision.id,))

    # Redécision → nouvelle ligne qui supersède la précédente (jamais un UPDATE).
    second = review_decision_service.record(
        company_id=cid, run_id=res.run.id, reviewer_id=91,
        payload=ReviewDecisionCreate(decision="reject", justification="Reconsidéré."),
    )
    assert second.supersedes_id == decision.id


def test_provider_unavailable_records_failed_run(ai_env):
    cid, iid = ai_env["cid_a"], ai_env["iro_id"]
    with pytest.raises(ProviderUnavailable):
        review_service.run_review(
            company_id=cid, use_case="iro_review", subject_key=str(iid),
            created_by=91, provider_fn=_stub([[]], unavailable=True),
        )
    with get_db(company_id=cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, error_code FROM ai_runs WHERE company_id=%s AND subject_key=%s "
                "ORDER BY id DESC LIMIT 1",
                (cid, str(iid)),
            )
            row = cur.fetchone()
    assert row["status"] == "failed" and row["error_code"] == "provider_unavailable"


def test_decision_on_cross_tenant_run_is_not_found(ai_env):
    cid_a, cid_b, iid = ai_env["cid_a"], ai_env["cid_b"], ai_env["iro_id"]
    res = review_service.run_review(
        company_id=cid_a, use_case="iro_review", subject_key=str(iid),
        created_by=91, provider_fn=_stub([[f"artifact:{ai_env['normal_id']}"]]),
    )
    with pytest.raises(review_service.AiReviewError):
        review_decision_service.record(
            company_id=cid_b, run_id=res.run.id, reviewer_id=91,
            payload=ReviewDecisionCreate(decision="accept", justification="x"),
        )
