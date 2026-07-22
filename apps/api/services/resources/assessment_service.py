"""
assessment_service.py — orchestration du moteur d'exposition ressources (PR-M2B).

Rassemble les entrées (observations de supply sous licence, parts fournisseurs,
substituts legacy via alias D-2, couverture de stock), délègue au calcul PUR
(`scoring.assess`), puis persiste un RUN IMMUABLE + ses dimensions.

Licence : une observation dont la source n'autorise pas l'usage dérivé
(`derived_use_allowed=false`) est EXCLUE du calcul et comptée « bloquée » — elle
dégrade la CONFIANCE (composante license_access), jamais le RISQUE. Aucune donnée
n'est jamais affichée brute.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from db.database import get_db
from models.resources import (
    ResourceAlert,
    ResourceAlertListResponse,
    ResourceAssessmentDetail,
    ResourceAssessmentListResponse,
    ResourceAssessmentSummary,
    ResourceDimension,
    ResourceDimensionListResponse,
)
from services.intelligence import license_policy
from services.resources import catalog_service, exposure_link_service, scoring

_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"

# Colonnes de licence lues sur source_registry (entrées de license_policy.evaluate).
_LICENSE_COLS = (
    "active", "automated_access_allowed", "storage_allowed", "display_allowed",
    "derived_use_allowed", "commercial_use_allowed", "redistribution_allowed", "attribution_text",
)

_HIGH_DEPENDENCY_THRESHOLD = 66.0
_STALE_YEARS = 3


class ResourceAssessmentError(Exception):
    """Erreur métier du moteur d'assessment (introuvable…)."""


# ---------------------------------------------------------------------------
# Rassemblement des entrées (avec gate de licence)
# ---------------------------------------------------------------------------

def _gather_inputs(cur, *, company_id: int, resource_id: int, resource_slug: str) -> dict[str, Any]:
    # Observations de supply + licence de leur source (LEFT JOIN : une observation
    # sans source reste utilisable, sans gate).
    lic_select = ", ".join(f"s.{c} AS lic_{c}" for c in _LICENSE_COLS)
    cur.execute(
        f"""
        SELECT o.stage_code, o.country_code, o.metric_code, o.share_pct, o.volume_value,
               o.volume_unit, o.reference_year, o.data_status, o.source_release_id, {lic_select}
        FROM resource_supply_observations o
        LEFT JOIN source_releases sr ON sr.id = o.source_release_id
        LEFT JOIN source_registry s  ON s.id = sr.source_id
        WHERE o.resource_id = %s AND {_SCOPE_READ.replace('company_id', 'o.company_id')}
        """,
        (resource_id, company_id),
    )
    usable: list[dict[str, Any]] = []
    market_total = 0
    market_blocked = 0
    for row in cur.fetchall():
        obs = {
            "stage_code": row["stage_code"], "country_code": row["country_code"],
            "metric_code": row["metric_code"],
            "share_pct": float(row["share_pct"]) if row["share_pct"] is not None else None,
            "volume_value": float(row["volume_value"]) if row["volume_value"] is not None else None,
            "volume_unit": row["volume_unit"], "reference_year": row["reference_year"],
            "data_status": row["data_status"], "source_release_id": row["source_release_id"],
        }
        if row["source_release_id"] is not None:
            market_total += 1
            source = {c: row[f"lic_{c}"] for c in _LICENSE_COLS}
            decision = license_policy.evaluate(source)
            if not decision.allow_derived_use:
                market_blocked += 1
                continue  # exclue du calcul — dégrade la confiance, pas le risque
        usable.append(obs)

    supplier = exposure_link_service.supplier_shares(cur, company_id=company_id, resource_id=resource_id)
    stock = exposure_link_service.min_stock_days(cur, company_id=company_id, resource_id=resource_id)
    substitutes = _legacy_substitutes(cur, company_id=company_id, resource_id=resource_id)

    return {
        "observations": usable, "supplier_shares": supplier, "stock_days": stock,
        "substitutes": substitutes, "market_total": market_total, "market_blocked": market_blocked,
    }


def _legacy_substitutes(cur, *, company_id: int, resource_id: int) -> list[dict[str, Any]]:
    """Substituts recensés côté CRMA (034) pour les material_id legacy rattachés à
    la ressource (pont D-2) — réutilisés comme entrée de la dimension de
    substituabilité. Vide si aucun alias/substitut : la dimension sera exclue,
    jamais comptée « pas de risque de substitution »."""
    cur.execute(
        f"""
        SELECT sub.maturity, sub.performance_penalty_pct
        FROM resource_aliases a
        JOIN substitutes sub ON sub.material_id = a.alias_value
        WHERE a.resource_id = %s AND a.alias_kind = 'legacy_material_id'
          AND (a.company_id = %s OR a.company_id IS NULL)
          AND {_SCOPE_READ.replace('company_id', 'sub.company_id')}
        """,
        (resource_id, company_id, company_id),
    )
    return [
        {"maturity": r["maturity"],
         "performance_penalty_pct": float(r["performance_penalty_pct"])
         if r["performance_penalty_pct"] is not None else None}
        for r in cur.fetchall()
    ]


# ---------------------------------------------------------------------------
# Création d'un run (immuable)
# ---------------------------------------------------------------------------

def create_run(
    *, company_id: int, slug: str, assessment_year: int, as_of: date | None = None,
    calculated_by: int | None = None,
) -> ResourceAssessmentDetail:
    as_of = as_of or date.today()
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = catalog_service.resolve_resource(cur, company_id=company_id, slug=slug)
            rid = resource["id"]
            inputs = _gather_inputs(cur, company_id=company_id, resource_id=rid, resource_slug=slug)
            result = scoring.assess(
                resource_slug=slug, observation_rows=inputs["observations"],
                supplier_shares=inputs["supplier_shares"], substitutes=inputs["substitutes"],
                stock_coverage_days=inputs["stock_days"], as_of=as_of,
                market_total=inputs["market_total"], market_blocked=inputs["market_blocked"],
            )
            # Supersession du run courant (l'immutabilité autorise le seul changement de statut).
            cur.execute(
                """
                UPDATE resource_assessment_runs SET status = 'superseded', updated_at = now()
                WHERE company_id = %s AND resource_id = %s AND assessment_year = %s
                  AND status <> 'superseded'
                """,
                (company_id, rid, assessment_year),
            )
            cur.execute(
                """
                INSERT INTO resource_assessment_runs
                    (company_id, resource_id, assessment_year, status, risk_score, confidence,
                     coverage_pct, observed_hhi, missing_share_pct, methodology_code,
                     methodology_version, input_snapshot, input_hash, drivers, warnings,
                     sensitivity, calculated_by)
                VALUES (%s, %s, %s, 'computed', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, rid, assessment_year, result.risk_score, result.confidence,
                    result.coverage_pct, result.observed_hhi, result.missing_share_pct,
                    result.methodology_code, result.methodology_version,
                    json.dumps({"inputs": inputs, "as_of": as_of.isoformat()}, default=str),
                    result.input_hash, json.dumps(result.drivers, default=str),
                    json.dumps(result.warnings), json.dumps(result.sensitivity, default=str)
                    if result.sensitivity is not None else None,
                    calculated_by,
                ),
            )
            run = cur.fetchone()
            for d in result.dimensions:
                cur.execute(
                    """
                    INSERT INTO resource_assessment_dimensions
                        (company_id, run_id, kind, dimension_code, available, risk_value, weight,
                         contribution, raw_value, raw_unit, stage_code, rationale, detail,
                         source_release_ids)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        company_id, run["id"], d.kind, d.dimension_code, d.available, d.risk_value,
                        d.weight, d.contribution, d.raw_value, d.raw_unit, d.stage_code, d.rationale,
                        json.dumps(d.detail, default=str), json.dumps(d.source_release_ids),
                    ),
                )
    return _detail(run, result.dimensions, slug)


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------

def _summary(row: dict[str, Any], slug: str) -> ResourceAssessmentSummary:
    return ResourceAssessmentSummary(
        run_id=row["id"], resource_slug=slug, resource_id=row["resource_id"],
        assessment_year=row["assessment_year"], status=row["status"],
        risk_score=float(row["risk_score"]) if row["risk_score"] is not None else None,
        confidence=float(row["confidence"]) if row["confidence"] is not None else None,
        coverage_pct=float(row["coverage_pct"]) if row["coverage_pct"] is not None else None,
        observed_hhi=float(row["observed_hhi"]) if row["observed_hhi"] is not None else None,
        missing_share_pct=float(row["missing_share_pct"]) if row["missing_share_pct"] is not None else None,
        methodology_code=row["methodology_code"], methodology_version=row["methodology_version"],
        calculated_at=row["calculated_at"],
    )


def _detail(row: dict[str, Any], dimensions: list[ResourceDimension], slug: str) -> ResourceAssessmentDetail:
    return ResourceAssessmentDetail(
        run_id=row["id"], resource_slug=slug, resource_id=row["resource_id"],
        assessment_year=row["assessment_year"], status=row["status"],
        risk_score=float(row["risk_score"]) if row["risk_score"] is not None else None,
        confidence=float(row["confidence"]) if row["confidence"] is not None else None,
        coverage_pct=float(row["coverage_pct"]) if row["coverage_pct"] is not None else None,
        observed_hhi=float(row["observed_hhi"]) if row["observed_hhi"] is not None else None,
        missing_share_pct=float(row["missing_share_pct"]) if row["missing_share_pct"] is not None else None,
        methodology_code=row["methodology_code"], methodology_version=row["methodology_version"],
        input_hash=row["input_hash"], drivers=row["drivers"], warnings=row["warnings"],
        sensitivity=row["sensitivity"], iro_signal_id=row["iro_signal_id"],
        calculated_at=row["calculated_at"], dimensions=dimensions, disclaimer=scoring.DISCLAIMER,
    )


def _dimension_from_row(row: dict[str, Any]) -> ResourceDimension:
    return ResourceDimension(
        kind=row["kind"], dimension_code=row["dimension_code"], available=row["available"],
        risk_value=float(row["risk_value"]) if row["risk_value"] is not None else None,
        weight=float(row["weight"]) if row["weight"] is not None else None,
        contribution=float(row["contribution"]) if row["contribution"] is not None else None,
        raw_value=float(row["raw_value"]) if row["raw_value"] is not None else None,
        raw_unit=row["raw_unit"], stage_code=row["stage_code"], rationale=row["rationale"],
        detail=row["detail"] or {}, source_release_ids=row["source_release_ids"] or [],
    )


def _run_by_id(cur, *, company_id: int, run_id: int) -> dict[str, Any]:
    cur.execute(
        """
        SELECT r.*, c.slug AS resource_slug FROM resource_assessment_runs r
        JOIN resource_catalog c ON c.id = r.resource_id
        WHERE r.id = %s AND r.company_id = %s
        """,
        (run_id, company_id),
    )
    row = cur.fetchone()
    if row is None:
        raise ResourceAssessmentError(f"Run d'assessment {run_id} introuvable.")
    return dict(row)


def get_run(*, company_id: int, run_id: int) -> ResourceAssessmentDetail:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            row = _run_by_id(cur, company_id=company_id, run_id=run_id)
            cur.execute(
                """
                SELECT * FROM resource_assessment_dimensions
                WHERE run_id = %s AND company_id = %s ORDER BY kind, dimension_code
                """,
                (run_id, company_id),
            )
            dims = [_dimension_from_row(r) for r in cur.fetchall()]
    return _detail(row, dims, row["resource_slug"])


def list_runs(
    *, company_id: int, slug: str | None = None, assessment_year: int | None = None,
    status: str | None = None, current_only: bool = True, limit: int = 50, offset: int = 0,
) -> ResourceAssessmentListResponse:
    clauses = ["r.company_id = %s"]
    params: list[Any] = [company_id]
    if slug:
        clauses.append("c.slug = %s")
        params.append(slug)
    if assessment_year is not None:
        clauses.append("r.assessment_year = %s")
        params.append(assessment_year)
    if status:
        clauses.append("r.status = %s")
        params.append(status)
    elif current_only:
        clauses.append("r.status <> 'superseded'")
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT COUNT(*) AS n FROM resource_assessment_runs r
                    JOIN resource_catalog c ON c.id = r.resource_id WHERE {where}""",
                params,
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT r.*, c.slug AS resource_slug FROM resource_assessment_runs r
                JOIN resource_catalog c ON c.id = r.resource_id
                WHERE {where} ORDER BY r.calculated_at DESC, r.id DESC LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_summary(r, r["resource_slug"]) for r in cur.fetchall()]
    return ResourceAssessmentListResponse(items=items, total=total, limit=limit, offset=offset)


def list_dimensions(
    *, company_id: int, run_id: int, limit: int = 100, offset: int = 0
) -> ResourceDimensionListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _run_by_id(cur, company_id=company_id, run_id=run_id)  # scope guard / 404
            cur.execute(
                """SELECT COUNT(*) AS n FROM resource_assessment_dimensions
                   WHERE run_id = %s AND company_id = %s""",
                (run_id, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                """
                SELECT * FROM resource_assessment_dimensions
                WHERE run_id = %s AND company_id = %s ORDER BY kind, dimension_code
                LIMIT %s OFFSET %s
                """,
                (run_id, company_id, limit, offset),
            )
            items = [_dimension_from_row(r) for r in cur.fetchall()]
    return ResourceDimensionListResponse(items=items, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Alertes dérivées (lecture seule, aucune table neuve)
# ---------------------------------------------------------------------------

def list_alerts(*, company_id: int, limit: int = 50, offset: int = 0) -> ResourceAlertListResponse:
    """Signaux dérivés de l'état du tenant : forte dépendance (run courant à
    risque élevé) et données de supply périmées. Lecture seule — aucune règle
    d'alerte persistée (le module alert_rules 021 reste la brique si des seuils
    configurables sont un jour requis)."""
    alerts: list[ResourceAlert] = []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.slug, r.risk_score FROM resource_assessment_runs r
                JOIN resource_catalog c ON c.id = r.resource_id
                WHERE r.company_id = %s AND r.status <> 'superseded'
                  AND r.risk_score IS NOT NULL AND r.risk_score >= %s
                ORDER BY r.risk_score DESC
                """,
                (company_id, _HIGH_DEPENDENCY_THRESHOLD),
            )
            for row in cur.fetchall():
                score = float(row["risk_score"])
                alerts.append(ResourceAlert(
                    kind="high_dependency",
                    severity="critical" if score >= 80 else "high",
                    resource_slug=row["slug"],
                    message=f"Dépendance élevée : score d'exposition {score} (≥ {_HIGH_DEPENDENCY_THRESHOLD}).",
                    as_of=date.today(),
                ))
            cur.execute(
                f"""
                SELECT c.slug, MAX(o.reference_year) AS last_year
                FROM resource_supply_observations o
                JOIN resource_catalog c ON c.id = o.resource_id
                WHERE {_SCOPE_READ.replace('company_id', 'o.company_id')}
                GROUP BY c.slug
                HAVING MAX(o.reference_year) <= %s
                """,
                (company_id, date.today().year - _STALE_YEARS),
            )
            for row in cur.fetchall():
                alerts.append(ResourceAlert(
                    kind="stale_supply_data", severity="medium", resource_slug=row["slug"],
                    message=f"Données de supply périmées (dernière année {row['last_year']}).",
                    as_of=date.today(),
                ))
    total = len(alerts)
    return ResourceAlertListResponse(
        items=alerts[offset:offset + limit], total=total, limit=limit, offset=offset
    )

