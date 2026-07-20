"""
risk_service.py — orchestration du scoring RISQUE nature (PR-09 tranche B).

Le CALCUL est pur (`services/calculations/nature_scoring.py::score_risk`) ;
ce module fait l'I/O : lecture des dépendances/impacts/intersections
ACCEPTÉS dans le périmètre du dossier LEAP (tous ses sites, ou un seul si
précisé), persistance du résultat, gate de revue.

Seules les lignes `review_status='accepted'` alimentent le score — jamais une
ligne `pending`/`flagged` (aucune conclusion automatique, contrats §11).

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
    NatureRiskData,
    NatureRiskListResponse,
    NatureRiskSummary,
    RiskCalculateRequest,
    ScoreComponent,
)
from services.calculations.nature_scoring import score_risk

_SCOPE = "company_id = %s"


class NatureRiskError(Exception):
    """Erreur métier du scoring risque nature."""


def _float(value: Any) -> float | None:
    return float(value) if value is not None else None


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureRiskError(f"{label} '{row_id}' introuvable.")


def fetch_scope_rows(
    cur, *, company_id: int, assessment_id: int, site_id: int | None,
) -> tuple[list[dict], list[dict], list[dict], int, int]:
    """Dépendances/impacts/intersections du périmètre du dossier LEAP (tous
    les sites rattachés via `leap_assessment_sites`, filtré à UN site si
    fourni). Retourne les lignes ACCEPTÉES (celles qui alimentent le score)
    ainsi que `total_rows`/`accepted_rows` (toutes lignes confondues, pour la
    couverture de revue humaine — dimension de CONFIANCE, jamais de risque)."""
    dep_params: list[Any] = [assessment_id, company_id, company_id]
    dep_sql = (
        "SELECT d.* FROM nature_dependencies d "
        "JOIN leap_assessment_sites las "
        "  ON las.site_id = d.site_id AND las.assessment_id = %s AND las.company_id = %s "
        "WHERE d.company_id = %s"
    )
    if site_id is not None:
        dep_sql += " AND d.site_id = %s"
        dep_params.append(site_id)
    cur.execute(dep_sql, dep_params)
    all_deps = [dict(r) for r in cur.fetchall()]

    imp_params: list[Any] = [assessment_id, company_id, company_id]
    imp_sql = (
        "SELECT i.* FROM nature_impacts i "
        "JOIN leap_assessment_sites las "
        "  ON las.site_id = i.site_id AND las.assessment_id = %s AND las.company_id = %s "
        "WHERE i.company_id = %s"
    )
    if site_id is not None:
        imp_sql += " AND i.site_id = %s"
        imp_params.append(site_id)
    cur.execute(imp_sql, imp_params)
    all_imps = [dict(r) for r in cur.fetchall()]

    inter_params: list[Any] = [assessment_id, company_id, company_id]
    inter_sql = (
        "SELECT s.*, f.feature_kind AS feature_kind FROM site_nature_intersections s "
        "JOIN nature_features f ON f.id = s.feature_id "
        "JOIN leap_assessment_sites las "
        "  ON las.site_id = s.site_id AND las.assessment_id = %s AND las.company_id = %s "
        "WHERE s.company_id = %s"
    )
    if site_id is not None:
        inter_sql += " AND s.site_id = %s"
        inter_params.append(site_id)
    cur.execute(inter_sql, inter_params)
    all_inter = [dict(r) for r in cur.fetchall()]

    accepted_deps = [d for d in all_deps if d["review_status"] == "accepted"]
    accepted_imps = [i for i in all_imps if i["review_status"] == "accepted"]
    accepted_inter = [s for s in all_inter if s["review_status"] == "accepted"]
    total_rows = len(all_deps) + len(all_imps) + len(all_inter)
    accepted_rows = len(accepted_deps) + len(accepted_imps) + len(accepted_inter)
    return accepted_deps, accepted_imps, accepted_inter, total_rows, accepted_rows


def calculate(
    *, company_id: int, payload: RiskCalculateRequest, calculated_by: int | None = None,
) -> AnalyticalEnvelope[NatureRiskData]:
    """Calcule et PERSISTE un risque. `risk_score=None` si aucune composante
    n'est calculable — jamais un nombre inventé (motif scoring.py, PR-07)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "leap_assessments", payload.assessment_id, "Dossier LEAP")
            _assert_in_scope(cur, company_id, "sites", payload.site_id, "Site")
            deps, imps, inter, total_rows, accepted_rows = fetch_scope_rows(
                cur, company_id=company_id, assessment_id=payload.assessment_id, site_id=payload.site_id,
            )
            result = score_risk(
                dependencies=deps, impacts=imps, intersections=inter,
                total_rows=total_rows, accepted_rows=accepted_rows, likelihood=payload.likelihood,
            )
            cur.execute(
                """
                INSERT INTO nature_risks
                    (company_id, assessment_id, site_id, title, methodology_code,
                     methodology_version, risk_score, likelihood, confidence, components,
                     warnings, input_snapshot, input_fingerprint, calculated_at, calculated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s)
                RETURNING *
                """,
                (
                    company_id, payload.assessment_id, payload.site_id, payload.title,
                    result["methodology_code"], result["methodology_version"],
                    result["risk_score"], result["likelihood"], result["confidence"],
                    json.dumps(result["components"]), json.dumps(result["warnings"]),
                    json.dumps(result["snapshot"]), result["fingerprint"], calculated_by,
                ),
            )
            row = dict(cur.fetchone())

    data = NatureRiskData(
        risk_id=row["id"], assessment_id=row["assessment_id"], site_id=row["site_id"],
        title=row["title"], methodology_code=row["methodology_code"],
        methodology_version=row["methodology_version"], risk_score=_float(row["risk_score"]),
        likelihood=row["likelihood"],
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
        EvidenceRef(note=f"dépendance nature #{d['id']} ACCEPTÉE ({d['ecosystem_service']}/{d['dependency_level']})")
        for d in deps
    ] + [
        EvidenceRef(note=f"impact nature #{i['id']} ACCEPTÉ ({i['pressure_type']}/{i['magnitude_qualitative']})")
        for i in imps
    ]
    return AnalyticalEnvelope[NatureRiskData](data=data, meta=meta, evidence=evidence)


def _summary(row: dict[str, Any]) -> NatureRiskSummary:
    data = dict(row)
    data["risk_score"] = _float(row["risk_score"])
    data["confidence"] = _float(row["confidence"])
    data["components"] = row.get("components") or []
    data["warnings"] = row.get("warnings") or []
    return NatureRiskSummary(**{k: data[k] for k in NatureRiskSummary.model_fields if k in data})


def get_risk(*, company_id: int, risk_id: int) -> NatureRiskSummary:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM nature_risks WHERE id = %s AND {_SCOPE}", (risk_id, company_id))
            row = cur.fetchone()
    if row is None:
        raise NatureRiskError(f"Risque nature '{risk_id}' introuvable.")
    return _summary(dict(row))


def list_risks(
    *, company_id: int, assessment_id: int | None = None, review_status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> NatureRiskListResponse:
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
            cur.execute(f"SELECT COUNT(*) AS c FROM nature_risks {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM nature_risks {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return NatureRiskListResponse(
        items=[_summary(dict(r)) for r in rows], total=total, limit=limit, offset=offset,
    )


def review_risk(
    *, company_id: int, risk_id: int, accept: bool, reviewed_by: int | None = None,
) -> NatureRiskSummary:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM nature_risks WHERE id = %s AND {_SCOPE}",
                (risk_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureRiskError(f"Risque nature '{risk_id}' introuvable.")
            if row["review_status"] != "pending":
                raise NatureRiskError(
                    f"Risque '{risk_id}' déjà revu ({row['review_status']}) — "
                    "seule une ligne 'pending' est revue."
                )
            cur.execute(
                f"UPDATE nature_risks SET review_status = %s, reviewed_by = %s, "
                f"reviewed_at = now(), updated_at = now() WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, reviewed_by, risk_id, company_id),
            )
            return _summary(dict(cur.fetchone()))
