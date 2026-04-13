"""
admin.py — CRUD companies et users, accessible uniquement aux admins.

Endpoints :
  GET    /admin/companies           → liste toutes les entreprises
  POST   /admin/companies           → créer une entreprise
  GET    /admin/companies/{id}      → détail + users
  PATCH  /admin/companies/{id}      → modifier name/plan/naf_code
  DELETE /admin/companies/{id}      → supprimer (cascade users/snapshots)

  GET    /admin/users               → tous les users (filtrable par company_id)
  POST   /admin/users               → créer un user
  PATCH  /admin/users/{id}          → modifier role/is_active/password
  DELETE /admin/users/{id}          → supprimer
"""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr

from db.database import db_available, get_db
from routers.auth import require_admin
from services.auth_service import AuthUser, _pwd_context

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_ROLES = {"admin", "analyst", "viewer"}
VALID_PLANS = {"starter", "pro", "enterprise"}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CompanyOut(BaseModel):
    id: int
    name: str
    slug: str
    naf_code: str | None
    plan: str
    created_at: str
    user_count: int = 0


class CompanyCreate(BaseModel):
    name: str
    slug: str
    naf_code: str | None = None
    plan: str = "starter"


class CompanyPatch(BaseModel):
    name: str | None = None
    naf_code: str | None = None
    plan: str | None = None


class UserOut(BaseModel):
    id: int
    company_id: int
    company_name: str | None
    email: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: str | None


class UserCreate(BaseModel):
    company_id: int
    email: EmailStr
    password: str
    role: str = "analyst"


class UserPatch(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


def _require_pg() -> None:
    if not db_available():
        raise HTTPException(
            status_code=503,
            detail="Fonctionnalité admin non disponible — PostgreSQL non configuré.",
        )


def _fmt_dt(v) -> str:  # type: ignore[no-untyped-def]
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------

@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(_: AuthUser = Depends(require_admin)) -> list[CompanyOut]:
    _require_pg()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.naf_code, c.plan, c.created_at,
                       COUNT(u.id) AS user_count
                FROM companies c
                LEFT JOIN users u ON u.company_id = c.id
                GROUP BY c.id
                ORDER BY c.id
                """
            )
            rows = cur.fetchall()
    return [
        CompanyOut(
            id=r["id"], name=r["name"], slug=r["slug"],
            naf_code=r["naf_code"], plan=r["plan"],
            created_at=_fmt_dt(r["created_at"]),
            user_count=r["user_count"] or 0,
        )
        for r in rows
    ]


@router.post("/companies", response_model=CompanyOut, status_code=201)
async def create_company(body: CompanyCreate, _: AuthUser = Depends(require_admin)) -> CompanyOut:
    _require_pg()
    if body.plan not in VALID_PLANS:
        raise HTTPException(status_code=422, detail=f"Plan invalide. Valeurs : {', '.join(VALID_PLANS)}")
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO companies (name, slug, naf_code, plan)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, name, slug, naf_code, plan, created_at
                    """,
                    (body.name, body.slug, body.naf_code, body.plan),
                )
                r = cur.fetchone()
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail=f"Le slug '{body.slug}' existe déjà.") from exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return CompanyOut(
        id=r["id"], name=r["name"], slug=r["slug"],
        naf_code=r["naf_code"], plan=r["plan"],
        created_at=_fmt_dt(r["created_at"]),
    )


@router.get("/companies/{company_id}", response_model=CompanyOut)
async def get_company(company_id: int, _: AuthUser = Depends(require_admin)) -> CompanyOut:
    _require_pg()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.naf_code, c.plan, c.created_at,
                       COUNT(u.id) AS user_count
                FROM companies c
                LEFT JOIN users u ON u.company_id = c.id
                WHERE c.id = %s
                GROUP BY c.id
                """,
                (company_id,),
            )
            r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    return CompanyOut(
        id=r["id"], name=r["name"], slug=r["slug"],
        naf_code=r["naf_code"], plan=r["plan"],
        created_at=_fmt_dt(r["created_at"]),
        user_count=r["user_count"] or 0,
    )


@router.patch("/companies/{company_id}", response_model=CompanyOut)
async def patch_company(company_id: int, body: CompanyPatch, _: AuthUser = Depends(require_admin)) -> CompanyOut:
    _require_pg()
    if body.plan and body.plan not in VALID_PLANS:
        raise HTTPException(status_code=422, detail=f"Plan invalide. Valeurs : {', '.join(VALID_PLANS)}")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="Aucun champ à modifier.")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE companies SET {set_clause}, updated_at = now() WHERE id = %s RETURNING id, name, slug, naf_code, plan, created_at",
                (*updates.values(), company_id),
            )
            r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    return CompanyOut(
        id=r["id"], name=r["name"], slug=r["slug"],
        naf_code=r["naf_code"], plan=r["plan"],
        created_at=_fmt_dt(r["created_at"]),
    )


@router.delete("/companies/{company_id}", status_code=204)
async def delete_company(company_id: int, _: AuthUser = Depends(require_admin)) -> None:
    _require_pg()
    if company_id == 1:
        raise HTTPException(status_code=403, detail="L'entreprise par défaut ne peut pas être supprimée.")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM companies WHERE id = %s RETURNING id", (company_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Entreprise introuvable.")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserOut])
async def list_users(
    company_id: int | None = Query(default=None),
    _: AuthUser = Depends(require_admin),
) -> list[UserOut]:
    _require_pg()
    with get_db() as conn:
        with conn.cursor() as cur:
            if company_id:
                cur.execute(
                    """
                    SELECT u.id, u.company_id, c.name AS company_name,
                           u.email, u.role, u.is_active, u.created_at, u.last_login_at
                    FROM users u JOIN companies c ON c.id = u.company_id
                    WHERE u.company_id = %s ORDER BY u.id
                    """,
                    (company_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT u.id, u.company_id, c.name AS company_name,
                           u.email, u.role, u.is_active, u.created_at, u.last_login_at
                    FROM users u JOIN companies c ON c.id = u.company_id
                    ORDER BY u.id
                    """
                )
            rows = cur.fetchall()
    return [
        UserOut(
            id=r["id"], company_id=r["company_id"], company_name=r["company_name"],
            email=r["email"], role=r["role"], is_active=r["is_active"],
            created_at=_fmt_dt(r["created_at"]),
            last_login_at=_fmt_dt(r["last_login_at"]) or None,
        )
        for r in rows
    ]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, _: AuthUser = Depends(require_admin)) -> UserOut:
    _require_pg()
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Rôle invalide. Valeurs : {', '.join(VALID_ROLES)}")
    pw_hash = _pwd_context.hash(body.password)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (company_id, email, password_hash, role)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, company_id, email, role, is_active, created_at, last_login_at
                    """,
                    (body.company_id, body.email.lower(), pw_hash, body.role),
                )
                r = cur.fetchone()
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail=f"L'email '{body.email}' existe déjà.") from exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM companies WHERE id = %s", (body.company_id,))
            company_row = cur.fetchone()

    return UserOut(
        id=r["id"], company_id=r["company_id"],
        company_name=company_row["name"] if company_row else None,
        email=r["email"], role=r["role"], is_active=r["is_active"],
        created_at=_fmt_dt(r["created_at"]),
        last_login_at=None,
    )


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(user_id: int, body: UserPatch, _: AuthUser = Depends(require_admin)) -> UserOut:
    _require_pg()
    if body.role and body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Rôle invalide. Valeurs : {', '.join(VALID_ROLES)}")

    updates: dict = {}
    if body.role is not None:
        updates["role"] = body.role
    if body.is_active is not None:
        updates["is_active"] = body.is_active
    if body.password is not None:
        updates["password_hash"] = _pwd_context.hash(body.password)

    if not updates:
        raise HTTPException(status_code=422, detail="Aucun champ à modifier.")

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE users SET {set_clause}
                WHERE id = %s
                RETURNING id, company_id, email, role, is_active, created_at, last_login_at
                """,
                (*updates.values(), user_id),
            )
            r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM companies WHERE id = %s", (r["company_id"],))
            company_row = cur.fetchone()

    return UserOut(
        id=r["id"], company_id=r["company_id"],
        company_name=company_row["name"] if company_row else None,
        email=r["email"], role=r["role"], is_active=r["is_active"],
        created_at=_fmt_dt(r["created_at"]),
        last_login_at=_fmt_dt(r["last_login_at"]) or None,
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, _: AuthUser = Depends(require_admin)) -> None:
    _require_pg()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
