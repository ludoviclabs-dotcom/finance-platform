"""
tenant.py — Dépendances FastAPI pour le contexte multi-tenant.

Usage dans un router :

    from db.tenant import get_company_id

    @router.get("/snapshot")
    async def snapshot(company_id: int = Depends(get_company_id)):
        ...

Logique : le company_id vient EXCLUSIVEMENT du claim "cid" d'un jeton d'accès
valide. Sans jeton (ou jeton invalide/expiré) → 401.

Historique : l'ancienne version renvoyait DEFAULT_COMPANY_ID (1) en l'absence
de jeton, ce qui ouvrait en lecture — et parfois en écriture (POST /ingest,
POST /report/generate…) — les données de l'organisation n°1 à tout appelant
anonyme, et exportait ses KPIs à n'importe quel utilisateur d'une autre
organisation via les liens de téléchargement sans en-tête Authorization.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from services.auth_service import decode_token

# Conservé pour les modules qui l'importent encore comme valeur par défaut de
# leurs fonctions de service (jamais comme repli d'authentification).
DEFAULT_COMPANY_ID = 1

_oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_company_id(token: str | None = Depends(_oauth2_optional)) -> int:
    """company_id du jeton d'accès ; 401 si absent ou invalide."""
    user = decode_token(token) if token else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise." if not token else "Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user.company_id
