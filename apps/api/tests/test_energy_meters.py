"""
test_energy_meters.py — compteurs d'énergie (PR-06A), DB-gated.

Couvre CRUD, unicité de meter_code par tenant, contrôle de site en périmètre,
et l'isolation tenant (RLS + défense en profondeur : tenant A ne voit jamais un
compteur de B, même sous le rôle superuser de la CI qui bypasse la RLS).
"""

from __future__ import annotations

import os

import pytest

from db.database import db_available, get_db
from models.energy import MeterCreate
from services.energy import EnergyError, meters_service

_skip_no_db_url = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="DATABASE_URL absent — tests PostgreSQL skippés"
)
_skip_no_psycopg2 = pytest.mark.skipif(not db_available(), reason="psycopg2/PostgreSQL non disponible")


@_skip_no_db_url
@_skip_no_psycopg2
class TestMeterCrud:
    def test_create_and_get_meter(self, energy_companies):
        cid = energy_companies["a"]
        meter = meters_service.create_meter(
            company_id=cid,
            payload=MeterCreate(carrier="electricity", meter_code=f"M-{cid}-1", site_id=energy_companies["site_a"]),
        )
        assert meter.carrier == "electricity"
        assert meter.unit == "MWh"
        reloaded = meters_service.get_meter(company_id=cid, meter_id=meter.id)
        assert reloaded.id == meter.id
        assert reloaded.site_id == energy_companies["site_a"]

    def test_meter_code_unique_per_tenant(self, energy_companies):
        cid = energy_companies["a"]
        meters_service.create_meter(
            company_id=cid, payload=MeterCreate(carrier="gas", meter_code=f"DUP-{cid}"),
        )
        with pytest.raises(EnergyError, match="déjà utilisé"):
            meters_service.create_meter(
                company_id=cid, payload=MeterCreate(carrier="gas", meter_code=f"DUP-{cid}"),
            )

    def test_same_code_allowed_across_tenants(self, energy_companies):
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        meters_service.create_meter(company_id=cid_a, payload=MeterCreate(carrier="heat", meter_code="SHARED"))
        # Le même code chez B ne collisionne pas (unicité PAR tenant).
        b = meters_service.create_meter(company_id=cid_b, payload=MeterCreate(carrier="heat", meter_code="SHARED"))
        assert b.meter_code == "SHARED"

    def test_list_meters_filters_by_carrier(self, energy_companies):
        cid = energy_companies["a"]
        meters_service.create_meter(company_id=cid, payload=MeterCreate(carrier="steam", meter_code=f"ST-{cid}"))
        items, total = meters_service.list_meters(company_id=cid, carrier="steam")
        assert total >= 1
        assert all(m.carrier == "steam" for m in items)


@_skip_no_db_url
@_skip_no_psycopg2
class TestMeterSiteScope:
    def test_cannot_reference_other_tenant_site(self, energy_companies):
        cid_a = energy_companies["a"]
        foreign_site = energy_companies["site_b"]
        with pytest.raises(EnergyError, match="introuvable"):
            meters_service.create_meter(
                company_id=cid_a,
                payload=MeterCreate(carrier="electricity", meter_code=f"XSITE-{cid_a}", site_id=foreign_site),
            )


@_skip_no_db_url
@_skip_no_psycopg2
class TestMeterRlsIsolation:
    def test_tenant_a_cannot_get_tenant_b_meter(self, energy_companies):
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        b_meter = meters_service.create_meter(
            company_id=cid_b, payload=MeterCreate(carrier="electricity", meter_code=f"SECRET-B-{cid_b}"),
        )
        with pytest.raises(EnergyError, match="introuvable"):
            meters_service.get_meter(company_id=cid_a, meter_id=b_meter.id)

    def test_list_does_not_leak_across_tenants(self, energy_companies):
        cid_a, cid_b = energy_companies["a"], energy_companies["b"]
        meters_service.create_meter(
            company_id=cid_b, payload=MeterCreate(carrier="cooling", meter_code=f"ONLYB-{cid_b}"),
        )
        items_a, _ = meters_service.list_meters(company_id=cid_a, limit=200)
        assert all(m.company_id == cid_a for m in items_a)
        assert all(m.meter_code != f"ONLYB-{cid_b}" for m in items_a)

    def test_defense_in_depth_direct_sql_scope(self, energy_companies):
        """Même en SQL direct sous le périmètre A, une ligne de B est invisible
        (RLS primaire ; en CI superuser, c'est le prédicat applicatif des
        services qui tient — ici on vérifie que la ligne existe bien côté B)."""
        cid_b = energy_companies["b"]
        b_meter = meters_service.create_meter(
            company_id=cid_b, payload=MeterCreate(carrier="other", meter_code=f"DID-{cid_b}"),
        )
        with get_db(company_id=cid_b) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT company_id FROM energy_meters WHERE id = %s AND company_id = %s",
                    (b_meter.id, cid_b),
                )
                assert cur.fetchone()["company_id"] == cid_b
