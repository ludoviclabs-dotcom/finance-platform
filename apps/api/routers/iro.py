"""
routers/iro.py — IRO, double matérialité et transmission financière (PR-10),
préfixe `/iro`.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`).
Écriture (POST) de préparation : `require_analyst`. Décision de matérialité
(`POST .../decide`) : `require_admin` — JAMAIS `require_analyst` seul, une
décision de matérialité est un geste à autorité plus élevée que sa
préparation (motif direct `POST /energy/scope2/runs/{id}/approve`, PR-06B).

Endpoints :
  GET  /iro/iros                                — pagination, filtres
  POST /iro/iros                                — création manuelle OU interne,
                                                    toujours status='candidate'
  GET  /iro/iros/{id}                           — vue complète (IRO + évaluations
                                                    + décisions + actions + preuves)
  POST /iro/iros/{id}/impact-assessment         — AnalyticalEnvelope
  POST /iro/iros/{id}/financial-assessment      — AnalyticalEnvelope
  POST /iro/iros/{id}/decide                    — require_admin
  GET  /iro/iros/{id}/decisions                 — historique complet (append-only)
  POST /iro/iros/{id}/actions · GET
  POST /iro/iros/{id}/disclosure-mappings · GET
  GET  /iro/iros/{id}/evidence-pack             — require_analyst — via export_package

Toutes les routes de ce fichier sont NEUVES (migration 040 pas encore
appliquée au moment où la production déploie ce code) : chacune est sous
`schema_ready_guard` et répond 503 `schema_not_ready` tant que le schéma
n'est pas migré (motif PR-08/PR-09) — jamais une erreur SQL brute.

Aucun LLM, aucune source externe, aucun appel réseau, aucune écriture de
production par ce code. Aucune décision de matérialité automatique : un
signal externe crée au plus un IRO `candidate`, jamais davantage.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from db.database import get_db
from models.analytics import AnalyticalEnvelope
from models.iro import (
    DisclosureMappingCreate,
    DisclosureMappingListResponse,
    DisclosureMappingResponse,
    FinancialAssessmentCreate,
    FinancialAssessmentResponse,
    ImpactAssessmentCreate,
    ImpactAssessmentResponse,
    IroActionCreate,
    IroActionListResponse,
    IroActionResponse,
    IroCreate,
    IroDetailResponse,
    IroListResponse,
    IroResponse,
    MaterialityDecisionCreate,
    MaterialityDecisionListResponse,
    MaterialityDecisionResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_admin, require_analyst
from services import export_package
from services.auth_service import AuthUser
from services.iro import (
    disclosure_mapping_service,
    financial_assessment_service,
    impact_assessment_service,
    iro_actions_service,
    iro_service,
    materiality_decision_service,
)

router = APIRouter()

_IRO_ERRORS = (
    iro_service.IroError,
    impact_assessment_service.ImpactAssessmentError,
    financial_assessment_service.FinancialAssessmentError,
    materiality_decision_service.MaterialityDecisionError,
    iro_actions_service.IroActionError,
    disclosure_mapping_service.DisclosureMappingError,
)


def _company_name(company_id: int) -> str:
    """Nom affichable du tenant pour l'Evidence Pack (même geste que
    `services/calculations/scope2_runs.py::company_name` / `routers/export.py`
    — chaque domaine garde sa propre copie triviale plutôt que d'importer un
    autre domaine pour un simple SELECT). Repli explicite si la ligne est
    absente — jamais une exception qui empêcherait de produire une preuve."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM companies WHERE id = %s", (company_id,))
            row = cur.fetchone()
    return row["name"] if row else "Entreprise"


# ---------------------------------------------------------------------------
# iros — registre
# ---------------------------------------------------------------------------

@router.get("/iros", response_model=IroListResponse)
async def list_iros_endpoint(
    status: str | None = Query(None),
    iro_type: str | None = Query(None),
    origin_domain: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> IroListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return iro_service.list_iros(
                company_id=user.company_id, status=status, iro_type=iro_type,
                origin_domain=origin_domain, limit=limit, offset=offset,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/iros", response_model=IroResponse, status_code=201)
async def create_iro_endpoint(
    body: IroCreate,
    user: AuthUser = Depends(require_analyst),
) -> IroResponse:
    """Création manuelle (écran IRO) OU interne (point d'appel additif depuis
    un domaine — eau/nature/CRMA) : toujours `status='candidate'`, jamais une
    décision (contrats §10)."""
    require_db()
    try:
        with schema_ready_guard():
            return iro_service.create_iro(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/iros/{iro_id}", response_model=IroDetailResponse)
async def get_iro_detail_endpoint(
    iro_id: int,
    user: AuthUser = Depends(get_current_user),
) -> IroDetailResponse:
    """Vue complète : IRO + évaluations d'impact + évaluations financières +
    décisions (append-only) + actions + disclosure mappings + preuves
    complémentaires (`claim_link_service`)."""
    require_db()
    try:
        with schema_ready_guard():
            return iro_service.get_iro_detail(company_id=user.company_id, iro_id=iro_id)
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Évaluations — deux dimensions strictement séparées
# ---------------------------------------------------------------------------

@router.post(
    "/iros/{iro_id}/impact-assessment",
    response_model=AnalyticalEnvelope[ImpactAssessmentResponse],
    status_code=201,
)
async def create_impact_assessment_endpoint(
    iro_id: int,
    body: ImpactAssessmentCreate,
    user: AuthUser = Depends(require_analyst),
) -> AnalyticalEnvelope[ImpactAssessmentResponse]:
    require_db()
    try:
        with schema_ready_guard():
            return impact_assessment_service.create_impact_assessment(
                company_id=user.company_id, iro_id=iro_id, payload=body, prepared_by=user.user_id,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


@router.post(
    "/iros/{iro_id}/financial-assessment",
    response_model=AnalyticalEnvelope[FinancialAssessmentResponse],
    status_code=201,
)
async def create_financial_assessment_endpoint(
    iro_id: int,
    body: FinancialAssessmentCreate,
    user: AuthUser = Depends(require_analyst),
) -> AnalyticalEnvelope[FinancialAssessmentResponse]:
    require_db()
    try:
        with schema_ready_guard():
            return financial_assessment_service.create_financial_assessment(
                company_id=user.company_id, iro_id=iro_id, payload=body, prepared_by=user.user_id,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Décision de matérialité — HUMAINE, require_admin, append-only
# ---------------------------------------------------------------------------

@router.post("/iros/{iro_id}/decide", response_model=MaterialityDecisionResponse, status_code=201)
async def decide_materiality_endpoint(
    iro_id: int,
    body: MaterialityDecisionCreate,
    user: AuthUser = Depends(require_admin),
) -> MaterialityDecisionResponse:
    """`require_admin` — JAMAIS `require_analyst` seul : une décision de
    matérialité est un geste à autorité plus élevée que sa préparation (motif
    `POST /energy/scope2/runs/{id}/approve`). Une redécision INSÈRE une
    nouvelle ligne (`supersedes_id`), n'écrase jamais l'ancienne."""
    require_db()
    try:
        with schema_ready_guard():
            return materiality_decision_service.decide(
                company_id=user.company_id, iro_id=iro_id, payload=body, decided_by=user.user_id,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/iros/{iro_id}/decisions", response_model=MaterialityDecisionListResponse)
async def list_decisions_endpoint(
    iro_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> MaterialityDecisionListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return materiality_decision_service.list_decisions(
                company_id=user.company_id, iro_id=iro_id, limit=limit, offset=offset,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

@router.post("/iros/{iro_id}/actions", response_model=IroActionResponse, status_code=201)
async def create_iro_action_endpoint(
    iro_id: int,
    body: IroActionCreate,
    user: AuthUser = Depends(require_analyst),
) -> IroActionResponse:
    require_db()
    try:
        with schema_ready_guard():
            return iro_actions_service.create_action(
                company_id=user.company_id, iro_id=iro_id, payload=body, created_by=user.user_id,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/iros/{iro_id}/actions", response_model=IroActionListResponse)
async def list_iro_actions_endpoint(
    iro_id: int,
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> IroActionListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return iro_actions_service.list_actions(
                company_id=user.company_id, iro_id=iro_id, status=status, limit=limit, offset=offset,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Disclosure mappings — correspondance pure
# ---------------------------------------------------------------------------

@router.post("/iros/{iro_id}/disclosure-mappings", response_model=DisclosureMappingResponse, status_code=201)
async def create_disclosure_mapping_endpoint(
    iro_id: int,
    body: DisclosureMappingCreate,
    user: AuthUser = Depends(require_analyst),
) -> DisclosureMappingResponse:
    require_db()
    try:
        with schema_ready_guard():
            return disclosure_mapping_service.create_mapping(
                company_id=user.company_id, iro_id=iro_id, payload=body, created_by=user.user_id,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/iros/{iro_id}/disclosure-mappings", response_model=DisclosureMappingListResponse)
async def list_disclosure_mappings_endpoint(
    iro_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> DisclosureMappingListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return disclosure_mapping_service.list_mappings(
                company_id=user.company_id, iro_id=iro_id, limit=limit, offset=offset,
            )
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Evidence Pack
# ---------------------------------------------------------------------------

@router.get("/iros/{iro_id}/evidence-pack")
async def iro_evidence_pack_endpoint(
    iro_id: int,
    user: AuthUser = Depends(require_analyst),
) -> StreamingResponse:
    """Evidence Pack d'un IRO : ZIP signé (manifest + CHECKSUMS) contenant
    l'IRO, ses évaluations (composantes séparées), l'historique complet des
    décisions, les actions, les disclosure mappings et les preuves
    complémentaires — jamais un score unique (motif `IRO_PACK_DOMAIN`,
    `services/export_package.py`)."""
    require_db()
    try:
        with schema_ready_guard():
            detail = iro_service.get_iro_detail(company_id=user.company_id, iro_id=iro_id)
    except _IRO_ERRORS as exc:
        raise http_error(exc) from exc

    pack = export_package.build_iro_evidence_pack(
        company_id=user.company_id,
        company_name=_company_name(user.company_id),
        detail=detail.model_dump(mode="json"),
        generated_by=user.user_id,
    )
    return StreamingResponse(
        iter([pack.zip_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{pack.filename}"',
            "X-Package-Hash": pack.package_hash,
            "X-Manifest-Hash": pack.manifest_hash,
        },
    )
