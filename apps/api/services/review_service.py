"""
review_service.py — Workflow de validation des datapoints (Phase 3).

Cycle :
  PROPOSED ────auto (2h)───▶ IN_REVIEW
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
                 VALIDATED                 REJECTED
                     │                       │
                     ▼                       ▼
                  FROZEN                  PROPOSED (nouvelle itération)

Règles :
  - PROPOSED : auto-créé à l'émission d'un fact (emit_fact with auto_review=True)
  - IN_REVIEW : passage manuel OU auto après 2h (timeout_at)
  - VALIDATED : seul un rôle analyst/admin peut valider
  - FROZEN : seul admin peut geler (typiquement lors de génération de rapport)
  - REJECTED : avec reject_reason obligatoire ; le datapoint redevient PROPOSED

FROZEN est terminal : impossible de modifier le fact sous-jacent (vérif applicative).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

DatapointStatus = Literal["proposed", "in_review", "validated", "frozen", "rejected"]
REVIEW_TIMEOUT_HOURS = 2


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class DatapointReview:
    id: int
    company_id: int
    fact_code: str
    fact_event_id: int | None
    status: DatapointStatus
    proposed_by: int | None
    proposed_at: datetime
    reviewed_by: int | None
    reviewed_at: datetime | None
    frozen_by: int | None
    frozen_at: datetime | None
    timeout_at: datetime | None
    comment: str | None
    reject_reason: str | None
    meta: dict[str, Any] | None


class ReviewError(Exception):
    """Erreur applicative dans le workflow de review (transition invalide, etc.)."""


# ---------------------------------------------------------------------------
# Helpers mapping row → DatapointReview
# ---------------------------------------------------------------------------

def _row_to_review(row: dict) -> DatapointReview:
    return DatapointReview(
        id=row["id"],
        company_id=row["company_id"],
        fact_code=row["fact_code"],
        fact_event_id=row["fact_event_id"],
        status=row["status"],
        proposed_by=row["proposed_by"],
        proposed_at=row["proposed_at"],
        reviewed_by=row["reviewed_by"],
        reviewed_at=row["reviewed_at"],
        frozen_by=row["frozen_by"],
        frozen_at=row["frozen_at"],
        timeout_at=row["timeout_at"],
        comment=row["comment"],
        reject_reason=row["reject_reason"],
        meta=row["meta"],
    )


# ---------------------------------------------------------------------------
# propose — création d'une review en statut PROPOSED
# ---------------------------------------------------------------------------

def propose(
    *,
    company_id: int,
    fact_code: str,
    fact_event_id: int | None = None,
    proposed_by: int | None = None,
    comment: str | None = None,
    meta: dict[str, Any] | None = None,
) -> DatapointReview | None:
    """Crée une nouvelle review en statut PROPOSED avec timeout à now() + 2h."""
    if not db_available():
        return None

    now = datetime.now(tz=timezone.utc)
    timeout = now + timedelta(hours=REVIEW_TIMEOUT_HOURS)

    import json as _json
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO datapoint_reviews
                    (company_id, fact_code, fact_event_id, status, proposed_by,
                     proposed_at, timeout_at, comment, meta)
                VALUES (%s, %s, %s, 'proposed', %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, fact_code, fact_event_id, proposed_by,
                    now, timeout, comment,
                    _json.dumps(meta) if meta is not None else None,
                ),
            )
            row = cur.fetchone()
    return _row_to_review(row) if row else None


# ---------------------------------------------------------------------------
# Transitions de statut
# ---------------------------------------------------------------------------

_VALID_TRANSITIONS: dict[DatapointStatus, set[DatapointStatus]] = {
    "proposed": {"in_review", "validated", "rejected"},
    "in_review": {"validated", "rejected"},
    "validated": {"frozen", "rejected"},
    "rejected": {"proposed"},
    "frozen": set(),  # terminal
}


def _transition(
    *,
    review_id: int,
    company_id: int,
    new_status: DatapointStatus,
    user_id: int | None,
    comment: str | None = None,
    reject_reason: str | None = None,
) -> DatapointReview:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # Lock la review courante
            cur.execute(
                "SELECT * FROM datapoint_reviews WHERE id = %s AND company_id = %s FOR UPDATE",
                (review_id, company_id),
            )
            row = cur.fetchone()
            if not row:
                raise ReviewError(f"Review {review_id} introuvable")

            current: DatapointStatus = row["status"]
            if new_status not in _VALID_TRANSITIONS[current]:
                raise ReviewError(
                    f"Transition interdite : {current} → {new_status}"
                )

            now = datetime.now(tz=timezone.utc)
            updates = {"status": new_status, "updated_at": now}
            if new_status == "validated":
                updates["reviewed_by"] = user_id
                updates["reviewed_at"] = now
            elif new_status == "rejected":
                updates["reviewed_by"] = user_id
                updates["reviewed_at"] = now
                updates["reject_reason"] = reject_reason or comment or "(non précisé)"
            elif new_status == "frozen":
                updates["frozen_by"] = user_id
                updates["frozen_at"] = now
            if comment is not None and new_status != "rejected":
                updates["comment"] = comment

            set_clause = ", ".join(f"{k} = %s" for k in updates)
            params = list(updates.values()) + [review_id, company_id]
            cur.execute(
                f"UPDATE datapoint_reviews SET {set_clause} WHERE id = %s AND company_id = %s RETURNING *",
                params,
            )
            updated = cur.fetchone()
    if not updated:
        raise ReviewError(f"Échec update review {review_id}")
    return _row_to_review(updated)


def approve(
    *,
    review_id: int,
    company_id: int,
    user_id: int,
    comment: str | None = None,
) -> DatapointReview:
    """Approuve une review (→ VALIDATED). Requiert rôle analyst/admin côté endpoint."""
    return _transition(
        review_id=review_id, company_id=company_id, user_id=user_id,
        new_status="validated", comment=comment,
    )


def reject(
    *,
    review_id: int,
    company_id: int,
    user_id: int,
    reject_reason: str,
) -> DatapointReview:
    """Rejette une review (→ REJECTED). Motif obligatoire."""
    if not reject_reason or not reject_reason.strip():
        raise ReviewError("Motif de rejet obligatoire")
    return _transition(
        review_id=review_id, company_id=company_id, user_id=user_id,
        new_status="rejected", reject_reason=reject_reason,
    )


def freeze(
    *,
    review_id: int,
    company_id: int,
    user_id: int,
) -> DatapointReview:
    """Gèle une review validée (→ FROZEN). Terminal : réservé admin."""
    return _transition(
        review_id=review_id, company_id=company_id, user_id=user_id,
        new_status="frozen",
    )


def move_to_review(
    *,
    review_id: int,
    company_id: int,
    user_id: int | None = None,
) -> DatapointReview:
    """Passe PROPOSED → IN_REVIEW (manuel ou auto via cron timeout)."""
    return _transition(
        review_id=review_id, company_id=company_id, user_id=user_id,
        new_status="in_review",
    )


# ---------------------------------------------------------------------------
# Reads : inbox, latest par code, par statut
# ---------------------------------------------------------------------------

def inbox(
    *,
    company_id: int,
    statuses: list[DatapointStatus] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[DatapointReview]:
    """Retourne la liste des reviews pour la Inbox.

    Par défaut filtre sur statuts actifs (proposed, in_review, validated).
    Les rejected et frozen sont exclus sauf demande explicite.
    """
    if not db_available():
        return []
    if statuses is None:
        statuses = ["proposed", "in_review", "validated"]

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM datapoint_reviews
                WHERE company_id = %s AND status = ANY(%s)
                ORDER BY
                  CASE status
                    WHEN 'proposed'  THEN 1
                    WHEN 'in_review' THEN 2
                    WHEN 'validated' THEN 3
                    ELSE 4
                  END,
                  proposed_at DESC
                LIMIT %s OFFSET %s
                """,
                (company_id, statuses, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_review(r) for r in rows]


def latest_by_code(
    *,
    company_id: int,
    fact_code: str,
) -> DatapointReview | None:
    """Dernière review (quelle que soit le statut) pour un fact_code donné."""
    if not db_available():
        return None
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM datapoint_reviews
                WHERE company_id = %s AND fact_code = %s
                ORDER BY created_at DESC LIMIT 1
                """,
                (company_id, fact_code),
            )
            row = cur.fetchone()
    return _row_to_review(row) if row else None


def count_by_status(*, company_id: int) -> dict[str, int]:
    """Comptage par statut pour le badge de l'Inbox."""
    if not db_available():
        return {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, COUNT(*) AS c FROM datapoint_reviews WHERE company_id = %s GROUP BY status",
                (company_id,),
            )
            rows = cur.fetchall()
    return {r["status"]: r["c"] for r in rows}


# ---------------------------------------------------------------------------
# Timeout cron — promotion auto PROPOSED → IN_REVIEW après 2h
# ---------------------------------------------------------------------------

def promote_timed_out_reviews() -> int:
    """Passe toutes les reviews PROPOSED dont timeout_at < now() en IN_REVIEW.

    À appeler par un cron (ex: toutes les 15 minutes).
    Retourne le nombre de reviews promues.
    """
    if not db_available():
        return 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE datapoint_reviews
                   SET status = 'in_review', updated_at = now()
                 WHERE status = 'proposed' AND timeout_at < now()
                RETURNING id
                """
            )
            rows = cur.fetchall()
    promoted = len(rows)
    if promoted:
        logger.info("promote_timed_out_reviews: %d reviews auto-promues", promoted)
    return promoted
