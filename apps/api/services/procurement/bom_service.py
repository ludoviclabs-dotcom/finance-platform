"""
bom_service.py — nomenclatures (BOM) versionnées + correspondances matières (PR-05A).

Une BOM est rattachée à un produit interne (`products`, DPP) et peut citer une
pièce de preuve (`evidence_artifacts`, 028). Ses items forment un arbre
(`parent_item_id` self-FK) ; à la création, l'arbre est décrit par des index
relatifs (`parent_index`) résolus en ids serveur en un seul passage ordonné
(parents avant enfants). Les correspondances matières (`material_mappings`)
gardent `confidence` (0-1) SÉPARÉ du `review_status` (contrats §2). Un mapping
`ai_draft` est un point d'ancrage pour de futures suggestions IA REVUES — jamais
une décision automatique (aucun LLM ici).
"""

from __future__ import annotations

from db.database import get_db
from models.procurement import (
    BomItemResponse,
    BomVersionCreate,
    BomVersionDetail,
    BomVersionResponse,
    MaterialMappingCreate,
    MaterialMappingResponse,
)

_SCOPE = "company_id = %s"
# Un artefact de preuve peut être global (company_id IS NULL) ou tenant.
_ARTIFACT_SCOPE = "(company_id = %s OR company_id IS NULL)"


class BomError(Exception):
    """Erreur métier des BOM / correspondances matières (produit hors périmètre…)."""


def _assert_product_in_scope(cur, company_id: int, product_id: int) -> None:
    cur.execute("SELECT 1 FROM products WHERE id = %s AND company_id = %s", (product_id, company_id))
    if cur.fetchone() is None:
        raise BomError(f"Produit '{product_id}' introuvable ou hors périmètre.")


def create_bom(
    *, company_id: int, product_id: int, payload: BomVersionCreate, created_by: int | None = None,
) -> BomVersionResponse:
    # Validation de l'arbre AVANT toute écriture : un parent doit précéder son
    # enfant dans la liste (parent_index < index courant) — pas de cycle possible.
    for idx, item in enumerate(payload.items):
        if item.parent_index is not None and not (0 <= item.parent_index < idx):
            raise BomError(
                f"Item {idx} : parent_index {item.parent_index} invalide "
                "(doit référencer un item antérieur de la liste)."
            )

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_product_in_scope(cur, company_id, product_id)
            if payload.source_artifact_id is not None:
                cur.execute(
                    f"SELECT 1 FROM evidence_artifacts WHERE id = %s AND {_ARTIFACT_SCOPE}",
                    (payload.source_artifact_id, company_id),
                )
                if cur.fetchone() is None:
                    raise BomError(
                        f"Artefact de preuve '{payload.source_artifact_id}' introuvable ou hors périmètre."
                    )
            cur.execute(
                """
                INSERT INTO bom_versions
                    (company_id, product_id, version, valid_from, valid_to, status, source_artifact_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, product_id, version) DO NOTHING
                RETURNING *
                """,
                (
                    company_id, product_id, payload.version, payload.valid_from, payload.valid_to,
                    payload.status, payload.source_artifact_id, created_by,
                ),
            )
            version_row = cur.fetchone()
            if version_row is None:
                raise BomError(
                    f"Version BOM '{payload.version}' déjà existante pour le produit {product_id}."
                )
            bom_version_id = version_row["id"]

            item_ids: list[int] = []
            for item in payload.items:
                parent_id = item_ids[item.parent_index] if item.parent_index is not None else None
                if item.supplier_product_id is not None:
                    cur.execute(
                        f"SELECT 1 FROM supplier_products WHERE id = %s AND {_SCOPE}",
                        (item.supplier_product_id, company_id),
                    )
                    if cur.fetchone() is None:
                        raise BomError(
                            f"Produit fournisseur '{item.supplier_product_id}' introuvable ou hors périmètre."
                        )
                cur.execute(
                    """
                    INSERT INTO bom_items
                        (company_id, bom_version_id, parent_item_id, component_code, component_name,
                         quantity, unit, supplier_id, supplier_product_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        company_id, bom_version_id, parent_id, item.component_code, item.component_name,
                        item.quantity, item.unit, item.supplier_id, item.supplier_product_id,
                    ),
                )
                item_ids.append(cur.fetchone()["id"])
    return BomVersionResponse(**version_row)


def list_boms(
    *, company_id: int, product_id: int, limit: int = 50, offset: int = 0,
) -> tuple[list[BomVersionResponse], int]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM bom_versions WHERE {_SCOPE} AND product_id = %s",
                (company_id, product_id),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM bom_versions WHERE {_SCOPE} AND product_id = %s "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (company_id, product_id, limit, offset),
            )
            rows = cur.fetchall()
    return [BomVersionResponse(**r) for r in rows], total


def get_bom(*, company_id: int, product_id: int, version: str) -> BomVersionDetail:
    """Version BOM + son arbre d'items (ordre d'id = parents avant enfants,
    l'arbre est reconstructible côté client via `parent_item_id`)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM bom_versions WHERE {_SCOPE} AND product_id = %s AND version = %s",
                (company_id, product_id, version),
            )
            version_row = cur.fetchone()
            if version_row is None:
                raise BomError(f"Version BOM '{version}' introuvable pour le produit {product_id}.")
            cur.execute(
                f"SELECT * FROM bom_items WHERE {_SCOPE} AND bom_version_id = %s ORDER BY id",
                (company_id, version_row["id"]),
            )
            items = cur.fetchall()
    return BomVersionDetail(
        version=BomVersionResponse(**version_row),
        items=[BomItemResponse(**i) for i in items],
    )


def _resolve_version_id(cur, company_id: int, product_id: int, version: str) -> int:
    cur.execute(
        f"SELECT id FROM bom_versions WHERE {_SCOPE} AND product_id = %s AND version = %s",
        (company_id, product_id, version),
    )
    row = cur.fetchone()
    if row is None:
        raise BomError(f"Version BOM '{version}' introuvable pour le produit {product_id}.")
    return row["id"]


def map_materials(
    *,
    company_id: int,
    product_id: int,
    version: str,
    mappings: list[MaterialMappingCreate],
    reviewed_by: int | None = None,
) -> list[MaterialMappingResponse]:
    """Rattache des matières aux items d'une version BOM. Chaque `bom_item_id`
    doit appartenir à cette version et au tenant. `review_status` naît `pending`
    (revue humaine avant tout usage aval). `confidence` reste séparé du statut."""
    created: list[MaterialMappingResponse] = []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            bom_version_id = _resolve_version_id(cur, company_id, product_id, version)
            for m in mappings:
                cur.execute(
                    f"SELECT 1 FROM bom_items WHERE id = %s AND {_SCOPE} AND bom_version_id = %s",
                    (m.bom_item_id, company_id, bom_version_id),
                )
                if cur.fetchone() is None:
                    raise BomError(
                        f"Item BOM '{m.bom_item_id}' introuvable dans la version {version}."
                    )
                cur.execute(
                    """
                    INSERT INTO material_mappings
                        (company_id, bom_item_id, material_id, mass_value, mass_unit, mass_fraction,
                         mapping_method, confidence)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        company_id, m.bom_item_id, m.material_id, m.mass_value, m.mass_unit,
                        m.mass_fraction, m.mapping_method, m.confidence,
                    ),
                )
                created.append(MaterialMappingResponse(**cur.fetchone()))
    return created


def list_mappings(
    *, company_id: int, bom_item_id: int,
) -> list[MaterialMappingResponse]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM material_mappings WHERE {_SCOPE} AND bom_item_id = %s ORDER BY id",
                (company_id, bom_item_id),
            )
            rows = cur.fetchall()
    return [MaterialMappingResponse(**r) for r in rows]


def review_mapping(
    *, company_id: int, mapping_id: int, accept: bool, reviewed_by: int | None = None,
) -> MaterialMappingResponse:
    """Gate de revue d'un mapping matière : `pending` → `accepted` / `flagged`."""
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE material_mappings SET review_status = %s, reviewed_by = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, reviewed_by, mapping_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise BomError(f"Correspondance matière '{mapping_id}' introuvable.")
    return MaterialMappingResponse(**row)

# Note d'ancrage (aucune logique IA en PR-05A) : `mapping_method='ai_draft'` est
# le point d'entrée réservé aux futures suggestions IA REVUES du mapping produit↔
# matière (PR-11) — une suggestion DRAFT resterait `review_status='pending'`
# jusqu'à validation humaine, jamais un mapping décidé automatiquement.
