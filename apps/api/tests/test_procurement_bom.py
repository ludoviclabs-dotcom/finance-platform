"""
test_procurement_bom.py — BOM versionnées + correspondances matières (PR-05A).

PUR : validation de l'arbre (parent_index) sans DB.
DB-gated : création d'un arbre BOM (self-FK), drill-down, mapping matières +
gate de revue, unicité de version, isolation tenant.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available
from models.procurement import (
    BomItemCreate,
    BomVersionCreate,
    MaterialMappingCreate,
)
from services.procurement import bom_service

from ._procurement_fixtures import insert_product, insert_supplier

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


# ── Pur : validation de l'arbre (lève AVANT tout accès DB) ───────────────────

class TestBomTreeValidationPure:
    def test_parent_index_referencing_itself_rejected(self):
        with pytest.raises(bom_service.BomError):
            bom_service.create_bom(
                company_id=1, product_id=1,
                payload=BomVersionCreate(
                    version="v1", items=[BomItemCreate(component_code="A", parent_index=0)],
                ),
            )

    def test_parent_index_forward_reference_rejected(self):
        with pytest.raises(bom_service.BomError):
            bom_service.create_bom(
                company_id=1, product_id=1,
                payload=BomVersionCreate(
                    version="v1",
                    items=[
                        BomItemCreate(component_code="A", parent_index=1),  # référence un item futur
                        BomItemCreate(component_code="B"),
                    ],
                ),
            )


# ── DB-gated : arbre BOM, mapping matières, gate, isolation ──────────────────

@_skip_no_db_url
@_skip_no_psycopg2
class TestBomDb:
    def _tree_payload(self, version: str) -> BomVersionCreate:
        return BomVersionCreate(
            version=version,
            status="active",
            items=[
                BomItemCreate(component_code="ROOT", component_name="Assemblage", quantity=1, unit="pcs"),
                BomItemCreate(component_code="CHILD1", quantity=2, unit="kg", parent_index=0),
                BomItemCreate(component_code="CHILD2", quantity=3, unit="kg", parent_index=0),
            ],
        )

    def test_create_bom_tree_and_drilldown(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        product_id = insert_product(cid_a, "Produit BOM")
        version = bom_service.create_bom(
            company_id=cid_a, product_id=product_id, payload=self._tree_payload("v1"),
        )
        assert version.status == "active"

        detail = bom_service.get_bom(company_id=cid_a, product_id=product_id, version="v1")
        assert len(detail.items) == 3
        root = next(i for i in detail.items if i.component_code == "ROOT")
        children = [i for i in detail.items if i.component_code in ("CHILD1", "CHILD2")]
        assert all(c.parent_item_id == root.id for c in children)
        assert root.parent_item_id is None

    def test_duplicate_version_rejected(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        product_id = insert_product(cid_a, "Produit dup")
        bom_service.create_bom(company_id=cid_a, product_id=product_id, payload=self._tree_payload("v1"))
        with pytest.raises(bom_service.BomError):
            bom_service.create_bom(company_id=cid_a, product_id=product_id, payload=self._tree_payload("v1"))

    def test_unknown_product_rejected(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        with pytest.raises(bom_service.BomError):
            bom_service.create_bom(
                company_id=cid_a, product_id=999_999_999, payload=self._tree_payload("v1"),
            )

    def test_map_materials_and_review_gate(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        product_id = insert_product(cid_a, "Produit mapping")
        bom_service.create_bom(company_id=cid_a, product_id=product_id, payload=self._tree_payload("v1"))
        detail = bom_service.get_bom(company_id=cid_a, product_id=product_id, version="v1")
        child = next(i for i in detail.items if i.component_code == "CHILD1")

        mappings = bom_service.map_materials(
            company_id=cid_a, product_id=product_id, version="v1",
            mappings=[
                MaterialMappingCreate(
                    bom_item_id=child.id, material_id="steel", mass_value=2.0, mass_unit="kg",
                    mapping_method="manual", confidence=0.8,
                ),
            ],
        )
        assert len(mappings) == 1
        m = mappings[0]
        assert m.review_status == "pending"  # revue humaine requise
        assert m.confidence == 0.8  # confidence SÉPARÉ du statut

        accepted = bom_service.review_mapping(company_id=cid_a, mapping_id=m.id, accept=True)
        assert accepted.review_status == "accepted"

    def test_map_materials_unknown_item_rejected(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        product_id = insert_product(cid_a, "Produit bad item")
        bom_service.create_bom(company_id=cid_a, product_id=product_id, payload=self._tree_payload("v1"))
        with pytest.raises(bom_service.BomError):
            bom_service.map_materials(
                company_id=cid_a, product_id=product_id, version="v1",
                mappings=[MaterialMappingCreate(bom_item_id=999_999_999, material_id="x")],
            )

    def test_tenant_isolation_bom_not_visible_to_other(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        product_id = insert_product(cid_a, "Produit secret")
        bom_service.create_bom(company_id=cid_a, product_id=product_id, payload=self._tree_payload("v1"))
        with pytest.raises(bom_service.BomError):
            bom_service.get_bom(company_id=cid_b, product_id=product_id, version="v1")

    def test_supplier_product_out_of_scope_in_item_rejected(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        product_id = insert_product(cid_a, "Produit fk")
        # Un item référençant un supplier_product inexistant/hors périmètre est refusé.
        insert_supplier(cid_a, "Sup fk")
        with pytest.raises(bom_service.BomError):
            bom_service.create_bom(
                company_id=cid_a, product_id=product_id,
                payload=BomVersionCreate(
                    version="vX",
                    items=[BomItemCreate(component_code="C", supplier_product_id=999_999_999)],
                ),
            )
