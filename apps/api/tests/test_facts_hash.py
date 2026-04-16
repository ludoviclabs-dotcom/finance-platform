"""
test_facts_hash.py — Tests unitaires pour la chaîne hash Merkle de facts_service.

Vérifie :
  - compute_hash est déterministe
  - compute_hash change si un champ change
  - Une chaîne de 100 events simulée est vérifiable
  - Une altération de valeur (tamper) est détectée par verify_chain simulé

Ces tests ne nécessitent PAS de base de données.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from services.facts_service import ChainVerification, compute_hash, verify_chain


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ts(second: int = 0) -> datetime:
    from datetime import timedelta
    base = datetime(2026, 4, 16, 10, 0, 0, 0, tzinfo=timezone.utc)
    return base + timedelta(seconds=second)


def _make_chain(n: int) -> list[dict]:
    """Génère une chaîne de n events valide en mémoire."""
    events = []
    prev = None
    for i in range(n):
        ev = {
            "id": i + 1,
            "company_id": 1,
            "code": f"carbon.kpi{i % 5}",
            "value": float(i * 1.5),
            "unit": "tCO2e",
            "ef_id": None,
            "source_path": f"master!Sheet!C{i+1}",
            "computed_at": _ts(i),
            "hash_prev": prev,
            "hash_self": None,
        }
        ev["hash_self"] = compute_hash(
            hash_prev=prev,
            company_id=ev["company_id"],
            code=ev["code"],
            value=ev["value"],
            unit=ev["unit"],
            ef_id=ev["ef_id"],
            source_path=ev["source_path"],
            computed_at=ev["computed_at"],
        )
        prev = ev["hash_self"]
        events.append(ev)
    return events


# ── Tests compute_hash ────────────────────────────────────────────────────────

class TestComputeHash:
    def test_deterministic(self):
        kwargs = dict(
            hash_prev=None,
            company_id=1,
            code="carbon.scope1Tco2e",
            value=42.5,
            unit="tCO2e",
            ef_id=None,
            source_path="master",
            computed_at=_ts(0),
        )
        assert compute_hash(**kwargs) == compute_hash(**kwargs)

    def test_returns_64_char_hex(self):
        h = compute_hash(
            hash_prev=None, company_id=1, code="x", value=1.0,
            unit="t", ef_id=None, source_path="s", computed_at=_ts(),
        )
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_changes_on_value(self):
        base = dict(hash_prev=None, company_id=1, code="x", value=1.0,
                    unit="t", ef_id=None, source_path="s", computed_at=_ts())
        h1 = compute_hash(**base)
        h2 = compute_hash(**{**base, "value": 2.0})
        assert h1 != h2

    def test_changes_on_company_id(self):
        base = dict(hash_prev=None, company_id=1, code="x", value=1.0,
                    unit="t", ef_id=None, source_path="s", computed_at=_ts())
        h1 = compute_hash(**base)
        h2 = compute_hash(**{**base, "company_id": 2})
        assert h1 != h2

    def test_changes_on_code(self):
        base = dict(hash_prev=None, company_id=1, code="a", value=1.0,
                    unit="t", ef_id=None, source_path="s", computed_at=_ts())
        assert compute_hash(**base) != compute_hash(**{**base, "code": "b"})

    def test_changes_on_hash_prev(self):
        base = dict(hash_prev=None, company_id=1, code="x", value=1.0,
                    unit="t", ef_id=None, source_path="s", computed_at=_ts())
        h1 = compute_hash(**base)
        h2 = compute_hash(**{**base, "hash_prev": "a" * 64})
        assert h1 != h2

    def test_genesis_no_prev(self):
        ts = _ts(0)
        h = compute_hash(
            hash_prev=None, company_id=1, code="x", value=1.0,
            unit="t", ef_id=None, source_path="s", computed_at=ts,
        )
        raw = f"GENESIS|1|x|1.000000|t||s|{ts.isoformat(timespec='microseconds')}"
        assert h == hashlib.sha256(raw.encode()).hexdigest()

    def test_none_value_formatted_as_empty(self):
        ts = _ts(0)
        h_none = compute_hash(
            hash_prev=None, company_id=1, code="x", value=None,
            unit="t", ef_id=None, source_path="s", computed_at=ts,
        )
        raw = f"GENESIS|1|x||t||s|{ts.isoformat(timespec='microseconds')}"
        assert h_none == hashlib.sha256(raw.encode()).hexdigest()

    def test_float_precision_6_decimals(self):
        h1 = compute_hash(hash_prev=None, company_id=1, code="x", value=1.000000001,
                          unit="t", ef_id=None, source_path="s", computed_at=_ts())
        h2 = compute_hash(hash_prev=None, company_id=1, code="x", value=1.000000,
                          unit="t", ef_id=None, source_path="s", computed_at=_ts())
        # Arrondi à 6 décimales : ces deux valeurs donnent le même hash
        assert h1 == h2


# ── Tests verify_chain (simulé, sans DB) ────────────────────────────────────

class TestVerifyChainSimulated:
    def _verify_in_memory(self, events: list[dict]) -> ChainVerification:
        """Réimplémentation locale de verify_chain sur liste en mémoire."""
        prev: str | None = None
        for i, ev in enumerate(events):
            expected = compute_hash(
                hash_prev=prev,
                company_id=ev["company_id"],
                code=ev["code"],
                value=float(ev["value"]) if ev["value"] is not None else None,
                unit=ev["unit"],
                ef_id=ev["ef_id"],
                source_path=ev["source_path"],
                computed_at=ev["computed_at"],
            )
            if ev["hash_self"] != expected:
                return ChainVerification(ok=False, broken_at=ev["id"], checked=i)
            prev = ev["hash_self"]
        return ChainVerification(ok=True, broken_at=None, checked=len(events))

    def test_valid_chain_100_events(self):
        chain = _make_chain(100)
        result = self._verify_in_memory(chain)
        assert result.ok is True
        assert result.broken_at is None
        assert result.checked == 100

    def test_valid_chain_1_event(self):
        chain = _make_chain(1)
        result = self._verify_in_memory(chain)
        assert result.ok is True

    def test_tamper_value_detected(self):
        chain = _make_chain(10)
        # Altérer silencieusement la valeur de l'event 5 sans recalculer son hash
        chain[4]["value"] = 999.0
        result = self._verify_in_memory(chain)
        assert result.ok is False
        assert result.broken_at == chain[4]["id"]

    def test_tamper_first_event_detected(self):
        chain = _make_chain(5)
        chain[0]["value"] = -1.0
        result = self._verify_in_memory(chain)
        assert result.ok is False
        assert result.broken_at == chain[0]["id"]

    def test_tamper_last_event_detected(self):
        chain = _make_chain(5)
        chain[-1]["source_path"] = "tampered!"
        result = self._verify_in_memory(chain)
        assert result.ok is False

    def test_empty_chain_is_valid(self):
        result = self._verify_in_memory([])
        assert result.ok is True
        assert result.checked == 0

    def test_hash_prev_links_are_correct(self):
        """Vérifie que chaque hash_prev pointe bien vers le hash_self précédent."""
        chain = _make_chain(10)
        for i in range(1, len(chain)):
            assert chain[i]["hash_prev"] == chain[i - 1]["hash_self"]
        assert chain[0]["hash_prev"] is None


# ── Test verify_chain DB (skip si pas de DB) ─────────────────────────────────

@pytest.mark.skipif(
    not __import__("os").environ.get("DATABASE_URL"),
    reason="DATABASE_URL absent — test DB skippé",
)
def test_verify_chain_db_empty_company():
    """verify_chain sur une company sans facts retourne ok=True."""
    result = verify_chain(company_id=99999)
    assert result.ok is True
    assert result.checked == 0
