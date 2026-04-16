"""
test_facts_integration.py — Tests intégration du pipeline facts complet.

Vérifie sans DB (mode mock) :
  - Le mapping SNAPSHOT_FIELD_TO_FACT_CODE est cohérent avec SNAPSHOT_FIELD_TO_KEY
  - _emit_carbon_facts ne crashe pas quand emit_fact retourne None (mode dégradé)
  - Les codes CC.* sont uniques et bien formés

Tests DB (skippés si DATABASE_URL absent) :
  - ingest master → N facts créés en DB
  - /facts/{code}/trail répond < 500ms sur 100 events
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ── Tests sans DB ────────────────────────────────────────────────────────────

class TestFactMapping:
    def test_fact_code_mapping_keys_are_valid_field_paths(self):
        from services.carbon_service import SNAPSHOT_FIELD_TO_FACT_CODE, SNAPSHOT_FIELD_TO_KEY

        fact_keys = set(SNAPSHOT_FIELD_TO_FACT_CODE.keys())
        snapshot_keys = set(SNAPSHOT_FIELD_TO_KEY.keys())

        # Tous les fact codes doivent correspondre à un champ extrait
        orphans = fact_keys - snapshot_keys
        assert not orphans, f"Fact codes sans extraction correspondante : {orphans}"

    def test_fact_codes_are_unique(self):
        from services.carbon_service import SNAPSHOT_FIELD_TO_FACT_CODE

        codes = [c[0] for c in SNAPSHOT_FIELD_TO_FACT_CODE.values()]
        dups = [c for c in set(codes) if codes.count(c) > 1]
        assert not dups, f"Fact codes dupliqués : {dups}"

    def test_fact_codes_start_with_cc_namespace(self):
        from services.carbon_service import SNAPSHOT_FIELD_TO_FACT_CODE

        bad = [c for c, u in SNAPSHOT_FIELD_TO_FACT_CODE.values() if not c.startswith("CC.")]
        assert not bad, f"Codes hors namespace CC.* : {bad}"

    def test_all_fact_units_populated(self):
        from services.carbon_service import SNAPSHOT_FIELD_TO_FACT_CODE

        missing = [fp for fp, (c, u) in SNAPSHOT_FIELD_TO_FACT_CODE.items() if not u]
        assert not missing, f"Unités manquantes : {missing}"


class TestEmitCarbonFactsRobustness:
    """_emit_carbon_facts doit être résilient : ne jamais casser l'ingest."""

    def test_none_emit_fact_does_not_crash(self):
        """Si facts_service.emit_fact retourne None (mode dégradé), pas d'exception."""
        from services.carbon_service import _emit_carbon_facts

        snapshot_data = {
            "company": {"revenueNetEur": 1_000_000},
            "carbon": {"scope1Tco2e": 100.0, "scope2LbTco2e": 50.0, "totalS123Tco2e": 200.0},
            "energy": {},
            "taxonomy": {},
            "cbam": {},
            "sbti": {},
        }

        with patch("services.facts_service.emit_fact", return_value=None):
            result = _emit_carbon_facts(
                snapshot_data=snapshot_data,
                company_id=1,
                source_label="test",
                source_filename="test.xlsx",
            )
            assert result == 0  # rien inséré, mais pas de crash

    def test_exception_in_emit_fact_does_not_crash(self):
        """Une exception dans emit_fact doit être loggée mais ne pas remonter."""
        from services.carbon_service import _emit_carbon_facts

        snapshot_data = {
            "carbon": {"scope1Tco2e": 10.0},
            "company": {}, "energy": {}, "taxonomy": {}, "cbam": {}, "sbti": {},
        }

        with patch("services.facts_service.emit_fact", side_effect=RuntimeError("boom")):
            with patch("services.facts_service.refresh_facts_current"):
                # Ne doit pas lever
                result = _emit_carbon_facts(
                    snapshot_data=snapshot_data, company_id=1,
                    source_label="test", source_filename="t.xlsx",
                )
                assert result == 0

    def test_non_numeric_values_are_skipped(self):
        """Un KPI string doit être skip sans crash."""
        from services.carbon_service import _emit_carbon_facts

        snapshot_data = {
            "carbon": {"scope1Tco2e": "not a number"},  # string invalide
            "company": {}, "energy": {}, "taxonomy": {}, "cbam": {}, "sbti": {},
        }

        with patch("services.facts_service.emit_fact") as mock_emit:
            _emit_carbon_facts(
                snapshot_data=snapshot_data, company_id=1,
                source_label="test", source_filename="t.xlsx",
            )
            # emit_fact ne doit jamais être appelé pour scope1Tco2e (string)
            for call in mock_emit.call_args_list:
                assert call.kwargs["code"] != "CC.GES.SCOPE1"


# ── Tests DB/perf (skip si pas de DATABASE_URL) ─────────────────────────────

@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL absent — tests DB skippés",
)
class TestFactsTrailPerf:
    def test_trail_under_500ms_on_100_events(self):
        """GET /facts/{code}/trail doit répondre en < 500ms sur 100 events."""
        from services.facts_service import emit_fact, get_trail

        company_id = 999_999  # ID réservé aux tests perf
        # Seed 100 events
        for i in range(100):
            emit_fact(
                company_id=company_id,
                code="perf.test.kpi",
                value=float(i),
                unit="t",
                ef_id=None,
                source_path=f"perf_test:iter={i}",
                meta={"iter": i},
            )

        start = time.perf_counter()
        events = get_trail(code="perf.test.kpi", company_id=company_id, limit=100)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(events) == 100
        assert elapsed_ms < 500, f"get_trail trop lent : {elapsed_ms:.1f}ms (cible < 500ms)"

        # Cleanup
        from db.database import get_db
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM facts_events WHERE company_id = %s", (company_id,))
