"""Tests T3.4 — wizard VSME 10 étapes.

Pur (sans DB) : progression, fusion d'état, 10 étapes, émission no-op sans DB,
gardes auth, progress sans session. Roundtrip start/save/complete sous skipif DB.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import vsme_wizard_service as wiz

client = TestClient(app)


class TestPureLogic:
    def test_ten_steps(self) -> None:
        assert wiz.TOTAL_STEPS == 10
        assert len(wiz.WIZARD_STEPS) == 10

    def test_progress(self) -> None:
        assert wiz.compute_progress(1) == 10
        assert wiz.compute_progress(5) == 50
        assert wiz.compute_progress(10) == 100
        assert wiz.compute_progress(0) == 0
        assert wiz.compute_progress(99) == 100

    def test_merge_state(self) -> None:
        assert wiz.merge_state({"a": 1}, {"b": 2}) == {"a": 1, "b": 2}
        assert wiz.merge_state({"a": 1}, {"a": 9}) == {"a": 9}
        assert wiz.merge_state({}, None) == {}

    def test_emit_state_facts_noop_without_db(self) -> None:
        # Sans DB, emit_fact renvoie None → 0 fact émis.
        assert wiz._emit_state_facts(1, {"B6-1": 1500, "B1-1": "Exemplia"}) == 0


class TestEndpoints:
    def test_progress_requires_auth(self) -> None:
        assert client.get("/vsme/wizard/progress").status_code in (401, 403)

    def test_start_requires_auth(self) -> None:
        assert client.post("/vsme/wizard/start", json={}).status_code in (401, 403)


class TestGetSessionNoDb:
    def test_none_without_db(self) -> None:
        assert wiz.get_session(999999) is None


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestRoundtrip:
    def test_start_save_complete(self) -> None:
        cid = 99341
        s = wiz.start_session(cid, {"anneeReporting": 2025})
        assert s["step"] == 1 and s["progress_pct"] == 10
        s2 = wiz.save_step(cid, 5, {"B6-1": 1500})
        assert s2["step"] == 5 and s2["state"]["B6-1"] == 1500
        res = wiz.complete(cid)
        assert res["completed"] is True
        assert wiz.get_session(cid)["completed"] is True
