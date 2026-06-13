"""
alerts_service.py — T5.3 : cœur d'évaluation des règles d'alerte (PUR).

Trois modes de règle :
  - absolute  : compare la valeur courante au seuil (gt|lt|gte|lte|eq).
  - delta_pct : compare la variation % vs N-1 (snapshot précédent) au seuil.
  - missing   : se déclenche si la donnée est absente du snapshot courant.

Tout est PUR (sans DB) → testable directement. L'e-mail est OPTIONNEL derrière
EMAIL_ENABLED via SMTP stdlib (aucune dépendance payante : pas de SDK e-mail).
"""

from __future__ import annotations

import logging
import operator as _op
import os
from typing import Any

logger = logging.getLogger(__name__)

VALID_OPERATORS = {"gt", "lt", "gte", "lte", "eq"}
VALID_MODES = {"absolute", "delta_pct", "missing"}

_OPS = {"gt": _op.gt, "lt": _op.lt, "gte": _op.ge, "lte": _op.le, "eq": _op.eq}


def extract_value(snapshot: dict[str, Any] | None, field_path: str) -> float | None:
    """Navigue un chemin pointé 'a.b.c' dans le snapshot. Retourne float ou None."""
    if not snapshot:
        return None
    node: Any = snapshot
    for part in field_path.split("."):
        if not isinstance(node, dict):
            return None
        node = node.get(part)
        if node is None:
            return None
    try:
        return float(node)
    except (TypeError, ValueError):
        return None


def compute_rule_condition(current: float | None, threshold: float | None, operator: str,
                           previous: float | None = None, mode: str = "absolute") -> bool:
    """Évalue UNE règle. Fonction PURE, déterministe."""
    if mode == "missing":
        return current is None
    if current is None:
        return False
    op_fn = _OPS.get(operator)
    if op_fn is None or threshold is None:
        return False
    if mode == "delta_pct":
        if previous is None or previous == 0:
            return False
        delta = (current - previous) / abs(previous) * 100.0
        return bool(op_fn(delta, threshold))
    # absolute
    return bool(op_fn(current, threshold))


def evaluate_rules_pure(rules: list[dict[str, Any]], snapshots_current: dict[str, dict],
                        snapshots_previous: dict[str, dict] | None = None) -> list[dict[str, Any]]:
    """Évalue toutes les règles actives. Fonction PURE.

    `snapshots_current` / `snapshots_previous` = {domain: snapshot}. Retourne la
    liste des déclenchements (sans horodatage — ajouté par l'appelant).
    """
    prev = snapshots_previous or {}
    fired: list[dict[str, Any]] = []
    for rule in rules:
        if not rule.get("is_active", True):
            continue
        domain = rule.get("domain")
        mode = rule.get("mode", "absolute")
        cur = extract_value(snapshots_current.get(domain), rule["field_path"])
        pre = extract_value(prev.get(domain), rule["field_path"])
        if compute_rule_condition(cur, rule.get("threshold"), rule.get("operator", ""), pre, mode):
            fired.append({
                "rule_id": rule.get("id"),
                "rule_name": rule.get("name"),
                "domain": domain,
                "field_path": rule["field_path"],
                "mode": mode,
                "current_value": cur,
                "previous_value": pre,
                "threshold": rule.get("threshold"),
                "operator": rule.get("operator"),
            })
    return fired


def format_notification(event: dict[str, Any]) -> tuple[str, str]:
    """Construit (titre, corps) d'une notification à partir d'un déclenchement."""
    name = event.get("rule_name") or "Alerte"
    mode = event.get("mode", "absolute")
    cur = event.get("current_value")
    if mode == "missing":
        body = f"Donnée manquante : {event.get('field_path')} (domaine {event.get('domain')})."
    elif mode == "delta_pct":
        pre = event.get("previous_value")
        delta = None
        if pre not in (None, 0) and cur is not None:
            delta = round((cur - pre) / abs(pre) * 100.0, 1)
        body = (f"{event.get('field_path')} = {cur} (vs {pre} précédent, "
                f"variation {delta}%) — seuil {event.get('operator')} {event.get('threshold')}%.")
    else:
        body = (f"{event.get('field_path')} = {cur} "
                f"{event.get('operator')} seuil {event.get('threshold')}.")
    return name, body


def email_enabled() -> bool:
    return os.environ.get("EMAIL_ENABLED", "").lower() in ("1", "true", "yes")


def send_email(to_addr: str, subject: str, body: str) -> bool:
    """Envoi e-mail OPTIONNEL via SMTP stdlib. No-op si EMAIL_ENABLED absent.

    Aucune dépendance externe : utilise smtplib (bibliothèque standard). La
    configuration (SMTP_HOST/PORT/USER/PASSWORD/FROM) vient de l'environnement.
    """
    if not email_enabled():
        return False
    host = os.environ.get("SMTP_HOST")
    if not host:
        logger.warning("EMAIL_ENABLED mais SMTP_HOST absent — e-mail ignoré.")
        return False
    try:
        import smtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = os.environ.get("SMTP_FROM", "carbonco@localhost")
        msg["To"] = to_addr
        msg.set_content(body)
        port = int(os.environ.get("SMTP_PORT", "587"))
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            if os.environ.get("SMTP_STARTTLS", "1") == "1":
                smtp.starttls()
            user, pwd = os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASSWORD")
            if user and pwd:
                smtp.login(user, pwd)
            smtp.send_message(msg)
        return True
    except Exception as exc:  # pragma: no cover - dépend de l'infra SMTP
        logger.warning("Envoi e-mail échoué : %s", exc)
        return False
