"""Tests T3.2 — mapping existant → VSME + complétude.

Pur (sans DB) : map_datapoints (auto/manuel/na/missing), completeness (CA :
E1 + profil → B1/B3 ≥ 80 %), validation de save_field_value, gardes auth.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import vsme_mapping_service as svc

client = TestClient(app)

# Snapshot avec profil (B1) + environnement (B3, B6, B7) renseignés (E1 carbone).
SNAPSHOT_E1 = {
    "profile": {
        "raisonSociale": "Exemplia", "secteurNaf": "62.01", "etp": 50,
        "caNet": 1_000_000, "anneeReporting": 2025, "pays": "FR", "perimetre": "mono",
    },
    "environnement": {
        "scope1Tco2e": 100, "scope2LbTco2e": 50, "scope3Tco2e": 200,
        "totalGesTco2e": 350, "intensiteCaGes": 35, "energieMwh": 500,
        "partEnrPct": 30, "eauM3": 1000, "dechetsTonnes": 10, "planReductionGes": "Plan 2030",
    },
    "social": {}, "gouvernance": {},
}


def _module(comp, m):
    return next((x for x in comp["modules"] if x["module"] == m), None)


class TestMapDatapoints:
    def test_auto_from_snapshot_with_source(self) -> None:
        rows = svc.map_datapoints(SNAPSHOT_E1, {})
        b31 = next(r for r in rows if r["code"] == "B3-1")
        assert b31["status"] == "auto"
        assert b31["value"] == 100
        assert b31["source"] == "E1 (carbone)"

    def test_missing_when_no_data(self) -> None:
        rows = svc.map_datapoints({"profile": {}, "environnement": {}, "social": {}, "gouvernance": {}}, {})
        b31 = next(r for r in rows if r["code"] == "B3-1")
        assert b31["status"] == "missing"

    def test_manual_override(self) -> None:
        rows = svc.map_datapoints(SNAPSHOT_E1, {"B6-1": {"value": 1500, "is_applicable": True}})
        b61 = next(r for r in rows if r["code"] == "B6-1")
        assert b61["status"] == "manuel"
        assert b61["value"] == 1500

    def test_non_applicable(self) -> None:
        rows = svc.map_datapoints(
            {"profile": {}, "environnement": {}, "social": {}, "gouvernance": {}},
            {"B4-1": {"is_applicable": False, "na_justification": "Non matériel pour le secteur"}},
        )
        b41 = next(r for r in rows if r["code"] == "B4-1")
        assert b41["status"] == "na"
        assert b41["na_justification"] == "Non matériel pour le secteur"


class TestCompleteness:
    def test_e1_profile_gives_b1_b3_above_80(self) -> None:
        # CA T3.2 : une org ayant E1 + profil voit B1-B3 ≥ 80 % sans ressaisie.
        comp = svc.completeness(svc.map_datapoints(SNAPSHOT_E1, {}))
        assert _module(comp, "B1")["pct"] >= 80
        assert _module(comp, "B3")["pct"] >= 80

    def test_denominator_is_mandatory_only(self) -> None:
        comp = svc.completeness(svc.map_datapoints(SNAPSHOT_E1, {}))
        # mandatory_total > 0 et filled ≤ total
        assert comp["mandatory_total"] > 0
        assert comp["mandatory_filled"] <= comp["mandatory_total"]

    def test_modules_in_efrag_order(self) -> None:
        comp = svc.completeness(svc.map_datapoints(SNAPSHOT_E1, {}))
        mods = [m["module"] for m in comp["modules"]]
        from services import vsme_catalog
        assert mods == [m for m in vsme_catalog.ALL_MODULES if m in mods]


class TestSaveValidation:
    def test_unknown_code(self) -> None:
        with pytest.raises(svc.VsmeMappingError):
            svc.save_field_value(company_id=1, code="ZZ-9", value=1)

    def test_non_numeric_quantitative_rejected(self) -> None:
        # B6-1 est quantitatif → une valeur non numérique est rejetée (pas de stockage silencieux).
        with pytest.raises(svc.VsmeMappingError):
            svc.save_field_value(company_id=1, code="B6-1", value="abc")

    def test_na_requires_justification(self) -> None:
        with pytest.raises(svc.VsmeMappingError):
            svc.save_field_value(company_id=1, code="B4-1", is_applicable=False, na_justification="court")

    def test_na_with_justification_passes_validation_then_needs_db(self) -> None:
        # Justification OK → passe la validation, échoue ensuite sur l'absence de DB.
        with pytest.raises(svc.VsmeMappingError) as exc:
            svc.save_field_value(
                company_id=1, code="B4-1", is_applicable=False,
                na_justification="Non matériel pour ce secteur d'activité",
            )
        assert "indisponible" in str(exc.value)


class TestEndpoints:
    def test_status_requires_auth(self) -> None:
        assert client.get("/vsme/mapping/status").status_code in (401, 403)

    def test_save_requires_auth(self) -> None:
        assert client.post("/vsme/mapping/datapoint", json={"code": "B6-1", "value": 1}).status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestSaveRoundtripDb:
    def test_emit_dedup_change_na(self) -> None:
        cid = 99351
        # 1. valeur initiale → fact émis, fact_event_id renseigné
        r1 = svc.save_field_value(company_id=cid, code="B6-1", value=1500, user_email="u@e.fr")
        assert r1["fact_emitted"] is True and r1["fact_event_id"]
        fid1 = r1["fact_event_id"]
        # 2. même valeur → dédup : pas de nouveau fact, même fact_event_id
        r2 = svc.save_field_value(company_id=cid, code="B6-1", value=1500, user_email="u@e.fr")
        assert r2["fact_emitted"] is False and r2["fact_event_id"] == fid1
        # 3. valeur changée → nouveau fact
        r3 = svc.save_field_value(company_id=cid, code="B6-1", value=2000, user_email="u@e.fr")
        assert r3["fact_emitted"] is True and r3["fact_event_id"] != fid1
        # 4. non applicable → fact_event_id remis à NULL (pas de fantôme)
        r4 = svc.save_field_value(
            company_id=cid, code="B6-1", is_applicable=False,
            na_justification="Non matériel pour ce secteur", user_email="u@e.fr",
        )
        assert r4["fact_event_id"] is None
