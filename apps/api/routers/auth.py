"""
Auth router — POST /auth/login, GET /auth/me.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr

from services.auth_service import (
    AuthUser,
    authenticate,
    create_access_token,
    decode_token,
)

router = APIRouter()

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    expiresAt: str
    user: AuthUser


class MeResponse(BaseModel):
    user: AuthUser


def get_current_user(token: str = Depends(_oauth2_scheme)) -> AuthUser:
    user = decode_token(token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    user = authenticate(body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token, expires_at = create_access_token(user)
    return LoginResponse(
        accessToken=token,
        expiresAt=expires_at.isoformat(),
        user=user,
    )


@router.get("/me", response_model=MeResponse)
async def me(user: AuthUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=user)
