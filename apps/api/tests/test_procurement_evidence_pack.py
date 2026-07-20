"""
test_procurement_evidence_pack.py — Evidence Pack d'un run Scope 3 (PR-05B).

PUR : canonicalisation JSON, contenu de la note méthodologique.
DB-gated (CI `migration-tests`) : construction du pack, intégrité vérifiable par
le mécanisme d'export EXISTANT (`inspect_zip`), reproductibilité byte-à-byte,
présence des lignes non résolues, isolation tenant.
"""

from __future__ import annotations

import io
import json
import os
import zipfile

import pytest

from db.database import db_available
from models.procurement import CalculationRequest
from services.export_package import inspect_zip
from services.procurement import evidence_pack

from ._procurement_fixtures import (
    cleanup_emission_factors,
    insert_emission_factor,
    insert_pcf,
    insert_supplier,
    insert_supplier_product,
)

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")

def _csv_for(marker: str) -> str:
    """CSV aux codes produit PROPRES au test (voir la note de
    `test_procurement_hotspots.py::_csv_for` : le mapping automatique de PR-05A
    est ambigu quand plusieurs fournisseurs partagent un code, et la fixture est
    de portée module). La 2ᵉ ligne est volontairement orpheline : elle ressort
    non résolue, ce que plusieurs tests de ce module vérifient dans le pack."""
    return (
        "supplier_code,product_code,date,quantity,unit,spend,currency,category,country\n"
        f"{marker},SKU-{marker}-A,2026-01-15,100,kg,5000,EUR,materials,FR\n"
        f"{marker},SKU-{marker}-ORPHELIN,2026-01-17,5,kg,120,EUR,inconnue,\n"
    )


# ── PUR ─────────────────────────────────────────────────────────────────────

class TestEvidencePackPure:
    def test_canonical_json_is_stable_across_key_order(self):
        a = evidence_pack._canonical_json({"b": 1, "a": 2})
        b = evidence_pack._canonical_json({"a": 2, "b": 1})
        assert a == b

    def test_methodology_doc_states_the_hard_rules(self):
        from services.calculations import procurement as engine

        doc = evidence_pack._METHODOLOGY_DOC.format(
            code=engine.METHODOLOGY_CODE, version=engine.METHODOLOGY_VERSION,
        )
        assert "Aucun repli silencieux" in doc
        assert "Aucune valeur inventée" in doc
        assert "modèle de langage" in doc
        for method in engine.METHOD_ORDER:
            assert method in doc
        assert "unresolved" in doc


# ── DB-gated ────────────────────────────────────────────────────────────────

@_skip_no_db_url
@_skip_no_psycopg2
class TestEvidencePackDb:
    @pytest.fixture(autouse=True)
    def _factors(self):
        insert_emission_factor(
            ef_code="EF-PACK-TEST", category="materials", factor_kgco2e=2.0, unit="kg",
        )
        yield
        cleanup_emission_factors()

    def _run(self, company_id: int, marker: str) -> int:
        from services.procurement import calculation_run_service as runs
        from services.procurement import purchase_import_service as imports

        supplier = insert_supplier(company_id, f"Fournisseur {marker}")
        product = insert_supplier_product(
            company_id, supplier, f"SKU-{marker}-A", category_code="materials",
        )
        insert_pcf(company_id, product, value_kgco2e=2.5, declared_unit="kg")
        imp = imports.create_import(
            company_id=company_id, filename=f"{marker}.csv",
            content=_csv_for(marker).encode("utf-8"),
        )
        imports.review_import(company_id=company_id, import_id=imp.id, accept=True)
        return runs.calculate(
            company_id=company_id, payload=CalculationRequest(import_id=imp.id),
        ).id

    def test_pack_contains_every_expected_file(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-A")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        with zipfile.ZipFile(io.BytesIO(pack["zip_bytes"])) as zf:
            names = set(zf.namelist())
        assert names == {
            "manifest.json", "run.json", "line_results.json", "coverage.json",
            "methodology.md", "README.txt", "CHECKSUMS.sha256",
        }

    def test_pack_passes_the_existing_integrity_checker(self, two_companies_proc):
        """Le pack réutilise le mécanisme d'export existant : `inspect_zip` —
        donc la page publique /verify — fonctionne sans code supplémentaire."""
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-B")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        result = inspect_zip(pack["zip_bytes"])
        assert result["valid"] is True
        assert result["self_consistent"] is True
        assert result["manifest_hash"] == pack["manifest_hash"]
        assert result["package_hash"] == pack["package_hash"]

    def test_pack_is_reproducible_byte_for_byte(self, two_companies_proc):
        """Deux exports du même run doivent donner exactement les mêmes octets :
        c'est ce qui rend la reproductibilité vérifiable de l'extérieur."""
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-C")
        first = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)
        second = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        assert first["manifest_hash"] == second["manifest_hash"]
        assert first["package_hash"] == second["package_hash"]
        assert first["zip_bytes"] == second["zip_bytes"]

    def test_manifest_carries_no_timestamp(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-D")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)
        raw = json.dumps(pack["manifest"]).lower()
        for forbidden in ("generated_at", "exported_at", "timestamp"):
            assert forbidden not in raw

    def test_unresolved_lines_are_present_with_null_not_zero(self, two_companies_proc):
        """Le pack doit montrer les trous, pas les combler."""
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-E")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        with zipfile.ZipFile(io.BytesIO(pack["zip_bytes"])) as zf:
            lines = json.loads(zf.read("line_results.json"))
        unresolved = [
            line for line in lines["lines"] if line["calculation_method"] == "unresolved"
        ]
        assert unresolved, "les lignes non résolues doivent figurer dans le pack"
        for line in unresolved:
            assert line["result_tco2e"] is None
            assert line["fallback_reason"]

    def test_every_fallback_line_documents_its_reason(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-F")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        with zipfile.ZipFile(io.BytesIO(pack["zip_bytes"])) as zf:
            lines = json.loads(zf.read("line_results.json"))
        for line in lines["lines"]:
            if line["method_rank"] > 1:
                assert line["fallback_reason"], line

    def test_pack_embeds_the_immutable_input_snapshot(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-G")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        with zipfile.ZipFile(io.BytesIO(pack["zip_bytes"])) as zf:
            run_doc = json.loads(zf.read("run.json"))
        assert run_doc["input_snapshot"]["lines"], "le snapshot d'entrée doit être embarqué"
        assert run_doc["input_fingerprint"]
        assert run_doc["methodology"]["code"]
        assert run_doc["methodology"]["version"]

    def test_checksums_file_matches_actual_contents(self, two_companies_proc):
        cid_a, _ = two_companies_proc
        run_id = self._run(cid_a, "PACK-H")
        pack = evidence_pack.build_run_evidence_pack(company_id=cid_a, run_id=run_id)

        import hashlib

        with zipfile.ZipFile(io.BytesIO(pack["zip_bytes"])) as zf:
            checksums = zf.read("CHECKSUMS.sha256").decode("utf-8")
            for line in checksums.strip().splitlines():
                expected, name = line.split("  ", 1)
                actual = hashlib.sha256(zf.read(name)).hexdigest()
                assert actual == expected, name

    def test_tenant_b_cannot_export_tenant_a_run(self, two_companies_proc):
        from services.procurement import calculation_run_service as runs

        cid_a, cid_b = two_companies_proc
        run_a = self._run(cid_a, "PACK-ISO")
        with pytest.raises(runs.ProcurementCalculationError, match="introuvable"):
            evidence_pack.build_run_evidence_pack(company_id=cid_b, run_id=run_a)
