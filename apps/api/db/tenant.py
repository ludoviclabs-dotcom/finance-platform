"""
tenant.py — Dépendances FastAPI pour le contexte multi-tenant.

Usage dans un router :

    from db.tenant import get_company_id

    @router.get("/snapshot")
    async def snapshot(company_id: int = Depends(get_company_id)):
        ...

Logique :
  1. Si le token JWT est présent et valide → company_id depuis le claim "cid"
  2. Si pas de token (route publique ou test) → DEFAULT_COMPANY_ID (1)
  3. Si PostgreSQL non disponible → DEFAULT_COMPANY_ID (1)
"""

from __future__ import annotations

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from services.auth_service import decode_token

DEFAULT_COMPANY_ID = 1

_oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_company_id(token: str | None = Depends(_oauth2_optional)) -> int:
    """Extract company_id from JWT, fallback to DEFAULT_COMPANY_ID."""
    if not token:
        return DEFAULT_COMPANY_ID
    user = decode_token(token)
    if user is None:
        return DEFAULT_COMPANY_ID
    return user.company_id
