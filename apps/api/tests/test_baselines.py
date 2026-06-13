"""Tests T4.5 — année de référence & recalcul.

Pur (sans DB) : compute_deltas, motifs, validation, gardes. Roundtrip DB sous skipif.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import baseline_service as bl

client = TestClient(app)


class TestDeltas:
    def test_change_pct(self) -> None:
        d = bl.compute_deltas({"CC.GES.SCOPE1": 100}, {"CC.GES.SCOPE1": 120})
        assert d["CC.GES.SCOPE1"]["change_pct"] == 20.0
        assert d["CC.GES.SCOPE1"]["baseline"] == 100
        assert d["CC.GES.SCOPE1"]["current"] == 120

    def test_zero_baseline_none(self) -> None:
        d = bl.compute_deltas({"X": 0}, {"X": 50})
        assert d["X"]["change_pct"] is None

    def test_new_code(self) -> None:
        d = bl.compute_deltas({}, {"Y": 10})
        assert d["Y"]["baseline"] is None and d["Y"]["change_pct"] is None

    def test_four_reasons(self) -> None:
        assert set(bl.RECALC_REASONS) == {"scope_change", "ef_version", "data_error", "manual_adjustment"}


class TestValidation:
    def test_recalc_invalid_reason(self) -> None:
        with pytest.raises(bl.BaselineError):
            bl.trigger_recalc(company_id=1, baseline_id=None, reason="wat")


class TestEndpoints:
    def test_list_requires_auth(self) -> None:
        assert client.get("/baselines").status_code in (401, 403)

    def test_freeze_requires_admin(self) -> None:
        assert client.post("/baselines/freeze", json={"baseline_year": 2025}).status_code in (401, 403)

    def test_recalc_requires_admin(self) -> None:
        assert client.post("/baselines/1/recalc", json={"reason": "ef_version"}).status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestRoundtripDb:
    def test_freeze_recalc_trail(self) -> None:
        from services import facts_service
        cid = 99451
        facts_service.emit_fact(company_id=cid, code="CC.GES.SCOPE1", value=100.0, unit="tCO2e", source_path="ingest")
        facts_service.refresh_facts_current()
        b = bl.freeze_baseline(company_id=cid, baseline_year=2024, ef_version="v2025")
        vs = bl.baseline_vs_current(company_id=cid, baseline_id=b["id"])
        assert vs["baseline_year"] == 2024
        rec = bl.trigger_recalc(company_id=cid, baseline_id=b["id"], reason="ef_version", actor="a@e.fr")
        assert rec["facts_touched"] >= 1
        # Le motif est dans le trail (meta)
        trail = facts_service.get_trail(code="CC.GES.SCOPE1", company_id=cid, limit=5)
        assert any((e.meta or {}).get("recalc_reason") == "ef_version" for e in trail)
