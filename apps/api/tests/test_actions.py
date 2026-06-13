"""Tests T5.1 (MACC) + T5.2 (plan de transition).

Pur (sans DB) : coût marginal, tri MACC, trajectoire projetée, rendus PDF, gardes
d'auth. Roundtrip DB (CRUD + journal de statut) sous skipif.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import actions_export, actions_service as act

client = TestClient(app)


class TestMarginalCost:
    def test_formula(self) -> None:
        # 100 000 € / (50 tCO2e/an × 10 ans) = 200 €/tCO2e
        assert act.marginal_cost(100_000, 50, 10) == 200.0

    def test_negative_cost_allowed(self) -> None:
        assert act.marginal_cost(-5000, 10, 5) == -100.0

    def test_zero_reduction_none(self) -> None:
        assert act.marginal_cost(100_000, 0, 10) is None

    def test_missing_data_none(self) -> None:
        assert act.marginal_cost(None, 50, 10) is None
        assert act.marginal_cost(100_000, 50, None) is None


class TestMacc:
    ACTIONS = [
        {"id": 1, "title": "LED", "status": "proposed", "capex": 20_000, "reduction_tco2e": 20, "lifespan_years": 10},
        {"id": 2, "title": "Pompe à chaleur", "status": "committed", "capex": 120_000, "reduction_tco2e": 30, "lifespan_years": 15},
        {"id": 3, "title": "Audit", "status": "proposed", "capex": 5000, "reduction_tco2e": None, "lifespan_years": None},
    ]

    def test_sorted_ascending(self) -> None:
        m = act.build_macc(self.ACTIONS)
        costs = [b["marginal_cost"] for b in m["bars"]]
        assert costs == sorted(costs)
        # LED = 20000/200 = 100 ; PAC = 120000/450 ≈ 266.67 → LED en premier
        assert m["bars"][0]["title"] == "LED"

    def test_cumulative_and_unpriced(self) -> None:
        m = act.build_macc(self.ACTIONS)
        assert m["bars"][0]["cumulative_start"] == 0.0
        assert m["bars"][-1]["cumulative_end"] == m["total_potential_tco2e"]
        # L'action sans réduction reste visible (non chiffrée), jamais masquée
        assert len(m["unpriced"]) == 1
        assert m["unpriced"][0]["title"] == "Audit"


class TestTrajectory:
    ACTIONS = [
        {"status": "done", "reduction_tco2e": 100},
        {"status": "committed", "reduction_tco2e": 50},
        {"status": "proposed", "reduction_tco2e": 30},
    ]

    def test_done_reduces_projection(self) -> None:
        t = act.project_trajectory(1000, self.ACTIONS, years=3)
        assert t["projected_done"][0] == 900.0       # 1000 - 100 (réalisé)
        assert t["projected_committed"][0] == 850.0  # 1000 - 150 (réalisé + engagé)
        assert t["potential"][0] == 820.0            # 1000 - 180 (tout)
        assert t["reductions"] == {"done": 100.0, "committed": 50.0, "proposed": 30.0, "total": 180.0}

    def test_never_below_zero(self) -> None:
        t = act.project_trajectory(50, [{"status": "done", "reduction_tco2e": 100}], years=2)
        assert t["projected_done"] == [0.0, 0.0]


class TestRenderers:
    def test_macc_pdf(self) -> None:
        m = act.build_macc(TestMacc.ACTIONS)
        pdf = actions_export.build_macc_pdf(company_name="Exemplia", macc=m, generated_at="14/06/2026")
        assert pdf[:5] == b"%PDF-"

    def test_transition_pdf(self) -> None:
        traj = act.project_trajectory(1000, TestTrajectory.ACTIONS)
        pdf = actions_export.build_transition_pdf(
            company_name="Exemplia",
            actions=[{"title": "LED", "status": "done", "reduction_tco2e": 20, "owner": "DAF"}],
            trajectory=traj, generated_at="14/06/2026",
        )
        assert pdf[:5] == b"%PDF-"


class TestEndpoints:
    def test_list_requires_auth(self) -> None:
        assert client.get("/actions").status_code in (401, 403)

    def test_create_requires_analyst(self) -> None:
        assert client.post("/actions", json={"title": "x"}).status_code in (401, 403)

    def test_macc_requires_auth(self) -> None:
        assert client.get("/actions/macc").status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestRoundtripDb:
    def test_crud_and_status_journal(self) -> None:
        cid = 99461
        a = act.create_action(cid, title="LED", capex=20_000, reduction_tco2e=20,
                              lifespan_years=10, actor="a@e.fr")
        assert a["status"] == "proposed"
        act.update_action(cid, a["id"], {"owner": "DAF"})
        act.set_status(cid, a["id"], "committed", actor="a@e.fr")
        act.set_status(cid, a["id"], "done", actor="a@e.fr")
        events = act.list_events(cid, a["id"])
        # proposed (création) → committed → done = 3 events journalisés
        assert [e["status_to"] for e in events] == ["done", "committed", "proposed"]
        assert act.delete_action(cid, a["id"]) is True
