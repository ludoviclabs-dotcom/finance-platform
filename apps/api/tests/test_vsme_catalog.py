"""Tests T3.1 — référentiel VSME (catalogue global des datapoints).

Sans DB : intégrité du catalogue, cohérence des chemins snapshot avec le modèle
VSME réel, conventions de fact_code, endpoints, et dry-run du seed.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from models.vsme import (
    VsmeEnvironSnapshot,
    VsmeGovSnapshot,
    VsmeProfileSnapshot,
    VsmeSocialSnapshot,
)
from services import vsme_catalog

client = TestClient(app)

SECTION_MODELS = {
    "profile": VsmeProfileSnapshot,
    "environnement": VsmeEnvironSnapshot,
    "social": VsmeSocialSnapshot,
    "gouvernance": VsmeGovSnapshot,
}


class TestCatalogIntegrity:
    def test_codes_unique(self) -> None:
        codes = [d["code"] for d in vsme_catalog.all_datapoints()]
        assert len(codes) == len(set(codes))

    def test_required_fields_and_enums(self) -> None:
        for d in vsme_catalog.all_datapoints():
            assert d["code"] and d["module"] and d["label"]
            assert d["module"] in vsme_catalog.ALL_MODULES, d["code"]
            assert d["type"] in vsme_catalog.VALID_TYPES, d["code"]
            assert d["collect"] in vsme_catalog.VALID_COLLECT, d["code"]

    def test_all_basic_modules_present(self) -> None:
        present = {d["module"] for d in vsme_catalog.all_datapoints()}
        for m in vsme_catalog.BASIC_MODULES:
            assert m in present, f"Module Basic manquant : {m}"

    def test_snapshot_paths_match_model(self) -> None:
        for d in vsme_catalog.all_datapoints():
            sp = d.get("snapshot")
            if not sp:
                continue
            section, field = sp.split(".")
            assert section in SECTION_MODELS, f"{d['code']}: section {section} inconnue"
            assert field in SECTION_MODELS[section].model_fields, f"{d['code']}: champ {field} absent"

    def test_quantitative_have_units(self) -> None:
        for d in vsme_catalog.all_datapoints():
            if d["type"] == "quantitatif":
                assert d.get("unit"), f"{d['code']} quantitatif sans unité"

    def test_fact_codes_are_dotted(self) -> None:
        for d in vsme_catalog.all_datapoints():
            fc = d.get("fact_code")
            if fc:
                assert fc.startswith("CC."), f"{d['code']}: fact_code non dotted {fc}"

    def test_ges_datapoints_reuse_carbon_codes(self) -> None:
        # Scope 1 réutilise le code carbon existant, pas un nouveau CC.VSME.*
        assert vsme_catalog.get_datapoint("B3-1")["fact_code"] == "CC.GES.SCOPE1"


class TestCatalogHelpers:
    def test_by_module(self) -> None:
        b3 = vsme_catalog.by_module("B3")
        assert b3 and all(d["module"] == "B3" for d in b3)

    def test_get_datapoint(self) -> None:
        assert vsme_catalog.get_datapoint("B1-1") is not None
        assert vsme_catalog.get_datapoint("ZZ-9") is None

    def test_modules_summary_ordered(self) -> None:
        mods = [m["module"] for m in vsme_catalog.modules_summary()]
        assert mods == [m for m in vsme_catalog.ALL_MODULES if m in mods]


class TestEndpoints:
    def test_list(self) -> None:
        r = client.get("/vsme/datapoints")
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == len(vsme_catalog.all_datapoints())
        assert body["version"] == vsme_catalog.catalog_version()

    def test_list_filtered(self) -> None:
        r = client.get("/vsme/datapoints", params={"module": "B3"})
        assert r.status_code == 200
        assert all(d["module"] == "B3" for d in r.json()["datapoints"])

    def test_detail(self) -> None:
        r = client.get("/vsme/datapoints/B3-1")
        assert r.status_code == 200
        assert r.json()["fact_code"] == "CC.GES.SCOPE1"

    def test_detail_unknown_404(self) -> None:
        assert client.get("/vsme/datapoints/ZZ-9").status_code == 404


class TestSeedDryRun:
    def test_dry_run_no_db(self) -> None:
        import importlib

        seed = importlib.import_module("scripts.seed_vsme_datapoints")
        assert seed.seed(dry_run=True) == 0
