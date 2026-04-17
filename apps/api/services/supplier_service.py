"""
supplier_service.py — Logique métier fournisseurs Phase 4.

Fonctionnalités :
  - CRUD fournisseurs (list, get, create, update, delete)
  - Génération et validation de tokens questionnaire
  - Lecture/écriture des réponses publiques
  - Calcul du score GES par fournisseur (top 20 scope 3)

En mode /tmp (no PostgreSQL) : retourne des données de démo in-memory.
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models Pydantic
# ---------------------------------------------------------------------------


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_email: str | None = None
    contact_name: str | None = None
    country: str | None = None
    sector: str | None = None
    scope3_category: str | None = None
    spend_eur: float | None = None
    ghg_estimate_tco2e: float | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    contact_name: str | None = None
    country: str | None = None
    sector: str | None = None
    scope3_category: str | None = None
    spend_eur: float | None = None
    ghg_estimate_tco2e: float | None = None
    status: str | None = None
    notes: str | None = None


class SupplierOut(BaseModel):
    id: int
    company_id: int
    name: str
    contact_email: str | None
    contact_name: str | None
    country: str | None
    sector: str | None
    scope3_category: str | None
    spend_eur: float | None
    ghg_estimate_tco2e: float | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    last_answer_at: datetime | None = None


class TokenCreate(BaseModel):
    campaign: str | None = None
    expires_days: int = Field(default=30, ge=1, le=365)


class TokenOut(BaseModel):
    id: int
    supplier_id: int
    token: str
    campaign: str | None
    expires_at: datetime | None
    used_at: datetime | None
    created_at: datetime
    url: str  # URL complète du questionnaire public


class SupplierAnswerCreate(BaseModel):
    ghg_total_tco2e: float | None = None
    ghg_scope1: float | None = None
    ghg_scope2: float | None = None
    ghg_scope3: float | None = None
    methodology: str | None = None
    reporting_year: int | None = None
    has_sbti: bool = False
    has_iso14001: bool = False
    has_iso50001: bool = False
    narrative: str | None = None


class SupplierAnswerOut(BaseModel):
    id: int
    supplier_id: int
    company_id: int
    ghg_total_tco2e: float | None
    ghg_scope1: float | None
    ghg_scope2: float | None
    ghg_scope3: float | None
    methodology: str | None
    reporting_year: int | None
    has_sbti: bool
    has_iso14001: bool
    has_iso50001: bool
    narrative: str | None
    submitted_at: datetime


class PublicQuestionnaireContext(BaseModel):
    """Contexte exposé publiquement sur le token (sans données confidentielles)."""
    supplier_name: str
    company_name: str
    campaign: str | None
    expires_at: datetime | None
    already_answered: bool


# ---------------------------------------------------------------------------
# In-memory demo data (utilisé quand PostgreSQL absent)
# ---------------------------------------------------------------------------

_DEMO_SUPPLIERS: list[dict[str, Any]] = [
    {
        "id": i + 1,
        "company_id": 1,
        "name": name,
        "contact_email": f"contact{i+1}@{name.lower().replace(' ', '')}.fr",
        "contact_name": "Jean Dupont",
        "country": country,
        "sector": sector,
        "scope3_category": cat,
        "spend_eur": spend,
        "ghg_estimate_tco2e": ghg,
        "status": "active",
        "notes": None,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "last_answer_at": None,
    }
    for i, (name, country, sector, cat, spend, ghg) in enumerate([
        ("Acier Durable SAS",      "France",    "Industrie",  "C1 Biens achetés",      2_500_000, 1_250.0),
        ("TransLogis Europe",       "Belgique",  "Transport",  "C4 Transport amont",    800_000,   420.0),
        ("PackPlast Ibérica",       "Espagne",   "Emballage",  "C1 Biens achetés",      1_200_000, 680.0),
        ("EnergieFlex SA",          "France",    "Énergie",    "C3 Activités liées",    3_000_000, 2_100.0),
        ("CloudSys GMBH",           "Allemagne", "IT",         "C1 Biens achetés",      500_000,   95.0),
        ("BioIngreds Ltd",          "UK",        "Agri-food",  "C1 Biens achetés",      1_800_000, 340.0),
        ("CleanChem NV",            "Pays-Bas",  "Chimie",     "C1 Biens achetés",      900_000,   510.0),
        ("FastShip Maroc",          "Maroc",     "Transport",  "C4 Transport amont",    400_000,   185.0),
        ("PrintSmart SA",           "France",    "Emballage",  "C1 Biens achetés",      600_000,   120.0),
        ("TechParts Asia",          "Vietnam",   "Industrie",  "C1 Biens achetés",      2_200_000, 1_800.0),
        ("ServicesPlus SARL",       "France",    "Services",   "C5 Déchets",            200_000,   35.0),
        ("ImmoPro Gestion",         "France",    "Immobilier", "C8 Actifs en leasing",  750_000,   88.0),
        ("MétauxRecyclés SA",       "France",    "Industrie",  "C1 Biens achetés",      1_100_000, 290.0),
        ("AgroSupplies BV",         "Pays-Bas",  "Agri-food",  "C1 Biens achetés",      1_500_000, 620.0),
        ("FlexWork RH",             "France",    "Services",   "C6 Déplacements",       180_000,   28.0),
        ("TextileVerde PT",         "Portugal",  "Textile",    "C1 Biens achetés",      700_000,   210.0),
        ("DigitalHub SAS",          "France",    "IT",         "C1 Biens achetés",      350_000,   42.0),
        ("ColdChain Logistics",     "France",    "Transport",  "C4 Transport amont",    920_000,   385.0),
        ("EcoPlast Polska",         "Pologne",   "Emballage",  "C1 Biens achetés",      480_000,   175.0),
        ("SolarGlass Italia",       "Italie",    "Énergie",    "C3 Activités liées",    1_300_000, 450.0),
    ])
]

_DEMO_TOKENS: list[dict[str, Any]] = []
_DEMO_ANSWERS: list[dict[str, Any]] = []
_DEMO_ID_COUNTER = {"supplier": 21, "token": 1, "answer": 1}


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# PostgreSQL helpers
# ---------------------------------------------------------------------------

def _db_available() -> bool:
    from db.database import db_available
    return db_available()


def _row_to_supplier(row: dict[str, Any]) -> SupplierOut:
    return SupplierOut(**{
        k: row[k] for k in SupplierOut.model_fields if k in row
    })


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def list_suppliers(
    company_id: int,
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[SupplierOut], int]:
    """List suppliers for a company, ordered by GHG estimate desc."""
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    where = "WHERE s.company_id = %s"
                    params: list[Any] = [company_id]
                    if status:
                        where += " AND s.status = %s"
                        params.append(status)
                    cur.execute(
                        f"""
                        SELECT s.*,
                            MAX(a.submitted_at) AS last_answer_at
                        FROM suppliers s
                        LEFT JOIN supplier_answers a ON a.supplier_id = s.id
                        {where}
                        GROUP BY s.id
                        ORDER BY s.ghg_estimate_tco2e DESC NULLS LAST, s.spend_eur DESC NULLS LAST
                        LIMIT %s OFFSET %s
                        """,
                        params + [limit, offset],
                    )
                    rows = cur.fetchall()
                    cur.execute(
                        f"SELECT COUNT(*) FROM suppliers s {where}", params
                    )
                    total = cur.fetchone()["count"]
                    return [_row_to_supplier(r) for r in rows], total
        except Exception as exc:
            logger.warning("list_suppliers DB error: %s", exc)

    # Demo fallback
    data = [s for s in _DEMO_SUPPLIERS if s["company_id"] == company_id]
    if status:
        data = [s for s in data if s["status"] == status]
    total = len(data)
    page = data[offset : offset + limit]
    return [SupplierOut(**s) for s in page], total


def get_supplier(supplier_id: int, company_id: int) -> SupplierOut | None:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM suppliers WHERE id = %s AND company_id = %s",
                        (supplier_id, company_id),
                    )
                    row = cur.fetchone()
                    return _row_to_supplier(row) if row else None
        except Exception as exc:
            logger.warning("get_supplier DB error: %s", exc)

    hit = next(
        (s for s in _DEMO_SUPPLIERS if s["id"] == supplier_id and s["company_id"] == company_id),
        None,
    )
    return SupplierOut(**hit) if hit else None


def create_supplier(payload: SupplierCreate, company_id: int) -> SupplierOut:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO suppliers
                            (company_id, name, contact_email, contact_name, country,
                             sector, scope3_category, spend_eur, ghg_estimate_tco2e, notes)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING *
                        """,
                        (
                            company_id,
                            payload.name, payload.contact_email, payload.contact_name,
                            payload.country, payload.sector, payload.scope3_category,
                            payload.spend_eur, payload.ghg_estimate_tco2e, payload.notes,
                        ),
                    )
                    return _row_to_supplier(cur.fetchone())
        except Exception as exc:
            logger.warning("create_supplier DB error: %s", exc)

    # Demo fallback
    new_id = _DEMO_ID_COUNTER["supplier"]
    _DEMO_ID_COUNTER["supplier"] += 1
    supplier = {
        "id": new_id,
        "company_id": company_id,
        **payload.model_dump(),
        "status": "active",
        "created_at": _now(),
        "updated_at": _now(),
    }
    _DEMO_SUPPLIERS.append(supplier)
    return SupplierOut(**supplier)


def update_supplier(supplier_id: int, payload: SupplierUpdate, company_id: int) -> SupplierOut | None:
    if _db_available():
        try:
            from db.database import get_db
            updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
            if not updates:
                return get_supplier(supplier_id, company_id)
            set_clause = ", ".join(f"{k} = %s" for k in updates)
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE suppliers SET {set_clause}, updated_at = now() "
                        f"WHERE id = %s AND company_id = %s RETURNING *",
                        list(updates.values()) + [supplier_id, company_id],
                    )
                    row = cur.fetchone()
                    return _row_to_supplier(row) if row else None
        except Exception as exc:
            logger.warning("update_supplier DB error: %s", exc)

    for s in _DEMO_SUPPLIERS:
        if s["id"] == supplier_id and s["company_id"] == company_id:
            for k, v in payload.model_dump(exclude_none=True).items():
                s[k] = v
            s["updated_at"] = _now()
            return SupplierOut(**s)
    return None


def delete_supplier(supplier_id: int, company_id: int) -> bool:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM suppliers WHERE id = %s AND company_id = %s",
                        (supplier_id, company_id),
                    )
                    return cur.rowcount > 0
        except Exception as exc:
            logger.warning("delete_supplier DB error: %s", exc)

    for i, s in enumerate(_DEMO_SUPPLIERS):
        if s["id"] == supplier_id and s["company_id"] == company_id:
            _DEMO_SUPPLIERS.pop(i)
            return True
    return False


# ---------------------------------------------------------------------------
# Questionnaire tokens
# ---------------------------------------------------------------------------

def create_token(
    supplier_id: int,
    company_id: int,
    payload: TokenCreate,
    base_url: str = "https://carbon-snowy-nine.vercel.app",
) -> TokenOut | None:
    """Generate a unique 64-char token for the public questionnaire."""
    supplier = get_supplier(supplier_id, company_id)
    if not supplier:
        return None

    token_hex = secrets.token_hex(32)  # 64 hex chars
    expires_at = _now() + timedelta(days=payload.expires_days)

    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO supplier_questionnaire_tokens
                            (supplier_id, company_id, token, campaign, expires_at)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING *
                        """,
                        (supplier_id, company_id, token_hex, payload.campaign, expires_at),
                    )
                    row = cur.fetchone()
                    return TokenOut(
                        **{k: row[k] for k in ("id","supplier_id","token","campaign","expires_at","used_at","created_at")},
                        url=f"{base_url}/q/{token_hex}",
                    )
        except Exception as exc:
            logger.warning("create_token DB error: %s", exc)

    # Demo fallback
    new_id = _DEMO_ID_COUNTER["token"]
    _DEMO_ID_COUNTER["token"] += 1
    tok = {
        "id": new_id,
        "supplier_id": supplier_id,
        "company_id": company_id,
        "token": token_hex,
        "campaign": payload.campaign,
        "expires_at": expires_at,
        "used_at": None,
        "created_at": _now(),
    }
    _DEMO_TOKENS.append(tok)
    return TokenOut(**tok, url=f"{base_url}/q/{token_hex}")


def list_tokens(supplier_id: int, company_id: int) -> list[TokenOut]:
    base_url = os.environ.get("FRONTEND_URL", "https://carbon-snowy-nine.vercel.app")
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM supplier_questionnaire_tokens "
                        "WHERE supplier_id = %s AND company_id = %s "
                        "ORDER BY created_at DESC",
                        (supplier_id, company_id),
                    )
                    rows = cur.fetchall()
                    return [
                        TokenOut(**{k: r[k] for k in ("id","supplier_id","token","campaign","expires_at","used_at","created_at")},
                                 url=f"{base_url}/q/{r['token']}")
                        for r in rows
                    ]
        except Exception as exc:
            logger.warning("list_tokens DB error: %s", exc)

    return [
        TokenOut(**{k: t[k] for k in ("id","supplier_id","token","campaign","expires_at","used_at","created_at")},
                 url=f"{base_url}/q/{t['token']}")
        for t in _DEMO_TOKENS
        if t["supplier_id"] == supplier_id and t["company_id"] == company_id
    ]


def resolve_token(token: str) -> dict[str, Any] | None:
    """Return token + supplier + company context for public questionnaire. No auth required.

    Utilise la fonction SECURITY DEFINER resolve_supplier_token() pour bypasser RLS :
    les endpoints publics /q/{token} n'ont pas de JWT, donc pas de company_id dans
    la session — une requête directe serait bloquée par les policies Phase 4.
    """
    if _db_available():
        try:
            from db.database import get_db
            # get_db() sans company_id — la fonction SECURITY DEFINER bypasse RLS
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM public.resolve_supplier_token(%s)",
                        (token,),
                    )
                    row = cur.fetchone()
                    return dict(row) if row else None
        except Exception as exc:
            logger.warning("resolve_token DB error: %s", exc)

    for t in _DEMO_TOKENS:
        if t["token"] == token:
            supplier = next((s for s in _DEMO_SUPPLIERS if s["id"] == t["supplier_id"]), None)
            if not supplier:
                return None
            return {
                **t,
                "supplier_name": supplier["name"],
                "company_name": "CarbonCo Demo",
            }
    return None


def submit_answer(token: str, payload: SupplierAnswerCreate) -> SupplierAnswerOut | None:
    """Submit questionnaire answer via public token."""
    ctx = resolve_token(token)
    if not ctx:
        return None

    expires_at = ctx.get("expires_at")
    if expires_at and _now() > expires_at:
        return None  # token expired

    if _db_available():
        try:
            from db.database import get_db
            # Passer company_id pour que RLS accepte l'INSERT (migration 008b active)
            with get_db(ctx["company_id"]) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO supplier_answers
                            (token_id, supplier_id, company_id, ghg_total_tco2e,
                             ghg_scope1, ghg_scope2, ghg_scope3, methodology,
                             reporting_year, has_sbti, has_iso14001, has_iso50001, narrative,
                             raw_json)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING *
                        """,
                        (
                            ctx["id"], ctx["supplier_id"], ctx["company_id"],
                            payload.ghg_total_tco2e, payload.ghg_scope1,
                            payload.ghg_scope2, payload.ghg_scope3,
                            payload.methodology, payload.reporting_year,
                            payload.has_sbti, payload.has_iso14001, payload.has_iso50001,
                            payload.narrative, payload.model_dump_json(),
                        ),
                    )
                    row = cur.fetchone()
                    # Mark token as used (même contexte RLS — company_id match garanti)
                    cur.execute(
                        "UPDATE supplier_questionnaire_tokens SET used_at = now() WHERE id = %s",
                        (ctx["id"],),
                    )
                    return SupplierAnswerOut(**{k: row[k] for k in SupplierAnswerOut.model_fields if k in row})
        except Exception as exc:
            logger.warning("submit_answer DB error: %s", exc)

    # Demo fallback
    new_id = _DEMO_ID_COUNTER["answer"]
    _DEMO_ID_COUNTER["answer"] += 1
    answer = {
        "id": new_id,
        "token_id": ctx["id"],
        "supplier_id": ctx["supplier_id"],
        "company_id": ctx["company_id"],
        **payload.model_dump(),
        "submitted_at": _now(),
    }
    _DEMO_ANSWERS.append(answer)
    # Mark token used
    for t in _DEMO_TOKENS:
        if t["token"] == token:
            t["used_at"] = _now()
            break
    return SupplierAnswerOut(**answer)


def get_answers(supplier_id: int, company_id: int) -> list[SupplierAnswerOut]:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM supplier_answers WHERE supplier_id = %s AND company_id = %s "
                        "ORDER BY submitted_at DESC",
                        (supplier_id, company_id),
                    )
                    rows = cur.fetchall()
                    return [
                        SupplierAnswerOut(**{k: r[k] for k in SupplierAnswerOut.model_fields if k in r})
                        for r in rows
                    ]
        except Exception as exc:
            logger.warning("get_answers DB error: %s", exc)

    return [
        SupplierAnswerOut(**{k: a[k] for k in SupplierAnswerOut.model_fields if k in a})
        for a in _DEMO_ANSWERS
        if a["supplier_id"] == supplier_id and a["company_id"] == company_id
    ]


# ---------------------------------------------------------------------------
# Scope 3 aggregation
# ---------------------------------------------------------------------------

def scope3_summary(company_id: int) -> dict[str, Any]:
    """Aggregate GHG estimates from supplier list for scope 3 dashboard."""
    suppliers, _ = list_suppliers(company_id, limit=200)
    total_ghg = sum(s.ghg_estimate_tco2e or 0 for s in suppliers)
    covered = sum(1 for s in suppliers if s.ghg_estimate_tco2e is not None)
    by_category: dict[str, float] = {}
    for s in suppliers:
        cat = s.scope3_category or "Autres"
        by_category[cat] = by_category.get(cat, 0) + (s.ghg_estimate_tco2e or 0)

    return {
        "total_suppliers": len(suppliers),
        "suppliers_with_ghg": covered,
        "total_ghg_tco2e": round(total_ghg, 2),
        "by_category": by_category,
        "top20": [
            {
                "id": s.id,
                "name": s.name,
                "ghg_estimate_tco2e": s.ghg_estimate_tco2e,
                "scope3_category": s.scope3_category,
                "country": s.country,
                "has_answer": False,  # enrichi côté router si besoin
            }
            for s in sorted(suppliers, key=lambda x: x.ghg_estimate_tco2e or 0, reverse=True)[:20]
        ],
    }
