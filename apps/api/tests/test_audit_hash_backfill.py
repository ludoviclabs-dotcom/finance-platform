"""
test_audit_hash_backfill.py — T1.1 : backfill hash Merkle de audit_events.

Teste la fonction pure _compute_audit_hash (déterminisme, GENESIS, chaînage) et
l'idempotence du point d'entrée backfill() en mode dégradé (sans DB → no-op).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "migrate_audit_hash.py"
_spec = importlib.util.spec_from_file_location("migrate_audit_hash", _SCRIPT)
mah = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mah)


def _row(**over):
    from datetime import datetime, timezone
    base = dict(
        hash_prev=None, company_id=1, event_type="ingest", title="t",
        detail="d", status="ok", meta_json="", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    base.update(over)
    return base


def test_compute_hash_deterministic():
    h1 = mah._compute_audit_hash(**_row())
    h2 = mah._compute_audit_hash(**_row())
    assert h1 == h2
    assert len(h1) == 64


def test_compute_hash_genesis_vs_chained():
    genesis = mah._compute_audit_hash(**_row(hash_prev=None))
    chained = mah._compute_audit_hash(**_row(hash_prev="a" * 64))
    assert genesis != chained


def test_compute_hash_sensitive_to_fields():
    base = mah._compute_audit_hash(**_row())
    changed = mah._compute_audit_hash(**_row(title="autre"))
    assert base != changed


def test_backfill_noop_without_db(monkeypatch):
    # conftest force DATABASE_URL="" → db_available() False → backfill no-op idempotent.
    monkeypatch.setattr(mah, "db_available", lambda: False)
    assert mah.backfill(dry_run=False) == 0
    assert mah.backfill(dry_run=True) == 0
