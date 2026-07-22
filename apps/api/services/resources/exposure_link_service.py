"""
exposure_link_service.py — pont d'exposition tenant vers un objet EXISTANT (D-1).

Tenant strict. Relie une ressource à un `bom_item`/`purchase_line`/
`energy_activity`/`water_activity`/`supplier_declaration` ou une saisie manuelle.
Anti-IDOR : la cible référencée est vérifiée appartenir au tenant AVANT insertion
(motif `exposure_service._assert_in_scope`, CRMA) — jamais lier l'objet d'un
autre tenant, jamais fuiter son existence. **D-4 : ne stocke ni ne recalcule
aucun facteur carbone** — l'empreinte est lue depuis le module cible.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.resources import (
    ResourceExposureLinkCreate,
    ResourceExposureLinkListResponse,
    ResourceExposureLinkResponse,
)
from services.resources import catalog_service

# Table + colonne portant l'id, par type de lien (toutes ont company_id).
_LINK_TARGETS: dict[str, tuple[str, str]] = {
    "bom_item": ("bom_items", "bom_item_id"),
    "purchase_line": ("purchase_lines", "purchase_line_id"),
    "energy_activity": ("energy_activities", "energy_activity_id"),
    "water_activity": ("water_activities", "water_activity_id"),
    "supplier_declaration": ("supplier_metric_declarations", "supplier_declaration_id"),
}


class ResourceExposureError(Exception):
    """Erreur métier du pont d'exposition (introuvable, cible requise/incohérente…)."""


def _target_id(payload: ResourceExposureLinkCreate) -> int | None:
    if payload.link_kind == "manual":
        return None
    return getattr(payload, _LINK_TARGETS[payload.link_kind][1])


def _linked_ref(row: dict[str, Any]) -> str | None:
    for kind, (_table, col) in _LINK_TARGETS.items():
        if row.get(col) is not None:
            return f"{kind}:{row[col]}"
    if row.get("link_kind") == "manual":
        return "manual"
    return None


def _response(row: dict[str, Any], *, resource_slug: str | None = None) -> ResourceExposureLinkResponse:
    return ResourceExposureLinkResponse(
        id=row["id"], company_id=row["company_id"], resource_id=row["resource_id"],
        resource_slug=resource_slug, role=row["role"], link_kind=row["link_kind"],
        linked_ref=_linked_ref(row),
        annual_mass_kg=float(row["annual_mass_kg"]) if row["annual_mass_kg"] is not None else None,
        annual_spend_eur=float(row["annual_spend_eur"]) if row["annual_spend_eur"] is not None else None,
        share_of_supply_pct=float(row["share_of_supply_pct"]) if row["share_of_supply_pct"] is not None else None,
        stock_coverage_days=float(row["stock_coverage_days"]) if row["stock_coverage_days"] is not None else None,
        data_status=row["data_status"], created_at=row["created_at"],
    )


def create_link(
    *, company_id: int, payload: ResourceExposureLinkCreate, created_by: int | None = None
) -> ResourceExposureLinkResponse:
    target_id = _target_id(payload)
    if payload.link_kind != "manual" and target_id is None:
        raise ResourceExposureError(
            f"Un lien '{payload.link_kind}' requiert l'identifiant de sa cible."
        )
    if payload.link_kind == "manual" and not payload.manual_note:
        raise ResourceExposureError("Un lien 'manual' requiert une note (manual_note).")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = catalog_service.resolve_resource(
                cur, company_id=company_id, slug=payload.resource_slug
            )
            # Anti-IDOR : la cible doit appartenir au tenant.
            if payload.link_kind != "manual":
                table, _col = _LINK_TARGETS[payload.link_kind]
                cur.execute(
                    f"SELECT 1 FROM {table} WHERE id = %s AND company_id = %s",
                    (target_id, company_id),
                )
                if cur.fetchone() is None:
                    raise ResourceExposureError(
                        f"Cible {payload.link_kind}:{target_id} introuvable pour ce tenant."
                    )
            cur.execute(
                """
                INSERT INTO company_resource_exposure_links
                    (company_id, resource_id, role, link_kind, bom_item_id, purchase_line_id,
                     energy_activity_id, water_activity_id, supplier_declaration_id, manual_note,
                     annual_mass_kg, annual_spend_eur, share_of_supply_pct, stock_coverage_days,
                     data_status, confidence, notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, resource["id"], payload.role, payload.link_kind,
                    payload.bom_item_id, payload.purchase_line_id, payload.energy_activity_id,
                    payload.water_activity_id, payload.supplier_declaration_id, payload.manual_note,
                    payload.annual_mass_kg, payload.annual_spend_eur, payload.share_of_supply_pct,
                    payload.stock_coverage_days, payload.data_status, payload.confidence,
                    payload.notes, created_by,
                ),
            )
            row = cur.fetchone()
    return _response(row, resource_slug=payload.resource_slug)


def list_links(
    *, company_id: int, slug: str | None = None, link_kind: str | None = None,
    role: str | None = None, limit: int = 50, offset: int = 0,
) -> ResourceExposureLinkListResponse:
    clauses = ["l.company_id = %s"]
    params: list[Any] = [company_id]
    if slug:
        clauses.append("c.slug = %s")
        params.append(slug)
    if link_kind:
        clauses.append("l.link_kind = %s")
        params.append(link_kind)
    if role:
        clauses.append("l.role = %s")
        params.append(role)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT COUNT(*) AS n FROM company_resource_exposure_links l
                    JOIN resource_catalog c ON c.id = l.resource_id WHERE {where}""",
                params,
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT l.*, c.slug AS resource_slug FROM company_resource_exposure_links l
                JOIN resource_catalog c ON c.id = l.resource_id
                WHERE {where} ORDER BY l.id DESC LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_response(r, resource_slug=r.get("resource_slug")) for r in cur.fetchall()]
    return ResourceExposureLinkListResponse(items=items, total=total, limit=limit, offset=offset)


def supplier_shares(cur, *, company_id: int, resource_id: int) -> list[float]:
    """Parts d'approvisionnement (share_of_supply_pct) des liens du tenant — entrée
    du HHI fournisseurs. Prédicat de périmètre explicite (défense en profondeur)."""
    cur.execute(
        """
        SELECT share_of_supply_pct FROM company_resource_exposure_links
        WHERE company_id = %s AND resource_id = %s AND share_of_supply_pct IS NOT NULL
        """,
        (company_id, resource_id),
    )
    return [float(r["share_of_supply_pct"]) for r in cur.fetchall()]


def min_stock_days(cur, *, company_id: int, resource_id: int) -> float | None:
    """Couverture de stock la plus FAIBLE déclarée (le maillon le plus tendu)."""
    cur.execute(
        """
        SELECT MIN(stock_coverage_days) AS d FROM company_resource_exposure_links
        WHERE company_id = %s AND resource_id = %s AND stock_coverage_days IS NOT NULL
        """,
        (company_id, resource_id),
    )
    row = cur.fetchone()
    return float(row["d"]) if row and row["d"] is not None else None
