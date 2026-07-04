"""
auditor_service.py — T2.2 : rôle « Auditeur invité » (lecture seule, par lien).

Un admin crée une invitation → token 64 hex scopé à sa company, expirant à 30 j,
révocable. Les endpoints publics /auditor/public/{token} n'ont pas de JWT : la
résolution et la journalisation d'accès passent par des fonctions SECURITY
DEFINER (migration 012) qui bypassent RLS de façon bornée. L'auditeur n'a AUCUN
droit d'écriture : le token n'est pas un JWT, il n'ouvre que des GET en lecture.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from db.database import db_available, get_db
from services import audit_service, facts_service

logger = logging.getLogger(__name__)

DEFAULT_EXPIRES_DAYS = 30


class AuditorError(Exception):
    """Erreur métier (DB indisponible, invitation introuvable…)."""


def create_invite(
    *,
    company_id: int,
    email: str | None = None,
    label: str | None = None,
    created_by: str | None = None,
    expires_days: int = DEFAULT_EXPIRES_DAYS,
) -> dict[str, Any]:
    """Crée une invitation auditeur et retourne le token (à transmettre une seule fois)."""
    if not db_available():
        raise AuditorError("Base de données indisponible — création d'invitation impossible.")

    token = secrets.token_hex(32)  # 64 hex
    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=expires_days)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auditor_invites (company_id, token, email, label, created_by, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (company_id, token, email, label, created_by, expires_at),
            )
            row = cur.fetchone()

    audit_service.log_event(
        "auditor_invite", "Invitation auditeur créée",
        detail=email or label, company_id=company_id, user=created_by,
    )
    return {
        "id": row["id"],
        "token": token,
        "email": email,
        "label": label,
        "expires_at": expires_at,
        "created_at": row["created_at"],
    }


def list_invites(company_id: int) -> list[dict[str, Any]]:
    if not db_available():
        return []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, token, email, label, created_by, created_at, expires_at,
                       revoked_at, last_accessed_at, access_count
                FROM auditor_invites
                WHERE company_id = %s
                ORDER BY created_at DESC
                """,
                (company_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def revoke_invite(*, company_id: int, token: str) -> bool:
    if not db_available():
        return False
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE auditor_invites SET revoked_at = now() "
                "WHERE company_id = %s AND token = %s AND revoked_at IS NULL RETURNING id",
                (company_id, token),
            )
            ok = cur.fetchone() is not None
    if ok:
        audit_service.log_event(
            "auditor_invite", "Invitation auditeur révoquée", company_id=company_id,
        )
    return ok


def resolve_invite(token: str) -> dict[str, Any] | None:
    """Résout un token sans contexte tenant (SECURITY DEFINER). None si inconnu."""
    if not db_available():
        return None
    with get_db() as conn:  # pas de company_id — la fonction SECURITY DEFINER bypasse RLS
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM resolve_auditor_token(%s)", (token,))
            row = cur.fetchone()
    return dict(row) if row else None


def invite_status(invite: dict[str, Any]) -> str:
    """active | revoked | expired — fonction pure (testable sans DB)."""
    if invite.get("revoked_at"):
        return "revoked"
    expires_at = invite.get("expires_at")
    if expires_at and datetime.now(tz=timezone.utc) > expires_at:
        return "expired"
    return "active"


def record_access(*, token: str, company_id: int, source: str | None = None) -> None:
    """Journalise une consultation (compteur + audit_events). Best-effort."""
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT touch_auditor_token(%s)", (token,))
        except Exception as exc:  # pragma: no cover
            logger.warning("touch_auditor_token échoué: %s", exc)
    audit_service.log_event(
        "auditor_access", "Consultation auditeur",
        detail=source, company_id=company_id, user=f"auditor:{token[:8]}",
    )


def audit_view(company_id: int) -> dict[str, Any]:
    """Vue lecture seule : KPIs courants + statut de la chaîne d'intégrité."""
    kpis: list[dict[str, Any]] = []
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT code, value, unit, source_path, computed_at, hash_self
                        FROM facts_current WHERE company_id = %s ORDER BY code
                        """,
                        (company_id,),
                    )
                    kpis = [
                        {
                            "code": r["code"],
                            "value": float(r["value"]) if r["value"] is not None else None,
                            "unit": r["unit"],
                            "source_path": r["source_path"],
                            "computed_at": r["computed_at"],
                            "hash_self": r["hash_self"],
                        }
                        for r in cur.fetchall()
                    ]
        except Exception as exc:  # pragma: no cover
            logger.warning("audit_view KPIs échoué: %s", exc)

    chain = facts_service.verify_chain(company_id)
    return {
        "kpis": kpis,
        "verify": {"ok": chain.ok, "broken_at": chain.broken_at, "checked": chain.checked},
    }
