"""
impact_assessment_service.py — `impact_assessments` (PR-10, migration 040) :
CRUD, composition des `components`, calcul INDICATIF de `threshold_crossed`.

**Jamais un score unique.** `scale`/`scope`/`irremediability`/`likelihood`
restent quatre colonnes séparées de bout en bout — ce module ne les
multiplie, ne les pondère ni ne les additionne jamais en un nombre. Le seul
dérivé calculé est `threshold_crossed` (booléen), par une règle OR
TRANSPARENTE et documentée : au moins UNE composante de SÉVÉRITÉ (scale,
scope ou irremediability) atteint le seuil `SEVERITY_COMPONENT_THRESHOLD`.
`likelihood` (probabilité) en est délibérément exclue — au sens ESRS/TNFD,
la sévérité d'un impact est fonction de son échelle/étendue/irrémédiabilité ;
la probabilité ne qualifie que le passage du potentiel à l'avéré (et n'a
d'ailleurs pas de sens pour un impact déjà avéré, `is_actual=true`). C'est le
même motif « OR jamais fusion » que `materialite_service.compute_score`
(impact OU financier), appliqué un niveau plus bas, DANS la dimension impact.

`threshold_crossed` reste INDICATIF — il n'écrit jamais `materiality_
decisions`, il ne fait qu'informer une décision humaine ultérieure (plan §6).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from db.database import get_db
from models.analytics import AnalyticalEnvelope, AnalyticalMeta, MethodRef, QualityMeta
from models.iro import (
    ImpactAssessmentCreate,
    ImpactAssessmentListResponse,
    ImpactAssessmentResponse,
    ScoreComponent,
)

from . import iro_service

_SCOPE = "company_id = %s"

METHODOLOGY_CODE = "CC-IRO-IMPACT"
METHODOLOGY_VERSION = "0.1.0"

# Palier "sévérité haute" CarbonCo (0-100) — méthode indicative propre,
# jamais un score officiel ESRS/EFRAG (même disclaimer de posture que
# scoring.py CRMA : DISCLAIMER, is_official_eu_score=False).
SEVERITY_COMPONENT_THRESHOLD = 66

_SEVERITY_COMPONENTS: tuple[tuple[str, str], ...] = (
    ("scale", "Échelle"),
    ("scope", "Étendue"),
    ("irremediability", "Irrémédiabilité"),
)


class ImpactAssessmentError(Exception):
    """Erreur métier des évaluations de matérialité d'impact."""


def _impact_row(row: dict[str, Any]) -> ImpactAssessmentResponse:
    data = {k: row[k] for k in ImpactAssessmentResponse.model_fields}
    components = data["components"]
    data["components"] = json.loads(components) if isinstance(components, str) else components
    return ImpactAssessmentResponse(**data)


def _build_components(payload: ImpactAssessmentCreate) -> tuple[list[ScoreComponent], bool, list[str]]:
    """Dérive les composantes affichables + le résultat OR indicatif.

    Renvoie (components, threshold_crossed, triggered_labels). Une
    composante sans donnée (`available=False`) est EXCLUE de la règle OR,
    jamais comptée comme sous le seuil par défaut."""
    values = {
        "scale": payload.scale, "scope": payload.scope, "irremediability": payload.irremediability,
    }
    components: list[ScoreComponent] = []
    triggered: list[str] = []
    for code, label in _SEVERITY_COMPONENTS:
        value = values[code]
        available = value is not None
        if available and value >= SEVERITY_COMPONENT_THRESHOLD:
            triggered.append(label)
        components.append(ScoreComponent(
            code=code, label=label, available=available,
            value=float(value) if available else None,
            rationale=(
                f"{label} = {value}/100 (seuil {SEVERITY_COMPONENT_THRESHOLD})"
                if available else "Non renseignée — exclue de la lecture indicative."
            ),
        ))
    # Likelihood est affichée en composante (traçabilité) mais N'ENTRE JAMAIS
    # dans la règle OR de sévérité (voir docstring module).
    components.append(ScoreComponent(
        code="likelihood", label="Probabilité", available=payload.likelihood is not None,
        value=float(payload.likelihood) if payload.likelihood is not None else None,
        rationale="Probabilité — n'entre pas dans la lecture de sévérité (échelle/étendue/irrémédiabilité).",
    ))
    return components, bool(triggered), triggered


def create_impact_assessment(
    *, company_id: int, iro_id: int, payload: ImpactAssessmentCreate, prepared_by: int | None = None,
) -> AnalyticalEnvelope[ImpactAssessmentResponse]:
    if payload.is_actual and payload.likelihood is not None:
        raise ImpactAssessmentError(
            "Un impact avéré (is_actual=true) ne porte pas de probabilité — "
            "likelihood doit rester vide."
        )
    components, threshold_crossed, triggered = _build_components(payload)
    now = datetime.now(timezone.utc)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                """
                INSERT INTO impact_assessments
                    (company_id, iro_id, polarity, is_actual, scale, scope, irremediability,
                     likelihood, time_horizon, confidence, methodology_code, methodology_version,
                     components, threshold_crossed, rationale, calculated_at, prepared_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, iro_id, payload.polarity, payload.is_actual, payload.scale,
                    payload.scope, payload.irremediability, payload.likelihood, payload.time_horizon,
                    payload.confidence, METHODOLOGY_CODE, METHODOLOGY_VERSION,
                    json.dumps([c.model_dump() for c in components]), threshold_crossed,
                    payload.rationale, now, prepared_by,
                ),
            )
            row = _impact_row(dict(cur.fetchone()))

    # Fait de calcul (pas une décision) : au moins une évaluation existe désormais.
    iro_service.advance_status(company_id=company_id, iro_id=iro_id, target="assessed")

    warnings = []
    if not triggered:
        warnings.append("Aucune composante de sévérité au-dessus du seuil indicatif (ou données absentes).")
    missing = [c.label for c in components if not c.available]
    if missing:
        warnings.append(f"Composante(s) non renseignée(s) : {', '.join(missing)}.")

    meta = AnalyticalMeta(
        as_of=now.date().isoformat(),
        status="manual",
        method=MethodRef(code=METHODOLOGY_CODE, version=METHODOLOGY_VERSION),
        quality=QualityMeta(confidence=payload.confidence, warnings=warnings),
    )
    return AnalyticalEnvelope[ImpactAssessmentResponse](data=row, meta=meta, evidence=[])


def list_impact_assessments(
    *, company_id: int, iro_id: int, limit: int = 50, offset: int = 0,
) -> ImpactAssessmentListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                f"SELECT COUNT(*) AS n FROM impact_assessments WHERE iro_id = %s AND {_SCOPE}",
                (iro_id, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM impact_assessments WHERE iro_id = %s AND {_SCOPE} "
                "ORDER BY calculated_at DESC NULLS LAST, id DESC LIMIT %s OFFSET %s",
                (iro_id, company_id, limit, offset),
            )
            items = [_impact_row(dict(r)) for r in cur.fetchall()]
    return ImpactAssessmentListResponse(items=items, total=total, limit=limit, offset=offset)
