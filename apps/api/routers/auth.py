"""
Auth router — login, refresh, logout, /me, dépendances de rôles.

Endpoints :
  POST /auth/login    → access token (body JSON) + refresh token (cookie httpOnly)
  POST /auth/refresh  → rotation refresh token → nouveau access token + refresh token
  POST /auth/logout   → révocation du refresh token + suppression cookie
  GET  /auth/me       → infos user courant

Cookies :
  cc_refresh  httpOnly, Secure (en prod), SameSite=None en prod / Lax en dev,
              Path=/auth, 30 jours.

  Note SameSite : le front (carbon-snowy-nine.vercel.app) et l'API
  (carbonco-api-...vercel.app) sont sur des subdomains de vercel.app, qui
  figure dans la Public Suffix List → considérés cross-site par les
  navigateurs. SameSite=Lax bloquerait donc le cookie sur les fetch
  cross-origin. SameSite=None + Secure permet l'envoi cross-site.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr

from middleware.request_logger import log_obs_event
from services import totp_service
from services.audit_service import log_event
from services.auth_service import (
    AuthUser,
    authenticate,
    create_access_token,
    create_demo_access_token,
    create_pre_auth_token,
    create_refresh_token,
    decode_pre_auth_token,
    decode_token,
    ensure_demo_tenant,
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
    accessToken: str | None = None
    tokenType: str = "bearer"
    expiresAt: str | None = None
    user: AuthUser | None = None
    # 2FA : si l'utilisateur a le TOTP activé, le login renvoie requiresTotp + un
    # token pré-auth à présenter avec le code sur /auth/totp/verify.
    requiresTotp: bool = False
    preAuthToken: str | None = None


class TotpVerifyRequest(BaseModel):
    preAuthToken: str
    code: str


class TotpCodeRequest(BaseModel):
    code: str


class TotpEnrollResponse(BaseModel):
    secret: str
    otpauthUri: str


class TotpActivateResponse(BaseModel):
    recoveryCodes: list[str]


class TotpStatusResponse(BaseModel):
    enabled: bool


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


def require_cron_or_analyst(request: Request) -> None:
    """Autorise soit le token de service cron, soit un JWT analyst/admin.

    Les endpoints périodiques (rappels BEGES, relances fournisseurs) sont
    appelés par le cron Vercel sans contexte utilisateur : le route handler
    front transmet `Authorization: Bearer <CRON_SERVICE_TOKEN>`. Le même
    secret doit être défini côté API (env CRON_SERVICE_TOKEN). À défaut,
    un JWT analyst permet le déclenchement manuel depuis l'app.
    """
    import os
    import secrets as _secrets

    auth = request.headers.get("authorization") or ""
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    expected = os.environ.get("CRON_SERVICE_TOKEN") or ""
    if expected and token and _secrets.compare_digest(token, expected):
        return
    user = decode_token(token) if token else None
    if user is None or not has_role(user, "analyst"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de service cron ou JWT analyst requis.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# Helper: set / clear refresh cookie
# ---------------------------------------------------------------------------

def _is_prod() -> bool:
    """Detect production via Vercel's standard VERCEL_ENV variable.

    Fail-secure : si VERCEL_ENV n'est pas "development", on considère prod
    (preview deployments inclus) et on émet le cookie en Secure. Logique
    factorisée dans `utils.env.is_production()` (PR-02C, D-2) — réutilisée par
    le CLI de migrations ; conservée ici comme alias local pour ne rien
    changer aux appelants existants de ce module.
    """
    from utils.env import is_production

    return is_production()


def _cookie_samesite() -> str:
    """SameSite policy for the refresh cookie.

    Prod (cross-site fetch front ↔ API): "none" (+ Secure obligatoire).
    Dev (localhost) : "lax" reste valide et plus restrictif côté DevTools.
    """
    return "none" if _is_prod() else "lax"


def _set_refresh_cookie(response: Response, raw_token: str, expires_at: datetime) -> None:
    max_age = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_token,
        httponly=True,
        secure=_is_prod(),
        samesite=_cookie_samesite(),
        path=REFRESH_COOKIE_PATH,
        max_age=max(0, max_age),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=_is_prod(),
        samesite=_cookie_samesite(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response) -> LoginResponse:
    user = authenticate(body.email, body.password)
    if user is None:
        log_obs_event(
            "auth_login_failed",
            email=body.email,
            ip=request.headers.get("x-forwarded-for", "unknown").split(",")[0].strip(),
            user_agent=request.headers.get("user-agent"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2FA : si TOTP activé, on s'arrête à l'étape mot de passe et on renvoie un
    # token pré-auth. Le client appelle ensuite /auth/totp/verify avec le code.
    if totp_service.is_enabled(user.email):
        return LoginResponse(requiresTotp=True, preAuthToken=create_pre_auth_token(user))

    return _issue_session(user, request, response)


def _issue_session(user: AuthUser, request: Request, response: Response) -> LoginResponse:
    """Émet access + refresh (cookie) et journalise la connexion."""
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


@router.post("/demo", response_model=LoginResponse)
async def demo_login(request: Request) -> LoginResponse:
    """Session de démonstration produit — tenant fixe `asterion-motion-demo`,
    rôle analyste, courte durée, SANS refresh cookie (auto-expiration, non
    renouvelable). Aucun mot de passe n'est requis ni exposé côté client :
    remplace l'ancien bouton démo qui embarquait un identifiant en clair.

    L'IA reste en mode demo (aucune activation live). Le tenant démo est isolé
    (RLS) et sans permission globale (rôle analyste, jamais admin).
    """
    user = ensure_demo_tenant()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Accès démo indisponible (base non configurée).",
        )
    access_token, access_expires = create_demo_access_token(user)
    log_event(
        event_type="login",
        title=f"Session démo — {user.email}",
        status="ok",
        user=user.email,
        company_id=user.company_id,
    )
    # Volontairement AUCUN refresh cookie : la session démo expire seule.
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


# ---------------------------------------------------------------------------
# 2FA TOTP (T1.4)
# ---------------------------------------------------------------------------

@router.post("/totp/verify", response_model=LoginResponse)
async def totp_verify(body: TotpVerifyRequest, request: Request, response: Response) -> LoginResponse:
    """Étape 2 du login : valide le code TOTP (ou un code de récupération) à
    partir du token pré-auth, puis émet la session complète. Rate-limité 5/15 min."""
    user = decode_pre_auth_token(body.preAuthToken)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session pré-auth invalide ou expirée.")
    if not totp_service.verify(user.email, body.code):
        log_event(event_type="2fa_fail", title=f"2FA échec — {user.email}", status="warning",
                  user=user.email, company_id=user.company_id)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Code de vérification invalide.")
    log_event(event_type="2fa_success", title=f"2FA validé — {user.email}", status="ok",
              user=user.email, company_id=user.company_id)
    return _issue_session(user, request, response)


@router.get("/totp/status", response_model=TotpStatusResponse)
async def totp_status(user: AuthUser = Depends(get_current_user)) -> TotpStatusResponse:
    return TotpStatusResponse(enabled=totp_service.is_enabled(user.email))


@router.post("/totp/enroll", response_model=TotpEnrollResponse)
async def totp_enroll(user: AuthUser = Depends(get_current_user)) -> TotpEnrollResponse:
    """Génère un secret (pending) et renvoie l'URI otpauth (QR rendu côté front)."""
    data = totp_service.enroll(user.email, user.company_id)
    log_event(event_type="2fa_enroll", title=f"2FA enrôlement — {user.email}", status="ok",
              user=user.email, company_id=user.company_id)
    return TotpEnrollResponse(secret=data["secret"], otpauthUri=data["otpauthUri"])


@router.post("/totp/activate", response_model=TotpActivateResponse)
async def totp_activate(body: TotpCodeRequest, user: AuthUser = Depends(get_current_user)) -> TotpActivateResponse:
    """Vérifie le code du secret pending, active le TOTP, renvoie 8 codes de récupération."""
    try:
        codes = totp_service.activate(user.email, body.code, user.company_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    log_event(event_type="2fa_recovery", title=f"2FA activé — {user.email}", status="ok",
              user=user.email, company_id=user.company_id)
    return TotpActivateResponse(recoveryCodes=codes)


@router.post("/totp/disable", status_code=204)
async def totp_disable(user: AuthUser = Depends(get_current_user)) -> None:
    totp_service.disable(user.email, user.company_id)
    log_event(event_type="2fa_fail", title=f"2FA désactivé — {user.email}", status="warning",
              user=user.email, company_id=user.company_id)
