"""
audit_service.py — Journal d'audit des opérations CarbonCo.

Stratégie double :
  - Si PostgreSQL disponible → table audit_events (persistant, filtrable, multi-tenant)
  - Sinon → fallback /tmp JSON (comportement Phase 1 inchangé, max 500 events)
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

MAX_EVENTS = 500
DEFAULT_COMPANY_ID = 1

AuditEventType = Literal[
    "ingest",
    "upload",
    "cache_clear",
    "login",
    "export",
    "validation",
    "error",
]


# ---------------------------------------------------------------------------
# /tmp fallback helpers
# ---------------------------------------------------------------------------

def _audit_path() -> Path:
    cache_dir = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "audit.json"


def _load_file_events() -> list[dict[str, Any]]:
    path = _audit_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_file_events(events: list[dict[str, Any]]) -> None:
    path = _audit_path()
    path.write_text(
        json.dumps(events, ensure_ascii=False, default=str),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_event(
    event_type: AuditEventType,
    title: str,
    detail: str | None = None,
    status: Literal["ok", "warning", "error"] = "ok",
    meta: dict[str, Any] | None = None,
    user: str | None = None,
    company_id: int = DEFAULT_COMPANY_ID,
) -> dict[str, Any]:
    """Append a new audit event and return it."""
    now = datetime.now(timezone.utc)

    if db_available():
        return _log_pg(event_type, title, detail, status, meta, user, company_id, now)
    return _log_file(event_type, title, detail, status, meta, user, now)


def _log_pg(
    event_type: str,
    title: str,
    detail: str | None,
    status: str,
    meta: dict[str, Any] | None,
    user: str | None,
    company_id: int,
    now: datetime,
) -> dict[str, Any]:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_events
                        (company_id, user_email, event_type, title, detail, status, meta, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                    """,
                    (
                        company_id,
                        user,
                        event_type,
                        title,
                        detail,
                        status,
                        json.dumps(meta, default=str) if meta else None,
                        now,
                    ),
                )
                row = cur.fetchone()
        event_id = str(row["id"]) if row else now.strftime("%Y%m%d%H%M%S%f")
        return {
            "id": event_id,
            "timestamp": now.isoformat(),
            "type": event_type,
            "title": title,
            "status": status,
            "detail": detail,
            "meta": meta,
            "user": user,
        }
    except Exception as exc:
        logger.warning("Écriture audit PostgreSQL échouée, fallback /tmp : %s", exc)
        return _log_file(event_type, title, detail, status, meta, user, now)


def _log_file(
    event_type: str,
    title: str,
    detail: str | None,
    status: str,
    meta: dict[str, Any] | None,
    user: str | None,
    now: datetime,
) -> dict[str, Any]:
    event: dict[str, Any] = {
        "id": now.strftime("%Y%m%d%H%M%S%f"),
        "timestamp": now.isoformat(),
        "type": event_type,
        "title": title,
        "status": status,
    }
    if detail:
        event["detail"] = detail
    if meta:
        event["meta"] = meta
    if user:
        event["user"] = user

    events = _load_file_events()
    events.insert(0, event)
    events = events[:MAX_EVENTS]
    _save_file_events(events)
    return event


def get_events(
    limit: int = 50,
    event_type: str | None = None,
    company_id: int = DEFAULT_COMPANY_ID,
) -> list[dict[str, Any]]:
    """Return audit events, optionally filtered by type."""
    if db_available():
        return _get_events_pg(limit, event_type, company_id)
    return _get_events_file(limit, event_type)


def _get_events_pg(
    limit: int,
    event_type: str | None,
    company_id: int,
) -> list[dict[str, Any]]:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                if event_type:
                    cur.execute(
                        """
                        SELECT id, created_at, event_type, title, detail, status, meta, user_email
                        FROM audit_events
                        WHERE company_id = %s AND event_type = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (company_id, event_type, limit),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, created_at, event_type, title, detail, status, meta, user_email
                        FROM audit_events
                        WHERE company_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (company_id, limit),
                    )
                rows = cur.fetchall()

        result = []
        for row in rows:
            meta = row["meta"]
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = None
            result.append({
                "id": str(row["id"]),
                "timestamp": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                "type": row["event_type"],
                "title": row["title"],
                "detail": row["detail"],
                "status": row["status"],
                "meta": meta,
                "user": row["user_email"],
            })
        return result
    except Exception as exc:
        logger.warning("Lecture audit PostgreSQL échouée, fallback /tmp : %s", exc)
        return _get_events_file(limit, event_type)


def _get_events_file(limit: int, event_type: str | None) -> list[dict[str, Any]]:
    events = _load_file_events()
    if event_type:
        events = [e for e in events if e.get("type") == event_type]
    return events[:limit]


def clear_events(company_id: int = DEFAULT_COMPANY_ID) -> int:
    """Wipe the audit log and return the number of deleted events."""
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT COUNT(*) FROM audit_events WHERE company_id = %s",
                        (company_id,),
                    )
                    row = cur.fetchone()
                    count = row[0] if row else 0
                    cur.execute(
                        "DELETE FROM audit_events WHERE company_id = %s",
                        (company_id,),
                    )
            return count
        except Exception as exc:
            logger.warning("Erreur clear_events PostgreSQL : %s", exc)

    # Fallback fichier
    events = _load_file_events()
    count = len(events)
    _save_file_events([])
    return count
