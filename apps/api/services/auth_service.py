"""
auth_service.py — JWT access tokens (15 min) + refresh tokens (30 j).

Stratégie :
  - Si PostgreSQL disponible → users en table `users`, refresh tokens en `refresh_tokens`
  - Sinon → fallback in-memory demo users (comportement Phase 1)

Access token : HS256, 15 min
Refresh token : opaque (secrets.token_urlsafe), stocké haché (SHA-256) en BDD, 30 j

Rôles supportés : admin | analyst | viewer
  - admin   : accès total (ingest, cache, gestion users, rapports)
  - analyst : lecture + export + upload
  - viewer  : lecture seule
"""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

_DEV_JWT_SECRET = "dev-secret-change-me-in-production-0123456789abcdef"
_JWT_SECRET = os.environ.get("AUTH_JWT_SECRET", _DEV_JWT_SECRET)

# Avertissement critique en production si le secret n'est pas défini.
# VERCEL_ENV est défini automatiquement par Vercel ("production" / "preview" / "development").
# On ne crash PAS le boot pour ne pas casser la prod, mais on logue très visiblement.
if os.environ.get("VERCEL_ENV") == "production" and _JWT_SECRET == _DEV_JWT_SECRET:
    logger.critical(
        "═══════════════════════════════════════════════════════════════════════"
    )
    logger.critical(
        "SECURITY WARNING : AUTH_JWT_SECRET non défini en production !"
    )
    logger.critical(
        "Le secret de développement est utilisé — les tokens JWT sont triviaux à forger."
    )
    logger.critical(
        "ACTION REQUISE : définir AUTH_JWT_SECRET dans les variables d'environnement Vercel."
    )
    logger.critical(
        "Génération : openssl rand -hex 32"
    )
    logger.critical(
        "═══════════════════════════════════════════════════════════════════════"
    )
_JWT_ALGORITHM = "HS256"
_ACCESS_TTL_MINUTES = int(os.environ.get("AUTH_ACCESS_TTL_MINUTES", "15"))
_REFRESH_TTL_DAYS = int(os.environ.get("AUTH_REFRESH_TTL_DAYS", "30"))

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

VALID_ROLES = {"admin", "analyst", "viewer"}


class AuthUser(BaseModel):
    email: str
    role: str = "analyst"
    company_id: int = 1
    user_id: int | None = None  # Phase 3.A — nécessaire pour traçabilité reviews/freezes


# ---------------------------------------------------------------------------
# Demo users fallback (no database)
# ---------------------------------------------------------------------------

_DEMO_USERS: dict[str, dict] = {
    "demo@carbonco.fr": {
        "password_hash": _pwd_context.hash("CarbonCo2024!"),
        "role": "analyst",
        "company_id": 1,
    },
    "admin@carbonco.fr": {
        "password_hash": _pwd_context.hash("Admin2024!"),
        "role": "admin",
        "company_id": 1,
    },
    "viewer@carbonco.fr": {
        "password_hash": _pwd_context.hash("Viewer2024!"),
        "role": "viewer",
        "company_id": 1,
    },
}


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _ensure_default_users() -> None:
    """Seed default users if the users table is empty (first run)."""
    if not db_available():
        return
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS count FROM users")
                row = cur.fetchone()
                count = row["count"] if row else 0
                if count == 0:
                    for email, data in _DEMO_USERS.items():
                        cur.execute(
                            """
                            INSERT INTO users (company_id, email, password_hash, role)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (email) DO NOTHING
                            """,
                            (data["company_id"], email, data["password_hash"], data["role"]),
                        )
    except Exception as exc:
        logger.warning("Impossible de seeder les users par défaut : %s", exc)


def _get_user_from_db(email: str) -> Optional[dict]:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, email, password_hash, role, company_id, is_active FROM users WHERE email = %s",
                    (email,),
                )
                return cur.fetchone()
    except Exception as exc:
        logger.warning("Erreur lecture user DB : %s", exc)
        return None


def _update_last_login(user_id: int) -> None:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET last_login_at = now() WHERE id = %s",
                    (user_id,),
                )
    except Exception as exc:
        logger.warning("Erreur update last_login : %s", exc)


# ---------------------------------------------------------------------------
# Public auth functions
# ---------------------------------------------------------------------------

def authenticate(email: str, password: str) -> Optional[AuthUser]:
    """Verify credentials and return AuthUser or None."""
    normalized = email.strip().lower()

    if db_available():
        _ensure_default_users()
        record = _get_user_from_db(normalized)
        if record is None:
            return None
        if not record["is_active"]:
            return None
        if not _pwd_context.verify(password, record["password_hash"]):
            return None
        _update_last_login(record["id"])
        return AuthUser(
            email=normalized,
            role=record["role"],
            company_id=record["company_id"],
            user_id=record["id"],
        )

    # Fallback demo users
    record = _DEMO_USERS.get(normalized)
    if record is None:
        return None
    if not _pwd_context.verify(password, record["password_hash"]):
        return None
    return AuthUser(
        email=normalized,
        role=record["role"],
        company_id=record["company_id"],
    )


# ---------------------------------------------------------------------------
# Access token
# ---------------------------------------------------------------------------

def create_access_token(user: AuthUser) -> tuple[str, datetime]:
    """Return (signed JWT, expires_at). TTL: ACCESS_TTL_MINUTES (default 15)."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TTL_MINUTES)
    payload = {
        "sub": user.email,
        "role": user.role,
        "cid": user.company_id,
        "exp": expires_at,
    }
    if user.user_id is not None:
        payload["uid"] = user.user_id
    token = jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)
    return token, expires_at


def decode_token(token: str) -> Optional[AuthUser]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except JWTError:
        return None
    email = payload.get("sub")
    role = payload.get("role", "analyst")
    company_id = payload.get("cid", 1)
    uid_raw = payload.get("uid")
    if not isinstance(email, str):
        return None
    try:
        user_id = int(uid_raw) if uid_raw is not None else None
    except (TypeError, ValueError):
        user_id = None
    return AuthUser(
        email=email, role=role, company_id=int(company_id), user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Refresh token
# ---------------------------------------------------------------------------

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_refresh_token(user: AuthUser, user_agent: str | None = None) -> tuple[str, datetime]:
    """
    Create an opaque refresh token, store its hash in DB, return (raw_token, expires_at).
    Falls back to a no-op (returns dummy values) if PostgreSQL is unavailable.
    """
    raw = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=_REFRESH_TTL_DAYS)

    if not db_available():
        return raw, expires_at

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Récupérer l'user_id
                cur.execute("SELECT id FROM users WHERE email = %s", (user.email,))
                row = cur.fetchone()
                if not row:
                    return raw, expires_at
                user_id = row["id"]

                # Insérer le refresh token
                cur.execute(
                    """
                    INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user_id, _hash_token(raw), expires_at, user_agent),
                )

                # Révoquer les anciens tokens (garder les 5 derniers par user)
                cur.execute(
                    """
                    UPDATE refresh_tokens SET revoked = TRUE
                    WHERE user_id = %s AND revoked = FALSE
                      AND id NOT IN (
                          SELECT id FROM refresh_tokens
                          WHERE user_id = %s AND revoked = FALSE
                          ORDER BY created_at DESC
                          LIMIT 5
                      )
                    """,
                    (user_id, user_id),
                )
    except Exception as exc:
        logger.warning("Erreur création refresh token : %s", exc)

    return raw, expires_at


def rotate_refresh_token(raw_token: str, user_agent: str | None = None) -> tuple[Optional[AuthUser], Optional[str], Optional[datetime]]:
    """
    Validate a refresh token, revoke it, and issue a new one (rotation).
    Returns (AuthUser, new_raw_token, new_expires_at) or (None, None, None) on failure.
    """
    if not db_available():
        return None, None, None

    token_hash = _hash_token(raw_token)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT rt.id, rt.expires_at, rt.revoked,
                           u.email, u.role, u.company_id, u.is_active
                    FROM refresh_tokens rt
                    JOIN users u ON u.id = rt.user_id
                    WHERE rt.token_hash = %s
                    """,
                    (token_hash,),
                )
                row = cur.fetchone()

                if not row:
                    return None, None, None
                if row["revoked"]:
                    # Possible token reuse — révoquer toute la famille (sécurité)
                    cur.execute(
                        "UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = (SELECT user_id FROM refresh_tokens WHERE token_hash = %s)",
                        (token_hash,),
                    )
                    return None, None, None
                if row["expires_at"] < datetime.now(timezone.utc):
                    return None, None, None
                if not row["is_active"]:
                    return None, None, None

                # Révoquer l'ancien token
                cur.execute(
                    "UPDATE refresh_tokens SET revoked = TRUE WHERE id = %s",
                    (row["id"],),
                )

                user = AuthUser(
                    email=row["email"],
                    role=row["role"],
                    company_id=row["company_id"],
                )

        # Créer un nouveau refresh token (hors transaction pour éviter deadlock)
        new_raw, new_expires = create_refresh_token(user, user_agent)
        return user, new_raw, new_expires

    except Exception as exc:
        logger.warning("Erreur rotation refresh token : %s", exc)
        return None, None, None


def revoke_refresh_token(raw_token: str) -> None:
    """Revoke a specific refresh token (logout)."""
    if not db_available():
        return
    token_hash = _hash_token(raw_token)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = %s",
                    (token_hash,),
                )
    except Exception as exc:
        logger.warning("Erreur révocation refresh token : %s", exc)


# ---------------------------------------------------------------------------
# Role-based access helpers
# ---------------------------------------------------------------------------

ROLE_HIERARCHY = {"admin": 3, "analyst": 2, "viewer": 1}


def has_role(user: AuthUser, minimum_role: str) -> bool:
    """Return True if user's role is >= minimum_role in the hierarchy."""
    user_level = ROLE_HIERARCHY.get(user.role, 0)
    required_level = ROLE_HIERARCHY.get(minimum_role, 99)
    return user_level >= required_level
