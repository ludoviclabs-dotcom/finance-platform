"""
article24_service.py — évaluations Article 24 (CRMA), actions d'atténuation et
rapport exportable (PR-07).

**Le calcul ne décide pas.** `recalculate` remplit `risk_score`, `confidence`,
`components`, `drivers` et `input_snapshot`, mais laisse le statut à `draft` :
seul `review` (avec un utilisateur identifié) fait passer une évaluation à
`approved`/`submitted`. C'est le gate de revue humaine — aucun score
n'auto-approuve un rapport réglementaire, et la contrainte SQL
`crma_article24_approval_check` le redit en base.

**Risque et confiance restent séparés** jusque dans l'export : deux colonnes,
deux champs JSON, jamais un « score net ». Le rapport porte en plus
`is_official_eu_score=False` et le `disclaimer` de la méthode, pour qu'un
lecteur du JSON hors contexte applicatif ne puisse pas le prendre pour une
notation réglementaire.

**Aucune action ne modifie le score.** `expected_risk_reduction_pct` d'une
`mitigation_action` est une intention déclarée : aucune ligne de ce module ne la
soustrait de `risk_score`. Un risque ne baisse que quand les données changent.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from db.database import get_db
from models.crma import (
    GROUP_CODE_CRITICAL,
    Article24AssessmentCreate,
    Article24AssessmentListResponse,
    Article24AssessmentResponse,
    Article24Report,
    MitigationActionCreate,
    MitigationActionListResponse,
    MitigationActionResponse,
)
from services.crma import exposure_service, reference_service, scoring, stage_service

# Tables TENANT STRICTES — jamais de `IS NULL`.
_SCOPE = "company_id = %s"


class Article24Error(Exception):
    """Erreur métier des évaluations Article 24 / actions d'atténuation."""


def _float(value: Any) -> float | None:
    return float(value) if value is not None else None


def _assessment_row(row: dict[str, Any]) -> Article24AssessmentResponse:
    data = {k: row[k] for k in Article24AssessmentResponse.model_fields}
    for key in ("risk_score", "confidence", "coverage_pct"):
        data[key] = _float(data[key])
    # psycopg2 rend déjà les JSONB décodés ; on tolère la chaîne par sécurité.
    for key in ("components", "drivers", "warnings", "input_snapshot"):
        value = data[key]
        data[key] = json.loads(value) if isinstance(value, str) else value
    return Article24AssessmentResponse(**data)


# ---------------------------------------------------------------------------
# Évaluations
# ---------------------------------------------------------------------------

def create_assessment(
    *, company_id: int, payload: Article24AssessmentCreate, prepared_by: int | None = None
) -> Article24AssessmentResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crma_article24_assessments
                    (company_id, material_id, assessment_year, regulation_version,
                     vulnerability_summary, methodology_code, methodology_version, prepared_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, material_id, assessment_year) DO NOTHING
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.assessment_year,
                    payload.regulation_version, payload.vulnerability_summary,
                    scoring.METHODOLOGY_CODE, scoring.METHODOLOGY_VERSION, prepared_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise Article24Error(
                    f"Une évaluation Article 24 existe déjà pour '{payload.material_id}' "
                    f"en {payload.assessment_year}."
                )
    return _assessment_row(row)


def get_assessment(*, company_id: int, assessment_id: int) -> Article24AssessmentResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM crma_article24_assessments WHERE id = %s AND {_SCOPE}",
                (assessment_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise Article24Error(f"Évaluation '{assessment_id}' introuvable ou hors périmètre.")
    return _assessment_row(row)


def list_assessments(
    *,
    company_id: int,
    material_id: str | None = None,
    assessment_year: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> Article24AssessmentListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    if assessment_year is not None:
        clauses.append("assessment_year = %s")
        params.append(assessment_year)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM crma_article24_assessments WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM crma_article24_assessments WHERE {where}
                ORDER BY assessment_year DESC, material_id LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_assessment_row(r) for r in cur.fetchall()]
    return Article24AssessmentListResponse(items=items, total=total, limit=limit, offset=offset)


def recalculate(
    *, company_id: int, assessment_id: int, as_of: date | None = None
) -> Article24AssessmentResponse:
    """Recalcule le score d'une évaluation et conserve son instantané d'entrées.

    Le statut n'est PAS touché : recalculer n'approuve pas. Une évaluation déjà
    approuvée est refusée au recalcul — sinon le chiffre approuvé par un humain
    pourrait changer sous ses pieds sans nouvelle revue.
    """
    current = get_assessment(company_id=company_id, assessment_id=assessment_id)
    if current.status in ("approved", "submitted"):
        raise Article24Error(
            "Évaluation déjà approuvée : rouvrir la revue avant de recalculer "
            "(un chiffre approuvé ne change pas sans nouvelle revue humaine)."
        )

    score = exposure_service.compute_exposure_score(
        company_id=company_id,
        material_id=current.material_id,
        reference_year=None,
        as_of=as_of,
    )
    status = reference_service.get_material_status(
        company_id=company_id, material_id=current.material_id
    )

    warnings = list(score.warnings)
    if status.strategic_not_critical:
        warnings.append(
            f"Incohérence de référentiel : '{current.material_id}' est marquée stratégique "
            "sans être critique — toute matière stratégique est aussi critique (CRMA)."
        )
    if not status.is_critical_eu:
        warnings.append(
            f"'{current.material_id}' n'appartient pas au groupe '{GROUP_CODE_CRITICAL}' : "
            "l'obligation Article 24 ne s'applique pas nécessairement."
        )

    snapshot = {
        "material_id": current.material_id,
        "as_of": (as_of or date.today()).isoformat(),
        "material_status": status.model_dump(mode="json"),
        "stage_concentrations": [c.model_dump(mode="json") for c in score.stage_concentrations],
        "confidence_components": [c.model_dump(mode="json") for c in score.confidence_components],
        "methodology": {
            "code": score.methodology_code,
            "version": score.methodology_version,
            "nominal_weights": scoring.NOMINAL_WEIGHTS,
        },
    }

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE crma_article24_assessments SET
                    risk_score = %s,
                    confidence = %s,
                    coverage_pct = %s,
                    methodology_code = %s,
                    methodology_version = %s,
                    components = %s::jsonb,
                    drivers = %s::jsonb,
                    warnings = %s::jsonb,
                    input_snapshot = %s::jsonb,
                    calculated_at = now(),
                    updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING *
                """,
                (
                    score.risk_score,
                    score.confidence,
                    score.coverage_pct,
                    score.methodology_code,
                    score.methodology_version,
                    json.dumps([c.model_dump(mode="json") for c in score.components], default=str),
                    json.dumps([d.model_dump(mode="json") for d in score.drivers], default=str),
                    json.dumps(warnings, ensure_ascii=False),
                    json.dumps(snapshot, default=str, ensure_ascii=False),
                    assessment_id, company_id,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise Article24Error(f"Évaluation '{assessment_id}' introuvable ou hors périmètre.")
    return _assessment_row(row)


def review(
    *, company_id: int, assessment_id: int, approve: bool, reviewed_by: int
) -> Article24AssessmentResponse:
    """Gate de revue HUMAINE : `approved` exige un utilisateur identifié.

    `reviewed_by` n'est pas optionnel — un rapport ne peut pas être approuvé par
    « le système ». Le refus renvoie l'évaluation en `draft` plutôt que de la
    supprimer : la trace de la revue reste.
    """
    if approve and not reviewed_by:
        raise Article24Error("Une approbation requiert un utilisateur identifié.")
    current = get_assessment(company_id=company_id, assessment_id=assessment_id)
    if approve and current.risk_score is None and current.calculated_at is None:
        raise Article24Error(
            "Évaluation jamais calculée : lancer le calcul avant de l'approuver."
        )

    new_status = "approved" if approve else "draft"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE crma_article24_assessments SET
                    status = %s,
                    approved_by = %s,
                    approved_at = %s,
                    updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING *
                """,
                (
                    new_status,
                    reviewed_by if approve else None,
                    datetime.now(timezone.utc) if approve else None,
                    assessment_id, company_id,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise Article24Error(f"Évaluation '{assessment_id}' introuvable ou hors périmètre.")
    return _assessment_row(row)


# ---------------------------------------------------------------------------
# Actions d'atténuation
# ---------------------------------------------------------------------------

def _action_row(row: dict[str, Any]) -> MitigationActionResponse:
    data = {k: row[k] for k in MitigationActionResponse.model_fields}
    data["expected_risk_reduction_pct"] = _float(data["expected_risk_reduction_pct"])
    return MitigationActionResponse(**data)


def create_action(
    *, company_id: int, payload: MitigationActionCreate, created_by: int | None = None
) -> MitigationActionResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if payload.assessment_id is not None:
                cur.execute(
                    f"SELECT 1 FROM crma_article24_assessments WHERE id = %s AND {_SCOPE}",
                    (payload.assessment_id, company_id),
                )
                if cur.fetchone() is None:
                    raise Article24Error(
                        f"Évaluation '{payload.assessment_id}' introuvable ou hors périmètre."
                    )
            cur.execute(
                """
                INSERT INTO mitigation_actions
                    (company_id, assessment_id, material_id, target_stage_code, action_type,
                     title, description, status, owner, due_date, expected_effect,
                     expected_risk_reduction_pct, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.assessment_id, payload.material_id,
                    payload.target_stage_code, payload.action_type, payload.title,
                    payload.description, payload.status, payload.owner, payload.due_date,
                    payload.expected_effect, payload.expected_risk_reduction_pct, created_by,
                ),
            )
            row = cur.fetchone()
    return _action_row(row)


def list_actions(
    *,
    company_id: int,
    assessment_id: int | None = None,
    material_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> MitigationActionListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if assessment_id is not None:
        clauses.append("assessment_id = %s")
        params.append(assessment_id)
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM mitigation_actions WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM mitigation_actions WHERE {where}
                ORDER BY due_date NULLS LAST, id LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_action_row(r) for r in cur.fetchall()]
    return MitigationActionListResponse(items=items, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Rapport Article 24
# ---------------------------------------------------------------------------

def build_report(*, company_id: int, assessment_id: int) -> Article24Report:
    """Assemble le rapport Article 24 exportable.

    Le rapport n'invente rien : il agrège l'évaluation déjà calculée, la chaîne
    de valeur PAR ÉTAPE, les alternatives, les filières de recyclage, les
    événements, les expositions et les actions. Si l'évaluation n'a jamais été
    calculée, l'absence de score est signalée dans `warnings` plutôt que
    comblée par un chiffre.
    """
    assessment = get_assessment(company_id=company_id, assessment_id=assessment_id)
    material_id = assessment.material_id

    warnings = list(assessment.warnings)
    if assessment.calculated_at is None:
        warnings.append(
            "Évaluation jamais calculée : ce rapport ne contient aucun score."
        )
    if assessment.status not in ("approved", "submitted"):
        warnings.append(
            f"Évaluation au statut « {assessment.status} » : rapport non approuvé, "
            "à ne pas transmettre en l'état."
        )

    return Article24Report(
        company_id=company_id,
        material_id=material_id,
        assessment_year=assessment.assessment_year,
        generated_at=datetime.now(timezone.utc),
        assessment=assessment,
        material_status=reference_service.get_material_status(
            company_id=company_id, material_id=material_id
        ),
        value_chain=stage_service.get_value_chain(
            company_id=company_id, material_id=material_id
        ),
        substitutes=reference_service.list_substitutes(
            company_id=company_id, material_id=material_id, limit=200
        ).items,
        recycling_routes=reference_service.list_recycling_routes(
            company_id=company_id, material_id=material_id, limit=200
        ).items,
        events=reference_service.list_events(
            company_id=company_id, material_id=material_id, limit=200
        ).items,
        exposures=exposure_service.list_exposures(
            company_id=company_id, material_id=material_id, limit=200
        ).items,
        mitigation_actions=list_actions(
            company_id=company_id, assessment_id=assessment_id, limit=200
        ).items,
        methodology_code=assessment.methodology_code,
        methodology_version=assessment.methodology_version,
        # Sérialisé dans l'export : un lecteur du JSON, hors contexte
        # applicatif, doit pouvoir constater que ce score n'est pas officiel.
        is_official_eu_score=False,
        disclaimer=scoring.DISCLAIMER,
        warnings=warnings,
    )
