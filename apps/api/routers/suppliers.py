"""
suppliers.py — Endpoints fournisseurs Phase 4.

Endpoints protégés (require_analyst ou require_admin) :
  GET    /suppliers              — liste paginée
  POST   /suppliers              — créer un fournisseur
  GET    /suppliers/{id}         — détail fournisseur
  PATCH  /suppliers/{id}         — mise à jour partielle
  DELETE /suppliers/{id}         — supprimer (admin)
  GET    /suppliers/{id}/tokens  — lister les tokens questionnaire
  POST   /suppliers/{id}/tokens  — générer un token
  GET    /suppliers/{id}/answers — réponses reçues
  GET    /suppliers/scope3       — agrégat GES scope 3

Endpoints publics (no auth) :
  GET  /suppliers/public/q/{token}  — contexte du questionnaire
  POST /suppliers/public/q/{token}  — soumettre une réponse
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query

from db.tenant import get_company_id
from routers.auth import require_admin, require_analyst
from services.auth_service import AuthUser
from services.supplier_service import (
    SupplierAnswerCreate,
    SupplierAnswerOut,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
    TokenCreate,
    TokenOut,
    PublicQuestionnaireContext,
    create_supplier,
    create_token,
    delete_supplier,
    get_answers,
    get_supplier,
    list_suppliers,
    list_tokens,
    resolve_token,
    scope3_summary,
    submit_answer,
    update_supplier,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Scope 3 summary (must be before /{id} routes to avoid matching conflict)
# ---------------------------------------------------------------------------

@router.get("/scope3")
def get_scope3_summary(company_id: int = Depends(get_company_id)) -> dict:
    """Agrégation GES scope 3 par fournisseur — top 20 + by category."""
    return scope3_summary(company_id)


# ---------------------------------------------------------------------------
# CRUD fournisseurs
# ---------------------------------------------------------------------------

class SupplierListResponse(dict):
    pass


@router.get("", response_model=list[SupplierOut])
def get_suppliers(
    status: str | None = Query(default=None, description="Filtre par statut : active|pending|archived"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    company_id: int = Depends(get_company_id),
) -> list[SupplierOut]:
    suppliers, _ = list_suppliers(company_id, status=status, limit=limit, offset=offset)
    return suppliers


@router.post("", response_model=SupplierOut, status_code=201)
def post_supplier(
    payload: SupplierCreate,
    user: AuthUser = Depends(require_analyst),
) -> SupplierOut:
    return create_supplier(payload, user.company_id)


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier_detail(
    supplier_id: int,
    company_id: int = Depends(get_company_id),
) -> SupplierOut:
    supplier = get_supplier(supplier_id, company_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierOut)
def patch_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    user: AuthUser = Depends(require_analyst),
) -> SupplierOut:
    supplier = update_supplier(supplier_id, payload, user.company_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return supplier


@router.delete("/{supplier_id}", status_code=204)
def del_supplier(
    supplier_id: int,
    user: AuthUser = Depends(require_admin),
) -> None:
    deleted = delete_supplier(supplier_id, user.company_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")


# ---------------------------------------------------------------------------
# Questionnaire tokens
# ---------------------------------------------------------------------------

@router.get("/{supplier_id}/tokens", response_model=list[TokenOut])
def get_tokens(
    supplier_id: int,
    user: AuthUser = Depends(require_analyst),
) -> list[TokenOut]:
    return list_tokens(supplier_id, user.company_id)


@router.post("/{supplier_id}/tokens", response_model=TokenOut, status_code=201)
def post_token(
    supplier_id: int,
    payload: TokenCreate,
    user: AuthUser = Depends(require_analyst),
) -> TokenOut:
    base_url = os.environ.get("FRONTEND_URL", "https://carbon-snowy-nine.vercel.app")
    tok = create_token(supplier_id, user.company_id, payload, base_url=base_url)
    if not tok:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return tok


# ---------------------------------------------------------------------------
# Réponses reçues (protégées)
# ---------------------------------------------------------------------------

@router.get("/{supplier_id}/answers", response_model=list[SupplierAnswerOut])
def get_supplier_answers(
    supplier_id: int,
    user: AuthUser = Depends(require_analyst),
) -> list[SupplierAnswerOut]:
    return get_answers(supplier_id, user.company_id)


# ---------------------------------------------------------------------------
# Endpoints publics — questionnaire (no auth required)
# ---------------------------------------------------------------------------

@router.get("/public/q/{token}", response_model=PublicQuestionnaireContext)
def get_questionnaire_context(token: str) -> PublicQuestionnaireContext:
    """
    Retourne le contexte public du questionnaire (nom fournisseur + campagne).
    N'expose aucune donnée confidentielle.
    """
    ctx = resolve_token(token)
    if not ctx:
        raise HTTPException(status_code=404, detail="Token invalide ou introuvable")

    from datetime import datetime, timezone
    now = datetime.now(tz=timezone.utc)
    expires_at = ctx.get("expires_at")
    if expires_at and now > expires_at:
        raise HTTPException(status_code=410, detail="Ce lien questionnaire a expiré")

    already_answered = ctx.get("used_at") is not None

    return PublicQuestionnaireContext(
        supplier_name=ctx["supplier_name"],
        company_name=ctx["company_name"],
        campaign=ctx.get("campaign"),
        expires_at=expires_at,
        already_answered=already_answered,
    )


@router.post("/public/q/{token}", response_model=SupplierAnswerOut, status_code=201)
def post_questionnaire_answer(
    token: str,
    payload: SupplierAnswerCreate,
) -> SupplierAnswerOut:
    """
    Soumet une réponse au questionnaire via le token public.
    Accessible sans authentification (lien envoyé par email au fournisseur).
    """
    ctx = resolve_token(token)
    if not ctx:
        raise HTTPException(status_code=404, detail="Token invalide ou introuvable")

    from datetime import datetime, timezone
    now = datetime.now(tz=timezone.utc)
    expires_at = ctx.get("expires_at")
    if expires_at and now > expires_at:
        raise HTTPException(status_code=410, detail="Ce lien questionnaire a expiré")

    answer = submit_answer(token, payload)
    if not answer:
        raise HTTPException(status_code=422, detail="Impossible de soumettre la réponse")
    return answer
