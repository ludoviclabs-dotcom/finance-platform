"""Tests T5.4 — adaptateurs d'import fichiers (AWS / GCP / Qonto).

Pur (sans DB) : parsing (encodage, séparateur), screening (ventilation Scope 3,
% mappable, qualité 4), gate d'émission. Roundtrip DB sous skipif.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import csv_import_parsers as parsers
from services import import_screening_service as iss

client = TestClient(app)
_FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _bytes(name: str) -> bytes:
    with open(os.path.join(_FIX, name), "rb") as f:
        return f.read()


class TestAwsCcft:
    def test_parse_and_screen(self) -> None:
        p = parsers.aws_ccft_parse(_bytes("aws_ccft.csv"))
        assert p["row_count"] == 5
        assert p["total_tco2e"] == pytest.approx(8.0)
        s = iss.screen_aws_ccft(p["rows"])
        by = {c["category"]: c["tco2e"] for c in s["by_category"]}
        assert by[1] == pytest.approx(6.3)   # EC2 + Lambda + RDS
        assert by[8] == pytest.approx(1.7)    # S3 + CloudFront (stockage/CDN)
        assert s["total_tco2e"] == pytest.approx(8.0)
        assert s["mappable_pct"] > 85
        assert s["quality"] == 4


class TestGcpCarbon:
    def test_parse_and_screen(self) -> None:
        p = parsers.gcp_carbon_parse(_bytes("gcp_carbon.csv"))
        assert p["row_count"] == 4
        # kgCO2e → tCO2e : 4700 kg = 4.7 t
        assert p["total_tco2e"] == pytest.approx(4.7)
        s = iss.screen_gcp_carbon(p["rows"])
        by = {c["category"]: c["tco2e"] for c in s["by_category"]}
        assert by[1] == pytest.approx(3.6)    # Compute + BigQuery
        assert by[8] == pytest.approx(1.1)    # Storage + CDN


class TestQonto:
    def test_parse_excludes_income(self) -> None:
        p = parsers.qonto_parse(_bytes("qonto.csv"))
        # 5 lignes, 1 crédit (income) exclu → 4 dépenses
        assert p["row_count"] == 4
        assert p["total_spend"] == pytest.approx(2240.0)

    def test_screen_monetary(self) -> None:
        p = parsers.qonto_parse(_bytes("qonto.csv"))
        s = iss.screen_qonto(p["rows"])
        by = {c["category"]: c for c in s["by_category"]}
        assert by[1]["spend"] == pytest.approx(1200.0)        # SaaS
        assert by[6]["spend"] == pytest.approx(240.0)         # train + restaurant
        assert by[3]["spend"] == pytest.approx(800.0)         # énergie
        # tCO2e = spend × 0.25 / 1000
        assert s["total_tco2e"] == pytest.approx(0.56)
        assert s["quality"] == 4
        assert s["ratio_kgco2e_per_eur"] == 0.25


class TestCategoryMapping:
    def test_specific_vs_default(self) -> None:
        assert iss.category_for("aws", "Amazon EC2") == (1, True)
        assert iss.category_for("aws", "Amazon S3") == (8, True)
        # libellé inconnu → repli sur le défaut, non spécifique
        cat, specific = iss.category_for("aws", "Service inconnu xyz")
        assert cat == 1 and specific is False


class TestParsingRobustness:
    def test_empty_rejected(self) -> None:
        with pytest.raises(parsers.ImportParseError):
            parsers.aws_ccft_parse(b"")

    def test_cp1252_decoding(self) -> None:
        raw = "month,service,carbon_footprint_kgCO2e\n2025-01,Énergie,1000\n".encode("cp1252")
        p = parsers.gcp_carbon_parse(raw)
        assert p["encoding"] in ("cp1252", "utf-8")  # 'É' valide en cp1252
        assert p["total_tco2e"] == pytest.approx(1.0)


class TestEndpoints:
    def test_upload_requires_analyst(self) -> None:
        r = client.post("/imports/upload/aws", files={"file": ("aws.csv", _bytes("aws_ccft.csv"), "text/csv")})
        assert r.status_code in (401, 403)

    def test_invalid_type(self) -> None:
        # Type invalide rejeté (après auth) — sans token c'est 401/403
        assert client.post("/imports/upload/azure").status_code in (401, 403)

    def test_emit_requires_analyst(self) -> None:
        assert client.post("/imports/1/emit").status_code in (401, 403)

    def test_list_requires_auth(self) -> None:
        assert client.get("/imports").status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestRoundtripDb:
    def test_create_emit(self) -> None:
        from services import facts_service
        cid = 99471
        p = parsers.aws_ccft_parse(_bytes("aws_ccft.csv"))
        result = iss.screen_aws_ccft(p["rows"])
        parsed_meta = {k: p[k] for k in p if k != "rows"}
        created = iss.create_import_screening(company_id=cid, import_type="aws",
                                              filename="aws.csv", parsed=parsed_meta, result=result)
        sid = created["id"]
        assert iss.get_import_screening(company_id=cid, screening_id=sid)["status"] == "pending"
        emit = iss.emit_import_facts(company_id=cid, screening_id=sid, user_email="a@e.fr")
        assert emit["emitted_facts"] >= 2  # cat 1 + cat 8
        assert iss.get_import_screening(company_id=cid, screening_id=sid)["status"] == "emitted"
        trail = facts_service.get_trail(code="CC.GES.SCOPE3.1", company_id=cid, limit=1)
        assert trail and trail[0].value == pytest.approx(6.3)
