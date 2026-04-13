from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from services.audit_service import clear_events, get_events, log_event

router = APIRouter()


class AuditEvent(BaseModel):
    id: str
    timestamp: str
    type: str
    title: str
    status: str
    detail: str | None = None
    user: str | None = None
    meta: dict[str, Any] | None = None


class AuditListResponse(BaseModel):
    total: int
    events: list[AuditEvent]


class LogEventRequest(BaseModel):
    type: Literal["ingest", "upload", "cache_clear", "login", "export", "validation", "error"]
    title: str
    detail: str | None = None
    status: Literal["ok", "warning", "error"] = "ok"
    meta: dict[str, Any] | None = None
    user: str | None = None


# ---------------------------------------------------------------------------
# GET /audit/events
# ---------------------------------------------------------------------------

@router.get("/events", response_model=AuditListResponse)
async def list_events(
    limit: int = Query(default=50, ge=1, le=200),
    type: str | None = Query(default=None),
) -> AuditListResponse:
    """Return audit log events, newest first."""
    events = get_events(limit=limit, event_type=type)
    return AuditListResponse(total=len(events), events=events)


# ---------------------------------------------------------------------------
# POST /audit/event — log an event from the frontend
# ---------------------------------------------------------------------------

@router.post("/event", response_model=AuditEvent, status_code=201)
async def create_event(body: LogEventRequest) -> AuditEvent:
    """Log a new audit event."""
    event = log_event(
        event_type=body.type,
        title=body.title,
        detail=body.detail,
        status=body.status,
        meta=body.meta,
        user=body.user,
    )
    return AuditEvent(**event)


# ---------------------------------------------------------------------------
# DELETE /audit/events — clear the audit log
# ---------------------------------------------------------------------------

@router.delete("/events", status_code=200)
async def delete_events() -> dict[str, int]:
    """Wipe all audit events. Returns number of deleted entries."""
    count = clear_events()
    return {"deleted": count}
