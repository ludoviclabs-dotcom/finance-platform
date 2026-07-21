"""
review_service.py — orchestration d'une revue IA (PR-11).

Pipeline (AI_GOVERNANCE §4-§5, plan §16.4) :
  grounding (pack pré-autorisé) → provider demo/live → validation Pydantic
  → citations résolues → entailment déterministe → étiquetage → persistance
  (ai_runs/ai_claims/ai_citations) → gate.

Gate de publication : schema_valid AND citation_resolved AND license_allowed
AND human_review = approved. Ce service produit les 3 premiers ; `human_review`
reste un geste humain (review_decision_service). Toute sortie DRAFT/SUGGESTION/
REVIEW_REQUIRED — jamais une décision, jamais un calcul.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from db.database import get_db
from models.ai_review import (
    ClaimResponse,
    ReviewRunResponse,
    RunListResponse,
    RunResponse,
)
from services.intelligence.ai import (
    citation_service,
    entailment_service,
    grounding_service,
    provider,
)
from services.intelligence.ai.grounding_service import AiGroundingError
from services.intelligence.ai.prompts import (
    POLICY_VERSION,
    PROMPT_VERSION,
    system_prompt_for,
)

_SCOPE = "company_id = %s"

# Quota par (tenant, utilisateur) — DB-backed donc FAIL-SAFE (si la base est
# indisponible, le garde require_db du routeur répond déjà 503 avant d'arriver
# ici). Plafond volontairement généreux : en demo aucun coût, en live il borne
# l'abus/coût (AI_GOVERNANCE §11, D-7).
RATE_LIMIT_PER_MIN = 20


class AiReviewError(Exception):
    """Erreur métier de la revue IA (sujet introuvable, sortie invalide…)."""


class AiRateLimited(AiReviewError):
    """Quota par tenant/utilisateur dépassé — le routeur mappe en 429."""


def _check_rate(company_id: int, created_by: int | None) -> None:
    if created_by is None:
        return
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM ai_runs WHERE {_SCOPE} AND created_by=%s "
                "AND created_at > now() - interval '1 minute'",
                (company_id, created_by),
            )
            n = cur.fetchone()["c"]
    if n >= RATE_LIMIT_PER_MIN:
        raise AiRateLimited("Trop de revues IA dans la dernière minute — réessayez plus tard.")


def _describe_provider() -> tuple[str, str]:
    """(provider, model) de PROVENANCE du run — jamais codé en dur pour le live."""
    if provider.current_mode() == "live":
        return (
            os.environ.get("AI_REVIEW_PROVIDER", "vercel-ai-gateway"),
            os.environ.get("AI_REVIEW_MODEL") or "(unconfigured)",
        )
    return "demo", "demo"


def _input_hash(pack_json: str) -> str:
    return hashlib.sha256(pack_json.encode("utf-8")).hexdigest()


def _insert_pending_run(
    *, company_id: int, created_by: int | None, use_case: str, subject_type: str,
    subject_key: str, provider_name: str, model_name: str, input_hash: str,
    allowed_reference_ids: list[dict[str, Any]],
) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_runs
                    (company_id, created_by, use_case, subject_type, subject_key,
                     provider, model, model_version, prompt_version, policy_version,
                     input_hash, allowed_reference_ids, status, review_status, started_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s::jsonb,
                        'pending', 'needs_review', now())
                RETURNING id
                """,
                (
                    company_id, created_by, use_case, subject_type, subject_key,
                    provider_name, model_name, PROMPT_VERSION, POLICY_VERSION,
                    input_hash, json.dumps(allowed_reference_ids),
                ),
            )
            return cur.fetchone()["id"]


def _mark_run_failed(*, company_id: int, run_id: int, status: str, error_code: str) -> None:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE ai_runs SET status=%s, error_code=%s, completed_at=now() "
                f"WHERE id=%s AND {_SCOPE}",
                (status, error_code, run_id, company_id),
            )


def run_review(
    *, company_id: int, use_case: str, subject_key: str, created_by: int | None,
    provider_fn: provider.Provider | None = None,
) -> ReviewRunResponse:
    """Exécute une revue IA de bout en bout et persiste le journal."""
    gen_provider = provider_fn or provider.default_provider
    _check_rate(company_id, created_by)

    # 1. Grounding (RLS + licence + sensibilité + minimisation).
    try:
        grounding = grounding_service.build_pack(
            company_id=company_id, use_case=use_case, subject_key=subject_key
        )
    except AiGroundingError as exc:
        raise AiReviewError(str(exc)) from exc

    pack = grounding.pack
    input_hash = _input_hash(pack.model_dump_json())
    provider_name, model_name = _describe_provider()

    run_id = _insert_pending_run(
        company_id=company_id, created_by=created_by, use_case=use_case,
        subject_type=pack.subject_type, subject_key=pack.subject_key,
        provider_name=provider_name, model_name=model_name, input_hash=input_hash,
        allowed_reference_ids=grounding.allowed_reference_ids,
    )

    # 2. Appel provider (hors transaction DB). Échecs journalisés, jamais masqués.
    request = provider.ModelRequest(
        use_case=use_case, provider=provider_name, model=model_name,
        prompt_version=PROMPT_VERSION, policy_version=POLICY_VERSION,
        system_prompt=system_prompt_for(use_case), pack=pack,
    )
    try:
        gen = gen_provider(request)
    except provider.BudgetExceeded as exc:
        _mark_run_failed(company_id=company_id, run_id=run_id, status="refused", error_code="budget")
        raise AiReviewError(f"Budget IA dépassé: {exc}") from exc
    except provider.ProviderUnavailable as exc:
        _mark_run_failed(
            company_id=company_id, run_id=run_id, status="failed", error_code="provider_unavailable"
        )
        raise exc  # remonte tel quel : le routeur mappe en 503.
    except provider.ProviderError as exc:
        _mark_run_failed(company_id=company_id, run_id=run_id, status="failed", error_code="provider_error")
        raise AiReviewError(f"Erreur fournisseur IA: {exc}") from exc

    # 3. Résolution citations + entailment + persistance (transaction unique).
    index = citation_service.build_index(pack)
    claim_responses: list[ClaimResponse] = []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            for i, claim in enumerate(gen.result.claims):
                resolved, _rejected = citation_service.resolve_claim(index, claim)
                corroborated = use_case == "calc_explanation" and any(
                    c.resource_type == "calc_result" for c in resolved
                )
                support = entailment_service.support_status(
                    claim, resolved, corroborated=corroborated
                )
                cur.execute(
                    """
                    INSERT INTO ai_claims
                        (run_id, company_id, claim_index, claim_text, structured_payload,
                         output_label, support_status)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
                    RETURNING id
                    """,
                    (
                        run_id, company_id, i, claim.claim_text,
                        json.dumps(claim.structured_payload), claim.output_label, support,
                    ),
                )
                claim_id = cur.fetchone()["id"]
                for cit in resolved:
                    cur.execute(
                        """
                        INSERT INTO ai_citations
                            (run_id, claim_id, company_id, resource_type, internal_id,
                             source_id, release_id, artifact_id, observation_id, locator,
                             data_status, sensitivity, license_ok, stale)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            run_id, claim_id, company_id, cit.resource_type, cit.internal_id,
                            cit.source_id, cit.release_id, cit.artifact_id, cit.observation_id,
                            json.dumps(cit.locator), cit.data_status, cit.sensitivity,
                            cit.license_ok, cit.stale,
                        ),
                    )
                    cit.id = cur.fetchone()["id"]
                claim_responses.append(
                    ClaimResponse(
                        id=claim_id, claim_index=i, claim_text=claim.claim_text,
                        structured_payload=claim.structured_payload,
                        output_label=claim.output_label, support_status=support,
                        citations=resolved,
                    )
                )
            cur.execute(
                f"""UPDATE ai_runs SET status='succeeded', model_version=%s, tokens_input=%s,
                    tokens_output=%s, cost_estimate=%s, latency_ms=%s, completed_at=now()
                    WHERE id=%s AND {_SCOPE}""",
                (gen.model_version, gen.tokens_input, gen.tokens_output, gen.cost_estimate,
                 gen.latency_ms, run_id, company_id),
            )

    run = get_run_row(company_id=company_id, run_id=run_id)
    schema_valid = True  # la sortie a passé la validation Pydantic.
    citation_resolved = all(
        c.support_status == "unsupported" or len(c.citations) > 0 for c in claim_responses
    )
    license_allowed = all(cit.license_ok for c in claim_responses for cit in c.citations)
    return ReviewRunResponse(
        run=run, claims=claim_responses, schema_valid=schema_valid,
        citation_resolved=citation_resolved, license_allowed=license_allowed,
    )


# --- Lecture ---------------------------------------------------------------
def _row_to_run(row: dict[str, Any]) -> RunResponse:
    return RunResponse(
        id=row["id"], company_id=row["company_id"], use_case=row["use_case"],
        subject_type=row["subject_type"], subject_key=row["subject_key"],
        provider=row["provider"], model=row["model"], model_version=row.get("model_version"),
        prompt_version=row["prompt_version"], policy_version=row["policy_version"],
        input_hash=row["input_hash"], status=row["status"], review_status=row["review_status"],
        tokens_input=row.get("tokens_input"), tokens_output=row.get("tokens_output"),
        cost_estimate=float(row["cost_estimate"]) if row.get("cost_estimate") is not None else None,
        latency_ms=row.get("latency_ms"), error_code=row.get("error_code"),
        created_at=row.get("created_at"), completed_at=row.get("completed_at"),
    )


def get_run_row(*, company_id: int, run_id: int) -> RunResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM ai_runs WHERE id=%s AND {_SCOPE}", (run_id, company_id))
            row = cur.fetchone()
    if row is None:
        raise AiReviewError(f"Run IA '{run_id}' introuvable ou hors périmètre.")
    return _row_to_run(dict(row))


def get_run_detail(*, company_id: int, run_id: int) -> ReviewRunResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM ai_runs WHERE id=%s AND {_SCOPE}", (run_id, company_id))
            run_row = cur.fetchone()
            if run_row is None:
                raise AiReviewError(f"Run IA '{run_id}' introuvable ou hors périmètre.")
            cur.execute(
                f"SELECT * FROM ai_claims WHERE run_id=%s AND {_SCOPE} ORDER BY claim_index",
                (run_id, company_id),
            )
            claim_rows = [dict(r) for r in cur.fetchall()]
            cur.execute(
                f"SELECT * FROM ai_citations WHERE run_id=%s AND {_SCOPE} ORDER BY claim_id, id",
                (run_id, company_id),
            )
            cit_rows = [dict(r) for r in cur.fetchall()]

    from models.ai_review import CitationResponse

    by_claim: dict[int, list[CitationResponse]] = {}
    for cr in cit_rows:
        by_claim.setdefault(cr["claim_id"], []).append(
            CitationResponse(
                id=cr["id"], resource_type=cr["resource_type"], internal_id=cr["internal_id"],
                source_id=cr.get("source_id"), release_id=cr.get("release_id"),
                artifact_id=cr.get("artifact_id"), observation_id=cr.get("observation_id"),
                locator=cr.get("locator") or {}, data_status=cr.get("data_status"),
                sensitivity=cr.get("sensitivity"), license_ok=cr["license_ok"], stale=cr["stale"],
            )
        )
    claims = [
        ClaimResponse(
            id=cl["id"], claim_index=cl["claim_index"], claim_text=cl["claim_text"],
            structured_payload=cl.get("structured_payload") or {},
            output_label=cl["output_label"], support_status=cl["support_status"],
            citations=by_claim.get(cl["id"], []),
        )
        for cl in claim_rows
    ]
    run = _row_to_run(run_row)
    citation_resolved = all(
        c.support_status == "unsupported" or len(c.citations) > 0 for c in claims
    )
    license_allowed = all(cit.license_ok for c in claims for cit in c.citations)
    return ReviewRunResponse(
        run=run, claims=claims, schema_valid=(run.status == "succeeded"),
        citation_resolved=citation_resolved, license_allowed=license_allowed,
    )


def list_runs(
    *, company_id: int, use_case: str | None = None, subject_type: str | None = None,
    subject_key: str | None = None, status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> RunListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    for col, val in (("use_case", use_case), ("subject_type", subject_type),
                     ("subject_key", subject_key), ("status", status)):
        if val is not None:
            clauses.append(f"{col} = %s")
            params.append(val)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM ai_runs WHERE {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM ai_runs WHERE {where} ORDER BY created_at DESC, id DESC "
                "LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            items = [_row_to_run(dict(r)) for r in cur.fetchall()]
    return RunListResponse(items=items, total=total, limit=limit, offset=offset)
