"""Tests T4.3 — import FEC → screening Scope 3 monétaire.

Pur (sans DB) : parseur (équilibre, exercice, séparateur), mapping PCG, screening
(>90 % mappable, total cohérent), gate d'émission. Roundtrip DB sous skipif.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import fec_parser
from services import fec_screening_service as fss

client = TestClient(app)

_FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "fec_anonymized.txt")


def _fec_bytes() -> bytes:
    with open(_FIXTURE, "rb") as f:
        return f.read()


class TestParser:
    def test_parse_fixture(self) -> None:
        p = fec_parser.parse_fec(_fec_bytes())
        assert p["separator"] == "|"
        assert p["row_count"] == 10
        assert p["balanced"] is True
        assert p["total_debit"] == 21000.0
        assert p["total_credit"] == 21000.0
        assert p["exercise_year"] == "2025"

    def test_no_separator_rejected(self) -> None:
        with pytest.raises(fec_parser.FecError):
            fec_parser.parse_fec(b"ceci nest pas un FEC sans separateur")

    def test_empty_rejected(self) -> None:
        with pytest.raises(fec_parser.FecError):
            fec_parser.parse_fec(b"")

    def test_cp1252_decoded_before_latin1(self) -> None:
        # 0x92 = apostrophe typographique en CP1252 (’), caractère de contrôle en
        # ISO-8859-1. L'ordre de fallback doit tenter CP1252 AVANT ISO-8859-1.
        raw = (
            "JournalCode|CompteNum|EcritureDate|EcritureLib|Debit|Credit\n"
            "AC|601000|20250115|Achat d’énergie|1000,00|0,00\n"
        ).encode("cp1252")
        p = fec_parser.parse_fec(raw)
        assert p["encoding"] == "cp1252"
        assert "’" in p["rows"][0]["EcritureLib"]


class TestMapping:
    def test_pcg_mapping(self) -> None:
        assert fss.map_compte("601000") == 1
        assert fss.map_compte("624000") == 4
        assert fss.map_compte("625000") == 6
        assert fss.map_compte("635000") is None  # taxe → non mappé
        assert fss.map_compte("401000") is None  # pas une charge


class TestScreening:
    def test_screen_fixture(self) -> None:
        p = fec_parser.parse_fec(_fec_bytes())
        r = fss.screen(p["rows"])
        assert r["total_spend"] == 21000.0
        assert r["mapped_spend"] == 20000.0
        assert r["mappable_pct"] == pytest.approx(95.2, abs=0.1)  # > 90 %
        assert r["mappable_pct"] > 90
        assert r["unmapped_accounts"] == ["635000"]
        assert r["quality"] == 4
        by_cat = {c["category"]: c for c in r["by_category"]}
        assert by_cat[1]["spend"] == 15000.0  # 601 + 606
        assert by_cat[4]["spend"] == 3000.0
        assert by_cat[6]["spend"] == 2000.0
        # total tCO2e = 20000 € × 0.25 / 1000
        assert r["total_tco2e"] == pytest.approx(5.0, abs=0.001)


class TestEndpoints:
    def test_upload_requires_auth(self) -> None:
        r = client.post("/fec/upload", files={"file": ("fec.txt", _fec_bytes(), "text/plain")})
        assert r.status_code in (401, 403)

    def test_emit_requires_auth(self) -> None:
        assert client.post("/fec/1/emit").status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestRoundtripDb:
    def test_create_get_emit(self) -> None:
        from services import facts_service
        cid = 99431
        p = fec_parser.parse_fec(_fec_bytes())
        result = fss.screen(p["rows"])
        created = fss.create_screening(company_id=cid, filename="fec.txt", parsed=p, result=result)
        sid = created["id"]
        assert fss.get_screening(company_id=cid, screening_id=sid)["status"] == "pending"
        emit = fss.emit_facts(company_id=cid, screening_id=sid, user_email="a@e.fr")
        assert emit["emitted_facts"] >= 3  # cat 1, 4, 6
        assert fss.get_screening(company_id=cid, screening_id=sid)["status"] == "emitted"
        # Les facts Scope 3 catégorisés existent
        trail = facts_service.get_trail(code="CC.GES.SCOPE3.1", company_id=cid, limit=1)
        assert trail and trail[0].value == 3.75
