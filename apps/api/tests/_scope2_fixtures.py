"""
_scope2_fixtures.py — état PostgreSQL pour les tests du moteur Scope 2 dual
(PR-06B). Pas un fichier de test (pas de préfixe `test_`, jamais collecté) —
même convention que `_migration_fixtures.py` / `_energy_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à 033 inclus (donc
001-031 + 033 ; 032 est réservée à une PR sœur non mergée — `apply_upto`
n'applique que les fichiers PRÉSENTS). Crée deux companies dédiées
(`s2-test-a/b`) avec site, compteur, facteurs et métadonnées de facteurs, plus
un teardown complet.
"""

from __future__ import annotations

from datetime import date

import pytest

from db.database import get_db

from ._migration_fixtures import apply_ddl_inline, apply_upto

# Ordre enfants → parents. Le teardown pose de toute façon
# session_replication_role=replica (désactive triggers de FK ET triggers
# utilisateur, dont l'immutabilité des runs).
SCOPE2_TABLES = (
    "scope2_line_results",
    "scope2_calculation_runs",
    "instrument_allocations",
    "energy_factor_metadata",
    "energy_activities",
    "contractual_instruments",
    "energy_meters",
)

# Facteurs de test — codes préfixés `S2TEST-` pour ne jamais collisionner avec
# un facteur réel du catalogue ADEME dans la même base CI.
TEST_FACTORS = (
    # (ef_code, factor_kgco2e par kWh, label)
    ("S2TEST-GRID-FR", 0.05, "Réseau FR (test) — 50 kgCO2e/MWh"),
    ("S2TEST-GRID-FR-IDF", 0.03, "Réseau FR-IDF (test) — 30 kgCO2e/MWh"),
    ("S2TEST-RESIDUAL-FR", 0.09, "Mix résiduel FR (test) — 90 kgCO2e/MWh"),
    ("S2TEST-SUPPLIER-FR", 0.02, "Facteur fournisseur FR (test) — 20 kgCO2e/MWh"),
)


def build_scope2_db(conn) -> None:
    """DDL historique + 001-033 (fondation énergie 031 + moteur 033)."""
    apply_ddl_inline(conn)
    apply_upto(conn, "033")


@pytest.fixture(scope="module")
def scope2_schema():
    """Applique le schéma jusqu'à 033 une fois par module de test."""
    with get_db() as conn:
        build_scope2_db(conn)


@pytest.fixture(scope="module")
def scope2_env(scope2_schema):
    """2 companies + site + compteur + facteurs candidats par tenant.

    Renvoie `{a, b, site_a, site_b, meter_a, meter_b, ef}` où `ef` mappe
    `ef_code → id` du catalogue global `emission_factors`.
    """
    ids: list[int] = []
    sites: dict[str, int] = {}
    meters: dict[str, int] = {}
    ef_ids: dict[str, int] = {}

    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("s2-test-a", "s2-test-b"):
                cur.execute(
                    """
                    INSERT INTO companies (name, slug, plan)
                    VALUES (%s, %s, 'starter')
                    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (slug.upper(), slug),
                )
                ids.append(cur.fetchone()["id"])
            # `emission_factors` est un catalogue GLOBAL sans RLS (migration 001).
            for ef_code, value, label in TEST_FACTORS:
                cur.execute(
                    """
                    INSERT INTO emission_factors
                        (ef_code, label, scope, category, factor_kgco2e, unit, source, version)
                    VALUES (%s, %s, 2, 'energy', %s, 'kWh', 'TEST', 'v2025')
                    ON CONFLICT (ef_code, version) DO UPDATE SET label = EXCLUDED.label
                    RETURNING id
                    """,
                    (ef_code, label, value),
                )
                ef_ids[ef_code] = cur.fetchone()["id"]

    cid_a, cid_b = ids
    for key, cid in (("a", cid_a), ("b", cid_b)):
        with get_db(company_id=cid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sites (company_id, name)
                    VALUES (%s, %s)
                    ON CONFLICT (company_id, name) DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (cid, f"Site scope2 {key}"),
                )
                sites[key] = cur.fetchone()["id"]
                cur.execute(
                    """
                    INSERT INTO energy_meters (company_id, site_id, carrier, meter_code, unit)
                    VALUES (%s, %s, 'electricity', %s, 'MWh')
                    ON CONFLICT (company_id, meter_code) DO UPDATE SET updated_at = now()
                    RETURNING id
                    """,
                    (cid, sites[key], f"S2-METER-{key.upper()}"),
                )
                meters[key] = cur.fetchone()["id"]

    yield {
        "a": cid_a, "b": cid_b,
        "site_a": sites["a"], "site_b": sites["b"],
        "meter_a": meters["a"], "meter_b": meters["b"],
        "ef": ef_ids,
    }

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
            for table in SCOPE2_TABLES:
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM export_packages WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM facts_events WHERE company_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM sites WHERE company_id = ANY(%s)", (ids,))
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))
            cur.execute(
                "DELETE FROM emission_factors WHERE ef_code = ANY(%s)",
                ([code for code, _, _ in TEST_FACTORS],),
            )


# ---------------------------------------------------------------------------
# Helpers d'insertion (utilisés par les tests, pas des fixtures pytest)
# ---------------------------------------------------------------------------

def add_factor_metadata(
    *, company_id: int, ef_id: int, basis: str, geography_code: str | None,
    carrier: str = "electricity", source_release_id: int | None = None,
) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO energy_factor_metadata
                    (company_id, ef_id, carrier, geography_code, basis, source_release_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (company_id, ef_id, carrier, geography_code, basis, source_release_id),
            )
            return cur.fetchone()["id"]


def add_activity(
    *, company_id: int, meter_id: int, site_id: int, quantity: float,
    period_start: date, period_end: date, unit: str = "MWh",
    carrier: str = "electricity", review_status: str = "accepted",
) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO energy_activities
                    (company_id, meter_id, site_id, carrier, quantity, unit,
                     period_start, period_end, data_status, review_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'manual', %s)
                ON CONFLICT (company_id, meter_id, period_start, period_end)
                    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
                RETURNING id
                """,
                (company_id, meter_id, site_id, carrier, quantity, unit,
                 period_start, period_end, review_status),
            )
            return cur.fetchone()["id"]


def add_instrument(
    *, company_id: int, volume_mwh: float, valid_from: date, valid_to: date,
    carrier: str = "electricity", certificate_artifact_id: int | None = None,
) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO contractual_instruments
                    (company_id, instrument_type, carrier, volume_mwh, valid_from,
                     valid_to, certificate_artifact_id)
                VALUES (%s, 'go', %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (company_id, carrier, volume_mwh, valid_from, valid_to,
                 certificate_artifact_id),
            )
            return cur.fetchone()["id"]


def add_allocation(
    *, company_id: int, instrument_id: int, activity_id: int, allocated_mwh: float
) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO instrument_allocations
                    (company_id, instrument_id, energy_activity_id, allocated_mwh)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (company_id, instrument_id, activity_id, allocated_mwh),
            )
            return cur.fetchone()["id"]
