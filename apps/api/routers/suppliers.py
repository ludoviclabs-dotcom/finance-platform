"""
suppliers.py — Endpoints fournisseurs Phase 4 + campagnes de collecte (T7.3).

Endpoints protégés (require_analyst ou require_admin) :
  GET    /suppliers              — liste paginée
  POST   /suppliers              — créer un fournisseur
  POST   /suppliers/import-csv   — import CSV de fournisseurs (dédupliqué)
  GET    /suppliers/{id}         — détail fournisseur
  PATCH  /suppliers/{id}         — mise à jour partielle
  DELETE /suppliers/{id}         — supprimer (admin)
  GET    /suppliers/{id}/tokens  — lister les tokens questionnaire
  POST   /suppliers/{id}/tokens  — générer un token
  GET    /suppliers/{id}/answers — réponses reçues
  GET    /suppliers/scope3       — agrégat GES scope 3

Campagnes de collecte (T7.3) :
  GET    /suppliers/campaigns                    — campagnes + stats de réponse
  POST   /suppliers/campaigns                    — créer une campagne
  POST   /suppliers/campaigns/reminders/run     — relances J-14/J-7/deadline (cron)
  GET    /suppliers/campaigns/{id}              — suivi détaillé (invitations)
  POST   /suppliers/campaigns/{id}/invites      — inviter des fournisseurs (tokens)
  POST   /suppliers/campaigns/{id}/close        — clôturer

Revue des réponses (gate avant intégration) :
  GET    /suppliers/answers/pending             — réponses à valider + anomalies
  POST   /suppliers/answers/{id}/review         — accepter / signaler

Endpoints publics (no auth) :
  GET  /suppliers/public/q/{token}  — contexte du questionnaire (stampe viewed_at)
  POST /suppliers/public/q/{token}  — soumettre une réponse
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query

from db.tenant import get_company_id
from models.procurement import (
    SupplierProductCreate,
    SupplierProductListResponse,
    SupplierProductResponse,
    SupplierSiteCreate,
    SupplierSiteListResponse,
    SupplierSiteResponse,
)
from routers._errors import http_error, require_db
from routers.auth import (
    get_current_user,
    require_admin,
    require_analyst,
    require_cron_or_analyst,
)
from services import supplier_campaigns_service as campaigns_svc
from services.auth_service import AuthUser
from services.procurement import supplier_sites_service
from services.supplier_campaigns_service import (
    AnswerReviewRequest,
    CampaignCreate,
    CampaignInvite,
    CampaignOut,
    CsvImportRequest,
    InviteRequest,
    PendingAnswer,
)
from services.supplier_service import (
    PublicQuestionnaireContext,
    SupplierAnswerCreate,
    SupplierAnswerOut,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
    TokenCreate,
    TokenOut,
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
# Campagnes de collecte (T7.3) — déclarées AVANT les routes /{supplier_id}
# pour éviter que "campaigns" ne soit interprété comme un id fournisseur.
# ---------------------------------------------------------------------------

@router.get("/campaigns", response_model=list[CampaignOut])
def get_campaigns(company_id: int = Depends(get_company_id)) -> list[CampaignOut]:
    """Campagnes de collecte avec statistiques de réponse (invités/vus/complétés)."""
    return campaigns_svc.list_campaigns(company_id)


@router.post("/campaigns", response_model=CampaignOut, status_code=201)
def post_campaign(
    payload: CampaignCreate,
    user: AuthUser = Depends(require_analyst),
) -> CampaignOut:
    return campaigns_svc.create_campaign(payload, user.company_id, user.email)


@router.post("/campaigns/reminders/run", dependencies=[Depends(require_cron_or_analyst)])
def run_campaign_reminders() -> dict:
    """Relances des campagnes actives (paliers J-14 / J-7 / deadline).

    Appelé par le cron quotidien (CRON_SERVICE_TOKEN) — notifications in-app
    systématiques, e-mails fournisseurs uniquement si EMAIL_ENABLED. Idempotent
    palier par palier (anti-spam).
    """
    return campaigns_svc.run_campaign_reminders()


@router.get("/campaigns/{campaign_id}")
def get_campaign_detail(
    campaign_id: int,
    company_id: int = Depends(get_company_id),
) -> dict:
    """Suivi détaillé d'une campagne : invitations, statuts, liens."""
    campaign = next(
        (c for c in campaigns_svc.list_campaigns(company_id) if c.id == campaign_id), None
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campagne introuvable")
    invites = campaigns_svc.campaign_invites(company_id, campaign_id)
    return {"campaign": campaign, "invites": invites}


@router.post("/campaigns/{campaign_id}/invites", response_model=list[CampaignInvite])
def post_campaign_invites(
    campaign_id: int,
    payload: InviteRequest,
    user: AuthUser = Depends(require_analyst),
) -> list[CampaignInvite]:
    """Génère les liens d'invitation (un token par fournisseur, dédupliqué)."""
    if not payload.supplier_ids and not payload.all_active:
        raise HTTPException(status_code=400, detail="supplier_ids ou all_active requis")
    invites = campaigns_svc.invite_suppliers(
        campaign_id, user.company_id, payload.supplier_ids, all_active=payload.all_active,
    )
    if not invites and not payload.all_active:
        # Campagne inexistante/clôturée OU fournisseurs inconnus — distinguer
        campaign = next(
            (c for c in campaigns_svc.list_campaigns(user.company_id) if c.id == campaign_id), None
        )
        if not campaign or campaign.status != "active":
            raise HTTPException(status_code=404, detail="Campagne introuvable ou clôturée")
    return invites


@router.post("/campaigns/{campaign_id}/close", status_code=204)
def post_campaign_close(
    campaign_id: int,
    user: AuthUser = Depends(require_analyst),
) -> None:
    if not campaigns_svc.close_campaign(campaign_id, user.company_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable ou déjà clôturée")


# ---------------------------------------------------------------------------
# Import CSV (T7.3)
# ---------------------------------------------------------------------------

@router.post("/import-csv")
def post_import_csv(
    payload: CsvImportRequest,
    user: AuthUser = Depends(require_analyst),
) -> dict:
    """Import en masse de fournisseurs depuis un CSV (dédup par nom).

    Colonnes reconnues : name/nom (obligatoire), email, contact, pays, secteur,
    catégorie scope 3, dépenses (€), GES estimé (tCO2e). Séparateur , ou ;.
    """
    return campaigns_svc.import_suppliers_csv(payload.csv_text, user.company_id)


# ---------------------------------------------------------------------------
# Revue des réponses (T7.3) — gate avant intégration
# ---------------------------------------------------------------------------

@router.get("/answers/pending", response_model=list[PendingAnswer])
def get_pending_answers(company_id: int = Depends(get_company_id)) -> list[PendingAnswer]:
    """Réponses fournisseurs en attente de revue, avec anomalies détectées."""
    return campaigns_svc.list_pending_answers(company_id)


@router.post("/answers/{answer_id}/review")
def post_answer_review(
    answer_id: int,
    payload: AnswerReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> dict:
    """Accepte (→ met à jour l'estimation GES du fournisseur) ou signale une réponse."""
    result = campaigns_svc.review_answer(answer_id, user.company_id, payload, user.email)
    if not result:
        raise HTTPException(status_code=404, detail="Réponse introuvable ou déjà revue")
    return result


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
# Sites & produits fournisseurs (PR-05A) — sous-ressources de /{supplier_id}.
# Lecture : get_current_user (JWT réel, PAS get_company_id qui retomberait sur
# le tenant 1) ; écriture : require_analyst. Ces routes paramétrées + suffixe
# ne capturent aucune route littérale (pas de conflit d'ordonnancement).
# ---------------------------------------------------------------------------

@router.get("/{supplier_id}/sites", response_model=SupplierSiteListResponse)
def get_supplier_sites(
    supplier_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> SupplierSiteListResponse:
    require_db()
    items, total = supplier_sites_service.list_sites(
        company_id=user.company_id, supplier_id=supplier_id, limit=limit, offset=offset,
    )
    return SupplierSiteListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/{supplier_id}/sites", response_model=SupplierSiteResponse, status_code=201)
def post_supplier_site(
    supplier_id: int,
    payload: SupplierSiteCreate,
    user: AuthUser = Depends(require_analyst),
) -> SupplierSiteResponse:
    require_db()
    try:
        return supplier_sites_service.create_site(
            company_id=user.company_id, supplier_id=supplier_id, payload=payload, created_by=user.user_id,
        )
    except supplier_sites_service.SupplierSitesError as exc:
        raise http_error(exc) from exc


@router.get("/{supplier_id}/products", response_model=SupplierProductListResponse)
def get_supplier_products(
    supplier_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> SupplierProductListResponse:
    require_db()
    items, total = supplier_sites_service.list_products(
        company_id=user.company_id, supplier_id=supplier_id, limit=limit, offset=offset,
    )
    return SupplierProductListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/{supplier_id}/products", response_model=SupplierProductResponse, status_code=201)
def post_supplier_product(
    supplier_id: int,
    payload: SupplierProductCreate,
    user: AuthUser = Depends(require_analyst),
) -> SupplierProductResponse:
    require_db()
    try:
        return supplier_sites_service.create_product(
            company_id=user.company_id, supplier_id=supplier_id, payload=payload, created_by=user.user_id,
        )
    except supplier_sites_service.SupplierSitesError as exc:
        raise http_error(exc) from exc


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

    # T7.3 : stampe la PREMIÈRE consultation (statut « viewed » du suivi de
    # campagne). Best-effort — n'échoue jamais le rendu du questionnaire.
    campaigns_svc.mark_token_viewed(token)

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
