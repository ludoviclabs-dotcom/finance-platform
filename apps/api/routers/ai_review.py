"""
routers/ai_review.py — assistant IA de revue/explication cité (PR-11), préfixe `/ai`.

Lecture (GET) : utilisateur authentifié du tenant. Lancement d'une revue et
décision humaine (POST) : `require_analyst`. Toutes les routes sont NEUVES (les
tables ai_* arrivent avec la migration 041) : chacune sous `schema_ready_guard`
→ 503 `schema_not_ready` tant que le schéma n'est pas migré, jamais une erreur
SQL brute (motif PR-08/09/10).

Aucune écriture métier par le modèle ; aucun accès direct du modèle à la DB, au
stockage ou au réseau ; aucune décision automatique. Rate-limit par tenant +
utilisateur (fail-safe, review_service). Erreurs :
  - sujet/ run introuvable        → 404 (via http_error, « introuvable »)
  - fournisseur indisponible      → 503 (explicite, jamais de substitution)
  - quota dépassé                 → 429
  - base indisponible             → 503 (require_db)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from models.ai_review import (
    ReviewDecisionCreate,
    ReviewDecisionResponse,
    ReviewRunResponse,
    RunListResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.intelligence.ai import review_decision_service, review_service
from services.intelligence.ai.provider import ProviderUnavailable

router = APIRouter()


def _map_run_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, review_service.AiRateLimited):
        return HTTPException(429, detail=str(exc))
    if isinstance(exc, ProviderUnavailable):
        return HTTPException(503, detail=f"Fournisseur IA indisponible: {exc}")
    return http_error(exc)


@router.post("/review/iro/{iro_id}", response_model=ReviewRunResponse, status_code=201)
async def review_iro(
    iro_id: int, user: AuthUser = Depends(require_analyst)
) -> ReviewRunResponse:
    """UC-1 — lance une revue IA d'un IRO candidate à partir de ses preuves.
    Sortie REVIEW_REQUIRED, jamais une décision de matérialité."""
    require_db()
    try:
        with schema_ready_guard():
            return review_service.run_review(
                company_id=user.company_id, use_case="iro_review",
                subject_key=str(iro_id), created_by=user.user_id,
            )
    except (review_service.AiReviewError, ProviderUnavailable) as exc:
        raise _map_run_errors(exc) from exc


@router.post("/review/calc/{envelope_ref}", response_model=ReviewRunResponse, status_code=201)
async def review_calc(
    envelope_ref: str, user: AuthUser = Depends(require_analyst)
) -> ReviewRunResponse:
    """UC-2 — explique un résultat déterministe Scope 2 déjà calculé
    (`envelope_ref` = 'scope2:{run_id}'). N'effectue aucun calcul."""
    require_db()
    try:
        with schema_ready_guard():
            return review_service.run_review(
                company_id=user.company_id, use_case="calc_explanation",
                subject_key=envelope_ref, created_by=user.user_id,
            )
    except (review_service.AiReviewError, ProviderUnavailable) as exc:
        raise _map_run_errors(exc) from exc


@router.get("/review/runs", response_model=RunListResponse)
async def list_runs_endpoint(
    use_case: str | None = Query(None),
    subject_type: str | None = Query(None),
    subject_key: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> RunListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return review_service.list_runs(
                company_id=user.company_id, use_case=use_case, subject_type=subject_type,
                subject_key=subject_key, status=status, limit=limit, offset=offset,
            )
    except review_service.AiReviewError as exc:
        raise http_error(exc) from exc


@router.get("/review/runs/{run_id}", response_model=ReviewRunResponse)
async def get_run_endpoint(
    run_id: int, user: AuthUser = Depends(get_current_user)
) -> ReviewRunResponse:
    require_db()
    try:
        with schema_ready_guard():
            return review_service.get_run_detail(company_id=user.company_id, run_id=run_id)
    except review_service.AiReviewError as exc:
        raise http_error(exc) from exc


@router.post(
    "/review/runs/{run_id}/decision", response_model=ReviewDecisionResponse, status_code=201
)
async def decide_endpoint(
    run_id: int,
    body: ReviewDecisionCreate,
    user: AuthUser = Depends(require_analyst),
) -> ReviewDecisionResponse:
    """Décision humaine accept/reject/modify (reviewer + justification obligatoires,
    append-only). Un accept peut promouvoir une suggestion en IRO candidate via
    l'API réelle (jamais une écriture du modèle)."""
    require_db()
    if user.user_id is None:
        raise HTTPException(400, detail="Reviewer requis (utilisateur non identifié).")
    try:
        with schema_ready_guard():
            return review_decision_service.record(
                company_id=user.company_id, run_id=run_id, payload=body, reviewer_id=user.user_id,
            )
    except (review_service.AiReviewError, review_decision_service.AiReviewDecisionError) as exc:
        raise http_error(exc) from exc
