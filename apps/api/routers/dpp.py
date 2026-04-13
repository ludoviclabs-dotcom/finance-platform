"""Routes pour les fiches DPP (Digital Product Passport / ESPR)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.database import db_available, get_db
from db.tenant import get_company_id
from routers.auth import require_analyst

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ProductBase(BaseModel):
    name: str
    sku: str | None = None
    sector: str | None = None
    pcf_kgco2e: float | None = None
    recyclability_pct: float | None = None
    lifespan_years: float | None = None
    supply_chain: dict[str, Any] | None = None
    espr_status: str = "pending"


class ProductCreate(ProductBase):
    pass


class ProductPatch(BaseModel):
    name: str | None = None
    sku: str | None = None
    sector: str | None = None
    pcf_kgco2e: float | None = None
    recyclability_pct: float | None = None
    lifespan_years: float | None = None
    supply_chain: dict[str, Any] | None = None
    espr_status: str | None = None


class ProductOut(ProductBase):
    id: int
    company_id: int
    created_at: str
    updated_at: str


_VALID_ESPR = {"pending", "eligible", "compliant", "non_compliant"}

# ---------------------------------------------------------------------------
# In-memory fallback (mode /tmp, sans PostgreSQL)
# ---------------------------------------------------------------------------

_MEM_PRODUCTS: list[dict[str, Any]] = []
_MEM_NEXT_ID = 1


def _mem_list(company_id: int) -> list[dict]:
    return [p for p in _MEM_PRODUCTS if p["company_id"] == company_id]


def _mem_get(pid: int, company_id: int) -> dict | None:
    return next((p for p in _MEM_PRODUCTS if p["id"] == pid and p["company_id"] == company_id), None)


def _mem_create(data: dict) -> dict:
    global _MEM_NEXT_ID
    now = "2024-01-01T00:00:00Z"
    rec = {**data, "id": _MEM_NEXT_ID, "created_at": now, "updated_at": now}
    _MEM_PRODUCTS.append(rec)
    _MEM_NEXT_ID += 1
    return rec


def _mem_patch(pid: int, patch: dict) -> dict | None:
    for i, p in enumerate(_MEM_PRODUCTS):
        if p["id"] == pid:
            _MEM_PRODUCTS[i] = {**p, **{k: v for k, v in patch.items() if v is not None}}
            return _MEM_PRODUCTS[i]
    return None


def _mem_delete(pid: int, company_id: int) -> bool:
    global _MEM_PRODUCTS
    before = len(_MEM_PRODUCTS)
    _MEM_PRODUCTS = [p for p in _MEM_PRODUCTS if not (p["id"] == pid and p["company_id"] == company_id)]
    return len(_MEM_PRODUCTS) < before


# ---------------------------------------------------------------------------
# Helpers DB
# ---------------------------------------------------------------------------

def _row_to_dict(row: tuple, keys: list[str]) -> dict:
    return dict(zip(keys, row))


_COLS = ["id", "company_id", "name", "sku", "sector", "pcf_kgco2e",
         "recyclability_pct", "lifespan_years", "supply_chain", "espr_status",
         "created_at", "updated_at"]

_SELECT = f"SELECT {', '.join(_COLS)} FROM products"


def _row(row: tuple) -> dict:
    d = _row_to_dict(row, _COLS)
    # Convert datetimes and Decimal to JSON-serializable types
    for k in ("created_at", "updated_at"):
        if d[k] is not None:
            d[k] = str(d[k])
    for k in ("pcf_kgco2e", "recyclability_pct", "lifespan_years"):
        if d[k] is not None:
            d[k] = float(d[k])
    return d


# ---------------------------------------------------------------------------
# GET /dpp/products
# ---------------------------------------------------------------------------


@router.get("/products")
def list_products(
    company_id: int = Depends(get_company_id),
) -> list[dict]:
    if not db_available():
        return _mem_list(company_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"{_SELECT} WHERE company_id = %s ORDER BY created_at DESC", (company_id,))
            return [_row(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# POST /dpp/products
# ---------------------------------------------------------------------------


@router.post("/products", status_code=201)
def create_product(
    body: ProductCreate,
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> dict:
    if body.espr_status not in _VALID_ESPR:
        raise HTTPException(400, f"espr_status invalide. Valeurs acceptées : {sorted(_VALID_ESPR)}")

    if not db_available():
        return _mem_create({"company_id": company_id, **body.model_dump()})

    with get_db() as conn:
        with conn.cursor() as cur:
            import json as _json
            cur.execute(
                """INSERT INTO products
                   (company_id, name, sku, sector, pcf_kgco2e, recyclability_pct,
                    lifespan_years, supply_chain, espr_status)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   RETURNING """ + ", ".join(_COLS),
                (
                    company_id,
                    body.name,
                    body.sku,
                    body.sector,
                    body.pcf_kgco2e,
                    body.recyclability_pct,
                    body.lifespan_years,
                    _json.dumps(body.supply_chain) if body.supply_chain else None,
                    body.espr_status,
                ),
            )
            return _row(cur.fetchone())


# ---------------------------------------------------------------------------
# GET /dpp/products/{product_id}
# ---------------------------------------------------------------------------


@router.get("/products/{product_id}")
def get_product(
    product_id: int,
    company_id: int = Depends(get_company_id),
) -> dict:
    if not db_available():
        p = _mem_get(product_id, company_id)
        if not p:
            raise HTTPException(404, "Produit introuvable")
        return p

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"{_SELECT} WHERE id = %s AND company_id = %s", (product_id, company_id))
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Produit introuvable")
    return _row(row)


# ---------------------------------------------------------------------------
# PATCH /dpp/products/{product_id}
# ---------------------------------------------------------------------------


@router.patch("/products/{product_id}")
def patch_product(
    product_id: int,
    body: ProductPatch,
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> dict:
    if body.espr_status and body.espr_status not in _VALID_ESPR:
        raise HTTPException(400, f"espr_status invalide. Valeurs acceptées : {sorted(_VALID_ESPR)}")

    if not db_available():
        p = _mem_patch(product_id, body.model_dump(exclude_none=True))
        if not p:
            raise HTTPException(404, "Produit introuvable")
        return p

    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    import json as _json

    set_clauses = []
    values = []
    for field, val in patch.items():
        set_clauses.append(f"{field} = %s")
        values.append(_json.dumps(val) if field == "supply_chain" and isinstance(val, dict) else val)

    set_clauses.append("updated_at = now()")
    values.extend([product_id, company_id])

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE products SET {', '.join(set_clauses)} "
                f"WHERE id = %s AND company_id = %s "
                f"RETURNING {', '.join(_COLS)}",
                values,
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Produit introuvable")
    return _row(row)


# ---------------------------------------------------------------------------
# DELETE /dpp/products/{product_id}
# ---------------------------------------------------------------------------


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    company_id: int = Depends(get_company_id),
    _: Any = Depends(require_analyst),
) -> None:
    if not db_available():
        if not _mem_delete(product_id, company_id):
            raise HTTPException(404, "Produit introuvable")
        return

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM products WHERE id = %s AND company_id = %s RETURNING id",
                (product_id, company_id),
            )
            if not cur.fetchone():
                raise HTTPException(404, "Produit introuvable")
