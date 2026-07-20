"""
routers/energy.py — Énergie & Scope 2, préfixe `/energy`.

PR-06A : la FONDATION de données (compteurs, activités, instruments, allocations).
PR-06B : le MOTEUR de calcul Scope 2 dual, sous `/energy/scope2/*` — calcul,
consultation d'un run, trace de calcul, approbation, Evidence Pack.

Lecture (GET) : tout utilisateur authentifié du tenant (`get_current_user`, RLS
filtre le tenant automatiquement). Écriture (POST) : `require_analyst`.
Approbation d'un run : `require_admin` (elle scelle des KPI réglementaires).

Erreurs : helper lexical PARTAGÉ `routers/_errors.py` (`introuvable` → 404,
`requis/requise` → 400, sinon 409). PR-06A portait une copie locale de ce helper
faute de module commun mergé ; PR-05A a depuis introduit `routers/_errors.py`, on
s'y branche donc ici (convention identique, comportement inchangé) plutôt que de
garder un doublon — contrats §6.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from models.analytics import (
    AnalyticalEnvelope,
    AnalyticalMeta,
    EvidenceRef,
    MethodRef,
    QualityMeta,
)
from models.energy import (
    ActivityImportRequest,
    ActivityImportResult,
    ActivityListResponse,
    ActivityResponse,
    AllocationRequest,
    AllocationResponse,
    InstrumentCreate,
    InstrumentListResponse,
    InstrumentResponse,
    MeterCreate,
    MeterListResponse,
    MeterResponse,
    Scope2CalculateRequest,
    Scope2ResultData,
    Scope2RunListResponse,
    Scope2RunSummary,
    Scope2TraceResponse,
)
from routers._errors import http_error as _http_error
from routers._errors import require_db as _require_db
from routers.auth import get_current_user, require_admin, require_analyst
from services import export_package
from services.auth_service import AuthUser
from services.calculations import CalculationError, scope2, scope2_runs
from services.energy import (
    EnergyError,
    activities_service,
    instruments_service,
    meters_service,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Compteurs
# ---------------------------------------------------------------------------

@router.get("/meters", response_model=MeterListResponse)
async def list_meters_endpoint(
    carrier: str | None = None,
    active_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> MeterListResponse:
    _require_db()
    items, total = meters_service.list_meters(
        company_id=user.company_id, limit=limit, offset=offset,
        carrier=carrier, active_only=active_only,
    )
    return MeterListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/meters", response_model=MeterResponse, status_code=201)
async def create_meter_endpoint(
    body: MeterCreate,
    user: AuthUser = Depends(require_analyst),
) -> MeterResponse:
    _require_db()
    try:
        return meters_service.create_meter(company_id=user.company_id, payload=body)
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.get("/meters/{meter_id}", response_model=MeterResponse)
async def get_meter_endpoint(
    meter_id: int,
    user: AuthUser = Depends(get_current_user),
) -> MeterResponse:
    _require_db()
    try:
        return meters_service.get_meter(company_id=user.company_id, meter_id=meter_id)
    except EnergyError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Activités (import CSV idempotent + gate de revue)
# ---------------------------------------------------------------------------

@router.post("/activities/import", response_model=ActivityImportResult)
async def import_activities_endpoint(
    body: ActivityImportRequest,
    user: AuthUser = Depends(require_analyst),
) -> ActivityImportResult:
    _require_db()
    try:
        return activities_service.import_activities(
            company_id=user.company_id, filename=body.filename, csv_text=body.csv_text,
        )
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.get("/activities", response_model=ActivityListResponse)
async def list_activities_endpoint(
    site_id: int | None = None,
    carrier: str | None = None,
    review_status: str | None = None,
    period_from: date | None = None,
    period_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> ActivityListResponse:
    _require_db()
    items, total = activities_service.list_activities(
        company_id=user.company_id, limit=limit, offset=offset,
        site_id=site_id, carrier=carrier, review_status=review_status,
        period_from=period_from, period_to=period_to,
    )
    return ActivityListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/activities/{activity_id}", response_model=ActivityResponse)
async def get_activity_endpoint(
    activity_id: int,
    user: AuthUser = Depends(get_current_user),
) -> ActivityResponse:
    _require_db()
    try:
        return activities_service.get_activity(company_id=user.company_id, activity_id=activity_id)
    except EnergyError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Instruments contractuels & allocations
# ---------------------------------------------------------------------------

@router.get("/instruments", response_model=InstrumentListResponse)
async def list_instruments_endpoint(
    carrier: str | None = None,
    status: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> InstrumentListResponse:
    _require_db()
    items, total = instruments_service.list_instruments(
        company_id=user.company_id, limit=limit, offset=offset, carrier=carrier, status=status,
    )
    return InstrumentListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/instruments", response_model=InstrumentResponse, status_code=201)
async def create_instrument_endpoint(
    body: InstrumentCreate,
    user: AuthUser = Depends(require_analyst),
) -> InstrumentResponse:
    _require_db()
    try:
        return instruments_service.create_instrument(company_id=user.company_id, payload=body)
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.get("/instruments/{instrument_id}", response_model=InstrumentResponse)
async def get_instrument_endpoint(
    instrument_id: int,
    user: AuthUser = Depends(get_current_user),
) -> InstrumentResponse:
    _require_db()
    try:
        return instruments_service.get_instrument(company_id=user.company_id, instrument_id=instrument_id)
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.post("/instruments/{instrument_id}/allocate", response_model=AllocationResponse, status_code=201)
async def allocate_instrument_endpoint(
    instrument_id: int,
    body: AllocationRequest,
    user: AuthUser = Depends(require_analyst),
) -> AllocationResponse:
    _require_db()
    try:
        return instruments_service.allocate_instrument(
            company_id=user.company_id, instrument_id=instrument_id,
            payload=body, allocated_by=user.user_id,
        )
    except EnergyError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Moteur de calcul Scope 2 dual (PR-06B) — `/energy/scope2/*`
#
# Réponses de calcul en ENVELOPPE ANALYTIQUE `{data, meta, evidence}`
# (contrats §4) : jamais un total nu, toujours accompagné de sa date, de sa
# méthode versionnée, de son statut et de sa qualité (confiance, couverture,
# warnings).
# ---------------------------------------------------------------------------

def _run_to_data(run: dict[str, Any], trace: list[dict[str, Any]] | None = None) -> Scope2ResultData:
    """Projette un run persisté vers le `data` de l'enveloppe."""
    result = run.get("result") or {}
    return Scope2ResultData(
        run_id=run["id"],
        status=run["status"],
        period_start=run["period_start"],
        period_end=run["period_end"],
        geography_code=run["geography_code"],
        location_based_tco2e=result.get("location_based_tco2e", 0.0),
        market_based_tco2e=result.get("market_based_tco2e", 0.0),
        total_consumption_mwh=result.get("total_consumption_mwh", 0.0),
        calculated_consumption_mwh=result.get("calculated_consumption_mwh", 0.0),
        contractual_coverage_mwh=result.get("contractual_coverage_mwh", 0.0),
        contractual_coverage_pct=result.get("contractual_coverage_pct", 0.0),
        uncovered_mwh=result.get("uncovered_mwh", 0.0),
        residual_mix_used=result.get("residual_mix_used", False),
        is_complete=result.get("is_complete", False),
        input_fingerprint=run["input_fingerprint"],
        calculated_at=run["calculated_at"],
        approved_at=run.get("approved_at"),
        missing_factors=result.get("missing_factors") or [],
        factors_used=run.get("factor_versions") or [],
        trace=trace if trace is not None else (result.get("trace") or []),
    )


def _envelope(
    run: dict[str, Any], trace: list[dict[str, Any]] | None = None
) -> AnalyticalEnvelope[Scope2ResultData]:
    """Enveloppe `{data, meta, evidence}` d'un run.

    `meta.status` : un run APPROUVÉ dont chaque ligne est vérifiée vaut
    `verified` ; sinon `estimated`. Jamais l'inverse — une estimation n'est
    jamais présentée comme vérifiée (interdit méthodologique).
    """
    result = run.get("result") or {}
    warnings = list(run.get("warnings") or [])
    lines = trace if trace is not None else (result.get("trace") or [])
    all_verified = bool(lines) and all(
        (line.get("data_quality") or (line.get("selection") or {}).get("data_quality"))
        == "verified"
        for line in lines
    )
    status = "verified" if (run.get("status") == "approved" and all_verified) else "estimated"

    evidence: list[EvidenceRef] = []
    for factor in run.get("factor_versions") or []:
        evidence.append(EvidenceRef(
            source_code=factor.get("ef_code"),
            release_key=factor.get("ef_version"),
            note=f"Facteur retenu au niveau '{factor.get('selection_level')}' "
                 f"(base {factor.get('factor_basis')}).",
        ))
    if run.get("status") == "approved":
        evidence.append(EvidenceRef(
            note=f"Run approuvé — facts scellés dans la chaîne de preuve "
                 f"(source_path scope2_run:{run['id']}).",
        ))

    return AnalyticalEnvelope[Scope2ResultData](
        data=_run_to_data(run, trace),
        meta=AnalyticalMeta(
            # `AnalyticalMeta.as_of` est un `str | None` (module canonique de
            # PR-05B) alors que `period_end` sort de psycopg2 en `datetime.date`.
            as_of=run["period_end"].isoformat() if run.get("period_end") else None,
            status=status,
            method=MethodRef(
                code=run["methodology_code"], version=run["methodology_version"]
            ),
            quality=QualityMeta(
                confidence=int(run["confidence"]) if run.get("confidence") is not None else None,
                coverage_pct=run.get("coverage_pct"),
                warnings=warnings,
            ),
        ),
        evidence=evidence,
    )


def _run_summary(run: dict[str, Any]) -> Scope2RunSummary:
    result = run.get("result") or {}
    return Scope2RunSummary(
        id=run["id"],
        company_id=run["company_id"],
        methodology_code=run["methodology_code"],
        methodology_version=run["methodology_version"],
        period_start=run["period_start"],
        period_end=run["period_end"],
        geography_code=run["geography_code"],
        status=run["status"],
        location_based_tco2e=result.get("location_based_tco2e"),
        market_based_tco2e=result.get("market_based_tco2e"),
        confidence=run.get("confidence"),
        coverage_pct=run.get("coverage_pct"),
        is_complete=result.get("is_complete", False),
        input_fingerprint=run["input_fingerprint"],
        calculated_at=run["calculated_at"],
        approved_at=run.get("approved_at"),
        warning_count=len(run.get("warnings") or []),
    )


@router.post("/scope2/calculate", response_model=AnalyticalEnvelope[Scope2ResultData], status_code=201)
async def calculate_scope2_endpoint(
    body: Scope2CalculateRequest,
    user: AuthUser = Depends(require_analyst),
) -> AnalyticalEnvelope[Scope2ResultData]:
    """Lance un calcul Scope 2 dual (location-based ET market-based) et persiste
    le run. Le run naît en `draft` : il ne remplace aucun KPI tant qu'il n'est
    pas approuvé."""
    _require_db()
    methodology = scope2.Methodology(
        allow_market_fallback=body.allow_market_fallback,
        fallback_note=body.fallback_note,
    )
    try:
        run = scope2_runs.calculate_and_store(
            company_id=user.company_id,
            period_start=body.period_start,
            period_end=body.period_end,
            geography_code=body.geography_code,
            methodology=methodology,
            site_geographies=body.site_geographies,
            include_pending=body.include_pending,
            calculated_by=user.user_id,
        )
    except CalculationError as exc:
        raise _http_error(exc) from exc
    return _envelope(run)


@router.get("/scope2/runs", response_model=Scope2RunListResponse)
async def list_scope2_runs_endpoint(
    status: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> Scope2RunListResponse:
    _require_db()
    runs, total = scope2_runs.list_runs(
        company_id=user.company_id, limit=limit, offset=offset, status=status,
    )
    return Scope2RunListResponse(
        items=[_run_summary(r) for r in runs], total=total, limit=limit, offset=offset,
    )


@router.get("/scope2/runs/{run_id}", response_model=AnalyticalEnvelope[Scope2ResultData])
async def get_scope2_run_endpoint(
    run_id: int,
    user: AuthUser = Depends(get_current_user),
) -> AnalyticalEnvelope[Scope2ResultData]:
    _require_db()
    try:
        run = scope2_runs.get_run(company_id=user.company_id, run_id=run_id)
        trace = scope2_runs.get_trace(company_id=user.company_id, run_id=run_id)
    except CalculationError as exc:
        raise _http_error(exc) from exc
    return _envelope(run, trace)


@router.get("/scope2/runs/{run_id}/trace", response_model=Scope2TraceResponse)
async def get_scope2_trace_endpoint(
    run_id: int,
    user: AuthUser = Depends(get_current_user),
) -> Scope2TraceResponse:
    """Trace de calcul : une ligne par (activité, base, segment), avec le niveau
    de hiérarchie de facteur retenu et sa raison."""
    _require_db()
    try:
        trace = scope2_runs.get_trace(company_id=user.company_id, run_id=run_id)
    except CalculationError as exc:
        raise _http_error(exc) from exc
    return Scope2TraceResponse(run_id=run_id, items=trace, total=len(trace))


@router.post("/scope2/runs/{run_id}/approve", response_model=AnalyticalEnvelope[Scope2ResultData])
async def approve_scope2_run_endpoint(
    run_id: int,
    user: AuthUser = Depends(require_admin),
) -> AnalyticalEnvelope[Scope2ResultData]:
    """Approuve un run : c'est le SEUL moment où le moteur remplace les KPI
    Scope 2 historiques (émission de `CC.GES.SCOPE2_LB` **et** `…_MB`). Un run
    incomplet (facteur manquant) est refusé."""
    _require_db()
    try:
        run = scope2_runs.approve_run(
            company_id=user.company_id, run_id=run_id, approved_by=user.user_id or 0,
        )
        trace = scope2_runs.get_trace(company_id=user.company_id, run_id=run_id)
    except CalculationError as exc:
        raise _http_error(exc) from exc
    return _envelope(run, trace)


@router.get("/scope2/runs/{run_id}/evidence-pack")
async def scope2_evidence_pack_endpoint(
    run_id: int,
    user: AuthUser = Depends(require_analyst),
) -> StreamingResponse:
    """Evidence Pack d'un run : ZIP signé (manifest + CHECKSUMS) contenant les
    deux totaux, la trace de calcul, le snapshot d'entrée gelé, les facteurs
    utilisés et les warnings."""
    _require_db()
    try:
        run = scope2_runs.get_run(company_id=user.company_id, run_id=run_id)
        trace = scope2_runs.get_trace(company_id=user.company_id, run_id=run_id)
    except CalculationError as exc:
        raise _http_error(exc) from exc

    pack = export_package.build_scope2_evidence_pack(
        company_id=user.company_id,
        company_name=scope2_runs.company_name(company_id=user.company_id),
        run=run,
        trace=trace,
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
