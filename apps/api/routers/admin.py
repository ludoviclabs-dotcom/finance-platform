"""
admin.py — CRUD companies et users, accessible uniquement aux admins.

Deux niveaux de droits (B-03) :
  - admin d'organisation (rôle `admin`) : SA seule organisation — ses
    utilisateurs, le nom et le code NAF de l'organisation ;
  - administrateur de la plateforme (`admin` + e-mail listé dans
    PLATFORM_ADMIN_EMAILS) : toutes les organisations, création/suppression
    d'organisation, changement de plan.

Endpoints :
  GET    /admin/companies           → organisations visibles (la sienne, ou toutes)
  POST   /admin/companies           → créer une organisation (plateforme)
  GET    /admin/companies/{id}      → détail
  PATCH  /admin/companies/{id}      → modifier name/naf_code (plan : plateforme)
  DELETE /admin/companies/{id}      → supprimer (plateforme ; cascade users/snapshots)

  GET    /admin/users               → utilisateurs visibles (filtrable par company_id)
  POST   /admin/users               → créer un utilisateur
  PATCH  /admin/users/{id}          → modifier role/is_active/password
  DELETE /admin/users/{id}          → supprimer

Un utilisateur d'une autre organisation est traité comme inexistant (404) :
aucune route ne sert d'oracle d'existence inter-organisations.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr

from db.database import db_available, get_db
from routers.auth import require_admin
from services.audit_service import log_event
from services.auth_service import (
    AuthUser,
    _pwd_context,
    is_platform_admin,
    is_public_dev_password,
    platform_admin_emails,
)

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_ROLES = {"admin", "analyst", "viewer"}
VALID_PLANS = {"starter", "pro", "enterprise"}

# Organisation système créée par scripts/seed_admin.py — jamais supprimable.
_PROTECTED_COMPANY_ID = 1


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
    # Facultatif : par défaut, l'organisation de l'admin appelant.
    company_id: int | None = None
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
# Droits
# ---------------------------------------------------------------------------

def _require_platform_admin(admin: AuthUser) -> None:
    if not is_platform_admin(admin):
        raise HTTPException(
            status_code=403,
            detail="Accès refusé — geste réservé à l'administration de la plateforme.",
        )


def _target_company(admin: AuthUser, company_id: int | None) -> int:
    """Organisation visée par un geste admin, après contrôle d'accès."""
    if company_id is None or company_id == admin.company_id:
        return admin.company_id
    if is_platform_admin(admin):
        return company_id
    raise HTTPException(
        status_code=403,
        detail="Accès refusé — vous ne pouvez gérer que votre organisation.",
    )


def _can_see_company(admin: AuthUser, company_id: int) -> bool:
    return company_id == admin.company_id or is_platform_admin(admin)


# Politique de mot de passe : les trois exemples d'entropie ≥ 80 bits de la
# recommandation CNIL (délibération n° 2022-100 du 21 juillet 2022).
_WORD_RE = re.compile(r"[^\W\d_]{2,}")


def _password_problem(password: str) -> str | None:
    if is_public_dev_password(password):
        return "Ce mot de passe est public (présent dans le code source) : choisissez-en un autre."
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() and not c.isspace() for c in password)
    if len(password) >= 12 and has_upper and has_lower and has_digit and has_special:
        return None
    if len(password) >= 14 and has_upper and has_lower and has_digit:
        return None
    if len(_WORD_RE.findall(password)) >= 7:
        return None
    return (
        "Mot de passe trop faible (recommandation CNIL n° 2022-100) : au moins 12 caractères "
        "avec majuscules, minuscules, chiffres et caractères spéciaux, ou au moins 14 caractères "
        "avec majuscules, minuscules et chiffres, ou une phrase de passe d'au moins 7 mots."
    )


def _check_password(password: str) -> None:
    problem = _password_problem(password)
    if problem:
        raise HTTPException(status_code=422, detail=problem)


def _audit(admin: AuthUser, event_type: str, title: str, meta: dict, company_id: int) -> None:
    try:
        log_event(
            event_type=event_type,  # type: ignore[arg-type]
            title=title,
            status="ok",
            meta={**meta, "actor": admin.email},
            user=admin.email,
            company_id=company_id,
        )
    except Exception as exc:  # l'audit ne doit jamais masquer le geste réussi
        logger.warning("Audit admin non journalisé : %s", exc)


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------

_COMPANY_SELECT = """
    SELECT c.id, c.name, c.slug, c.naf_code, c.plan, c.created_at,
           COUNT(u.id) AS user_count
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id
"""


def _company_out(r) -> CompanyOut:  # type: ignore[no-untyped-def]
    return CompanyOut(
        id=r["id"], name=r["name"], slug=r["slug"],
        naf_code=r["naf_code"], plan=r["plan"],
        created_at=_fmt_dt(r["created_at"]),
        user_count=r.get("user_count") or 0,
    )


@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(admin: AuthUser = Depends(require_admin)) -> list[CompanyOut]:
    _require_pg()
    with get_db() as conn:
        with conn.cursor() as cur:
            if is_platform_admin(admin):
                cur.execute(_COMPANY_SELECT + " GROUP BY c.id ORDER BY c.id")
            else:
                cur.execute(
                    _COMPANY_SELECT + " WHERE c.id = %s GROUP BY c.id",
                    (admin.company_id,),
                )
            rows = cur.fetchall()
    return [_company_out(r) for r in rows]


@router.post("/companies", response_model=CompanyOut, status_code=201)
async def create_company(body: CompanyCreate, admin: AuthUser = Depends(require_admin)) -> CompanyOut:
    _require_pg()
    _require_platform_admin(admin)
    if body.plan not in VALID_PLANS:
        raise HTTPException(status_code=422, detail=f"Plan invalide. Valeurs : {', '.join(sorted(VALID_PLANS))}")
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
        logger.error("Création d'organisation échouée : %s", exc)
        raise HTTPException(status_code=500, detail="Création de l'organisation impossible.") from exc
    _audit(admin, "admin_company_change", f"Organisation créée — {body.name}",
           {"action": "create", "company_id": r["id"]}, r["id"])
    return _company_out(r)


@router.get("/companies/{company_id}", response_model=CompanyOut)
async def get_company(company_id: int, admin: AuthUser = Depends(require_admin)) -> CompanyOut:
    _require_pg()
    if not _can_see_company(admin, company_id):
        raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(_COMPANY_SELECT + " WHERE c.id = %s GROUP BY c.id", (company_id,))
            r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    return _company_out(r)


@router.patch("/companies/{company_id}", response_model=CompanyOut)
async def patch_company(
    company_id: int, body: CompanyPatch, admin: AuthUser = Depends(require_admin),
) -> CompanyOut:
    _require_pg()
    if not _can_see_company(admin, company_id):
        raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="Aucun champ à modifier.")
    if "plan" in updates:
        # Le plan conditionne la facturation : jamais modifiable par le client.
        _require_platform_admin(admin)
        if updates["plan"] not in VALID_PLANS:
            raise HTTPException(status_code=422, detail=f"Plan invalide. Valeurs : {', '.join(sorted(VALID_PLANS))}")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE companies SET {set_clause}, updated_at = now() WHERE id = %s "
                "RETURNING id, name, slug, naf_code, plan, created_at",
                (*updates.values(), company_id),
            )
            r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    _audit(admin, "admin_company_change", f"Organisation modifiée — {r['name']}",
           {"action": "update", "company_id": company_id, "fields": sorted(updates)}, company_id)
    return _company_out(r)


@router.delete("/companies/{company_id}", status_code=204)
async def delete_company(company_id: int, admin: AuthUser = Depends(require_admin)) -> None:
    _require_pg()
    _require_platform_admin(admin)
    if company_id in (_PROTECTED_COMPANY_ID, admin.company_id):
        raise HTTPException(status_code=403, detail="Cette organisation ne peut pas être supprimée.")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM companies WHERE id = %s RETURNING id", (company_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Entreprise introuvable.")
    # Journalisé dans l'organisation de l'administrateur : celle supprimée
    # n'existe plus (cascade).
    _audit(admin, "admin_company_change", f"Organisation supprimée — id {company_id}",
           {"action": "delete", "company_id": company_id}, admin.company_id)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

_USER_SELECT = """
    SELECT u.id, u.company_id, c.name AS company_name,
           u.email, u.role, u.is_active, u.created_at, u.last_login_at
    FROM users u JOIN companies c ON c.id = u.company_id
"""


def _user_out(r) -> UserOut:  # type: ignore[no-untyped-def]
    return UserOut(
        id=r["id"], company_id=r["company_id"], company_name=r.get("company_name"),
        email=r["email"], role=r["role"], is_active=r["is_active"],
        created_at=_fmt_dt(r["created_at"]),
        last_login_at=_fmt_dt(r.get("last_login_at")) or None,
    )


def _load_visible_user(cur, admin: AuthUser, user_id: int):  # type: ignore[no-untyped-def]
    cur.execute(_USER_SELECT + " WHERE u.id = %s", (user_id,))
    row = cur.fetchone()
    if not row or not _can_see_company(admin, row["company_id"]):
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return row


def _other_active_admins(cur, company_id: int, user_id: int) -> int:  # type: ignore[no-untyped-def]
    cur.execute(
        "SELECT COUNT(*) AS n FROM users "
        "WHERE company_id = %s AND role = 'admin' AND is_active AND id <> %s",
        (company_id, user_id),
    )
    return int(cur.fetchone()["n"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    company_id: int | None = Query(default=None),
    admin: AuthUser = Depends(require_admin),
) -> list[UserOut]:
    _require_pg()
    with get_db() as conn:
        with conn.cursor() as cur:
            if company_id is None and is_platform_admin(admin):
                cur.execute(_USER_SELECT + " ORDER BY u.id")
            else:
                target = _target_company(admin, company_id)
                cur.execute(_USER_SELECT + " WHERE u.company_id = %s ORDER BY u.id", (target,))
            rows = cur.fetchall()
    return [_user_out(r) for r in rows]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, admin: AuthUser = Depends(require_admin)) -> UserOut:
    _require_pg()
    target = _target_company(admin, body.company_id)
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Rôle invalide. Valeurs : {', '.join(sorted(VALID_ROLES))}")
    email = str(body.email).strip().lower()
    if email in platform_admin_emails() and not is_platform_admin(admin):
        # Sinon un admin d'organisation pourrait créer le compte d'un
        # administrateur de la plateforme et en hériter les droits.
        raise HTTPException(status_code=403, detail="Cette adresse est réservée.")
    _check_password(body.password)
    pw_hash = _pwd_context.hash(body.password)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (company_id, email, password_hash, role)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (target, email, pw_hash, body.role),
                )
                new_id = cur.fetchone()["id"]
                cur.execute(_USER_SELECT + " WHERE u.id = %s", (new_id,))
                r = cur.fetchone()
    except HTTPException:
        raise
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(status_code=409, detail=f"L'email '{email}' existe déjà.") from exc
        if "foreign key" in str(exc).lower():
            raise HTTPException(status_code=404, detail="Entreprise introuvable.") from exc
        logger.error("Création d'utilisateur échouée : %s", exc)
        raise HTTPException(status_code=500, detail="Création de l'utilisateur impossible.") from exc
    _audit(admin, "admin_user_change", f"Utilisateur créé — {email}",
           {"action": "create", "user_id": r["id"], "role": body.role}, target)
    return _user_out(r)


@router.patch("/users/{user_id}", response_model=UserOut)
async def patch_user(user_id: int, body: UserPatch, admin: AuthUser = Depends(require_admin)) -> UserOut:
    _require_pg()
    if body.role is not None and body.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Rôle invalide. Valeurs : {', '.join(sorted(VALID_ROLES))}")
    if body.password is not None:
        _check_password(body.password)

    with get_db() as conn:
        with conn.cursor() as cur:
            current = _load_visible_user(cur, admin, user_id)
            updates: dict = {}
            if body.role is not None:
                updates["role"] = body.role
            if body.is_active is not None:
                updates["is_active"] = body.is_active
            if body.password is not None:
                updates["password_hash"] = _pwd_context.hash(body.password)
            if not updates:
                raise HTTPException(status_code=422, detail="Aucun champ à modifier.")

            loses_admin = current["role"] == "admin" and current["is_active"] and (
                updates.get("role", "admin") != "admin" or updates.get("is_active") is False
            )
            if loses_admin and _other_active_admins(cur, current["company_id"], user_id) == 0:
                raise HTTPException(
                    status_code=409,
                    detail="Impossible : l'organisation doit conserver au moins un administrateur actif.",
                )

            set_clause = ", ".join(f"{k} = %s" for k in updates)
            cur.execute(
                f"UPDATE users SET {set_clause} WHERE id = %s",
                (*updates.values(), user_id),
            )
            if "password_hash" in updates or updates.get("is_active") is False:
                # Un mot de passe changé ou un compte désactivé ferme les
                # sessions existantes (les jetons d'accès expirent en 15 min).
                cur.execute(
                    "UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = %s AND revoked = FALSE",
                    (user_id,),
                )
            cur.execute(_USER_SELECT + " WHERE u.id = %s", (user_id,))
            r = cur.fetchone()

    fields = sorted("password" if k == "password_hash" else k for k in updates)
    _audit(admin, "admin_user_change", f"Utilisateur modifié — {r['email']}",
           {"action": "update", "user_id": user_id, "fields": fields}, r["company_id"])
    return _user_out(r)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, admin: AuthUser = Depends(require_admin)) -> None:
    _require_pg()
    if admin.user_id is not None and admin.user_id == user_id:
        raise HTTPException(status_code=409, detail="Vous ne pouvez pas supprimer votre propre compte.")
    with get_db() as conn:
        with conn.cursor() as cur:
            current = _load_visible_user(cur, admin, user_id)
            if current["email"] == admin.email:
                raise HTTPException(status_code=409, detail="Vous ne pouvez pas supprimer votre propre compte.")
            if (
                current["role"] == "admin" and current["is_active"]
                and _other_active_admins(cur, current["company_id"], user_id) == 0
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Impossible : l'organisation doit conserver au moins un administrateur actif.",
                )
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    _audit(admin, "admin_user_change", f"Utilisateur supprimé — {current['email']}",
           {"action": "delete", "user_id": user_id}, current["company_id"])
