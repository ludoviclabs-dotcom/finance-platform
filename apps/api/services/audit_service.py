"""
audit_service.py — Journal d'audit des opérations CarbonCo.

Stocke les événements dans /tmp/carbonco_audit.json (même stratégie que snapshot_cache).
Les événements sont conservés en mémoire inverse (plus récents en tête) et limités
à MAX_EVENTS pour éviter une croissance illimitée.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

MAX_EVENTS = 500

AuditEventType = Literal[
    "ingest",       # recalcul des snapshots
    "upload",       # upload d'un workbook Excel
    "cache_clear",  # invalidation du cache
    "login",        # connexion utilisateur
    "export",       # export PDF / rapport
    "validation",   # validation QC
    "error",        # erreur système
]


def _audit_path() -> Path:
    cache_dir = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "audit.json"


def _load_events() -> list[dict[str, Any]]:
    path = _audit_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_events(events: list[dict[str, Any]]) -> None:
    path = _audit_path()
    path.write_text(
        json.dumps(events, ensure_ascii=False, default=str),
        encoding="utf-8",
    )


def log_event(
    event_type: AuditEventType,
    title: str,
    detail: str | None = None,
    status: Literal["ok", "warning", "error"] = "ok",
    meta: dict[str, Any] | None = None,
    user: str | None = None,
) -> dict[str, Any]:
    """Append a new audit event and return it."""
    event: dict[str, Any] = {
        "id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
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

    events = _load_events()
    events.insert(0, event)          # plus récent en tête
    events = events[:MAX_EVENTS]     # limiter la taille
    _save_events(events)
    return event


def get_events(
    limit: int = 50,
    event_type: str | None = None,
) -> list[dict[str, Any]]:
    """Return audit events, optionally filtered by type."""
    events = _load_events()
    if event_type:
        events = [e for e in events if e.get("type") == event_type]
    return events[:limit]


def clear_events() -> int:
    """Wipe the audit log and return the number of deleted events."""
    events = _load_events()
    count = len(events)
    _save_events([])
    return count
