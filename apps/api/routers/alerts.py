"""
alerts.py — Gestion des règles d'alerte et évaluation sur snapshot.

Endpoints :
  GET  /alerts/rules              — liste les règles de la company
  POST /alerts/rules              — créer une règle
  PATCH /alerts/rules/{id}        — modifier une règle
  DELETE /alerts/rules/{id}       — supprimer une règle
  POST /alerts/evaluate           — évaluer toutes les règles actives sur le snapshot courant
  GET  /alerts/history            — dernières alertes déclenchées (in-memory, 100 max)

Structure d'une AlertRule :
  - domain       : carbon | vsme | esg | finance
  - field_path   : chemin pointé dans le snapshot (ex. "carbon.totalS123Tco2e")
  - operator     : gt | lt | gte | lte | eq
  - threshold    : valeur numérique de comparaison
  - channel      : webhook | email (stocké mais non envoyé en phase 7 — préparation)
  - destination  : URL webhook ou email
  - is_active    : active/inactive
"""

from __future__ import annotations

import logging
import operator as _op
from collections import deque
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.database import db_available, get_db
from db.tenant import get_company_id
from routers.auth import require_analyst

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

VALID_OPERATORS = {"gt", "lt", "gte", "lte", "eq"}
VALID_CHANNELS = {"webhook", "email"}
VALID_DOMAINS = {"carbon", "vsme", "esg", "finance"}

_OPS: dict[str, Any] = {
    "gt": _op.gt,
    "lt": _op.lt,
    "gte": _op.ge,
    "lte": _op.le,
    "eq": _op.eq,
}


class AlertRuleCreate(BaseModel):
    name: str
    domain: str
    field_path: str
    operator: str
    threshold: float
    channel: str = "webhook"
    destination: str
    is_active: bool = True


class AlertRulePatch(BaseModel):
    name: str | None = None
    field_path: str | None = None
    operator: str | None = None
    threshold: float | None = None
    channel: str | None = None
    destination: str | None = None
    is_active: bool | None = None


class AlertRuleOut(BaseModel):
    id: int
    company_id: int
    name: str
    domain: str
    field_path: str
    operator: str
    threshold: float
    channel: str
    destination: str
    is_active: bool
    last_fired_at: str | None
    created_at: str


class AlertFired(BaseModel):
    rule_id: int
    rule_name: str
    domain: str
    field_path: str
    current_value: float
    threshold: float
    operator: str
    fired_at: str


# ---------------------------------------------------------------------------
# In-memory fallback
# ---------------------------------------------------------------------------

_MEM_RULES: list[dict[str, Any]] = []
_MEM_NEXT_ID = 1
_MEM_HISTORY: deque[dict[str, Any]] = deque(maxlen=100)


def _now_str() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _mem_list_rules(company_id: int) -> list[dict]:
    return [r for r in _MEM_RULES if r["company_id"] == company_id]


def _mem_get_rule(rid: int, company_id: int) -> dict | None:
    return next((r for r in _MEM_RULES if r["id"] == rid and r["company_id"] == company_id), None)


def _mem_create_rule(data: dict) -> dict:
    global _MEM_NEXT_ID
    rec = {**data, "id": _MEM_NEXT_ID, "last_fired_at": None, "created_at": _now_str()}
    _MEM_RULES.append(rec)
    _MEM_NEXT_ID += 1
    return rec


def _mem_patch_rule(rid: int, patch: dict) -> dict | None:
    for i, r in enumerate(_MEM_RULES):
        if r["id"] == rid:
            _MEM_RULES[i] = {**r, **patch}
            return _MEM_RULES[i]
    return None


def _mem_delete_rule(rid: int, company_id: int) -> bool:
    global _MEM_RULES
    before = len(_MEM_RULES)
    _MEM_RULES = [r for r in _MEM_RULES if not (r["id"] == rid and r["company_id"] == company_id)]
    return len(_MEM_RULES) < before


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

_RULE_COLS = ["id", "company_id", "name", "domain", "field_path", "operator",
              "threshold", "channel", "destination", "is_active",
              "last_fired_at", "created_at"]
_RULE_SELECT = f"SELECT {', '.join(_RULE_COLS)} FROM alert_rules"


def _rule_row(row: tuple) -> dict:
    d = dict(zip(_RULE_COLS, row))
    for k in ("last_fired_at", "created_at"):
        if d[k] is not None:
            d[k] = str(d[k])
    if d["threshold"] is not None:
        d["threshold"] = float(d["threshold"])
    d["is_active"] = bool(d["is_active"])
    return d


# ---------------------------------------------------------------------------
# Value extractor — navigate field_path in snapshot dict
# ---------------------------------------------------------------------------

def _extract_value(snapshot: dict, field_path: str) -> float | None:
    """Navigate 'domain.field.subfield' path in snapshot. Returns float or None."""
    parts = field_path.split(".")
    node: Any = snapshot
    for part in parts:
        if not isinstance(node, dict):
            return None
        node = node.get(part)
        if node is None:
            return None
    try:
        return float(node)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# GET /alerts/rules
# ---------------------------------------------------------------------------


@router.get("/rules")
def list_rules(company_id: int = Depends(get_company_id)) -> list[dict]:
    if not db_available():
        return _mem_list_rules(company_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"{_RULE_SELECT} WHERE company_id = %s ORDER BY created_at DESC", (company_id,))
            return [_rule_row(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# POST /alerts/rules
# ---------------------------------------------------------------------------


@router.post("/rules", status_code=201)
def create_rule(
    body: AlertRuleCreate,
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> dict:
    if body.operator not in VALID_OPERATORS:
        raise HTTPException(400, f"operator invalide. Valeurs : {sorted(VALID_OPERATORS)}")
    if body.domain not in VALID_DOMAINS:
        raise HTTPException(400, f"domain invalide. Valeurs : {sorted(VALID_DOMAINS)}")
    if body.channel not in VALID_CHANNELS:
        raise HTTPException(400, f"channel invalide. Valeurs : {sorted(VALID_CHANNELS)}")

    data = {
        "company_id": company_id,
        "name": body.name,
        "domain": body.domain,
        "field_path": body.field_path,
        "operator": body.operator,
        "threshold": body.threshold,
        "channel": body.channel,
        "destination": body.destination,
        "is_active": body.is_active,
    }

    if not db_available():
        return _mem_create_rule(data)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO alert_rules
                   (company_id, name, domain, field_path, operator, threshold,
                    channel, destination, is_active)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   RETURNING """ + ", ".join(_RULE_COLS),
                (
                    company_id, body.name, body.domain, body.field_path,
                    body.operator, body.threshold, body.channel,
                    body.destination, body.is_active,
                ),
            )
            return _rule_row(cur.fetchone())


# ---------------------------------------------------------------------------
# PATCH /alerts/rules/{rule_id}
# ---------------------------------------------------------------------------


@router.patch("/rules/{rule_id}")
def patch_rule(
    rule_id: int,
    body: AlertRulePatch,
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> dict:
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "Aucun champ à mettre à jour")
    if "operator" in patch and patch["operator"] not in VALID_OPERATORS:
        raise HTTPException(400, f"operator invalide. Valeurs : {sorted(VALID_OPERATORS)}")
    if "channel" in patch and patch["channel"] not in VALID_CHANNELS:
        raise HTTPException(400, f"channel invalide. Valeurs : {sorted(VALID_CHANNELS)}")

    if not db_available():
        r = _mem_patch_rule(rule_id, patch)
        if not r:
            raise HTTPException(404, "Règle introuvable")
        return r

    set_clauses = [f"{k} = %s" for k in patch]
    values = list(patch.values()) + [rule_id, company_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE alert_rules SET {', '.join(set_clauses)} "
                f"WHERE id = %s AND company_id = %s "
                f"RETURNING {', '.join(_RULE_COLS)}",
                values,
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Règle introuvable")
    return _rule_row(row)


# ---------------------------------------------------------------------------
# DELETE /alerts/rules/{rule_id}
# ---------------------------------------------------------------------------


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> None:
    if not db_available():
        if not _mem_delete_rule(rule_id, company_id):
            raise HTTPException(404, "Règle introuvable")
        return
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM alert_rules WHERE id = %s AND company_id = %s RETURNING id",
                (rule_id, company_id),
            )
            if not cur.fetchone():
                raise HTTPException(404, "Règle introuvable")


# ---------------------------------------------------------------------------
# POST /alerts/evaluate — évaluation des règles actives sur snapshot courant
# ---------------------------------------------------------------------------


@router.post("/evaluate")
def evaluate_rules(
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> dict:
    """
    Évalue toutes les règles actives de la company contre les snapshots en cache.
    Retourne la liste des alertes déclenchées.
    """
    from datetime import datetime, timezone

    from services.snapshot_cache import read_snapshot

    # Charger les snapshots disponibles
    snapshots: dict[str, dict] = {}
    for domain in VALID_DOMAINS:
        try:
            snap = read_snapshot(domain, company_id=company_id)
            if snap:
                snapshots[domain] = snap
        except Exception:
            pass

    # Charger les règles actives
    if db_available():
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"{_RULE_SELECT} WHERE company_id = %s AND is_active = TRUE",
                    (company_id,),
                )
                rules = [_rule_row(r) for r in cur.fetchall()]
    else:
        rules = [r for r in _mem_list_rules(company_id) if r.get("is_active")]

    fired: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    for rule in rules:
        domain = rule["domain"]
        snap = snapshots.get(domain)
        if not snap:
            continue

        current = _extract_value(snap, rule["field_path"])
        if current is None:
            continue

        op_fn = _OPS.get(rule["operator"])
        if op_fn is None:
            continue

        if op_fn(current, rule["threshold"]):
            event = {
                "rule_id": rule["id"],
                "rule_name": rule["name"],
                "domain": domain,
                "field_path": rule["field_path"],
                "current_value": current,
                "threshold": rule["threshold"],
                "operator": rule["operator"],
                "fired_at": now,
            }
            fired.append(event)
            _MEM_HISTORY.appendleft(event)

            # Mettre à jour last_fired_at
            if db_available():
                try:
                    with get_db() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE alert_rules SET last_fired_at = now() WHERE id = %s",
                                (rule["id"],),
                            )
                except Exception as exc:
                    logger.warning("Erreur update last_fired_at : %s", exc)
            else:
                _mem_patch_rule(rule["id"], {"last_fired_at": now})

    logger.info("Évaluation alertes company %s : %d règles, %d déclenchées", company_id, len(rules), len(fired))
    return {"evaluated": len(rules), "fired": len(fired), "alerts": fired}


# ---------------------------------------------------------------------------
# GET /alerts/history — historique des alertes déclenchées (in-memory)
# ---------------------------------------------------------------------------


@router.get("/history")
def alert_history(
    company_id: int = Depends(get_company_id),
    limit: int = 20,
) -> dict:
    """Retourne les dernières alertes déclenchées depuis le démarrage du processus."""
    events = list(_MEM_HISTORY)[:limit]
    return {"total": len(_MEM_HISTORY), "limit": limit, "alerts": events}
