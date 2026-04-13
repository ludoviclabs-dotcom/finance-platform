"""
Auth router — login, refresh, logout, /me, dépendances de rôles.

Endpoints :
  POST /auth/login    → access token (body JSON) + refresh token (cookie httpOnly)
  POST /auth/refresh  → rotation refresh token → nouveau access token + refresh token
  POST /auth/logout   → révocation du refresh token + suppression cookie
  GET  /auth/me       → infos user courant

Cookies :
  cc_refresh  httpOnly, Secure (en prod), SameSite=Lax, Path=/auth, 30 jours
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr

from services.audit_service import log_event
from services.auth_service import (
    AuthUser,
    authenticate,
    create_access_token,
    create_refresh_token,
    decode_token,
    has_role,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter()

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

REFRESH_COOKIE = "cc_refresh"
REFRESH_COOKIE_PATH = "/auth"


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    expiresAt: str
    user: AuthUser


class RefreshResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    expiresAt: str
    user: AuthUser


class MeResponse(BaseModel):
    user: AuthUser


# ---------------------------------------------------------------------------
# Dependency: get current user from Bearer token
# ---------------------------------------------------------------------------

def get_current_user(token: str | None = Depends(_oauth2_scheme)) -> AuthUser:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = decode_token(token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ---------------------------------------------------------------------------
# Role-based dependencies
# ---------------------------------------------------------------------------

def require_analyst(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require at least analyst role (analyst or admin)."""
    if not has_role(user, "analyst"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé — rôle analyst requis.",
        )
    return user


def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require admin role."""
    if not has_role(user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé — rôle admin requis.",
        )
    return user


# ---------------------------------------------------------------------------
# Helper: set / clear refresh cookie
# ---------------------------------------------------------------------------

def _is_prod() -> bool:
    import os
    return os.environ.get("ENV", "development").lower() in ("production", "prod")


def _set_refresh_cookie(response: Response, raw_token: str, expires_at: datetime) -> None:
    max_age = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_token,
        httponly=True,
        secure=_is_prod(),
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        max_age=max(0, max_age),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=_is_prod(),
        samesite="lax",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response) -> LoginResponse:
    user = authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token, access_expires = create_access_token(user)
    user_agent = request.headers.get("user-agent")
    refresh_raw, refresh_expires = create_refresh_token(user, user_agent)

    _set_refresh_cookie(response, refresh_raw, refresh_expires)

    log_event(
        event_type="login",
        title=f"Connexion — {user.email}",
        status="ok",
        user=user.email,
        company_id=user.company_id,
    )

    return LoginResponse(
        accessToken=access_token,
        expiresAt=access_expires.isoformat(),
        user=user,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(request: Request, response: Response) -> RefreshResponse:
    """
    Rotate refresh token: validate cookie → revoke old → issue new access + refresh tokens.
    The new refresh token is set as an httpOnly cookie.
    """
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token manquant — veuillez vous reconnecter.",
        )

    user_agent = request.headers.get("user-agent")
    user, new_refresh_raw, new_refresh_expires = rotate_refresh_token(raw_token, user_agent)

    if user is None:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré — veuillez vous reconnecter.",
        )

    access_token, access_expires = create_access_token(user)
    _set_refresh_cookie(response, new_refresh_raw, new_refresh_expires)  # type: ignore[arg-type]

    return RefreshResponse(
        accessToken=access_token,
        expiresAt=access_expires.isoformat(),
        user=user,
    )


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response) -> None:
    """Revoke refresh token and clear cookie."""
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if raw_token:
        revoke_refresh_token(raw_token)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=MeResponse)
async def me(user: AuthUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=user)
