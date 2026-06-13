"""Tests T4.2 — export BEGES v5.

Pur (sans DB) : ventilation 6×22 + RÉCONCILIATION (total BEGES = total GHG),
éligibilité, rendu PDF/Excel, ZIP + CHECKSUMS, déterminisme, gardes.
"""

from __future__ import annotations

import hashlib
import io
import zipfile

from fastapi.testclient import TestClient

from main import app
from services import beges_export as beges

client = TestClient(app)

SCOPE_TOTALS = {"S1": 100.0, "S2": 50.0, "S3": {1: 30.0, 4: 20.0, "uncategorized": 10.0}}
# total GHG = 100 + 50 + 30 + 20 + 10 = 210


class TestVentilation:
    def test_reconciliation(self) -> None:
        b = beges.ventilate(SCOPE_TOTALS)
        assert b["total"] == 210.0  # total BEGES = total GHG

    def test_six_categories_22_postes(self) -> None:
        b = beges.ventilate(SCOPE_TOTALS)
        assert len(b["categories"]) == 6
        assert sum(len(c["postes"]) for c in b["categories"]) == 22

    def test_mapping(self) -> None:
        b = beges.ventilate(SCOPE_TOTALS)
        postes = {p["code"]: p["value"] for c in b["categories"] for p in c["postes"]}
        assert postes["1.1"] == 100.0   # S1
        assert postes["2.1"] == 50.0    # S2
        assert postes["4.1"] == 30.0    # S3.1 achats
        assert postes["3.1"] == 20.0    # S3.4 transport amont
        assert postes["6.1"] == 10.0    # S3 non catégorisé → autres

    def test_empty_reconciles_to_zero(self) -> None:
        assert beges.ventilate({"S1": 0, "S2": 0, "S3": {}})["total"] == 0.0


class TestEligibility:
    def test_obligatoire_fr_500(self) -> None:
        assert beges.eligibility(600, "FR")["status"] == "obligatoire"

    def test_volontaire_small(self) -> None:
        assert beges.eligibility(50, "FR")["status"] == "volontaire"

    def test_outremer_250(self) -> None:
        assert beges.eligibility(300, "GP")["status"] == "obligatoire_om"


class TestRenderers:
    def test_pdf_and_xlsx(self) -> None:
        b = beges.ventilate(SCOPE_TOTALS)
        elig = beges.eligibility(600, "FR")
        pdf = beges.build_beges_pdf(company_name="Exemplia", breakdown=b, elig=elig, generated_at="13/06/2026")
        assert pdf[:5] == b"%PDF-"
        xlsx = beges.build_beges_xlsx(company_name="Exemplia", breakdown=b)
        assert xlsx[:4] == b"PK\x03\x04"


class TestPackage:
    def test_zip_and_determinism(self) -> None:
        from datetime import datetime, timezone
        fixed = datetime(2026, 1, 1, tzinfo=timezone.utc)
        a = beges.build_beges_report(company_id=1, company_name="Exemplia", fte=600,
                                     scope_totals=SCOPE_TOTALS, generated_at=fixed)
        with zipfile.ZipFile(io.BytesIO(a["zip_bytes"])) as zf:
            names = set(zf.namelist())
            checksums = zf.read("CHECKSUMS.sha256").decode("utf-8")
            for line in checksums.strip().splitlines():
                sha, name = line.split("  ", 1)
                assert hashlib.sha256(zf.read(name)).hexdigest() == sha
        assert {"manifest.json", "beges.pdf", "beges.xlsx", "CHECKSUMS.sha256", "README.txt"} <= names
        b = beges.build_beges_report(company_id=1, company_name="Exemplia", fte=600,
                                     scope_totals=SCOPE_TOTALS, generated_at=fixed)
        assert a["manifest_hash"] == b["manifest_hash"]
        # Le ZIP entier doit être reproductible byte-à-byte (ZipInfo figée).
        assert a["package_hash"] == b["package_hash"]
        assert a["zip_bytes"] == b["zip_bytes"]


class TestScopeReduce:
    def test_s2_prefers_lb_even_when_zero(self) -> None:
        # LB = 0 (100 % renouvelable) doit primer sur MB, quel que soit l'ordre.
        for rows in (
            [("CC.GES.SCOPE2_LB", 0.0), ("CC.GES.SCOPE2_MB", 50.0)],
            [("CC.GES.SCOPE2_MB", 50.0), ("CC.GES.SCOPE2_LB", 0.0)],
        ):
            assert beges._reduce_scope_rows(rows)["S2"] == 0.0

    def test_s2_falls_back_to_mb_when_no_lb(self) -> None:
        assert beges._reduce_scope_rows([("CC.GES.SCOPE2_MB", 50.0)])["S2"] == 50.0

    def test_scope3_categories_and_uncategorized(self) -> None:
        t = beges._reduce_scope_rows([
            ("CC.GES.SCOPE1", 100.0),
            ("CC.GES.SCOPE3.4", 30.0),
            ("CC.GES.SCOPE3", 10.0),
        ])
        assert t["S1"] == 100.0
        assert t["S3"][4] == 30.0
        assert t["S3"]["uncategorized"] == 10.0


class TestEndpoints:
    def test_status_requires_auth(self) -> None:
        assert client.get("/beges/status").status_code in (401, 403)

    def test_export_requires_auth(self) -> None:
        assert client.post("/beges/export").status_code in (401, 403)
