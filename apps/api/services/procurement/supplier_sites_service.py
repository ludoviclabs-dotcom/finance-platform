"""
supplier_sites_service.py — CRUD sites & produits fournisseurs (PR-05A).

Étend le module fournisseurs existant (`supplier_service`) sans le réinventer :
un site / un produit fournisseur est toujours rattaché à un `suppliers.id` du
même tenant. Défense en profondeur (contrats §7) : chaque requête porte son
prédicat de périmètre explicite EN PLUS de la RLS gen-2 de la migration 030 —
les tables procurement sont à portée tenant stricte (`company_id NOT NULL`,
aucune ligne globale), donc le prédicat de lecture est `company_id = %s`.
"""

from __future__ import annotations

from db.database import get_db
from models.procurement import (
    SupplierProductCreate,
    SupplierProductResponse,
    SupplierSiteCreate,
    SupplierSiteResponse,
)

# Portée tenant stricte (pas de ligne globale sur ces tables) : lecture ET
# écriture scopées au tenant.
_SCOPE = "company_id = %s"


class SupplierSitesError(Exception):
    """Erreur métier des sites / produits fournisseurs (fournisseur hors périmètre…)."""


def _assert_supplier_in_scope(cur, company_id: int, supplier_id: int) -> None:
    """Le fournisseur doit exister ET appartenir au tenant. `suppliers` est en
    RLS gen-1 (008b) ; on double la garde ici (anti-IDOR) — un tenant ne
    rattache jamais un site/produit à un fournisseur d'un autre tenant."""
    cur.execute(
        "SELECT 1 FROM suppliers WHERE id = %s AND company_id = %s",
        (supplier_id, company_id),
    )
    if cur.fetchone() is None:
        raise SupplierSitesError(f"Fournisseur '{supplier_id}' introuvable ou hors périmètre.")


# ---------------------------------------------------------------------------
# Sites
# ---------------------------------------------------------------------------

def create_site(
    *, company_id: int, supplier_id: int, payload: SupplierSiteCreate, created_by: int | None = None,
) -> SupplierSiteResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_supplier_in_scope(cur, company_id, supplier_id)
            cur.execute(
                """
                INSERT INTO supplier_sites
                    (company_id, supplier_id, name, address, country_code, latitude, longitude, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, supplier_id, payload.name, payload.address,
                    payload.country_code, payload.latitude, payload.longitude, created_by,
                ),
            )
            row = cur.fetchone()
    return SupplierSiteResponse(**row)


def list_sites(
    *, company_id: int, supplier_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[SupplierSiteResponse], int]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM supplier_sites WHERE {_SCOPE} AND supplier_id = %s",
                (company_id, supplier_id),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM supplier_sites WHERE {_SCOPE} AND supplier_id = %s "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (company_id, supplier_id, limit, offset),
            )
            rows = cur.fetchall()
    return [SupplierSiteResponse(**r) for r in rows], total


def get_site(*, company_id: int, site_id: int) -> SupplierSiteResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM supplier_sites WHERE id = %s AND {_SCOPE}", (site_id, company_id))
            row = cur.fetchone()
    if row is None:
        raise SupplierSitesError(f"Site '{site_id}' introuvable.")
    return SupplierSiteResponse(**row)


# ---------------------------------------------------------------------------
# Produits fournisseurs
# ---------------------------------------------------------------------------

def create_product(
    *, company_id: int, supplier_id: int, payload: SupplierProductCreate, created_by: int | None = None,
) -> SupplierProductResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_supplier_in_scope(cur, company_id, supplier_id)
            if payload.manufacturing_site_id is not None:
                cur.execute(
                    f"SELECT 1 FROM supplier_sites WHERE id = %s AND {_SCOPE}",
                    (payload.manufacturing_site_id, company_id),
                )
                if cur.fetchone() is None:
                    raise SupplierSitesError(
                        f"Site de fabrication '{payload.manufacturing_site_id}' introuvable ou hors périmètre."
                    )
            cur.execute(
                """
                INSERT INTO supplier_products
                    (company_id, supplier_id, product_code, product_name, category_code,
                     origin_country, manufacturing_site_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, supplier_id, product_code) DO NOTHING
                RETURNING *
                """,
                (
                    company_id, supplier_id, payload.product_code, payload.product_name,
                    payload.category_code, payload.origin_country, payload.manufacturing_site_id,
                    created_by,
                ),
            )
            row = cur.fetchone()
    if row is None:
        raise SupplierSitesError(
            f"Code produit déjà utilisé pour ce fournisseur : '{payload.product_code}'."
        )
    return SupplierProductResponse(**row)


def list_products(
    *, company_id: int, supplier_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[SupplierProductResponse], int]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM supplier_products WHERE {_SCOPE} AND supplier_id = %s",
                (company_id, supplier_id),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM supplier_products WHERE {_SCOPE} AND supplier_id = %s "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (company_id, supplier_id, limit, offset),
            )
            rows = cur.fetchall()
    return [SupplierProductResponse(**r) for r in rows], total


def get_product(*, company_id: int, product_id: int) -> SupplierProductResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM supplier_products WHERE id = %s AND {_SCOPE}", (product_id, company_id))
            row = cur.fetchone()
    if row is None:
        raise SupplierSitesError(f"Produit fournisseur '{product_id}' introuvable.")
    return SupplierProductResponse(**row)
