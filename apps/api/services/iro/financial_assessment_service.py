"""
financial_assessment_service.py — `financial_assessments` (PR-10, migration
040) : CRUD, validation de `transmission_chain`, calcul INDICATIF de
`threshold_crossed`.

**Jamais un score unique.** `likelihood` et `magnitude` restent deux colonnes
séparées de bout en bout — ce module ne les multiplie JAMAIS (un produit
likelihood×magnitude serait exactement le « risk score » fusionné que la
Wave 4 interdit structurellement). `threshold_crossed` est un booléen
INDICATIF calculé par une règle OR transparente (chaque composante comparée
individuellement à `FINANCIAL_COMPONENT_THRESHOLD`), jamais une décision.

**Transmission financière = chaîne documentée, jamais un chiffre unique**
(plan §8). `transmission_chain` est une liste de `TransmissionStep`
(`channel`+`rationale` obligatoires par étape, `estimated_amount_eur`
optionnel) — validée non vide par le modèle Pydantic ET par un CHECK SQL
(`jsonb_array_length(...) > 0`) ; la complétude par étape (chaque élément
porte channel+rationale) ne peut être portée que par le modèle Pydantic,
PostgreSQL interdisant les sous-requêtes dans un CHECK.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from db.database import get_db
from models.analytics import AnalyticalEnvelope, AnalyticalMeta, MethodRef, QualityMeta
from models.iro import (
    FinancialAssessmentCreate,
    FinancialAssessmentListResponse,
    FinancialAssessmentResponse,
    ScoreComponent,
    TransmissionStep,
)

from . import iro_service

_SCOPE = "company_id = %s"

METHODOLOGY_CODE = "CC-IRO-FINANCIAL"
METHODOLOGY_VERSION = "0.1.0"

# Palier CarbonCo indicatif (0-100) — jamais un score officiel.
FINANCIAL_COMPONENT_THRESHOLD = 66


class FinancialAssessmentError(Exception):
    """Erreur métier des évaluations de matérialité financière."""


def _financial_row(row: dict[str, Any]) -> FinancialAssessmentResponse:
    data = {k: row[k] for k in FinancialAssessmentResponse.model_fields}
    for key in ("components", "transmission_chain"):
        value = data[key]
        data[key] = json.loads(value) if isinstance(value, str) else value
    return FinancialAssessmentResponse(**data)


def _build_components(payload: FinancialAssessmentCreate) -> tuple[list[ScoreComponent], bool]:
    components: list[ScoreComponent] = []
    triggered = False
    for code, label, value in (
        ("likelihood", "Probabilité", payload.likelihood),
        ("magnitude", "Ampleur financière", payload.magnitude),
    ):
        available = value is not None
        if available and value >= FINANCIAL_COMPONENT_THRESHOLD:
            triggered = True
        components.append(ScoreComponent(
            code=code, label=label, available=available,
            value=float(value) if available else None,
            rationale=(
                f"{label} = {value}/100 (seuil {FINANCIAL_COMPONENT_THRESHOLD})"
                if available else "Non renseignée — exclue de la lecture indicative."
            ),
        ))
    return components, triggered


def create_financial_assessment(
    *, company_id: int, iro_id: int, payload: FinancialAssessmentCreate, prepared_by: int | None = None,
) -> AnalyticalEnvelope[FinancialAssessmentResponse]:
    # Ceinture-bretelles : le modèle Pydantic (min_length=1, champs
    # obligatoires par étape) refuse déjà une chaîne vide/incomplète — ce
    # garde-fou explicite donne un message métier clair si jamais ce service
    # est appelé hors du chemin Pydantic (ex. depuis un futur script interne).
    if not payload.transmission_chain:
        raise FinancialAssessmentError(
            "La chaîne de transmission financière est requise — au moins une étape "
            "documentée (channel + rationale), jamais un chiffre isolé."
        )
    steps: list[TransmissionStep] = sorted(payload.transmission_chain, key=lambda s: s.step)
    primary_channel = steps[0].channel

    components, threshold_crossed = _build_components(payload)
    now = datetime.now(timezone.utc)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                """
                INSERT INTO financial_assessments
                    (company_id, iro_id, likelihood, magnitude, time_horizon, confidence,
                     methodology_code, methodology_version, transmission_chain, primary_channel,
                     components, threshold_crossed, rationale, calculated_at, prepared_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, iro_id, payload.likelihood, payload.magnitude, payload.time_horizon,
                    payload.confidence, METHODOLOGY_CODE, METHODOLOGY_VERSION,
                    json.dumps([s.model_dump() for s in steps]), primary_channel,
                    json.dumps([c.model_dump() for c in components]), threshold_crossed,
                    payload.rationale, now, prepared_by,
                ),
            )
            row = _financial_row(dict(cur.fetchone()))

    iro_service.advance_status(company_id=company_id, iro_id=iro_id, target="assessed")

    warnings = []
    if not threshold_crossed:
        warnings.append("Aucune composante au-dessus du seuil indicatif (ou données absentes).")
    missing = [c.label for c in components if not c.available]
    if missing:
        warnings.append(f"Composante(s) non renseignée(s) : {', '.join(missing)}.")

    meta = AnalyticalMeta(
        as_of=now.date().isoformat(),
        status="manual",
        method=MethodRef(code=METHODOLOGY_CODE, version=METHODOLOGY_VERSION),
        quality=QualityMeta(confidence=payload.confidence, warnings=warnings),
    )
    return AnalyticalEnvelope[FinancialAssessmentResponse](data=row, meta=meta, evidence=[])


def list_financial_assessments(
    *, company_id: int, iro_id: int, limit: int = 50, offset: int = 0,
) -> FinancialAssessmentListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                f"SELECT COUNT(*) AS n FROM financial_assessments WHERE iro_id = %s AND {_SCOPE}",
                (iro_id, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM financial_assessments WHERE iro_id = %s AND {_SCOPE} "
                "ORDER BY calculated_at DESC NULLS LAST, id DESC LIMIT %s OFFSET %s",
                (iro_id, company_id, limit, offset),
            )
            items = [_financial_row(dict(r)) for r in cur.fetchall()]
    return FinancialAssessmentListResponse(items=items, total=total, limit=limit, offset=offset)
