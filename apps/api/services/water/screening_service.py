"""
screening_service.py — orchestration du screening hydrique (PR-08 tranche B).

Le CALCUL est pur (`services/calculations/water_screening.py`) ; ce module
fait l'I/O : lecture de la position ACCEPTÉE du site (gate geocode_service —
la seule lecture autorisée), zones candidates (pré-filtre bbox SQL + licence +
fraîcheur), persistance du run IMMUABLE (trigger 037), signal IRO.

Le signal IRO est un GESTE HUMAIN avec justification obligatoire — jamais une
décision de matérialité (contrats Wave 4 §10 : la promotion en IRO est
l'affaire de PR-10 ; aucune table *_iro_candidates par domaine).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from db.database import get_db
from models.analytics import (
    AnalyticalEnvelope,
    AnalyticalMeta,
    EvidenceRef,
    MethodRef,
    QualityMeta,
)
from models.water import (
    MatchedAreaResult,
    WaterScreeningData,
    WaterScreeningListResponse,
    WaterScreeningSummary,
)
from services.calculations.water_screening import (
    WaterScreeningRefusal,
    run_screening,
)
from services.geo import geocode_service
from services.water import risk_areas_service

_SCOPE = "company_id = %s"

# Une release plus vieille que ce seuil marque la zone `stale` : la CONFIANCE
# du screening est dégradée — jamais le risque (moteur pur, règle testée).
STALENESS_THRESHOLD_DAYS = 365


class WaterScreeningError(Exception):
    """Erreur métier du screening (introuvable, refus explicite, transition)."""


def _summary(row: dict[str, Any]) -> WaterScreeningSummary:
    data = dict(row)
    data["confidence"] = float(row["confidence"]) if row["confidence"] is not None else None
    data["coverage_pct"] = float(row["coverage_pct"]) if row["coverage_pct"] is not None else None
    data["warnings"] = row.get("warnings") or []
    return WaterScreeningSummary(
        **{k: data[k] for k in WaterScreeningSummary.model_fields if k in data}
    )


def calculate(
    *, company_id: int, site_id: int, scenario_code: str = "baseline",
    calculated_by: int | None = None,
) -> AnalyticalEnvelope[WaterScreeningData]:
    """Exécute et PERSISTE un screening versionné. Tout refus du moteur pur
    (position non acceptée, précision insuffisante, référentiel vide, licence)
    remonte tel quel — explicite, jamais un résultat partiel silencieux."""
    # 1. Position ACCEPTÉE uniquement (gate non négociable).
    try:
        position = geocode_service.get_accepted_position(
            company_id=company_id, site_id=site_id
        )
    except geocode_service.GeocodeError as exc:
        raise WaterScreeningError(str(exc)) from exc

    # 2. Zones candidates (pré-filtre bbox SQL) + total du scénario + fraîcheur.
    raw_candidates = risk_areas_service.candidate_areas_for_point(
        company_id=company_id,
        latitude=position["latitude"], longitude=position["longitude"],
        scenario_code=scenario_code,
    )
    now = datetime.now(timezone.utc)
    candidates: list[dict[str, Any]] = []
    for area in raw_candidates:
        decision = area.pop("license_decision")
        retrieved_at = area.pop("release_retrieved_at", None)
        stale = bool(
            retrieved_at is not None
            and retrieved_at < now - timedelta(days=STALENESS_THRESHOLD_DAYS)
        )
        candidates.append({
            **area,
            "stress_category": area["baseline_stress_category"],
            "derived_use_allowed": bool(decision and decision.allow_derived_use),
            "stale": stale,
        })
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM water_risk_areas "
                "WHERE (company_id = %s OR company_id IS NULL) AND scenario_code = %s",
                (company_id, scenario_code),
            )
            total_area_count = cur.fetchone()["c"]

    # 3. Moteur pur.
    try:
        result = run_screening(
            site={
                "site_id": site_id,
                "latitude": position["latitude"],
                "longitude": position["longitude"],
                "precision": position["precision"],
                "review_status": "accepted",
            },
            candidate_areas=candidates,
            total_area_count=total_area_count,
            scenario_code=scenario_code,
        )
    except WaterScreeningRefusal as exc:
        raise WaterScreeningError(str(exc)) from exc

    # 4. Persistance du run (immuable — recalculer = un NOUVEAU run).
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO site_water_screenings
                    (company_id, site_id, methodology_code, methodology_version,
                     method_code, scenario_code, input_snapshot, input_fingerprint,
                     result, matched_area_ids, risk_category, risk_components,
                     confidence, coverage_pct, warnings, calculated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, site_id, result["methodology_code"],
                    result["methodology_version"], result["method_code"],
                    scenario_code, json.dumps(result["snapshot"]),
                    result["fingerprint"],
                    json.dumps({
                        "risk_category": result["risk_category"],
                        "matched_area_count": result["matched_area_count"],
                        "candidate_area_count": result["candidate_area_count"],
                        "confidence_trace": result["confidence_trace"],
                    }),
                    json.dumps([c["area_id"] for c in result["matched"]]),
                    result["risk_category"], json.dumps(result["risk_components"]),
                    result["confidence"], result["coverage_pct"],
                    json.dumps(result["warnings"]), calculated_by,
                ),
            )
            row = dict(cur.fetchone())

    # 5. Enveloppe analytique PARTAGÉE (models/analytics.py — jamais une forme
    # locale, règle Wave 4 §9 qui corrige la dérive PR-07).
    matched_models = [
        MatchedAreaResult(
            area_id=c["area_id"], code=c["code"], label=c["label"] or c["code"],
            area_kind=c["area_kind"], stress_category=c["stress_category"],
            data_status=c["data_status"], bbox_candidate=c["bbox_candidate"],
            matched=c["matched"], method_code=c["method_code"],
            prefilter_code=c["prefilter_code"],
        )
        for c in result["matched"]
    ]
    all_verified = bool(result["matched"]) and all(
        c["data_status"] == "verified" for c in result["matched"]
    )
    data = WaterScreeningData(
        screening_id=row["id"],
        site_id=site_id,
        scenario_code=scenario_code,
        method_code=result["method_code"],
        methodology_code=result["methodology_code"],
        methodology_version=result["methodology_version"],
        risk_category=result["risk_category"],
        matched_areas=matched_models,
        candidate_area_count=result["candidate_area_count"],
        matched_area_count=result["matched_area_count"],
        iro_signal=False,
        iro_signal_rationale=None,
        input_fingerprint=result["fingerprint"],
        calculated_at=row["calculated_at"],
    )
    meta = AnalyticalMeta(
        as_of=row["calculated_at"].date().isoformat(),
        status="verified" if all_verified else "estimated",
        method=MethodRef(code=result["methodology_code"], version=result["methodology_version"]),
        quality=QualityMeta(
            confidence=int(result["confidence"]),
            coverage_pct=result["coverage_pct"],
            warnings=list(result["warnings"]),
        ),
    )
    evidence = [
        EvidenceRef(
            source_code=c.get("source_code"),
            note=f"zone de stress hydrique '{c['code']}' appariée "
                 f"({c['method_code']})",
        )
        for c in result["matched"]
    ]
    return AnalyticalEnvelope[WaterScreeningData](data=data, meta=meta, evidence=evidence)


def get_screening(*, company_id: int, screening_id: int) -> WaterScreeningSummary:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM site_water_screenings WHERE id = %s AND {_SCOPE}",
                (screening_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise WaterScreeningError(f"Screening '{screening_id}' introuvable.")
    return _summary(dict(row))


def list_screenings(
    *, company_id: int, site_id: int | None = None, iro_signal: bool | None = None,
    limit: int = 50, offset: int = 0,
) -> WaterScreeningListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if iro_signal is not None:
        clauses.append("iro_signal = %s")
        params.append(iro_signal)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM site_water_screenings {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM site_water_screenings {where} "
                "ORDER BY calculated_at DESC, id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return WaterScreeningListResponse(
        items=[_summary(dict(r)) for r in rows], total=total, limit=limit, offset=offset,
    )


def flag_for_iro(
    *, company_id: int, screening_id: int, rationale: str, flagged_by: int,
) -> WaterScreeningSummary:
    """Pose le signal « à examiner comme IRO » — un GESTE humain justifié.

    Ne crée JAMAIS de ligne IRO, ne décide JAMAIS d'une matérialité : le
    screening reste un résultat de domaine tant que PR-10 (intake humain) ne le
    promeut pas. Un signal déjà posé n'est pas re-posable (le retrait ou la
    modification passeraient par un recalcul + nouveau signal — traçabilité)."""
    if not rationale or not rationale.strip():
        raise WaterScreeningError("Justification requise pour signaler un IRO candidat.")
    if flagged_by is None:
        raise WaterScreeningError("Identité de l'auteur du signal requise.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT iro_signal FROM site_water_screenings WHERE id = %s AND {_SCOPE}",
                (screening_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise WaterScreeningError(f"Screening '{screening_id}' introuvable.")
            if row["iro_signal"]:
                raise WaterScreeningError(
                    f"Screening '{screening_id}' déjà signalé comme IRO candidat — "
                    "le signal ne se réécrit pas."
                )
            cur.execute(
                f"""
                UPDATE site_water_screenings
                SET iro_signal = true, iro_signal_rationale = %s,
                    iro_signal_by = %s, iro_signal_at = now(), updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING *
                """,
                (rationale.strip(), flagged_by, screening_id, company_id),
            )
            updated = dict(cur.fetchone())
    return _summary(updated)
