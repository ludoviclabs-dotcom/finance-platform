"""Tests T2.5 — vérification planifiée de la chaîne + badge.

Sans DB :
  - run_verification : chaîne vide → ok, verified_at None, pas d'exception
  - latest_verification / run_all : no-op gracieux
  - endpoints /chain/* protégés par auth
Avec DB (skipif) : store + relecture du dernier résultat.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from main import app
from services import chain_monitor

client = TestClient(app)


class TestChainMonitorNoDb:
    def test_run_verification_empty_chain_ok(self) -> None:
        res = chain_monitor.run_verification(999321)
        assert res["ok"] is True
        assert res["checked"] == 0
        assert res["verified_at"] is None

    def test_latest_verification_none(self) -> None:
        assert chain_monitor.latest_verification(999321) is None

    def test_run_all_noop(self) -> None:
        assert chain_monitor.run_all() == 0


class TestChainEndpointsGuard:
    def test_status_requires_auth(self) -> None:
        assert client.get("/chain/status").status_code in (401, 403)

    def test_verify_requires_admin(self) -> None:
        assert client.post("/chain/verify").status_code in (401, 403)


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="nécessite une vraie DB")
class TestChainMonitorDb:
    def test_run_then_latest(self) -> None:
        company_id = 99231
        chain_monitor.run_verification(company_id)
        latest = chain_monitor.latest_verification(company_id)
        assert latest is not None
        assert latest["ok"] is True
        assert latest["verified_at"] is not None
