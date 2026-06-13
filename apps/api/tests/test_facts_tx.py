"""
test_facts_tx.py — T1.1 : contrat transactionnel de emit_fact.

(a) Test mocké (vert partout, sans DB) : vérifie que SET LOCAL (contexte tenant),
    SELECT ... FOR UPDATE et INSERT s'exécutent sur la MÊME connexion, dans la
    même transaction, avec un SEUL commit en fin (aucun commit intermédiaire).
(b) Test réel (skip si pas de DATABASE_URL_DIRECT) : deux emit_fact concurrents
    produisent une chaîne valide (pas de hash_prev dupliqué).
"""

from __future__ import annotations

import contextlib
import os
from datetime import datetime, timezone

import pytest

from services import facts_service


class _FakeCursor:
    def __init__(self, log: list[str]):
        self.log = log
        self._calls = 0

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params=None):
        self.log.append(sql.strip().split()[0].upper())

    def fetchone(self):
        self._calls += 1
        # 1er fetchone : résultat du SELECT ... FOR UPDATE (aucun event précédent)
        if self._calls == 1:
            return None
        # 2e fetchone : RETURNING de l'INSERT
        return {"id": 1, "computed_at": datetime.now(tz=timezone.utc)}


class _FakeConn:
    def __init__(self, log: list[str]):
        self.log = log
        self.commits = 0
        self.rollbacks = 0

    def cursor(self, *a, **k):
        return _FakeCursor(self.log)

    def commit(self):
        self.commits += 1
        self.log.append("COMMIT")

    def rollback(self):
        self.rollbacks += 1


def test_emit_fact_single_transaction(monkeypatch):
    log: list[str] = []
    conn = _FakeConn(log)

    @contextlib.contextmanager
    def fake_get_db(company_id=None):
        # Reproduit le contrat de db.database.get_db : SET LOCAL puis yield, 1 commit.
        if company_id is not None:
            log.append("SET")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    monkeypatch.setattr(facts_service, "db_available", lambda: True)
    monkeypatch.setattr(facts_service, "get_db", fake_get_db)

    facts_service.emit_fact(
        company_id=42, code="CC.GES.SCOPE1", value=123.456,
        unit="tCO2e", source_path="test:tx",
    )

    # Ordre attendu : contexte tenant -> verrou -> insert -> un seul commit.
    assert log == ["SET", "SELECT", "INSERT", "COMMIT"]
    assert conn.commits == 1
    assert conn.rollbacks == 0


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL_DIRECT"),
    reason="DATABASE_URL_DIRECT requis (connexion directe Neon) — rejeu manuel",
)
def test_emit_fact_concurrent_chain():  # pragma: no cover - exécuté hors CI
    """Deux emit_fact concurrents sur connexion directe : chaîne intègre."""
    import threading

    company_id = 999
    errors: list[Exception] = []

    def worker(i: int):
        try:
            facts_service.emit_fact(
                company_id=company_id, code=f"CONC.{i}", value=float(i),
                unit="t", source_path=f"test:conc:{i}",
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    result = facts_service.verify_chain(company_id)
    assert result.ok, f"chaîne cassée à l'event {result.broken_at}"
