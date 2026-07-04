"""
alerts.py — Règles d'alerte + évaluation sur snapshot + centre de notifications (T5.3).

Règles :
  GET    /alerts/rules              — liste les règles de la company
  POST   /alerts/rules              — créer une règle (analyste)
  PATCH  /alerts/rules/{id}         — modifier (analyste)
  DELETE /alerts/rules/{id}         — supprimer (analyste)
  POST   /alerts/evaluate           — évaluer les règles actives, persister les
                                      notifications déclenchées (analyste)
  GET    /alerts/history            — déclenchements récents (in-memory process)

Notifications in-app (persistées) :
  GET    /alerts/notifications      — centre de notifications (filtre read/archived)
  PATCH  /alerts/notifications/{id} — marquer lue
  DELETE /alerts/notifications/{id} — archiver (soft)

Modes de règle : absolute (seuil), delta_pct (variation % vs N-1), missing
(donnée absente). E-mail OPTIONNEL (canal 'email' + EMAIL_ENABLED via SMTP
stdlib) — aucune dépendance payante.
"""

from __future__ import annotations

import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.database import db_available, get_db
from db.tenant import get_company_id
from routers.auth import get_current_user, require_analyst
from services import alerts_service
from services.auth_service import AuthUser

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_OPERATORS = alerts_service.VALID_OPERATORS
VALID_MODES = alerts_service.VALID_MODES
VALID_CHANNELS = {"inapp", "webhook", "email"}
VALID_DOMAINS = {"carbon", "vsme", "esg", "finance"}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class AlertRuleCreate(BaseModel):
    name: str
    domain: str
    field_path: str
    operator: str = "gt"
    threshold: float | None = None
    mode: str = "absolute"
    channel: str = "inapp"
    destination: str | None = None
    is_active: bool = True


class AlertRulePatch(BaseModel):
    name: str | None = None
    field_path: str | None = None
    operator: str | None = None
    threshold: float | None = None
    mode: str | None = None
    channel: str | None = None
    destination: str | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# In-memory fallback (mode /tmp sans DB)
# ---------------------------------------------------------------------------

_MEM_RULES: list[dict[str, Any]] = []
_MEM_NOTIFS: list[dict[str, Any]] = []
_MEM_NEXT_ID = 1
_MEM_NOTIF_ID = 1
_MEM_HISTORY: deque[dict[str, Any]] = deque(maxlen=100)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mem_rules(company_id: int) -> list[dict]:
    return [r for r in _MEM_RULES if r["company_id"] == company_id]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

_RULE_COLS = ["id", "company_id", "name", "domain", "field_path", "operator",
              "threshold", "mode", "channel", "destination", "is_active",
              "last_fired_at", "created_at"]


def _rule_row(r: dict[str, Any]) -> dict[str, Any]:
    d = {k: r.get(k) for k in _RULE_COLS}
    for k in ("last_fired_at", "created_at"):
        if d.get(k) is not None:
            d[k] = str(d[k])
    if d.get("threshold") is not None:
        d["threshold"] = float(d["threshold"])
    d["is_active"] = bool(d["is_active"])
    return d


def _validate(domain: str | None, operator: str | None, mode: str | None, channel: str | None) -> None:
    if domain is not None and domain not in VALID_DOMAINS:
        raise HTTPException(400, f"domain invalide. Valeurs : {sorted(VALID_DOMAINS)}")
    if operator is not None and operator not in VALID_OPERATORS:
        raise HTTPException(400, f"operator invalide. Valeurs : {sorted(VALID_OPERATORS)}")
    if mode is not None and mode not in VALID_MODES:
        raise HTTPException(400, f"mode invalide. Valeurs : {sorted(VALID_MODES)}")
    if channel is not None and channel not in VALID_CHANNELS:
        raise HTTPException(400, f"channel invalide. Valeurs : {sorted(VALID_CHANNELS)}")


# ---------------------------------------------------------------------------
# Rules CRUD
# ---------------------------------------------------------------------------

@router.get("/rules")
def list_rules(company_id: int = Depends(get_company_id)) -> list[dict]:
    if not db_available():
        return _mem_rules(company_id)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(_RULE_COLS)} FROM alert_rules "
                "WHERE company_id = %s ORDER BY created_at DESC",
                (company_id,),
            )
            return [_rule_row(r) for r in cur.fetchall()]


@router.post("/rules", status_code=201)
def create_rule(body: AlertRuleCreate, company_id: int = Depends(get_company_id),
                _: Any = Depends(require_analyst)) -> dict:
    _validate(body.domain, body.operator, body.mode, body.channel)
    if body.mode != "missing" and body.threshold is None:
        raise HTTPException(400, "threshold obligatoire (sauf mode 'missing').")

    if not db_available():
        global _MEM_NEXT_ID
        rec = {**body.model_dump(), "company_id": company_id, "id": _MEM_NEXT_ID,
               "last_fired_at": None, "created_at": _now()}
        _MEM_RULES.append(rec)
        _MEM_NEXT_ID += 1
        return rec

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO alert_rules
                   (company_id, name, domain, field_path, operator, threshold, mode,
                    channel, destination, is_active)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   RETURNING """ + ", ".join(_RULE_COLS),
                (company_id, body.name, body.domain, body.field_path, body.operator,
                 body.threshold, body.mode, body.channel, body.destination, body.is_active),
            )
            return _rule_row(cur.fetchone())


@router.patch("/rules/{rule_id}")
def patch_rule(rule_id: int, body: AlertRulePatch, company_id: int = Depends(get_company_id),
               _: Any = Depends(require_analyst)) -> dict:
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "Aucun champ à mettre à jour")
    _validate(None, patch.get("operator"), patch.get("mode"), patch.get("channel"))

    if not db_available():
        for i, r in enumerate(_MEM_RULES):
            if r["id"] == rule_id and r["company_id"] == company_id:
                _MEM_RULES[i] = {**r, **patch}
                return _MEM_RULES[i]
        raise HTTPException(404, "Règle introuvable")

    set_clauses = [f"{k} = %s" for k in patch]
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE alert_rules SET {', '.join(set_clauses)} "
                "WHERE id = %s AND company_id = %s RETURNING " + ", ".join(_RULE_COLS),
                (*patch.values(), rule_id, company_id),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Règle introuvable")
    return _rule_row(row)


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, company_id: int = Depends(get_company_id),
                _: Any = Depends(require_analyst)) -> None:
    if not db_available():
        global _MEM_RULES
        before = len(_MEM_RULES)
        _MEM_RULES = [r for r in _MEM_RULES if not (r["id"] == rule_id and r["company_id"] == company_id)]
        if len(_MEM_RULES) == before:
            raise HTTPException(404, "Règle introuvable")
        return
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM alert_rules WHERE id = %s AND company_id = %s RETURNING id",
                        (rule_id, company_id))
            if not cur.fetchone():
                raise HTTPException(404, "Règle introuvable")


# ---------------------------------------------------------------------------
# Evaluate
# ---------------------------------------------------------------------------

@router.post("/evaluate")
def evaluate_rules(company_id: int = Depends(get_company_id),
                   _: Any = Depends(require_analyst)) -> dict:
    """Évalue les règles actives (modes absolute/delta_pct/missing) et persiste
    les notifications déclenchées. La comparaison N-1 lit le snapshot précédent."""
    from services.snapshot_cache import read_snapshot, read_snapshot_versions

    rules = [r for r in list_rules(company_id) if r.get("is_active")]
    domains = {r["domain"] for r in rules}

    current: dict[str, dict] = {}
    previous: dict[str, dict] = {}
    for domain in domains:
        versions = read_snapshot_versions(domain, company_id=company_id, limit=2)
        if versions:
            current[domain] = versions[0]
            if len(versions) > 1:
                previous[domain] = versions[1]
        else:
            snap = None
            try:
                snap = read_snapshot(domain, company_id=company_id)
            except Exception:
                snap = None
            if snap:
                current[domain] = snap

    events = alerts_service.evaluate_rules_pure(rules, current, previous)
    now = _now()
    for ev in events:
        ev["fired_at"] = now
        title, body = alerts_service.format_notification(ev)
        _persist_notification(company_id, ev, title, body)
        _MEM_HISTORY.appendleft(ev)
        _update_last_fired(company_id, ev.get("rule_id"))
        rule = next((r for r in rules if r.get("id") == ev.get("rule_id")), None)
        if rule and rule.get("channel") == "email" and rule.get("destination"):
            alerts_service.send_email(rule["destination"], f"[CarbonCo] {title}", body)

    return {"evaluated": len(rules), "fired": len(events), "alerts": events}


def _update_last_fired(company_id: int, rule_id: int | None) -> None:
    if rule_id is None:
        return
    if not db_available():
        for r in _MEM_RULES:
            if r["id"] == rule_id:
                r["last_fired_at"] = _now()
        return
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE alert_rules SET last_fired_at = now() "
                            "WHERE id = %s AND company_id = %s", (rule_id, company_id))
    except Exception as exc:
        logger.warning("update last_fired_at : %s", exc)


# ---------------------------------------------------------------------------
# Notifications (centre in-app persisté)
# ---------------------------------------------------------------------------

_NOTIF_COLS = ["id", "company_id", "rule_id", "rule_name", "title", "body",
               "fired_at", "read_at", "archived_at"]


def _persist_notification(company_id: int, ev: dict[str, Any], title: str, body: str) -> None:
    if not db_available():
        global _MEM_NOTIF_ID
        _MEM_NOTIFS.append({
            "id": _MEM_NOTIF_ID, "company_id": company_id, "rule_id": ev.get("rule_id"),
            "rule_name": ev.get("rule_name"), "title": title, "body": body,
            "fired_at": ev["fired_at"], "read_at": None, "archived_at": None,
        })
        _MEM_NOTIF_ID += 1
        return
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO alert_notifications (company_id, rule_id, rule_name, title, body) "
                    "VALUES (%s,%s,%s,%s,%s)",
                    (company_id, ev.get("rule_id"), ev.get("rule_name"), title, body),
                )
    except Exception as exc:
        logger.warning("persist notification : %s", exc)


def _notif_row(r: dict[str, Any]) -> dict[str, Any]:
    d = {k: r.get(k) for k in _NOTIF_COLS}
    for k in ("fired_at", "read_at", "archived_at"):
        if d.get(k) is not None:
            d[k] = str(d[k])
    return d


@router.get("/notifications")
def list_notifications(user: AuthUser = Depends(get_current_user),
                       include_archived: bool = False) -> dict:
    company_id = user.company_id
    if not db_available():
        rows = [n for n in _MEM_NOTIFS if n["company_id"] == company_id
                and (include_archived or n["archived_at"] is None)]
        unread = sum(1 for n in rows if n["read_at"] is None)
        return {"unread": unread, "notifications": list(reversed(rows))}
    clause = "" if include_archived else "AND archived_at IS NULL"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(_NOTIF_COLS)} FROM alert_notifications "
                f"WHERE company_id = %s {clause} ORDER BY fired_at DESC LIMIT 200",
                (company_id,),
            )
            rows = [_notif_row(r) for r in cur.fetchall()]
    return {"unread": sum(1 for r in rows if r["read_at"] is None), "notifications": rows}


@router.patch("/notifications/{notif_id}")
def mark_read(notif_id: int, user: AuthUser = Depends(get_current_user)) -> dict:
    company_id = user.company_id
    if not db_available():
        for n in _MEM_NOTIFS:
            if n["id"] == notif_id and n["company_id"] == company_id:
                n["read_at"] = _now()
                return n
        raise HTTPException(404, "Notification introuvable")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE alert_notifications SET read_at = now() "
                "WHERE id = %s AND company_id = %s AND read_at IS NULL "
                "RETURNING " + ", ".join(_NOTIF_COLS),
                (notif_id, company_id),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Notification introuvable ou déjà lue")
    return _notif_row(row)


@router.delete("/notifications/{notif_id}", status_code=204)
def archive_notification(notif_id: int, user: AuthUser = Depends(get_current_user)) -> None:
    company_id = user.company_id
    if not db_available():
        for n in _MEM_NOTIFS:
            if n["id"] == notif_id and n["company_id"] == company_id:
                n["archived_at"] = _now()
                return
        raise HTTPException(404, "Notification introuvable")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE alert_notifications SET archived_at = now() "
                "WHERE id = %s AND company_id = %s RETURNING id",
                (notif_id, company_id),
            )
            if not cur.fetchone():
                raise HTTPException(404, "Notification introuvable")


@router.get("/history")
def alert_history(company_id: int = Depends(get_company_id), limit: int = 20) -> dict:
    events = list(_MEM_HISTORY)[:limit]
    return {"total": len(_MEM_HISTORY), "limit": limit, "alerts": events}
