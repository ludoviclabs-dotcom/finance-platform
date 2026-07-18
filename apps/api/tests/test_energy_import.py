"""
test_energy_import.py — import CSV d'activités énergie (PR-06A).

Deux niveaux :
  - `TestParseActivitiesCsv` : parsing PUR (jamais skippé, tourne aussi dans le
    job `tests` /tmp) — en-tête, valeurs, erreurs explicites (aucun fallback).
  - Classes DB-gated : idempotence d'import (réimport = 0 créé), gate de revue
    (pending → accepted), warning sur compteur inconnu, isolation tenant.
"""

from __future__ import annotations

import os
from datetime import date

import pytest

from db.database import db_available
from models.energy import MeterCreate
from services.energy import EnergyError, activities_service, meters_service

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


_CSV_HEADER = "meter_code,carrier,quantity,unit,period_start,period_end"


class TestParseActivitiesCsv:
    """Parsing pur — aucune DB requise, jamais skippé."""

    def test_parses_valid_rows(self):
        csv_text = f"{_CSV_HEADER}\nM1,electricity,12.5,MWh,2026-01-01,2026-01-31\n"
        rows = activities_service.parse_activities_csv(csv_text)
        assert len(rows) == 1
        assert rows[0]["meter_code"] == "M1"
        assert rows[0]["carrier"] == "electricity"
        assert rows[0]["quantity"] == 12.5
        assert rows[0]["period_start"] == date(2026, 1, 1)

    def test_default_unit_when_absent(self):
        rows = activities_service.parse_activities_csv(
            "meter_code,carrier,quantity,period_start,period_end\nM1,gas,5,2026-01-01,2026-01-31\n"
        )
        assert rows[0]["unit"] == "MWh"

    def test_missing_required_column_raises(self):
        with pytest.raises(EnergyError, match="requises manquantes"):
            activities_service.parse_activities_csv("meter_code,carrier,quantity\nM1,gas,5\n")

    def test_invalid_carrier_raises(self):
        with pytest.raises(EnergyError, match="vecteur"):
            activities_service.parse_activities_csv(
                f"{_CSV_HEADER}\nM1,plutonium,5,MWh,2026-01-01,2026-01-31\n"
            )

    def test_invalid_quantity_raises(self):
        with pytest.raises(EnergyError, match="quantité"):
            activities_service.parse_activities_csv(
                f"{_CSV_HEADER}\nM1,electricity,abc,MWh,2026-01-01,2026-01-31\n"
            )

    def test_invalid_date_raises(self):
        with pytest.raises(EnergyError, match="période"):
            activities_service.parse_activities_csv(
                f"{_CSV_HEADER}\nM1,electricity,5,MWh,2026-13-01,2026-01-31\n"
            )

    def test_period_end_before_start_raises(self):
        with pytest.raises(EnergyError, match="period_end"):
            activities_service.parse_activities_csv(
                f"{_CSV_HEADER}\nM1,electricity,5,MWh,2026-03-31,2026-03-01\n"
            )

    def test_empty_csv_raises(self):
        with pytest.raises(EnergyError):
            activities_service.parse_activities_csv("")


@_skip_no_db_url
@_skip_no_psycopg2
class TestImportIdempotencyAndGate:
    def test_import_creates_pending_then_idempotent(self, energy_companies):
        cid = energy_companies["a"]
        meters_service.create_meter(company_id=cid, payload=MeterCreate(carrier="electricity", meter_code="IMP1"))
        csv_text = f"{_CSV_HEADER}\nIMP1,electricity,20,MWh,2026-01-01,2026-01-31\n"

        first = activities_service.import_activities(company_id=cid, filename="conso.csv", csv_text=csv_text)
        assert first.total_rows == 1
        assert first.created == 1
        assert first.review_status == "pending"

        # Réimport du MÊME contenu : idempotent, rien de nouveau.
        second = activities_service.import_activities(company_id=cid, filename="conso.csv", csv_text=csv_text)
        assert second.created == 0
        assert second.skipped == 1
        assert second.import_id == first.import_id

    def test_imported_activity_is_pending_and_can_be_reviewed(self, energy_companies):
        cid = energy_companies["a"]
        meters_service.create_meter(company_id=cid, payload=MeterCreate(carrier="gas", meter_code="IMP2"))
        csv_text = f"{_CSV_HEADER}\nIMP2,gas,8,MWh,2026-02-01,2026-02-28\n"
        activities_service.import_activities(company_id=cid, filename="gas.csv", csv_text=csv_text)

        items, _ = activities_service.list_activities(company_id=cid, review_status="pending", carrier="gas")
        target = next(a for a in items if a.period_start == date(2026, 2, 1))
        assert target.review_status == "pending"

        reviewed = activities_service.review_activity(company_id=cid, activity_id=target.id, decision="accepted")
        assert reviewed.review_status == "accepted"

    def test_unknown_meter_row_warned_and_skipped(self, energy_companies):
        cid = energy_companies["a"]
        meters_service.create_meter(company_id=cid, payload=MeterCreate(carrier="electricity", meter_code="IMP3"))
        csv_text = (
            f"{_CSV_HEADER}\n"
            "IMP3,electricity,10,MWh,2026-03-01,2026-03-31\n"
            "GHOST,electricity,99,MWh,2026-03-01,2026-03-31\n"
        )
        result = activities_service.import_activities(company_id=cid, filename="mix.csv", csv_text=csv_text)
        assert result.total_rows == 2
        assert result.created == 1
        assert any("GHOST" in w for w in result.warnings)


@_skip_no_db_url
@_skip_no_psycopg2
class TestImportRlsIsolation:
    def test_import_scoped_to_tenant(self, energy_companies):
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        meters_service.create_meter(company_id=cid_a, payload=MeterCreate(carrier="electricity", meter_code="ISOIMP"))
        csv_text = f"{_CSV_HEADER}\nISOIMP,electricity,15,MWh,2026-05-01,2026-05-31\n"
        activities_service.import_activities(company_id=cid_a, filename="a.csv", csv_text=csv_text)

        # B ne voit aucune activité de A.
        items_b, _ = activities_service.list_activities(company_id=cid_b, limit=200)
        assert all(a.company_id == cid_b for a in items_b)
