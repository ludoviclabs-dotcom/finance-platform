"""
chain_monitor.py — T2.5 : vérification planifiée de la chaîne d'intégrité.

run_verification() exécute verify_chain() pour une company et horodate le
résultat dans chain_verifications ; si la chaîne est rompue, un audit_event
d'erreur est journalisé (surface in-app). latest_verification() alimente le
badge de confiance du dashboard. run_all() est appelé par le job quotidien.
"""

from __future__ import annotations

import logging
from typing import Any

from db.database import db_available, get_db
from services import audit_service, facts_service

logger = logging.getLogger(__name__)


def run_verification(company_id: int) -> dict[str, Any]:
    """Vérifie la chaîne et persiste le résultat. Journalise une erreur si rompue."""
    chain = facts_service.verify_chain(company_id)
    result: dict[str, Any] = {
        "ok": chain.ok,
        "broken_at": chain.broken_at,
        "checked": chain.checked,
        "verified_at": None,
    }
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO chain_verifications (company_id, ok, broken_at, checked)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id, verified_at
                        """,
                        (company_id, chain.ok, chain.broken_at, chain.checked),
                    )
                    row = cur.fetchone()
            result["id"] = row["id"]
            result["verified_at"] = row["verified_at"]
        except Exception as exc:  # pragma: no cover
            logger.warning("Persist chain_verifications échoué: %s", exc)

    if not chain.ok:
        audit_service.log_event(
            "error",
            "Chaîne d'intégrité rompue",
            detail=f"Premier event altéré : #{chain.broken_at}",
            status="error",
            company_id=company_id,
        )
    return result


def latest_verification(company_id: int) -> dict[str, Any] | None:
    """Dernière vérification planifiée stockée (pour le badge). None si aucune."""
    if not db_available():
        return None
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, ok, broken_at, checked, verified_at
                FROM chain_verifications
                WHERE company_id = %s
                ORDER BY verified_at DESC
                LIMIT 1
                """,
                (company_id,),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def run_all() -> int:
    """Vérifie toutes les organisations (job quotidien). Retourne le nombre traité."""
    if not db_available():
        logger.info("run_all: DB indisponible — aucune vérification.")
        return 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM companies ORDER BY id")
            company_ids = [r["id"] for r in cur.fetchall()]

    done = 0
    for cid in company_ids:
        try:
            run_verification(cid)
            done += 1
        except Exception as exc:  # pragma: no cover
            logger.warning("Vérification chaîne échouée pour company %s: %s", cid, exc)
    return done
