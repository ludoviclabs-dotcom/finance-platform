"""
Auth service — JWT issuance and verification for Carbon&Co.

Phase 1-C: demo credentials live in-memory. A future phase should move them
to a real user store. Passwords are pre-hashed at import time so the bcrypt
round cost is paid once per cold start.

Environment variables:
- AUTH_JWT_SECRET: HMAC secret. Falls back to a dev value so local runs work,
  but Vercel production MUST override it.
- AUTH_JWT_TTL_HOURS: optional token lifetime (default 8 hours).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

_JWT_SECRET = os.environ.get(
    "AUTH_JWT_SECRET",
    "dev-secret-change-me-in-production-0123456789abcdef",
)
_JWT_ALGORITHM = "HS256"
_JWT_TTL_HOURS = int(os.environ.get("AUTH_JWT_TTL_HOURS", "8"))

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthUser(BaseModel):
    email: str
    role: str = "user"


_DEMO_USERS: dict[str, dict[str, str]] = {
    "demo@carbonco.fr": {
        "password_hash": _pwd_context.hash("CarbonCo2024!"),
        "role": "user",
    },
    "admin@carbonco.fr": {
        "password_hash": _pwd_context.hash("Admin2024!"),
        "role": "admin",
    },
}


def authenticate(email: str, password: str) -> Optional[AuthUser]:
    normalized = email.strip().lower()
    record = _DEMO_USERS.get(normalized)
    if record is None:
        return None
    if not _pwd_context.verify(password, record["password_hash"]):
        return None
    return AuthUser(email=normalized, role=record["role"])


def create_access_token(user: AuthUser) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_JWT_TTL_HOURS)
    payload = {
        "sub": user.email,
        "role": user.role,
        "exp": expires_at,
    }
    token = jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)
    return token, expires_at


def decode_token(token: str) -> Optional[AuthUser]:
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except JWTError:
        return None
    email = payload.get("sub")
    role = payload.get("role", "user")
    if not isinstance(email, str):
        return None
    return AuthUser(email=email, role=role)
