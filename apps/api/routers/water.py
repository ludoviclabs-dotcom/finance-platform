"""
routers/water.py — ledger eau et screening hydrique (PR-08), préfixe `/water`.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`).
Écriture (POST) : `require_analyst`.

Endpoints tranche A (036) :
  POST /water/activities/import           — import CSV idempotent (sha256)
  POST /water/imports/{id}/review         — gate de revue d'un import
  POST /water/activities · GET            — saisie directe + liste filtrable
  POST /water/activities/{id}/review      — gate de revue d'une activité
  POST /water/permits · GET · GET /{id}   — permis (preuve Evidence Kernel)
  POST /water/permits/{id}/review         — gate de revue d'un permis
  GET  /water/risk-areas                  — référentiel de zones (LECTURE SEULE :
                                            l'ingestion passe par le CLI
                                            d'administration, jamais par un
                                            endpoint utilisateur)

Endpoints tranche B (037) :
  POST /water/screenings/calculate        — screening versionné (AnalyticalEnvelope,
                                            method_code géométrique explicite)
  GET  /water/screenings · GET /{id}      — historique des runs
  POST /water/screenings/{id}/flag-for-iro — signal humain « à examiner comme
                                            IRO » (jamais une décision)
  POST /water/targets · GET · /review     — cibles eau
  POST /water/actions · GET · /review     — actions eau

TOUTES ces routes sont NEUVES (migrations 036/037 pas encore appliquées au
moment où la production déploie ce code) : chacune est sous
`schema_ready_guard` et répond 503 `schema_not_ready` tant que le schéma n'est
pas migré — jamais une erreur SQL brute.

Aucun LLM, aucune source externe, aucun appel réseau, aucune écriture de
production par ce code.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from models.analytics import AnalyticalEnvelope
from models.water import (
    IroSignalRequest,
    WaterActionCreate,
    WaterActionListResponse,
    WaterActionResponse,
    WaterActivityCreate,
    WaterActivityListResponse,
    WaterActivityResponse,
    WaterActivityReviewRequest,
    WaterImportRequest,
    WaterImportResponse,
    WaterImportReviewRequest,
    WaterPermitCreate,
    WaterPermitListResponse,
    WaterPermitResponse,
    WaterRiskAreaListResponse,
    WaterScreeningData,
    WaterScreeningListResponse,
    WaterScreeningRequest,
    WaterScreeningSummary,
    WaterTargetCreate,
    WaterTargetListResponse,
    WaterTargetResponse,
)
from models.water_intelligence_api import (
    DecisionSynthesisResponse,
    FinancialScenarioRequest,
    FinancialScenarioResponse,
    ScenarioQuantityInput,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.water import (
    activities_service,
    permits_service,
    risk_areas_service,
    screening_service,
    targets_actions_service,
    water_synthesis_service,
)
from services.water_intelligence.financial_scenarios import (
    UNIT_CURRENCY,
    UNIT_CURRENCY_PER_DAY,
    UNIT_DAY,
    UNIT_RATIO,
    FinancialScenarioError,
    Quantity,
    WaterDisruptionScenario,
    build_exposure,
)

router = APIRouter()

_WATER_ERRORS = (
    activities_service.WaterActivityError,
    permits_service.WaterPermitError,
    risk_areas_service.WaterRiskAreaError,
    screening_service.WaterScreeningError,
    targets_actions_service.WaterPlanError,
)

#: Unité imposée PAR CHAMP pour le moteur financier.
#:
#: L'appelant ne choisit pas l'unité d'une grandeur : laisser `outage_days`
#: arriver en euros ouvrirait à la frontière exactement la confusion que le
#: moteur refuse en interne. La table est donc fermée et vérifiée par test.
_SCENARIO_UNITS: dict[str, str] = {
    "outage_days": UNIT_DAY,
    "affected_capacity_share": UNIT_RATIO,
    "revenue_per_day": UNIT_CURRENCY_PER_DAY,
    "margin_rate": UNIT_RATIO,
    "additional_opex_per_day": UNIT_CURRENCY_PER_DAY,
    "adaptation_capex": UNIT_CURRENCY,
    "discount_rate": UNIT_RATIO,
    "probability": UNIT_RATIO,
}


def _quantity(field: str, supplied: ScenarioQuantityInput) -> Quantity:
    """Convertit une grandeur d'API en grandeur du moteur.

    L'unité vient de la table, jamais de l'appelant ; la provenance et la base
    viennent de l'appelant, qui est seul à savoir d'où sort son hypothèse.
    """
    return Quantity(
        value=supplied.value,
        unit=_SCENARIO_UNITS[field],
        provenance=supplied.provenance,
        basis=supplied.basis,
    )


def build_scenario_from_request(body: FinancialScenarioRequest) -> WaterDisruptionScenario:
    """Adapte une requête HTTP en scénario du moteur pur.

    Le moteur reste ignorant de HTTP ; le routeur reste ignorant de
    l'arithmétique. Toute hypothèse mal formée est refusée par le moteur, qui
    est le seul endroit où cette règle vit.
    """
    return WaterDisruptionScenario(
        scenario_code=body.scenario_code,
        label=body.label,
        base_year=body.base_year,
        horizon_year=body.horizon_year,
        outage_days=_quantity("outage_days", body.outage_days),
        affected_capacity_share=_quantity(
            "affected_capacity_share", body.affected_capacity_share
        ),
        revenue_per_day=_quantity("revenue_per_day", body.revenue_per_day),
        margin_rate=_quantity("margin_rate", body.margin_rate),
        additional_opex_per_day=_quantity(
            "additional_opex_per_day", body.additional_opex_per_day
        ),
        adaptation_capex=_quantity("adaptation_capex", body.adaptation_capex),
        discount_rate=_quantity("discount_rate", body.discount_rate),
        probability=(
            _quantity("probability", body.probability) if body.probability else None
        ),
    )


# ---------------------------------------------------------------------------
# Activités — import idempotent + gate de revue
# ---------------------------------------------------------------------------

@router.post("/activities/import", response_model=WaterImportResponse, status_code=201)
async def import_activities_endpoint(
    body: WaterImportRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterImportResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.create_import(
                company_id=user.company_id, filename=body.filename,
                content=body.csv_text.encode("utf-8"), imported_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/imports/{import_id}/review", response_model=WaterImportResponse)
async def review_import_endpoint(
    import_id: int,
    body: WaterImportReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterImportResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.review_import(
                company_id=user.company_id, import_id=import_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/activities", response_model=WaterActivityResponse, status_code=201)
async def create_activity_endpoint(
    body: WaterActivityCreate,
    user: AuthUser = Depends(require_analyst),
) -> WaterActivityResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.create_activity(
                company_id=user.company_id, created_by=user.user_id,
                **body.model_dump(),
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/activities", response_model=WaterActivityListResponse)
async def list_activities_endpoint(
    site_id: int | None = Query(None),
    activity_type: str | None = Query(None),
    review_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterActivityListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.list_activities(
                company_id=user.company_id, site_id=site_id,
                activity_type=activity_type, review_status=review_status,
                limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/activities/{activity_id}/review", response_model=WaterActivityResponse)
async def review_activity_endpoint(
    activity_id: int,
    body: WaterActivityReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterActivityResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.review_activity(
                company_id=user.company_id, activity_id=activity_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Permis
# ---------------------------------------------------------------------------

@router.post("/permits", response_model=WaterPermitResponse, status_code=201)
async def create_permit_endpoint(
    body: WaterPermitCreate,
    user: AuthUser = Depends(require_analyst),
) -> WaterPermitResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.create_permit(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/permits", response_model=WaterPermitListResponse)
async def list_permits_endpoint(
    site_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterPermitListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.list_permits(
                company_id=user.company_id, site_id=site_id, status=status,
                limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/permits/{permit_id}", response_model=WaterPermitResponse)
async def get_permit_endpoint(
    permit_id: int,
    user: AuthUser = Depends(get_current_user),
) -> WaterPermitResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.get_permit(
                company_id=user.company_id, permit_id=permit_id
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/permits/{permit_id}/review", response_model=WaterPermitResponse)
async def review_permit_endpoint(
    permit_id: int,
    body: WaterActivityReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterPermitResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.review_permit(
                company_id=user.company_id, permit_id=permit_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Référentiel de zones — LECTURE SEULE (ingestion = CLI/admin uniquement)
# ---------------------------------------------------------------------------

@router.get("/risk-areas", response_model=WaterRiskAreaListResponse)
async def list_risk_areas_endpoint(
    scenario_code: str | None = Query(None),
    area_kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterRiskAreaListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return risk_areas_service.list_areas(
                company_id=user.company_id, scenario_code=scenario_code,
                area_kind=area_kind, limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Screening (tranche B) — résultat versionné, enveloppe analytique partagée
# ---------------------------------------------------------------------------

@router.post("/screenings/calculate", response_model=AnalyticalEnvelope[WaterScreeningData])
async def calculate_screening_endpoint(
    body: WaterScreeningRequest,
    user: AuthUser = Depends(require_analyst),
) -> AnalyticalEnvelope[WaterScreeningData]:
    """Screening versionné et immuable. Refus EXPLICITES (jamais silencieux) :
    position non acceptée, précision insuffisante, référentiel vide, licence
    sans usage dérivé. `data.method_code` nomme la méthode géométrique réelle
    (geojson_point_in_polygon_v1 — jamais présentée comme ST_Intersects)."""
    require_db()
    try:
        with schema_ready_guard():
            return screening_service.calculate(
                company_id=user.company_id, site_id=body.site_id,
                scenario_code=body.scenario_code, calculated_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/screenings", response_model=WaterScreeningListResponse)
async def list_screenings_endpoint(
    site_id: int | None = Query(None),
    iro_signal: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterScreeningListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return screening_service.list_screenings(
                company_id=user.company_id, site_id=site_id, iro_signal=iro_signal,
                limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/screenings/{screening_id}", response_model=WaterScreeningSummary)
async def get_screening_endpoint(
    screening_id: int,
    user: AuthUser = Depends(get_current_user),
) -> WaterScreeningSummary:
    require_db()
    try:
        with schema_ready_guard():
            return screening_service.get_screening(
                company_id=user.company_id, screening_id=screening_id
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/screenings/{screening_id}/flag-for-iro", response_model=WaterScreeningSummary)
async def flag_screening_for_iro_endpoint(
    screening_id: int,
    body: IroSignalRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterScreeningSummary:
    """Signal HUMAIN « à examiner comme IRO », justification obligatoire. Ne
    crée jamais de ligne IRO ni de décision de matérialité (PR-10)."""
    require_db()
    try:
        with schema_ready_guard():
            return screening_service.flag_for_iro(
                company_id=user.company_id, screening_id=screening_id,
                rationale=body.rationale, flagged_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Cibles et actions (tranche B)
# ---------------------------------------------------------------------------

@router.post("/targets", response_model=WaterTargetResponse, status_code=201)
async def create_target_endpoint(
    body: WaterTargetCreate,
    user: AuthUser = Depends(require_analyst),
) -> WaterTargetResponse:
    require_db()
    try:
        with schema_ready_guard():
            return targets_actions_service.create_target(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/targets", response_model=WaterTargetListResponse)
async def list_targets_endpoint(
    site_id: int | None = Query(None),
    screening_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterTargetListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return targets_actions_service.list_targets(
                company_id=user.company_id, site_id=site_id,
                screening_id=screening_id, limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/targets/{target_id}/review", response_model=WaterTargetResponse)
async def review_target_endpoint(
    target_id: int,
    body: WaterActivityReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterTargetResponse:
    require_db()
    try:
        with schema_ready_guard():
            return targets_actions_service.review_target(
                company_id=user.company_id, target_id=target_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/actions", response_model=WaterActionResponse, status_code=201)
async def create_water_action_endpoint(
    body: WaterActionCreate,
    user: AuthUser = Depends(require_analyst),
) -> WaterActionResponse:
    require_db()
    try:
        with schema_ready_guard():
            return targets_actions_service.create_action(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/actions", response_model=WaterActionListResponse)
async def list_water_actions_endpoint(
    site_id: int | None = Query(None),
    screening_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterActionListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return targets_actions_service.list_actions(
                company_id=user.company_id, site_id=site_id,
                screening_id=screening_id, status=status, limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/actions/{action_id}/review", response_model=WaterActionResponse)
async def review_water_action_endpoint(
    action_id: int,
    body: WaterActivityReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterActionResponse:
    require_db()
    try:
        with schema_ready_guard():
            return targets_actions_service.review_action(
                company_id=user.company_id, action_id=action_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Couche décisionnelle (Wave E) — synthèse tenant et moteur financier
# ---------------------------------------------------------------------------
#
# Deux endpoints AUTHENTIFIÉS, ajoutés au domaine `/water` plutôt qu'au router
# public : ils lisent ou calculent sur des données d'entreprise, qui n'ont
# jamais leur place sur `/water-intelligence`.
#
# `company_id` provient EXCLUSIVEMENT du contexte d'authentification
# (`user.company_id`). Il n'est accepté ni en query, ni en body, ni en header —
# ce n'est pas un oubli mais l'invariant : un identifiant de tenant fourni par
# l'appelant serait un contournement d'isolation, pas un paramètre.

@router.get(
    "/decision-synthesis",
    response_model=DecisionSynthesisResponse,
    summary="Synthèse hydrique à six facettes (authentifiée)",
)
async def get_decision_synthesis_endpoint(
    user: AuthUser = Depends(get_current_user),
) -> DecisionSynthesisResponse:
    """Compose la synthèse hydrique de l'entreprise authentifiée.

    Six facettes — risque, confiance, dépendance, ressource/matière, IRO,
    actions — toujours présentes, même vides : une facette absente de la
    réponse serait indiscernable d'une facette non calculée.

    **Aucun score global.** Les facettes ne s'additionnent pas et le service ne
    propose aucune fonction pour les comparer.

    **Dégradation par facette** : une source dont le schéma n'est pas encore
    migré produit une absence motivée pour SA facette ; les autres restent
    rendues. Une erreur qui n'est pas un schéma manquant remonte telle quelle
    plutôt que d'être déguisée en absence.
    """
    require_db()
    try:
        synthesis = water_synthesis_service.build_synthesis(company_id=user.company_id)
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc
    payload = synthesis.as_mapping()
    return DecisionSynthesisResponse(
        company_id=int(payload["company_id"]),  # type: ignore[arg-type]
        is_empty=bool(payload["is_empty"]),
        facets=list(payload["facets"]),  # type: ignore[arg-type]
    )


@router.post(
    "/financial-scenarios/evaluate",
    response_model=FinancialScenarioResponse,
    summary="Évalue un scénario financier hydrique (sans persistance)",
)
async def evaluate_financial_scenario_endpoint(
    body: FinancialScenarioRequest,
    user: AuthUser = Depends(get_current_user),
) -> FinancialScenarioResponse:
    """Évalue un scénario d'interruption hydrique.

    **Sans état et sans écriture.** Rien n'est persisté : ni le scénario, ni le
    résultat. L'endpoint ne touche pas la base — c'est vérifiable, il n'ouvre
    aucune connexion.

    **Aucune valeur par défaut.** Le taux d'actualisation, le revenu, la marge
    et la probabilité sont fournis par l'appelant ou la requête est refusée en
    422. Fournir un défaut poserait une hypothèse invisible en son nom.

    Rend toujours la valeur centrale **et** ses bandes de sensibilité : une
    valeur seule se lit comme une prévision.
    """
    try:
        scenario = build_scenario_from_request(body)
        exposure = build_exposure(
            scenario,
            sensitivity_variation_pct=body.sensitivity_variation_pct,
            signals=body.signals,
        )
    except FinancialScenarioError as exc:
        # Hypothèse mal formée : c'est une erreur de l'appelant, pas du moteur.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    payload = exposure.as_mapping()
    return FinancialScenarioResponse(
        scenario_code=str(payload["scenario_code"]),
        label=str(payload["label"]),
        horizon_year=int(payload["horizon_year"]),  # type: ignore[arg-type]
        is_absent=bool(payload["is_absent"]),
        absence_reason=payload["absence_reason"],  # type: ignore[arg-type]
        components=dict(payload["components"]),  # type: ignore[arg-type]
        present_value=payload["present_value"],  # type: ignore[arg-type]
        probability_weighted=payload["probability_weighted"],  # type: ignore[arg-type]
        sensitivities=list(payload["sensitivities"]),  # type: ignore[arg-type]
        signals=list(payload["signals"]),  # type: ignore[arg-type]
    )
