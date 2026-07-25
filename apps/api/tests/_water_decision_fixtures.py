"""
tests/_water_decision_fixtures.py — montage PostgreSQL réel pour la synthèse
décisionnelle hydrique (P16, Wave E, commit E5).

## Pourquoi une fixture de plus

`_water_fixtures.py` s'arrête à la migration **037** : il n'a jamais eu besoin
des IRO (040) ni des expositions ressources (043). La synthèse décisionnelle,
elle, lit **cinq domaines** à la fois — eau, IRO et ressources — donc son
montage doit aller jusqu'à **043**.

Aucune seconde architecture n'est créée : mêmes helpers `apply_ddl_inline` /
`apply_upto`, même style de teardown en `session_replication_role = replica`,
mêmes conventions de slug. Seule la borne change.

## Slugs

`wave-e-a` / `wave-e-b` — préfixe distinct de `water-*`, `res-*`, `ek-*`,
`proc-*`, `en-*`, `crma-*` et `rls-*`, pour ne jamais collisionner sur la base
CI partagée.

## Ce montage sème deux tenants RÉELLEMENT distincts

Chaque tenant reçoit son propre site, sa propre activité hydrique, son propre
screening, son propre IRO et sa propre action. C'est la condition pour que
« A ne voit que A » soit une observation et non une tautologie : si B n'avait
aucune donnée, un filtre défaillant passerait inaperçu.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

import pytest

from db.database import get_db

from ._migration_fixtures import apply_ddl_inline, apply_upto

#: Borne haute : 043 (eau 036/037 + IRO 040 + ressources 042/043).
DECISION_CEILING = "043"

#: Tables touchées, enfants avant parents.
DECISION_TABLES = (
    "resource_assessment_dimensions",
    "resource_assessment_runs",
    "company_resource_exposure_links",
    "iro_actions",
    "materiality_decisions",
    "financial_assessments",
    "impact_assessments",
    "iros",
    "water_actions",
    "water_targets",
    "site_water_screenings",
    "water_activities",
    "water_permits",
    "water_imports",
    "water_risk_areas",
    "site_geocode_candidates",
    "sites",
)


def build_decision_db(conn) -> None:
    apply_ddl_inline(conn)
    apply_upto(conn, DECISION_CEILING)


@pytest.fixture(scope="module")
def decision_schema():
    with get_db() as conn:
        build_decision_db(conn)


@pytest.fixture(scope="module")
def two_companies_decision(decision_schema):
    """Deux entreprises de test dédiées à la Wave E, avec nettoyage complet."""
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("wave-e-a", "wave-e-b"):
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
    yield tuple(ids)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
            for table in DECISION_TABLES:
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            cur.execute(
                "DELETE FROM source_releases WHERE company_id IS NULL AND source_id IN "
                "(SELECT id FROM source_registry WHERE company_id IS NULL AND code LIKE 'wave-e-%')"
            )
            cur.execute(
                "DELETE FROM source_registry WHERE company_id IS NULL AND code LIKE 'wave-e-%'"
            )
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


# ── Fabriques (fonctions normales, jamais des fixtures) ──────────────────────


def seed_site(company_id: int, name: str) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sites (company_id, name, location) VALUES (%s, %s, %s) RETURNING id",
                (company_id, name, "1 rue Fictive, Testville"),
            )
            return cur.fetchone()["id"]


def seed_water_activity(company_id: int, site_id: int, *, activity_type: str) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO water_activities
                    (company_id, site_id, activity_type, source_type, quantity_m3,
                     period_start, period_end, data_status, review_status)
                VALUES (%s, %s, %s, 'surface', 1000, %s, %s, 'manual', 'accepted')
                RETURNING id
                """,
                (company_id, site_id, activity_type, date(2025, 1, 1), date(2025, 12, 31)),
            )
            return cur.fetchone()["id"]


def seed_screening(
    company_id: int,
    site_id: int,
    *,
    risk_category: str | None,
    confidence: float | None,
) -> int:
    """Insère un screening directement.

    Le chemin nominal (`screening_service.calculate`) exige une position
    acceptée et un référentiel de zones ; il est déjà couvert par
    `test_water_screening_api.py`. Ici on teste l'ISOLATION de la lecture, pas
    le calcul : semer directement évite de rejouer un montage sans rapport.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO site_water_screenings
                    (company_id, site_id, methodology_version, method_code, scenario_code,
                     input_snapshot, input_fingerprint, result, matched_area_ids,
                     risk_category, risk_components, confidence, coverage_pct, warnings,
                     calculated_at)
                VALUES (%s, %s, '1.0.0', 'geojson_point_in_polygon_v1', 'baseline',
                        %s, %s, %s, '[]', %s, '[]', %s, 100, '[]', %s)
                RETURNING id
                """,
                (
                    company_id,
                    site_id,
                    json.dumps({"site_id": site_id}),
                    f"fp-{company_id}-{site_id}",
                    json.dumps({"risk_category": risk_category}),
                    risk_category,
                    confidence,
                    datetime.now(timezone.utc),
                ),
            )
            return cur.fetchone()["id"]


def seed_iro(company_id: int, *, title: str, origin_reference: str) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO iros
                    (company_id, title, iro_type, origin_domain, origin_reference, status)
                VALUES (%s, %s, 'risk', 'water', %s, 'candidate')
                RETURNING id
                """,
                (company_id, title, origin_reference),
            )
            return cur.fetchone()["id"]


def seed_water_action(company_id: int, site_id: int, *, title: str) -> int:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO water_actions
                    (company_id, site_id, action_type, title, status, review_status)
                VALUES (%s, %s, 'efficiency', %s, 'planned', 'accepted')
                RETURNING id
                """,
                (company_id, site_id, title),
            )
            return cur.fetchone()["id"]


def seed_resource_exposure(company_id: int, water_activity_id: int, *, slug: str) -> int:
    """Lien exposition ressource ↔ activité eau.

    Utilise `link_kind='water_activity'` et `role='water'`, tous deux présents
    depuis la migration 043 : aucune migration n'est créée pour ce test.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM resource_catalog WHERE slug = %s AND company_id IS NULL",
                (slug,),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
                cur.execute(
                    """
                    INSERT INTO resource_catalog
                        (company_id, slug, name, primary_family, data_status)
                    VALUES (NULL, %s, %s, 'other', 'manual')
                    RETURNING id
                    """,
                    (slug, f"Ressource fictive {slug}"),
                )
                row = cur.fetchone()
            resource_id = row["id"]
            cur.execute(
                """
                INSERT INTO company_resource_exposure_links
                    (company_id, resource_id, role, link_kind, water_activity_id, data_status)
                VALUES (%s, %s, 'water', 'water_activity', %s, 'manual')
                RETURNING id
                """,
                (company_id, resource_id, water_activity_id),
            )
            return cur.fetchone()["id"]


def seed_full_tenant(company_id: int, *, marker: str) -> dict[str, Any]:
    """Sème un jeu COMPLET et identifiable pour un tenant.

    `marker` rend chaque enregistrement reconnaissable : si une fuite se
    produit, elle est visible dans les libellés, pas seulement dans un compte.
    """
    site_id = seed_site(company_id, f"Site {marker}")
    activity_id = seed_water_activity(company_id, site_id, activity_type="withdrawal")
    screening_id = seed_screening(
        company_id, site_id, risk_category="high", confidence=80.0
    )
    iro_id = seed_iro(
        company_id,
        title=f"IRO hydrique {marker}",
        origin_reference=f"site_water_screening:{screening_id}",
    )
    action_id = seed_water_action(company_id, site_id, title=f"Action {marker}")
    exposure_id = seed_resource_exposure(
        company_id, activity_id, slug=f"wave-e-res-{marker.lower()}"
    )
    return {
        "site_id": site_id,
        "activity_id": activity_id,
        "screening_id": screening_id,
        "iro_id": iro_id,
        "action_id": action_id,
        "exposure_id": exposure_id,
        "marker": marker,
    }
