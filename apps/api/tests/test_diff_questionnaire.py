"""Tests T5.5 — diff multi-exercices + export questionnaires.

Pur (sans DB) : diff de deux snapshots (variations/ajouts/suppressions + FE),
catalogue questionnaire (≥20 questions), construction CSV. Gardes d'auth.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from services import diff_service
from services import questionnaire_service as qs

client = TestClient(app)


class TestDiff:
    SNAP_A = {
        "carbon": {"scope1Tco2e": 100, "scope2LbTco2e": 50, "totalTco2e": 150},
        "meta": {"efVersion": "ADEME-2024"},
    }
    SNAP_B = {
        "carbon": {"scope1Tco2e": 120, "scope2LbTco2e": 50, "totalTco2e": 200, "scope3Tco2e": 30},
        "meta": {"efVersion": "ADEME-2025"},
    }

    def test_identifies_all_variations(self) -> None:
        d = diff_service.diff_snapshots(self.SNAP_A, self.SNAP_B)
        changed = {c["path"]: c for c in d["changed"]}
        # scope1 +20%, total +33.33% modifiés ; scope2 inchangé (absent du diff)
        assert changed["carbon.scope1Tco2e"]["change_pct"] == 20.0
        assert changed["carbon.totalTco2e"]["after"] == 200
        assert "carbon.scope2LbTco2e" not in changed
        # nouveau poste scope3
        assert any(a["path"] == "carbon.scope3Tco2e" for a in d["added"])
        assert d["changed_count"] == 2 and d["added_count"] == 1

    def test_fe_version_change_detected(self) -> None:
        d = diff_service.diff_snapshots(self.SNAP_A, self.SNAP_B)
        fe = {m["path"]: m for m in d["meta_changed"]}
        assert fe["meta.efVersion"]["before"] == "ADEME-2024"
        assert fe["meta.efVersion"]["after"] == "ADEME-2025"

    def test_zero_before_no_pct(self) -> None:
        d = diff_service.diff_snapshots({"x": 0}, {"x": 10})
        assert d["changed"][0]["change_pct"] is None


class TestQuestionnaire:
    def test_catalog_min_20_questions(self) -> None:
        cat = qs.catalogs()
        total = sum(c["question_count"] for c in cat["questionnaires"])
        assert total >= 20

    def test_build_answers_references_fact(self) -> None:
        rows = qs.build_answers(company_id=1)
        assert len(rows) >= 20
        # chaque ligne référence un fact source
        assert all(r["source"].startswith("facts_current:CC.") for r in rows)
        assert all(r["fact_code"] for r in rows)

    def test_filter_single_questionnaire(self) -> None:
        rows = qs.build_answers(company_id=1, questionnaire="ecovadis")
        assert all(r["questionnaire"].startswith("EcoVadis") for r in rows)

    def test_csv_has_header_and_rows(self) -> None:
        rows = qs.build_answers(company_id=1)
        csv_bytes = qs.build_csv(rows)
        text = csv_bytes.decode("utf-8-sig")
        assert text.splitlines()[0] == "questionnaire;question_id;question;fact_code;value;unit;source"
        assert len(text.splitlines()) >= 21  # header + ≥20


class TestEndpoints:
    def test_diff_requires_auth(self) -> None:
        assert client.get("/diff/carbon").status_code in (401, 403)

    def test_catalogs_requires_auth(self) -> None:
        assert client.get("/questionnaire/catalogs").status_code in (401, 403)

    def test_export_requires_auth(self) -> None:
        assert client.post("/questionnaire/export").status_code in (401, 403)
