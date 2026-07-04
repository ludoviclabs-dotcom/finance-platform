"""Tests T4.4 — périmètre & consolidation multi-entités.

Pur (sans DB) : pondération, consolidation (1 groupe + 2 filiales = somme
pondérée selon l'approche), validation, gardes auth. Roundtrip DB sous skipif.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import consolidation_service as cons

client = TestClient(app)

ENTITIES = [
    {"company_id": 1, "ownership_pct": 100, "facts": {"CC.GES.SCOPE1": 100.0}},
    {"company_id": 2, "ownership_pct": 60, "facts": {"CC.GES.SCOPE1": 50.0}},
    {"company_id": 3, "ownership_pct": 40, "facts": {"CC.GES.SCOPE1": 30.0}},
]


class TestWeight:
    def test_control_full(self) -> None:
        assert cons.weight_for("operational", 60) == 1.0
        assert cons.weight_for("financial", 30) == 1.0

    def test_equity_prorata(self) -> None:
        assert cons.weight_for("equity", 60) == 0.6
        assert cons.weight_for("equity", 150) == 1.0  # borné


class TestConsolidate:
    def test_operational_sum(self) -> None:
        # 1 groupe + 2 filiales, contrôle opérationnel → 100 + 50 + 30 = 180.
        r = cons.consolidate(ENTITIES, "operational")
        assert r["kpis"]["CC.GES.SCOPE1"] == 180.0
        assert r["entity_count"] == 3

    def test_equity_weighted(self) -> None:
        # parts de capital → 100·1 + 50·0.6 + 30·0.4 = 142.
        r = cons.consolidate(ENTITIES, "equity")
        assert r["kpis"]["CC.GES.SCOPE1"] == 142.0

    def test_invalid_approach(self) -> None:
        with pytest.raises(cons.ConsolidationError):
            cons.consolidate(ENTITIES, "wat")

    def test_three_approaches(self) -> None:
        assert set(cons.APPROACHES) == {"operational", "financial", "equity"}


class TestEndpoints:
    def test_group_requires_auth(self) -> None:
        assert client.get("/consolidation/group").status_code in (401, 403)

    def test_approach_requires_admin(self) -> None:
        assert client.post("/consolidation/approach", json={"approach": "equity"}).status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestRoundtripDb:
    def test_set_approach_journaled(self) -> None:
        cid = 99441
        res = cons.set_approach(company_id=cid, approach="equity", actor="a@e.fr")
        assert res["approach"] == "equity"
        assert cons.get_perimeter(cid)["approach"] == "equity"
