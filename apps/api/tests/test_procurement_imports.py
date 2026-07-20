"""
test_procurement_imports.py — imports d'achats (PR-05A).

Deux niveaux :
  - PUR (jamais skippé) : parse CSV (délimiteurs, colonnes tolérantes, dates) et
    logique d'idempotence SHA-256 (même contenu → même hash).
  - DB-gated : import idempotent par contenu (re-run = aucun doublon), mapping
    automatique conservateur, file de résolution, gate de revue, isolation tenant.
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.procurement import LineResolution, SupplierProductCreate
from services.procurement import purchase_import_service as pis
from services.procurement import supplier_sites_service

from ._procurement_fixtures import insert_supplier, insert_supplier_product

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


_CSV_COMMA = (
    "supplier_code,product_code,date,quantity,unit,amount,currency,category,country\n"
    "SUP1,PRD-100,2026-01-15,10,kg,1500,EUR,C1,FR\n"
    "SUP1,PRD-999,2026-02-01,5,unit,800,EUR,C1,DE\n"
    "SUP2,,2026-03-01,,,,,C1,FR\n"
)

_CSV_SEMICOLON = (
    "fournisseur;produit;date;quantité;unité;montant;devise\n"
    "SUP-A;REF-1;15/01/2026;3;kg;450;EUR\n"
)


def _csv(tag: str) -> str:
    """CSV d'achats dont le CONTENU varie par `tag` (le sha256 diffère donc entre
    tests) tout en gardant une structure identique : 3 lignes — PRD-100 (mappable
    si le produit existe), PRD-999 (non mappable), et une ligne sans activité."""
    return (
        "supplier_code,product_code,date,quantity,unit,amount,currency,category,country\n"
        f"{tag}-SUP1,PRD-100,2026-01-15,10,kg,1500,EUR,C1,FR\n"
        f"{tag}-SUP1,PRD-999,2026-02-01,5,unit,800,EUR,C1,DE\n"
        f"{tag}-SUP2,,2026-03-01,,,,,C1,FR\n"
    )


# ── Pur : parse + sha256 (aucune DB) ─────────────────────────────────────────

class TestPurchaseCsvParsePure:
    def test_parse_comma_delimited(self):
        rows = pis.parse_purchase_csv(_CSV_COMMA.encode("utf-8"))
        assert len(rows) == 3
        first = rows[0]
        assert first["supplier_external_code"] == "SUP1"
        assert first["product_external_code"] == "PRD-100"
        assert first["quantity"] == 10.0
        assert first["spend_amount"] == 1500.0
        assert first["currency"] == "EUR"
        assert str(first["purchase_date"]) == "2026-01-15"

    def test_parse_semicolon_delimited_and_fr_date(self):
        rows = pis.parse_purchase_csv(_CSV_SEMICOLON.encode("utf-8"))
        assert len(rows) == 1
        assert rows[0]["product_external_code"] == "REF-1"
        assert rows[0]["spend_amount"] == 450.0
        assert str(rows[0]["purchase_date"]) == "2026-01-15"  # 15/01/2026 → ISO

    def test_parse_row_without_activity_keeps_none(self):
        rows = pis.parse_purchase_csv(_CSV_COMMA.encode("utf-8"))
        third = rows[2]
        assert third["spend_amount"] is None
        assert third["quantity"] is None
        assert third["product_external_code"] is None

    def test_sha256_same_content_same_hash(self):
        a = pis.content_sha256(_CSV_COMMA.encode("utf-8"))
        b = pis.content_sha256(_CSV_COMMA.encode("utf-8"))
        assert a == b and len(a) == 64

    def test_sha256_different_content_different_hash(self):
        assert pis.content_sha256(b"one") != pis.content_sha256(b"two")


# ── DB-gated : import idempotent + mapping + gate + résolution ───────────────

@_skip_no_db_url
@_skip_no_psycopg2
class TestPurchaseImportDb:
    def _import(self, cid: int, tag: str, filename: str = "achats.csv"):
        return pis.create_import(company_id=cid, filename=filename, content=_csv(tag).encode("utf-8"))

    def test_import_creates_lines_and_counts(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        sup = insert_supplier(cid_a, "SUP1 SA")
        # PRD-100 existe → la ligne 1 doit être auto-mappée.
        supplier_sites_service.create_product(
            company_id=cid_a, supplier_id=sup, payload=SupplierProductCreate(product_code="PRD-100"),
        )
        imp = self._import(cid_a, "counts")
        assert imp.already_imported is False
        assert imp.row_count == 3
        assert imp.accepted_count == 2  # 2 lignes avec montant/quantité
        assert imp.rejected_count == 1  # 1 ligne sans donnée d'activité

        mapped, mapped_total = pis.list_lines(company_id=cid_a, import_id=imp.id, mapping_status="mapped")
        assert mapped_total == 1 and mapped[0].product_external_code == "PRD-100"
        assert mapped[0].product_id is not None
        _, unmapped_total = pis.list_lines(company_id=cid_a, import_id=imp.id, mapping_status="unmapped")
        assert unmapped_total == 1  # PRD-999
        _, needs_review_total = pis.list_lines(
            company_id=cid_a, import_id=imp.id, mapping_status="needs_review",
        )
        assert needs_review_total == 1  # ligne sans activité

    def test_reimport_same_content_is_idempotent_no_duplicate(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        first = self._import(cid_a, "dedup", filename="dedup.csv")
        assert first.already_imported is False
        _, lines_after_first = pis.list_lines(company_id=cid_a, import_id=first.id)

        second = self._import(cid_a, "dedup", filename="dedup-again.csv")  # même contenu, autre nom
        assert second.already_imported is True
        assert second.id == first.id  # même import réutilisé
        _, lines_after_second = pis.list_lines(company_id=cid_a, import_id=first.id)
        assert lines_after_second == lines_after_first  # aucun doublon de ligne

    def test_resolution_queue_and_resolve(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        sup = insert_supplier(cid_a, "Resolver SA")
        prod = supplier_sites_service.create_product(
            company_id=cid_a, supplier_id=sup, payload=SupplierProductCreate(product_code="RESO-1"),
        )
        imp = self._import(cid_a, "resolve")
        queue, total = pis.list_resolution_queue(company_id=cid_a, import_id=imp.id)
        assert total >= 1
        target = queue[0]

        result = pis.resolve_mappings(
            company_id=cid_a, import_id=imp.id,
            resolutions=[LineResolution(line_id=target.id, supplier_id=sup, product_id=prod.id)],
        )
        assert result["resolved"] == 1
        resolved_lines, _ = pis.list_lines(company_id=cid_a, import_id=imp.id, mapping_status="resolved")
        assert any(line.id == target.id for line in resolved_lines)

    def test_review_gate_pending_to_validated(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        imp = self._import(cid_a, "gate")
        assert imp.status == "pending"
        validated = pis.review_import(company_id=cid_a, import_id=imp.id, accept=True)
        assert validated.status == "validated"
        # Re-revue interdite (transition stricte).
        with pytest.raises(pis.PurchaseImportError):
            pis.review_import(company_id=cid_a, import_id=imp.id, accept=True)

    def test_review_reject(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        imp = self._import(cid_a, "reject")
        rejected = pis.review_import(company_id=cid_a, import_id=imp.id, accept=False)
        assert rejected.status == "rejected"

    def test_tenant_isolation_import_not_visible_to_other(self, two_companies_proc):
        cid_a, cid_b = two_companies_proc
        imp_a = self._import(cid_a, "secret-a")
        with pytest.raises(pis.PurchaseImportError):
            pis.get_import(company_id=cid_b, import_id=imp_a.id)

    def test_same_content_distinct_tenants_are_independent(self, two_companies_proc):
        """L'unicité sha256 est PAR tenant : deux tenants peuvent importer le
        même fichier sans collision (idempotence de contenu scopée)."""
        cid_a, cid_b = two_companies_proc
        imp_a = self._import(cid_a, "shared")
        imp_b = self._import(cid_b, "shared")
        assert imp_a.already_imported is False
        assert imp_b.already_imported is False
        assert imp_a.id != imp_b.id


# ── Wave 3 : _auto_map — ambiguïté jamais résolue par ordre/premier résultat ─
#
# Régression du défaut documenté par le commit d857eda (isolation de tests
# contournant le symptôme sans corriger la cause) : `_auto_map` résolvait un
# product_code par `fetchone()` SANS `ORDER BY`, alors que l'unicité de
# `supplier_products` porte sur (company_id, supplier_id, product_code) — PAS
# (company_id, product_code). Plusieurs fournisseurs du MÊME tenant peuvent
# donc légitimement partager un code produit ; l'ancien code attribuait alors
# la ligne au fournisseur arbitrairement renvoyé en premier par PostgreSQL.

@_skip_no_db_url
@_skip_no_psycopg2
class TestAutoMapAmbiguity:
    def test_ambiguous_product_code_same_tenant_not_silently_attributed(self, two_companies_proc):
        """Deux fournisseurs du MÊME tenant partagent un product_code : la ligne
        ne doit être rattachée à AUCUN des deux (ni le premier, ni le second),
        mais marquée `ambiguous` avec les deux candidats + la raison en clair."""
        cid_a, _ = two_companies_proc
        sup1 = insert_supplier(cid_a, "Ambigu Fournisseur Un")
        sup2 = insert_supplier(cid_a, "Ambigu Fournisseur Deux")
        prod1 = insert_supplier_product(cid_a, sup1, "AMBIG-CODE-1")
        prod2 = insert_supplier_product(cid_a, sup2, "AMBIG-CODE-1")

        csv = (
            "supplier_code,product_code,date,quantity,unit,amount,currency,category,country\n"
            "UNKNOWN-SUP,AMBIG-CODE-1,2026-01-15,10,kg,1500,EUR,C1,FR\n"
        )
        imp = pis.create_import(company_id=cid_a, filename="ambig-same-tenant.csv", content=csv.encode("utf-8"))

        ambiguous, total = pis.list_lines(company_id=cid_a, import_id=imp.id, mapping_status="ambiguous")
        assert total == 1
        line = ambiguous[0]
        assert line.product_id is None, "aucune attribution silencieuse au premier candidat"
        assert line.supplier_id is None, "aucune attribution silencieuse au second candidat"
        assert line.mapping_note is not None and line.mapping_note.strip() != ""
        assert str(prod1) in line.mapping_note and str(prod2) in line.mapping_note
        # Ni 'mapped' ni le simple 'unmapped' pré-Wave-3 : un statut dédié,
        # distinct, qui dit qu'il y avait bien des candidats (pas zéro).
        assert line.mapping_status == "ambiguous"
        _, unmapped_total = pis.list_lines(company_id=cid_a, import_id=imp.id, mapping_status="unmapped")
        assert unmapped_total == 0

    def test_explicit_supplier_scopes_resolution_despite_tenant_wide_ambiguity(self, two_companies_proc):
        """Un `supplier_id` DÉJÀ résolu sur la ligne fait autorité : le code est
        cherché dans le catalogue de CE fournisseur uniquement. Un product_code
        ambigu tenant-wide (deux fournisseurs le partagent) doit quand même
        résoudre proprement dès qu'un périmètre fournisseur explicite le rend
        unique — l'ambiguïté tenant-wide ne doit jamais contaminer une
        résolution par ailleurs univoque dans le périmètre explicite."""
        cid_a, _ = two_companies_proc
        sup1 = insert_supplier(cid_a, "Explicite Fournisseur Un")
        sup2 = insert_supplier(cid_a, "Explicite Fournisseur Deux")
        prod1 = insert_supplier_product(cid_a, sup1, "SHARED-EXPLICIT")
        insert_supplier_product(cid_a, sup2, "SHARED-EXPLICIT")  # même code -> ambigu tenant-wide

        line = {"product_external_code": "SHARED-EXPLICIT", "supplier_id": sup1}
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                product_id, supplier_id, mapping_status, mapping_note = pis._auto_map(cur, cid_a, line)

        assert mapping_status == "mapped"
        assert product_id == prod1
        assert supplier_id == sup1
        assert mapping_note is None

    def test_cross_tenant_shared_product_code_resolves_independently(self, two_companies_proc):
        """Un product_code partagé par des fournisseurs de DEUX TENANTS
        DIFFÉRENTS ne fuit jamais : chaque tenant ne voit que ses propres
        candidats (`_SCOPE = company_id`). Preuve explicite plutôt que supposée
        — chaque tenant résout proprement 'mapped' sur SON fournisseur, sans
        jamais voir ni l'autre tenant ni une ambiguïté fantôme."""
        cid_a, cid_b = two_companies_proc
        sup_a = insert_supplier(cid_a, "Tenant A Fournisseur Croisé")
        sup_b = insert_supplier(cid_b, "Tenant B Fournisseur Croisé")
        insert_supplier_product(cid_a, sup_a, "CROSS-TENANT-CODE")
        insert_supplier_product(cid_b, sup_b, "CROSS-TENANT-CODE")

        csv = (
            "supplier_code,product_code,date,quantity,unit,amount,currency,category,country\n"
            "X,CROSS-TENANT-CODE,2026-01-15,10,kg,1500,EUR,C1,FR\n"
        )
        imp_a = pis.create_import(company_id=cid_a, filename="cross-a.csv", content=csv.encode("utf-8"))
        imp_b = pis.create_import(company_id=cid_b, filename="cross-b.csv", content=csv.encode("utf-8"))

        mapped_a, total_a = pis.list_lines(company_id=cid_a, import_id=imp_a.id, mapping_status="mapped")
        mapped_b, total_b = pis.list_lines(company_id=cid_b, import_id=imp_b.id, mapping_status="mapped")
        assert total_a == 1 and total_b == 1
        assert mapped_a[0].supplier_id == sup_a
        assert mapped_b[0].supplier_id == sup_b
        _, ambiguous_a = pis.list_lines(company_id=cid_a, import_id=imp_a.id, mapping_status="ambiguous")
        assert ambiguous_a == 0, "le partage du code par un AUTRE tenant ne doit jamais créer d'ambiguïté locale"

    def test_unambiguous_single_supplier_match_unchanged(self, two_companies_proc):
        """Non-régression explicite : un seul fournisseur, un seul candidat ->
        toujours 'mapped', exactement comme avant Wave 3 (même comportement,
        pas seulement 'pas d'exception')."""
        cid_a, _ = two_companies_proc
        sup = insert_supplier(cid_a, "Seul Fournisseur SA")
        prod = insert_supplier_product(cid_a, sup, "SOLO-CODE")

        line = {"product_external_code": "SOLO-CODE"}
        with get_db(company_id=cid_a) as conn:
            with conn.cursor() as cur:
                product_id, supplier_id, mapping_status, mapping_note = pis._auto_map(cur, cid_a, line)

        assert (product_id, supplier_id, mapping_status, mapping_note) == (prod, sup, "mapped", None)

    def test_resolve_mappings_rejects_manual_ambiguous_status(self, two_companies_proc):
        """'ambiguous' est un statut système (raison obligatoire en base) — le
        paramétrer à la main via la résolution manuelle est refusé explicitement
        plutôt que de lever une IntegrityError SQL brute sur la contrainte CHECK."""
        cid_a, _ = two_companies_proc
        imp = self._import(cid_a, "reject-manual-ambiguous")
        queue, total = pis.list_resolution_queue(company_id=cid_a, import_id=imp.id)
        assert total >= 1
        target = queue[0]
        with pytest.raises(pis.PurchaseImportError, match="ambiguous"):
            pis.resolve_mappings(
                company_id=cid_a, import_id=imp.id,
                resolutions=[LineResolution(line_id=target.id, mapping_status="ambiguous")],
            )

    def _import(self, cid: int, tag: str, filename: str = "achats.csv"):
        return pis.create_import(company_id=cid, filename=filename, content=_csv(tag).encode("utf-8"))
