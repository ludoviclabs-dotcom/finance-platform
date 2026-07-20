"""
leap_service.py — cycle de vie du dossier LEAP (PR-09).

`phase` (locate -> evaluate -> assess -> prepare -> completed) avance d'UN
cran à la fois, avec une précondition VÉRIFIÉE par transition — jamais une
avance automatique. Introduit en tranche A (038) pour `evaluate`/`assess`
(site rattaché, dépendance/impact ACCEPTÉ) ; ÉTENDU par la tranche B (039,
ce commit) pour `prepare` (risque/opportunité ACCEPTÉ) et `completed`
(brouillon de disclosure préparé) — même module, jamais dupliqué.

`review()` mirrors `services/crma/article24_service.py::review()` (motif
imposé par WAVE_4_INTERFACE_CONTRACTS.md §6) : une approbation exige un
`reviewed_by` identifié, refuse d'approuver un dossier sans contenu, refuse de
réapprouver un dossier déjà approuvé (rouvrir la revue d'abord).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db.database import get_db
from models.nature import (
    LeapAssessmentCreate,
    LeapAssessmentListResponse,
    LeapAssessmentResponse,
)

_SCOPE = "company_id = %s"

# Ordre linéaire des phases LEAP — une seule transition valide à la fois.
_NEXT_PHASE: dict[str, str] = {
    "locate": "evaluate",
    "evaluate": "assess",
    "assess": "prepare",
    "prepare": "completed",
}
# Toutes les transitions ont désormais une précondition vérifiable :
# 'evaluate'/'assess' dépendent du périmètre 038 (dépendances/impacts/sites) ;
# 'prepare'/'completed' dépendent de 039 (risques/opportunités/disclosure),
# ajoutées par la tranche B — ce module est ÉTENDU, jamais dupliqué.
_SUPPORTED_TARGETS = frozenset({"evaluate", "assess", "prepare", "completed"})


class NatureLeapError(Exception):
    """Erreur métier du dossier LEAP (transition invalide, revue refusée)."""


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureLeapError(f"{label} '{row_id}' introuvable.")


def _attach_site_ids(cur, company_id: int, rows: list[dict[str, Any]]) -> list[LeapAssessmentResponse]:
    ids = [r["id"] for r in rows]
    site_map: dict[int, list[int]] = {i: [] for i in ids}
    if ids:
        cur.execute(
            "SELECT assessment_id, site_id FROM leap_assessment_sites "
            "WHERE assessment_id = ANY(%s) AND company_id = %s ORDER BY site_id",
            (ids, company_id),
        )
        for r in cur.fetchall():
            site_map.setdefault(r["assessment_id"], []).append(r["site_id"])
    out: list[LeapAssessmentResponse] = []
    for r in rows:
        data = dict(r)
        data["site_ids"] = site_map.get(data["id"], [])
        out.append(LeapAssessmentResponse(**data))
    return out


def create_assessment(
    *, company_id: int, payload: LeapAssessmentCreate, created_by: int | None = None,
) -> LeapAssessmentResponse:
    """Ouvre un dossier en `phase='locate'`, `status='draft'` — motif
    `crma_article24_assessments` : un dossier existe avant tout calcul."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            for site_id in payload.site_ids:
                _assert_in_scope(cur, company_id, "sites", site_id, "Site")
            cur.execute(
                """
                INSERT INTO leap_assessments (company_id, label, phase, status, prepared_by)
                VALUES (%s, %s, 'locate', 'draft', %s)
                RETURNING *
                """,
                (company_id, payload.label, created_by),
            )
            row = dict(cur.fetchone())
            for site_id in payload.site_ids:
                cur.execute(
                    "INSERT INTO leap_assessment_sites (company_id, assessment_id, site_id) "
                    "VALUES (%s, %s, %s) ON CONFLICT (assessment_id, site_id) DO NOTHING",
                    (company_id, row["id"], site_id),
                )
            return _attach_site_ids(cur, company_id, [row])[0]


def list_assessments(
    *, company_id: int, phase: str | None = None, status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> LeapAssessmentListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if phase is not None:
        clauses.append("phase = %s")
        params.append(phase)
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM leap_assessments {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM leap_assessments {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = [dict(r) for r in cur.fetchall()]
            items = _attach_site_ids(cur, company_id, rows)
    return LeapAssessmentListResponse(items=items, total=total, limit=limit, offset=offset)


def get_assessment(*, company_id: int, assessment_id: int) -> LeapAssessmentResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM leap_assessments WHERE id = %s AND {_SCOPE}",
                (assessment_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureLeapError(f"Dossier LEAP '{assessment_id}' introuvable.")
            return _attach_site_ids(cur, company_id, [dict(row)])[0]


def add_site(*, company_id: int, assessment_id: int, site_id: int) -> LeapAssessmentResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "leap_assessments", assessment_id, "Dossier LEAP")
            _assert_in_scope(cur, company_id, "sites", site_id, "Site")
            cur.execute(
                "INSERT INTO leap_assessment_sites (company_id, assessment_id, site_id) "
                "VALUES (%s, %s, %s) ON CONFLICT (assessment_id, site_id) DO NOTHING",
                (company_id, assessment_id, site_id),
            )
    return get_assessment(company_id=company_id, assessment_id=assessment_id)


def advance_phase(
    *, company_id: int, assessment_id: int, target_phase: str, actor_id: int | None = None,
) -> LeapAssessmentResponse:
    """Fait avancer `phase` d'UN cran, précondition vérifiée. Jamais une
    conclusion automatique : la précondition constate un ÉTAT DÉJÀ REVU par un
    humain (site rattaché, dépendance/impact ACCEPTÉ) — elle ne décide rien."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT phase FROM leap_assessments WHERE id = %s AND {_SCOPE}",
                (assessment_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureLeapError(f"Dossier LEAP '{assessment_id}' introuvable.")
            current = row["phase"]
            expected_next = _NEXT_PHASE.get(current)
            if expected_next is None or target_phase != expected_next:
                raise NatureLeapError(
                    f"Transition invalide : '{current}' -> '{target_phase}' "
                    f"(seule '{expected_next}' est atteignable depuis '{current}')."
                )
            if target_phase not in _SUPPORTED_TARGETS:
                raise NatureLeapError(f"Transition vers '{target_phase}' non supportée.")
            if target_phase == "evaluate":
                cur.execute(
                    "SELECT COUNT(*) AS c FROM leap_assessment_sites WHERE assessment_id = %s AND company_id = %s",
                    (assessment_id, company_id),
                )
                if cur.fetchone()["c"] == 0:
                    raise NatureLeapError(
                        "Passage en 'evaluate' refusé : aucun site rattaché au dossier LEAP."
                    )
            elif target_phase == "assess":
                cur.execute(
                    """
                    SELECT COUNT(*) AS c FROM (
                        SELECT 1 FROM nature_dependencies d
                        JOIN leap_assessment_sites las
                          ON las.site_id = d.site_id AND las.assessment_id = %s AND las.company_id = %s
                        WHERE d.company_id = %s AND d.review_status = 'accepted'
                        UNION ALL
                        SELECT 1 FROM nature_impacts i
                        JOIN leap_assessment_sites las
                          ON las.site_id = i.site_id AND las.assessment_id = %s AND las.company_id = %s
                        WHERE i.company_id = %s AND i.review_status = 'accepted'
                    ) sub
                    """,
                    (assessment_id, company_id, company_id, assessment_id, company_id, company_id),
                )
                if cur.fetchone()["c"] == 0:
                    raise NatureLeapError(
                        "Passage en 'assess' refusé : aucune dépendance ni impact ACCEPTÉ "
                        "pour les sites du dossier — proximité/déclaration ne suffit pas, "
                        "il faut une revue humaine positive."
                    )
            elif target_phase == "prepare":
                # 039 (tranche B) : au moins un risque OU une opportunité
                # ACCEPTÉ — un calcul seul (jamais revu) ne suffit pas, même
                # règle que 'assess' : la revue humaine positive est le geste
                # qui compte, pas le calcul.
                cur.execute(
                    """
                    SELECT COUNT(*) AS c FROM (
                        SELECT 1 FROM nature_risks
                        WHERE company_id = %s AND assessment_id = %s AND review_status = 'accepted'
                        UNION ALL
                        SELECT 1 FROM nature_opportunities
                        WHERE company_id = %s AND assessment_id = %s AND review_status = 'accepted'
                    ) sub
                    """,
                    (company_id, assessment_id, company_id, assessment_id),
                )
                if cur.fetchone()["c"] == 0:
                    raise NatureLeapError(
                        "Passage en 'prepare' refusé : aucun risque ni opportunité ACCEPTÉ "
                        "pour ce dossier — un score calculé mais jamais revu ne suffit pas."
                    )
            elif target_phase == "completed":
                # 039 : au moins un brouillon de disclosure préparé (jamais
                # exigé 'approved' — 'completed' constate que le cycle LEAP a
                # été parcouru, pas qu'une publication a eu lieu : aucune
                # publication automatique n'existe dans ce dépôt).
                cur.execute(
                    "SELECT COUNT(*) AS c FROM tnfd_disclosure_drafts "
                    "WHERE company_id = %s AND assessment_id = %s",
                    (company_id, assessment_id),
                )
                if cur.fetchone()["c"] == 0:
                    raise NatureLeapError(
                        "Passage en 'completed' refusé : aucun brouillon de disclosure "
                        "TNFD préparé pour ce dossier."
                    )
            cur.execute(
                f"UPDATE leap_assessments SET phase = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE}",
                (target_phase, assessment_id, company_id),
            )
    return get_assessment(company_id=company_id, assessment_id=assessment_id)


def review(
    *, company_id: int, assessment_id: int, approve: bool, reviewed_by: int,
) -> LeapAssessmentResponse:
    """Gate de revue HUMAINE du dossier — motif `article24_service.review()`
    (contrats §6) : `reviewed_by` non optionnel pour approuver, refus
    d'approuver un dossier encore en 'locate' (rien à approuver), refus de
    réapprouver un dossier déjà `approved` (rouvrir la revue d'abord)."""
    if approve and not reviewed_by:
        raise NatureLeapError("Une approbation requiert un utilisateur identifié.")
    current = get_assessment(company_id=company_id, assessment_id=assessment_id)
    if approve and current.status == "approved":
        raise NatureLeapError(
            f"Dossier LEAP '{assessment_id}' déjà approuvé — rouvrir la revue avant de réapprouver."
        )
    if approve and current.phase == "locate":
        raise NatureLeapError(
            "Dossier LEAP encore en phase 'locate' : rien à approuver avant 'evaluate'."
        )
    new_status = "approved" if approve else "draft"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE leap_assessments SET
                    status = %s, approved_by = %s, approved_at = %s, updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING id
                """,
                (
                    new_status, reviewed_by if approve else None,
                    datetime.now(timezone.utc) if approve else None,
                    assessment_id, company_id,
                ),
            )
            if cur.fetchone() is None:
                raise NatureLeapError(f"Dossier LEAP '{assessment_id}' introuvable.")
    return get_assessment(company_id=company_id, assessment_id=assessment_id)
