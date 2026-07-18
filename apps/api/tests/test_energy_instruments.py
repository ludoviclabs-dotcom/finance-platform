"""
test_energy_instruments.py — instruments contractuels & allocations (PR-06A),
DB-gated.

Cœur de la PR : l'anti-double-allocation est garanti EN BASE (contrainte UNIQUE
+ trigger `energy_allocation_guard`), pas seulement en Python. On prouve les
DEUX niveaux : le refus lisible côté service ET la barrière SQL directe (qui
tient même en contournant le service). Plus : couverture/expiry, compatibilité
vecteur/période, isolation tenant.
"""

from __future__ import annotations

import os
from datetime import date

import pytest

from db.database import db_available, get_db
from models.energy import AllocationRequest, InstrumentCreate, MeterCreate
from services.energy import EnergyError, instruments_service, meters_service

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


def _make_activity(cid: int, meter_id: int, site_id: int | None, carrier: str,
                   start: date, end: date, quantity: float = 10.0) -> int:
    with get_db(company_id=cid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO energy_activities
                    (company_id, meter_id, site_id, carrier, quantity, unit,
                     period_start, period_end, data_status, review_status)
                VALUES (%s, %s, %s, %s, %s, 'MWh', %s, %s, 'manual', 'accepted')
                RETURNING id
                """,
                (cid, meter_id, site_id, carrier, quantity, start, end),
            )
            return cur.fetchone()["id"]


def _make_meter(cid: int, code: str, carrier: str = "electricity") -> int:
    return meters_service.create_meter(
        company_id=cid, payload=MeterCreate(carrier=carrier, meter_code=code),
    ).id


@_skip_no_db_url
@_skip_no_psycopg2
class TestInstrumentCrudAndCoverage:
    def test_create_instrument_defaults(self, energy_companies):
        cid = energy_companies["a"]
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="go", volume_mwh=100.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        assert inst.carrier == "electricity"
        assert inst.status == "active"
        assert inst.allocated_mwh == 0.0
        assert inst.remaining_mwh == 100.0

    def test_coverage_reflects_allocations(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"COV-{cid}")
        activity = _make_activity(cid, meter, None, "electricity", date(2026, 3, 1), date(2026, 3, 31))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="rec", volume_mwh=50.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        instruments_service.allocate_instrument(
            company_id=cid, instrument_id=inst.id,
            payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=20.0), allocated_by=None,
        )
        reloaded = instruments_service.get_instrument(company_id=cid, instrument_id=inst.id)
        assert reloaded.allocated_mwh == 20.0
        assert reloaded.remaining_mwh == 30.0


@_skip_no_db_url
@_skip_no_psycopg2
class TestAntiDoubleAllocation:
    def test_over_allocation_refused_by_service(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"OVER-{cid}")
        a1 = _make_activity(cid, meter, None, "electricity", date(2026, 1, 1), date(2026, 1, 31))
        a2 = _make_activity(cid, meter, None, "electricity", date(2026, 2, 1), date(2026, 2, 28))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="rec", volume_mwh=100.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        instruments_service.allocate_instrument(
            company_id=cid, instrument_id=inst.id,
            payload=AllocationRequest(energy_activity_id=a1, allocated_mwh=70.0), allocated_by=None,
        )
        with pytest.raises(EnergyError, match="Dépassement"):
            instruments_service.allocate_instrument(
                company_id=cid, instrument_id=inst.id,
                payload=AllocationRequest(energy_activity_id=a2, allocated_mwh=40.0), allocated_by=None,
            )

    def test_over_allocation_refused_at_db_level_directly(self, energy_companies):
        """Barrière SQL : même en contournant le service (INSERT direct), le
        trigger `energy_allocation_guard` refuse la survente."""
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"DBGUARD-{cid}")
        a1 = _make_activity(cid, meter, None, "electricity", date(2026, 4, 1), date(2026, 4, 30))
        a2 = _make_activity(cid, meter, None, "electricity", date(2026, 5, 1), date(2026, 5, 31))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="rec", volume_mwh=100.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        instruments_service.allocate_instrument(
            company_id=cid, instrument_id=inst.id,
            payload=AllocationRequest(energy_activity_id=a1, allocated_mwh=80.0), allocated_by=None,
        )
        with pytest.raises(Exception, match="energy_scope2"):
            with get_db(company_id=cid) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO instrument_allocations "
                        "(company_id, instrument_id, energy_activity_id, allocated_mwh) "
                        "VALUES (%s, %s, %s, %s)",
                        (cid, inst.id, a2, 30.0),
                    )

    def test_double_allocation_same_pair_refused_by_service(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"PAIR-{cid}")
        activity = _make_activity(cid, meter, None, "electricity", date(2026, 6, 1), date(2026, 6, 30))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="go", volume_mwh=100.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        instruments_service.allocate_instrument(
            company_id=cid, instrument_id=inst.id,
            payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=10.0), allocated_by=None,
        )
        with pytest.raises(EnergyError, match="[Dd]ouble allocation"):
            instruments_service.allocate_instrument(
                company_id=cid, instrument_id=inst.id,
                payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=5.0), allocated_by=None,
            )

    def test_double_allocation_same_pair_refused_at_db_level(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"PAIRDB-{cid}")
        activity = _make_activity(cid, meter, None, "electricity", date(2026, 7, 1), date(2026, 7, 31))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="go", volume_mwh=100.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        instruments_service.allocate_instrument(
            company_id=cid, instrument_id=inst.id,
            payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=10.0), allocated_by=None,
        )
        # UNIQUE(instrument_id, energy_activity_id) refuse le doublon même en SQL direct.
        with pytest.raises(Exception):
            with get_db(company_id=cid) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO instrument_allocations "
                        "(company_id, instrument_id, energy_activity_id, allocated_mwh) "
                        "VALUES (%s, %s, %s, %s)",
                        (cid, inst.id, activity, 5.0),
                    )


@_skip_no_db_url
@_skip_no_psycopg2
class TestAllocationCompatibility:
    def test_expired_instrument_refused(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"EXP-{cid}")
        activity = _make_activity(cid, meter, None, "electricity", date(2025, 3, 1), date(2025, 3, 31))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="rec", volume_mwh=100.0,
                valid_from=date(2025, 1, 1), valid_to=date(2025, 12, 31),  # expiré (< aujourd'hui)
            ),
        )
        assert instruments_service.get_instrument(company_id=cid, instrument_id=inst.id).is_expired is True
        with pytest.raises(EnergyError, match="expiré"):
            instruments_service.allocate_instrument(
                company_id=cid, instrument_id=inst.id,
                payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=10.0), allocated_by=None,
            )

    def test_incompatible_carrier_refused(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"CARR-{cid}", carrier="gas")
        activity = _make_activity(cid, meter, None, "gas", date(2026, 3, 1), date(2026, 3, 31))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="rec", volume_mwh=100.0, carrier="electricity",
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        with pytest.raises(EnergyError, match="[Vv]ecteur incompatible"):
            instruments_service.allocate_instrument(
                company_id=cid, instrument_id=inst.id,
                payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=10.0), allocated_by=None,
            )

    def test_period_out_of_validity_refused(self, energy_companies):
        cid = energy_companies["a"]
        meter = _make_meter(cid, f"PER-{cid}")
        # Activité de mars, instrument valide seulement à partir de juin.
        activity = _make_activity(cid, meter, None, "electricity", date(2026, 3, 1), date(2026, 3, 31))
        inst = instruments_service.create_instrument(
            company_id=cid,
            payload=InstrumentCreate(
                instrument_type="rec", volume_mwh=100.0,
                valid_from=date(2026, 6, 1), valid_to=date(2026, 12, 31),
            ),
        )
        with pytest.raises(EnergyError, match="[Pp]ériode incompatible"):
            instruments_service.allocate_instrument(
                company_id=cid, instrument_id=inst.id,
                payload=AllocationRequest(energy_activity_id=activity, allocated_mwh=10.0), allocated_by=None,
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestInstrumentRlsIsolation:
    def test_tenant_a_cannot_get_tenant_b_instrument(self, energy_companies):
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        inst_b = instruments_service.create_instrument(
            company_id=cid_b,
            payload=InstrumentCreate(
                instrument_type="ppa", volume_mwh=10.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        with pytest.raises(EnergyError, match="introuvable"):
            instruments_service.get_instrument(company_id=cid_a, instrument_id=inst_b.id)

    def test_cannot_allocate_across_tenants(self, energy_companies):
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        inst_b = instruments_service.create_instrument(
            company_id=cid_b,
            payload=InstrumentCreate(
                instrument_type="ppa", volume_mwh=100.0,
                valid_from=date(2026, 1, 1), valid_to=date(2026, 12, 31),
            ),
        )
        meter_a = _make_meter(cid_a, f"ISOA-{cid_a}")
        activity_a = _make_activity(cid_a, meter_a, None, "electricity", date(2026, 3, 1), date(2026, 3, 31))
        # A tente d'allouer l'instrument de B : instrument hors périmètre -> introuvable.
        with pytest.raises(EnergyError, match="introuvable"):
            instruments_service.allocate_instrument(
                company_id=cid_a, instrument_id=inst_b.id,
                payload=AllocationRequest(energy_activity_id=activity_a, allocated_mwh=5.0), allocated_by=None,
            )
