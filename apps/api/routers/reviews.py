"""
routers/reviews.py — Endpoints de workflow de validation (Phase 3.A).

Endpoints :
  GET    /reviews/inbox               — liste paginée des reviews actives
  GET    /reviews/{id}                — détail
  POST   /reviews/propose             — créer une review (statut proposed)
  POST   /reviews/{id}/approve        — valider (rôle analyst/admin)
  POST   /reviews/{id}/reject         — rejeter avec motif
  POST   /reviews/{id}/freeze         — geler (rôle admin)
  POST   /reviews/{id}/move-to-review — promouvoir PROPOSED → IN_REVIEW
  GET    /reviews/stats               — compteurs par statut
  GET    /facts/{code}/review         — dernière review pour un fact_code

Tous les endpoints requièrent authentification + isolation tenant.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routers.auth import get_current_user, require_admin, require_analyst
from services import review_service
from services.auth_service import AuthUser
from services.review_service import ReviewError

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic models ──────────────────────────────────────────────────────────

class ReviewResponse(BaseModel):
    id: int
    company_id: int
    fact_code: str
    fact_event_id: int | None
    status: Literal["proposed", "in_review", "validated", "frozen", "rejected"]
    proposed_by: int | None
    proposed_at: datetime
    reviewed_by: int | None
    reviewed_at: datetime | None
    frozen_by: int | None
    frozen_at: datetime | None
    timeout_at: datetime | None
    comment: str | None
    reject_reason: str | None
    meta: dict[str, Any] | None


class InboxResponse(BaseModel):
    items: list[ReviewResponse]
    total: int
    limit: int
    offset: int


class ReviewStatsResponse(BaseModel):
    counts: dict[str, int]
    total_active: int


class ProposeRequest(BaseModel):
    fact_code: str = Field(..., min_length=1, max_length=100)
    fact_event_id: int | None = None
    comment: str | None = Field(None, max_length=2000)


class ApproveRequest(BaseModel):
    comment: str | None = Field(None, max_length=2000)


class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=2000)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _to_response(review: review_service.DatapointReview) -> ReviewResponse:
    return ReviewResponse(
        id=review.id,
        company_id=review.company_id,
        fact_code=review.fact_code,
        fact_event_id=review.fact_event_id,
        status=review.status,
        proposed_by=review.proposed_by,
        proposed_at=review.proposed_at,
        reviewed_by=review.reviewed_by,
        reviewed_at=review.reviewed_at,
        frozen_by=review.frozen_by,
        frozen_at=review.frozen_at,
        timeout_at=review.timeout_at,
        comment=review.comment,
        reject_reason=review.reject_reason,
        meta=review.meta,
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/inbox", response_model=InboxResponse)
async def inbox_endpoint(
    statuses: Annotated[list[str] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> InboxResponse:
    """Inbox paginée des reviews actives (proposed/in_review/validated par défaut)."""
    # Validation manuelle des statuts
    if statuses:
        allowed = {"proposed", "in_review", "validated", "frozen", "rejected"}
        invalid = [s for s in statuses if s not in allowed]
        if invalid:
            raise HTTPException(422, detail=f"Statuts invalides : {invalid}")
    items = review_service.inbox(
        company_id=user.company_id,
        statuses=statuses,  # type: ignore[arg-type]
        limit=limit,
        offset=offset,
    )
    total = len(items)  # approximatif — pour count exact il faudrait 1 requête de plus
    return InboxResponse(
        items=[_to_response(r) for r in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=ReviewStatsResponse)
async def review_stats(
    user: AuthUser = Depends(get_current_user),
) -> ReviewStatsResponse:
    counts = review_service.count_by_status(company_id=user.company_id)
    active = sum(counts.get(s, 0) for s in ("proposed", "in_review", "validated"))
    return ReviewStatsResponse(counts=counts, total_active=active)


@router.post("/propose", response_model=ReviewResponse, status_code=201)
async def propose_endpoint(
    body: ProposeRequest,
    user: AuthUser = Depends(require_analyst),
) -> ReviewResponse:
    """Crée une review en statut PROPOSED (timeout auto à +2h)."""
    result = review_service.propose(
        company_id=user.company_id,
        fact_code=body.fact_code,
        fact_event_id=body.fact_event_id,
        proposed_by=user.user_id,
        comment=body.comment,
    )
    if result is None:
        raise HTTPException(503, detail="Base de données indisponible")
    return _to_response(result)


@router.post("/{review_id}/approve", response_model=ReviewResponse)
async def approve_endpoint(
    review_id: int,
    body: ApproveRequest,
    user: AuthUser = Depends(require_analyst),
) -> ReviewResponse:
    try:
        result = review_service.approve(
            review_id=review_id,
            company_id=user.company_id,
            user_id=user.user_id,
            comment=body.comment,
        )
    except ReviewError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
    return _to_response(result)


@router.post("/{review_id}/reject", response_model=ReviewResponse)
async def reject_endpoint(
    review_id: int,
    body: RejectRequest,
    user: AuthUser = Depends(require_analyst),
) -> ReviewResponse:
    try:
        result = review_service.reject(
            review_id=review_id,
            company_id=user.company_id,
            user_id=user.user_id,
            reject_reason=body.reason,
        )
    except ReviewError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
    return _to_response(result)


@router.post("/{review_id}/freeze", response_model=ReviewResponse)
async def freeze_endpoint(
    review_id: int,
    user: AuthUser = Depends(require_admin),
) -> ReviewResponse:
    """Gèle une review (terminal). Réservé admin."""
    try:
        result = review_service.freeze(
            review_id=review_id,
            company_id=user.company_id,
            user_id=user.user_id,
        )
    except ReviewError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
    return _to_response(result)


@router.post("/{review_id}/move-to-review", response_model=ReviewResponse)
async def move_to_review_endpoint(
    review_id: int,
    user: AuthUser = Depends(require_analyst),
) -> ReviewResponse:
    try:
        result = review_service.move_to_review(
            review_id=review_id,
            company_id=user.company_id,
            user_id=user.user_id,
        )
    except ReviewError as exc:
        raise HTTPException(409, detail=str(exc)) from exc
    return _to_response(result)


@router.get("/by-code/{fact_code}", response_model=ReviewResponse | None)
async def latest_by_code_endpoint(
    fact_code: str,
    user: AuthUser = Depends(get_current_user),
) -> ReviewResponse | None:
    """Dernière review (quelle que soit le statut) pour un fact_code."""
    result = review_service.latest_by_code(
        company_id=user.company_id, fact_code=fact_code,
    )
    return _to_response(result) if result else None
