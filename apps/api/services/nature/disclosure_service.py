"""
disclosure_service.py — brouillons de disclosure TNFD (PR-09 tranche B,
« Prepare »).

Assemble `tnfd_disclosure_drafts` à partir de l'état RÉEL du dossier LEAP
(dépendances/impacts ACCEPTÉS, risques/opportunités calculés, actions) —
n'invente RIEN : une section sans donnée le dit explicitement plutôt que de
la combler (motif `article24_service.build_report`, PR-07).

TOUJOURS un brouillon. `is_official_tnfd_disclosure=False` est câblé en dur
ici ET verrouillé par un CHECK en base (039) — même discipline que
`Article24Report.is_official_eu_score=False` (`services/crma/scoring.py`).
`review()` mirrors `article24_service.review()` / `leap_service.review()` :
`reviewed_by` obligatoire pour approuver, refuse de réapprouver un brouillon
déjà approuvé. Aucun statut 'published' n'existe dans le vocabulaire — une
publication automatique n'est même pas représentable.

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from db.database import get_db
from models.nature import (
    TnfdDisclosureDraftCreate,
    TnfdDisclosureDraftListResponse,
    TnfdDisclosureDraftResponse,
)

_SCOPE = "company_id = %s"

DISCLAIMER = (
    "Brouillon TNFD CarbonCo — vocabulaire LEAP (Locate/Evaluate/Assess/"
    "Prepare) repris tel que publié par le TNFD à titre de structuration du "
    "processus. Ceci N'EST PAS une disclosure TNFD officielle, ni une "
    "certification, ni un rapport prêt à publier : chaque section reflète "
    "l'état des données et évaluations internes du tenant à la date "
    "indiquée, sous revue humaine — jamais une conclusion automatique."
)


class NatureDisclosureError(Exception):
    """Erreur métier des brouillons de disclosure TNFD."""


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureDisclosureError(f"{label} '{row_id}' introuvable.")


def _build_sections(cur, *, company_id: int, assessment_id: int) -> list[dict[str, Any]]:
    """Assemble les sections à partir de l'état RÉEL en base — jamais un
    texte narratif généré, jamais une conclusion inventée pour combler une
    section vide."""
    sections: list[dict[str, Any]] = []

    cur.execute(
        f"SELECT label, phase, status FROM leap_assessments WHERE id = %s AND {_SCOPE}",
        (assessment_id, company_id),
    )
    assessment = cur.fetchone()
    if assessment is None:
        raise NatureDisclosureError(f"Dossier LEAP '{assessment_id}' introuvable.")
    sections.append({
        "section_code": "leap_status",
        "title": "État du dossier LEAP",
        "content": (
            f"Dossier « {assessment['label']} » — phase actuelle : "
            f"{assessment['phase']} ; statut de revue : {assessment['status']}."
        ),
        "data_status": None,
    })

    cur.execute(
        """
        SELECT d.ecosystem_service, d.dependency_level, COUNT(*) AS c
        FROM nature_dependencies d
        JOIN leap_assessment_sites las
          ON las.site_id = d.site_id AND las.assessment_id = %s AND las.company_id = %s
        WHERE d.company_id = %s AND d.review_status = 'accepted'
        GROUP BY d.ecosystem_service, d.dependency_level
        ORDER BY d.ecosystem_service, d.dependency_level
        """,
        (assessment_id, company_id, company_id),
    )
    dep_rows = cur.fetchall()
    if dep_rows:
        content = "; ".join(
            f"{r['ecosystem_service']} ({r['dependency_level']}) x{r['c']}" for r in dep_rows
        )
    else:
        content = "Aucune dépendance ACCEPTÉE à ce jour pour ce dossier."
    sections.append({
        "section_code": "dependencies", "title": "Dépendances (Evaluate)",
        "content": content, "data_status": "manual" if dep_rows else None,
    })

    cur.execute(
        """
        SELECT i.pressure_type, i.impact_kind, i.magnitude_qualitative, COUNT(*) AS c
        FROM nature_impacts i
        JOIN leap_assessment_sites las
          ON las.site_id = i.site_id AND las.assessment_id = %s AND las.company_id = %s
        WHERE i.company_id = %s AND i.review_status = 'accepted'
        GROUP BY i.pressure_type, i.impact_kind, i.magnitude_qualitative
        ORDER BY i.pressure_type, i.impact_kind, i.magnitude_qualitative
        """,
        (assessment_id, company_id, company_id),
    )
    imp_rows = cur.fetchall()
    if imp_rows:
        content = "; ".join(
            f"{r['pressure_type']} ({r['impact_kind']}, {r['magnitude_qualitative']}) x{r['c']}"
            for r in imp_rows
        )
    else:
        content = "Aucun impact ACCEPTÉ à ce jour pour ce dossier."
    sections.append({
        "section_code": "impacts", "title": "Impacts (Evaluate)",
        "content": content, "data_status": "manual" if imp_rows else None,
    })

    cur.execute(
        "SELECT id, title, risk_score, likelihood, confidence, review_status "
        "FROM nature_risks WHERE company_id = %s AND assessment_id = %s ORDER BY id",
        (company_id, assessment_id),
    )
    risk_rows = cur.fetchall()
    if risk_rows:
        content = "; ".join(
            f"#{r['id']} « {r['title']} » — score={r['risk_score']}, "
            f"aléa={r['likelihood']}, confiance={r['confidence']} ({r['review_status']})"
            for r in risk_rows
        )
    else:
        content = "Aucun risque calculé à ce jour pour ce dossier."
    sections.append({
        "section_code": "risks", "title": "Risques (Assess)",
        "content": content, "data_status": "estimated" if risk_rows else None,
    })

    cur.execute(
        "SELECT id, title, opportunity_score, likelihood, confidence, review_status "
        "FROM nature_opportunities WHERE company_id = %s AND assessment_id = %s ORDER BY id",
        (company_id, assessment_id),
    )
    opp_rows = cur.fetchall()
    if opp_rows:
        content = "; ".join(
            f"#{r['id']} « {r['title']} » — score={r['opportunity_score']}, "
            f"aléa={r['likelihood']}, confiance={r['confidence']} ({r['review_status']})"
            for r in opp_rows
        )
    else:
        content = "Aucune opportunité calculée à ce jour pour ce dossier."
    sections.append({
        "section_code": "opportunities", "title": "Opportunités (Assess)",
        "content": content, "data_status": "estimated" if opp_rows else None,
    })

    cur.execute(
        "SELECT id, title, action_type, status, review_status FROM nature_actions "
        "WHERE company_id = %s AND assessment_id = %s ORDER BY id",
        (company_id, assessment_id),
    )
    action_rows = cur.fetchall()
    if action_rows:
        content = "; ".join(
            f"#{r['id']} « {r['title']} » ({r['action_type']}, {r['status']}, {r['review_status']})"
            for r in action_rows
        )
    else:
        content = "Aucune action rattachée directement au dossier à ce jour."
    sections.append({
        "section_code": "actions", "title": "Actions (Prepare)",
        "content": content, "data_status": "manual" if action_rows else None,
    })

    return sections


def _draft_response(row: dict[str, Any]) -> TnfdDisclosureDraftResponse:
    data = dict(row)
    data["sections"] = row.get("sections") or []
    return TnfdDisclosureDraftResponse(
        **{k: data[k] for k in TnfdDisclosureDraftResponse.model_fields if k in data}
    )


def assemble_draft(
    *, company_id: int, payload: TnfdDisclosureDraftCreate, prepared_by: int | None = None,
) -> TnfdDisclosureDraftResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "leap_assessments", payload.assessment_id, "Dossier LEAP")
            sections = _build_sections(cur, company_id=company_id, assessment_id=payload.assessment_id)
            cur.execute(
                """
                INSERT INTO tnfd_disclosure_drafts
                    (company_id, assessment_id, title, sections, is_official_tnfd_disclosure,
                     disclaimer, status, prepared_by)
                VALUES (%s, %s, %s, %s, false, %s, 'draft', %s)
                RETURNING *
                """,
                (company_id, payload.assessment_id, payload.title, json.dumps(sections),
                 DISCLAIMER, prepared_by),
            )
            return _draft_response(dict(cur.fetchone()))


def get_draft(*, company_id: int, draft_id: int) -> TnfdDisclosureDraftResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM tnfd_disclosure_drafts WHERE id = %s AND {_SCOPE}",
                (draft_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise NatureDisclosureError(f"Brouillon TNFD '{draft_id}' introuvable.")
    return _draft_response(dict(row))


def list_drafts(
    *, company_id: int, assessment_id: int | None = None, status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> TnfdDisclosureDraftListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if assessment_id is not None:
        clauses.append("assessment_id = %s")
        params.append(assessment_id)
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM tnfd_disclosure_drafts {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM tnfd_disclosure_drafts {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return TnfdDisclosureDraftListResponse(
        items=[_draft_response(dict(r)) for r in rows], total=total, limit=limit, offset=offset,
    )


def review(
    *, company_id: int, draft_id: int, approve: bool, reviewed_by: int,
) -> TnfdDisclosureDraftResponse:
    """Gate de revue HUMAINE — motif `article24_service.review()` (contrats
    §6) : `reviewed_by` non optionnel pour approuver, refuse de réapprouver un
    brouillon déjà `approved` (rouvrir la revue d'abord). Approuver un
    brouillon ne le rend JAMAIS 'published' — ce statut n'existe pas."""
    if approve and not reviewed_by:
        raise NatureDisclosureError("Une approbation requiert un utilisateur identifié.")
    current = get_draft(company_id=company_id, draft_id=draft_id)
    if approve and current.status == "approved":
        raise NatureDisclosureError(
            f"Brouillon TNFD '{draft_id}' déjà approuvé — rouvrir la revue avant de réapprouver."
        )
    new_status = "approved" if approve else "draft"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE tnfd_disclosure_drafts SET
                    status = %s, approved_by = %s, approved_at = %s, updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING *
                """,
                (
                    new_status, reviewed_by if approve else None,
                    datetime.now(timezone.utc) if approve else None,
                    draft_id, company_id,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureDisclosureError(f"Brouillon TNFD '{draft_id}' introuvable.")
    return _draft_response(dict(row))
