"""
_nature_fixtures.py — état PostgreSQL partagé pour les tests biodiversité/LEAP
(PR-09). Pas un fichier de test (pas de préfixe `test_`, jamais collecté) —
même convention que `_water_fixtures.py`/`_crma_fixtures.py`.

Applique le DDL historique + les fichiers `.sql` RÉELS jusqu'à la borne
`NATURE_CEILING` (fondation 038 : référentiel, intersections, dépendances/
impacts, dossiers LEAP ; 039 : risques, opportunités, actions, brouillons
TNFD — tranche B). `apply_upto` exécute les fichiers réels en superuser CI —
ni 038 ni 039 ne sont `requires_owner` (tables neuves uniquement),
contrairement à 036, donc aucune distinction production/CI à documenter ici
(à la différence de `_water_fixtures.py`).

**Toutes les données semées ici sont FICTIVES.** Aucune vraie aire protégée,
aucune vraie zone KBA, aucune coordonnée réelle d'usine : les géométries sont
des carrés/formes de test choisis pour EXERCER les règles (frontières, trous,
faux positifs bbox — réutilisation directe de la convention `services.
calculations.geo`), pas pour décrire le monde.

Réutilise les helpers génériques `insert_site`/`insert_source_with_release`/
`accept_site_position` de `_water_fixtures.py` (PR-08) plutôt que de les
recopier : ce sont des primitives `sites`/Evidence Kernel, pas des primitives
eau — le premier domaine à en avoir eu besoin (PR-08) les a créées, PR-09 les
réutilise telles quelles (même discipline que `services.calculations.geo`).
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from db.database import get_db

from ._intelligence_fixtures import EK_TABLES
from ._migration_fixtures import apply_ddl_inline, apply_upto
from ._water_fixtures import (  # noqa: F401 — réexportés pour les tests PR-09
    accept_site_position,
    insert_site,
    insert_source_with_release,
)

# Borne haute du schéma nature : 039 (fondation Locate/Evaluate 038 + Assess/
# Prepare 039, PR-09 tranches A+B).
NATURE_CEILING = "039"

# Tables PR-09, enfants avant parents (le teardown pose de toute façon
# session_replication_role=replica — triggers FK ET trigger d'immutabilité de
# site_nature_intersections désactivés le temps du nettoyage, pattern
# _water_fixtures/_crma_fixtures).
NATURE_TABLES = (
    "nature_actions",
    "tnfd_disclosure_drafts",
    "nature_opportunities",
    "nature_risks",
    "leap_assessment_sites",
    "leap_assessments",
    "nature_impacts",
    "nature_dependencies",
    "site_nature_intersections",
    "nature_features",
)


def build_nature_db(conn) -> None:
    """DDL historique + 001-<borne> (Evidence Kernel 028, géospatial/eau
    036-037 inclus — site_nature_intersections référence `sites`, 036)."""
    apply_ddl_inline(conn)
    apply_upto(conn, NATURE_CEILING)


@pytest.fixture(scope="module")
def nature_schema():
    """Applique le schéma jusqu'à la borne nature une fois par module de test."""
    with get_db() as conn:
        build_nature_db(conn)


@pytest.fixture(scope="module")
def two_companies_nature(nature_schema):
    """2 companies de test dédiées PR-09 + cleanup en tear-down.

    Slugs `nature-*` pour ne jamais collisionner avec `ek-*`, `proc-*`,
    `en-*`, `crma-*`, `rls-*` ni `water-*` sur la même base CI.
    """
    ids: list[int] = []
    with get_db() as conn:
        with conn.cursor() as cur:
            for slug in ("nature-test-a", "nature-test-b"):
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
            # replica : désactive triggers FK et le trigger d'immutabilité des
            # intersections le temps du nettoyage (rôle superuser CI).
            cur.execute("SET session_replication_role = replica")
            for table in (*NATURE_TABLES, "sites", *EK_TABLES):
                cur.execute(f"DELETE FROM {table} WHERE company_id = ANY(%s)", (ids,))
            # Lignes GLOBALES semées par ces tests (préfixes nature-*/global-*) :
            # jamais couvertes par le filtre company_id ci-dessus.
            cur.execute("DELETE FROM nature_features WHERE company_id IS NULL AND code LIKE 'global-%'")
            cur.execute(
                "DELETE FROM source_releases WHERE company_id IS NULL AND source_id IN "
                "(SELECT id FROM source_registry WHERE company_id IS NULL AND code LIKE 'nature-%')"
            )
            cur.execute("DELETE FROM source_registry WHERE company_id IS NULL AND code LIKE 'nature-%'")
            cur.execute("SET session_replication_role = origin")
            cur.execute("DELETE FROM companies WHERE id = ANY(%s)", (ids,))


# ── Helpers de fabrique (fonctions normales, jamais des fixtures) ────────────

def insert_nature_feature(
    company_id: int | None,
    code: str,
    release_id: int,
    *,
    boundary: dict[str, Any] | None = None,
    feature_kind: str = "ecosystem",
    sensitivity: str = "public",
) -> int:
    """Insère un élément naturel directement (les règles de licence/refus du
    SERVICE sont testées via `features_service` ; ce helper sert aux montages
    de Locate/Evaluate). La bbox est dérivée de la géométrie, comme le service."""
    from services.calculations.geo import compute_bbox

    if boundary is None:
        boundary = {
            "type": "Polygon",
            "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]],
        }
    min_lat, max_lat, min_lon, max_lon = compute_bbox(boundary)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if company_id is None:
                cur.execute("SET LOCAL app.rls_bypass = 'on'")
            cur.execute(
                """
                INSERT INTO nature_features
                    (company_id, code, label, feature_kind, bbox_min_lat, bbox_max_lat,
                     bbox_min_lon, bbox_max_lon, boundary_geojson, sensitivity, source_release_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    company_id, code, f"Élément fictif {code}", feature_kind,
                    min_lat, max_lat, min_lon, max_lon, json.dumps(boundary),
                    sensitivity, release_id,
                ),
            )
            return cur.fetchone()["id"]
