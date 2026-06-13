"""
vsme_wizard_service.py — T3.4 : parcours « VSME en 10 étapes ».

Persiste une session par organisation (étape + état JSONB + progression),
reprise possible. Les facts ne sont émis qu'au `complete` (bulk) pour éviter
100+ events par parcours : chaque valeur quantitative de l'état dont la clé est
un datapoint VSME à fact_code est émise avec source_path='wizard'.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from db.database import db_available, get_db
from services import facts_service, vsme_catalog

logger = logging.getLogger(__name__)

WIZARD_STEPS = [
    {"key": "periodisation", "label": "Période de reporting"},
    {"key": "import", "label": "Import / énergie"},
    {"key": "materialite", "label": "Matérialité allégée"},
    {"key": "profil", "label": "Profil (B1)"},
    {"key": "environnement", "label": "Environnement (B3-B7)"},
    {"key": "social", "label": "Social (B8-B10)"},
    {"key": "gouvernance", "label": "Gouvernance (B11)"},
    {"key": "anomalies", "label": "Revue des anomalies"},
    {"key": "revue", "label": "Revue finale"},
    {"key": "rapport", "label": "Génération du rapport"},
]
TOTAL_STEPS = len(WIZARD_STEPS)


class WizardError(Exception):
    """Erreur métier du wizard."""


def compute_progress(step: int) -> int:
    """% de progression (pur). step borné à [0, TOTAL_STEPS]."""
    return round(100 * max(0, min(step, TOTAL_STEPS)) / TOTAL_STEPS)


def merge_state(existing: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Fusion superficielle de l'état (pur)."""
    return {**(existing or {}), **(patch or {})}


def _emit_state_facts(company_id: int, state: dict[str, Any]) -> int:
    """Émet un fact par valeur quantitative de l'état mappée à un datapoint VSME."""
    emitted = 0
    for code, value in (state or {}).items():
        dp = vsme_catalog.get_datapoint(code)
        if not dp or not dp.get("fact_code") or dp["type"] != "quantitatif":
            continue
        try:
            fv = float(value)
        except (TypeError, ValueError):
            continue
        ev = facts_service.emit_fact(
            company_id=company_id, code=dp["fact_code"], value=fv,
            unit=dp.get("unit") or "", ef_id=None, source_path="wizard",
            meta={"vsme_code": code},
        )
        if ev is not None:
            emitted += 1
    return emitted


def _row_to_session(row: dict[str, Any]) -> dict[str, Any]:
    state = row["state"]
    if isinstance(state, str):
        state = json.loads(state or "{}")
    return {
        "step": row["step"],
        "state": state,
        "progress_pct": row["progress_pct"],
        "completed": row["completed_at"] is not None,
        "total_steps": TOTAL_STEPS,
        "steps": WIZARD_STEPS,
    }


def get_session(company_id: int) -> dict[str, Any] | None:
    if not db_available():
        return None
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT step, state, progress_pct, completed_at FROM vsme_wizard_sessions WHERE company_id = %s",
                (company_id,),
            )
            row = cur.fetchone()
    return _row_to_session(row) if row else None


def start_session(company_id: int, initial_state: dict[str, Any] | None = None) -> dict[str, Any]:
    if not db_available():
        raise WizardError("Base de données indisponible.")
    state = json.dumps(initial_state or {})
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO vsme_wizard_sessions (company_id, step, state, progress_pct, completed_at, updated_at)
                VALUES (%s, 1, %s, %s, NULL, now())
                ON CONFLICT (company_id) DO UPDATE SET
                    step = 1, state = EXCLUDED.state, progress_pct = EXCLUDED.progress_pct,
                    completed_at = NULL, updated_at = now()
                RETURNING step, state, progress_pct, completed_at
                """,
                (company_id, state, compute_progress(1)),
            )
            row = cur.fetchone()
    return _row_to_session(row)


def save_step(company_id: int, step: int, state_patch: dict[str, Any] | None = None) -> dict[str, Any]:
    if not 1 <= step <= TOTAL_STEPS:
        raise WizardError(f"Étape invalide : {step} (1-{TOTAL_STEPS}).")
    if not db_available():
        raise WizardError("Base de données indisponible.")
    current = get_session(company_id)
    if current is None:
        current = start_session(company_id)
    new_state = merge_state(current["state"], state_patch or {})
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE vsme_wizard_sessions
                SET step = %s, state = %s, progress_pct = %s, updated_at = now()
                WHERE company_id = %s
                RETURNING step, state, progress_pct, completed_at
                """,
                (step, json.dumps(new_state), compute_progress(step), company_id),
            )
            row = cur.fetchone()
    return _row_to_session(row)


def complete(company_id: int) -> dict[str, Any]:
    if not db_available():
        raise WizardError("Base de données indisponible.")
    session = get_session(company_id)
    if session is None:
        raise WizardError("Aucune session wizard à finaliser.")
    emitted = _emit_state_facts(company_id, session["state"])
    if emitted > 0:
        try:
            facts_service.refresh_facts_current()
        except Exception as exc:  # pragma: no cover
            logger.warning("refresh_facts_current (wizard) échoué: %s", exc)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE vsme_wizard_sessions SET step = %s, progress_pct = 100, completed_at = now(), "
                "updated_at = now() WHERE company_id = %s",
                (TOTAL_STEPS, company_id),
            )
    return {"completed": True, "emitted_facts": emitted, "redirect": "/vsme/completude"}
