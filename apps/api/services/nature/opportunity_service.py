"""
opportunity_service.py — orchestration du scoring OPPORTUNITÉ nature
(PR-09 tranche B). Même discipline que `risk_service.py`, direction opposée
— voir `services/calculations/nature_scoring.py::score_opportunity`.

Seules les lignes `review_status='accepted'` alimentent le score — jamais une
ligne `pending`/`flagged`.

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

import json
from typing import Any

from db.database import get_db
from models.analytics import (
    AnalyticalEnvelope,
    AnalyticalMeta,
    EvidenceRef,
    MethodRef,
    QualityMeta,
)
from models.nature import (
    NatureOpportunityData,
    NatureOpportunityListResponse,
    NatureOpportunitySummary,
    OpportunityCalculateRequest,
    ScoreComponent,
)
from services.calculations.nature_scoring import score_opportunity
from services.nature.risk_service import fetch_scope_rows

_SCOPE = "company_id = %s"


class NatureOpportunityError(Exception):
    """Erreur métier du scoring opportunité nature."""


def _float(value: Any) -> float | None:
    return float(value) if value is not None else None


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureOpportunityError(f"{label} '{row_id}' introuvable.")


def calculate(
    *, company_id: int, payload: OpportunityCalculateRequest, calculated_by: int | None = None,
) -> AnalyticalEnvelope[NatureOpportunityData]:
    """Calcule et PERSISTE une opportunité. `opportunity_score=None` si
    aucune composante n'est calculable — jamais un nombre inventé."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "leap_assessments", payload.assessment_id, "Dossier LEAP")
            _assert_in_scope(cur, company_id, "sites", payload.site_id, "Site")
            deps, imps, _inter, total_rows, accepted_rows = fetch_scope_rows(
                cur, company_id=company_id, assessment_id=payload.assessment_id, site_id=payload.site_id,
            )
            result = score_opportunity(
                dependencies=deps, impacts=imps,
                total_rows=total_rows, accepted_rows=accepted_rows, likelihood=payload.likelihood,
            )
            cur.execute(
                """
                INSERT INTO nature_opportunities
                    (company_id, assessment_id, site_id, title, methodology_code,
                     methodology_version, opportunity_score, likelihood, confidence, components,
                     warnings, input_snapshot, input_fingerprint, calculated_at, calculated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s)
                RETURNING *
                """,
                (
                    company_id, payload.assessment_id, payload.site_id, payload.title,
                    result["methodology_code"], result["methodology_version"],
                    result["opportunity_score"], result["likelihood"], result["confidence"],
                    json.dumps(result["components"]), json.dumps(result["warnings"]),
                    json.dumps(result["snapshot"]), result["fingerprint"], calculated_by,
                ),
            )
            row = dict(cur.fetchone())

    data = NatureOpportunityData(
        opportunity_id=row["id"], assessment_id=row["assessment_id"], site_id=row["site_id"],
        title=row["title"], methodology_code=row["methodology_code"],
        methodology_version=row["methodology_version"],
        opportunity_score=_float(row["opportunity_score"]), likelihood=row["likelihood"],
        components=[ScoreComponent(**c) for c in result["components"]],
        input_fingerprint=row["input_fingerprint"], calculated_at=row["calculated_at"],
    )
    all_available = bool(result["components"]) and all(c["available"] for c in result["components"])
    meta = AnalyticalMeta(
        as_of=row["calculated_at"].date().isoformat(),
        status="verified" if all_available else "estimated",
        method=MethodRef(code=result["methodology_code"], version=result["methodology_version"]),
        quality=QualityMeta(
            confidence=int(round(result["confidence"])) if result["confidence"] is not None else None,
            warnings=list(result["warnings"]),
        ),
    )
    evidence = [
        EvidenceRef(note=f"impact nature #{i['id']} ACCEPTÉ ({i['pressure_type']}/{i['magnitude_qualitative']})")
        for i in imps if i.get("impact_kind") == "positive"
    ] + [
        EvidenceRef(note=f"dépendance nature #{d['id']} ACCEPTÉE ({d['ecosystem_service']}/{d['dependency_level']})")
        for d in deps
    ]
    return AnalyticalEnvelope[NatureOpportunityData](data=data, meta=meta, evidence=evidence)


def _summary(row: dict[str, Any]) -> NatureOpportunitySummary:
    data = dict(row)
    data["opportunity_score"] = _float(row["opportunity_score"])
    data["confidence"] = _float(row["confidence"])
    data["components"] = row.get("components") or []
    data["warnings"] = row.get("warnings") or []
    return NatureOpportunitySummary(
        **{k: data[k] for k in NatureOpportunitySummary.model_fields if k in data}
    )


def get_opportunity(*, company_id: int, opportunity_id: int) -> NatureOpportunitySummary:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM nature_opportunities WHERE id = %s AND {_SCOPE}",
                (opportunity_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise NatureOpportunityError(f"Opportunité nature '{opportunity_id}' introuvable.")
    return _summary(dict(row))


def list_opportunities(
    *, company_id: int, assessment_id: int | None = None, review_status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> NatureOpportunityListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if assessment_id is not None:
        clauses.append("assessment_id = %s")
        params.append(assessment_id)
    if review_status is not None:
        clauses.append("review_status = %s")
        params.append(review_status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM nature_opportunities {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM nature_opportunities {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return NatureOpportunityListResponse(
        items=[_summary(dict(r)) for r in rows], total=total, limit=limit, offset=offset,
    )


def review_opportunity(
    *, company_id: int, opportunity_id: int, accept: bool, reviewed_by: int | None = None,
) -> NatureOpportunitySummary:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM nature_opportunities WHERE id = %s AND {_SCOPE}",
                (opportunity_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureOpportunityError(f"Opportunité nature '{opportunity_id}' introuvable.")
            if row["review_status"] != "pending":
                raise NatureOpportunityError(
                    f"Opportunité '{opportunity_id}' déjà revue ({row['review_status']}) — "
                    "seule une ligne 'pending' est revue."
                )
            cur.execute(
                f"UPDATE nature_opportunities SET review_status = %s, reviewed_by = %s, "
                f"reviewed_at = now(), updated_at = now() WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, reviewed_by, opportunity_id, company_id),
            )
            return _summary(dict(cur.fetchone()))
