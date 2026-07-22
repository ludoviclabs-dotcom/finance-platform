"""
catalog_service.py — Module 2, référentiel canonique des ressources (PR-M2A).

Catalogue, alias legacy (D-2), usages sectoriels. **Portée mixte** : ces tables
acceptent des lignes GLOBALES (`company_id IS NULL`, partagées par tous les
tenants — le référentiel canonique) et des lignes TENANT. La lecture voit les
deux (`_SCOPE_READ`) ; l'écriture par ce service ne crée JAMAIS que du tenant
(`company_id = %s`). Une ligne globale s'écrit uniquement par un service admin
sous `app.rls_bypass` (import des ressources canoniques) — jamais par un tenant.

Ce prédicat applicatif DOUBLE la RLS : en CI, PostgreSQL est superuser et bypasse
la RLS FORCE, donc sans lui aucun test d'isolation ne prouverait rien
(MODULE2_RLS_AND_SECURITY.md §3).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.resources import (
    ResourceAliasCreate,
    ResourceAliasListResponse,
    ResourceAliasResponse,
    ResourceCatalogCreate,
    ResourceCatalogDetail,
    ResourceCatalogItem,
    ResourceCatalogListResponse,
    ResourceCatalogResponse,
    ResourceSectorUseCreate,
    ResourceSectorUseListResponse,
    ResourceSectorUseResponse,
)

# Lecture : ligne du tenant OU ligne globale. Écriture : tenant uniquement.
_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"


class ResourceCatalogError(Exception):
    """Erreur métier du catalogue ressources (introuvable, doublon, source requise…)."""


# ---------------------------------------------------------------------------
# Résolution de slug (globale + tenant)
# ---------------------------------------------------------------------------

def resolve_resource(cur, *, company_id: int, slug: str) -> dict[str, Any]:
    """Résout un slug dans le périmètre `tenant ∪ global`, tenant prioritaire.

    Lève `ResourceCatalogError` (message « introuvable » → 404) si aucune
    ressource ne correspond. Réutilisé par regulatory_service (une seule vérité
    de résolution)."""
    cur.execute(
        f"""
        SELECT * FROM resource_catalog
        WHERE slug = %s AND {_SCOPE_READ}
        ORDER BY company_id NULLS LAST
        LIMIT 1
        """,
        (slug, company_id),
    )
    row = cur.fetchone()
    if row is None:
        raise ResourceCatalogError(f"Ressource '{slug}' introuvable.")
    return dict(row)


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------

def _catalog_response(row: dict[str, Any]) -> ResourceCatalogResponse:
    return ResourceCatalogResponse(**{k: row[k] for k in ResourceCatalogResponse.model_fields})


def create_resource(
    *, company_id: int, payload: ResourceCatalogCreate, created_by: int | None = None
) -> ResourceCatalogResponse:
    """Crée une ressource TENANT. Le référentiel canonique GLOBAL est chargé
    séparément par le service d'import sous `app.rls_bypass` (données via Source
    Admin / Evidence Kernel), jamais par un tenant."""
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise ResourceCatalogError(
            "Une ressource « verified » requiert une release source (source_release_id)."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO resource_catalog
                    (company_id, slug, name, name_fr, primary_family, description,
                     data_status, source_release_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING *
                """,
                (
                    company_id, payload.slug, payload.name, payload.name_fr,
                    payload.primary_family, payload.description, payload.data_status,
                    payload.source_release_id, created_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise ResourceCatalogError(f"Ressource '{payload.slug}' déjà existante.")
    return _catalog_response(row)


def list_catalog(
    *, company_id: int, family: str | None = None, q: str | None = None,
    limit: int = 50, offset: int = 0,
) -> ResourceCatalogListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if family:
        clauses.append("primary_family = %s")
        params.append(family)
    if q:
        clauses.append("(slug ILIKE %s OR name ILIKE %s OR name_fr ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like])
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM resource_catalog WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM resource_catalog WHERE {where}
                ORDER BY name, slug LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [
                ResourceCatalogItem(
                    id=r["id"], company_id=r["company_id"], slug=r["slug"], name=r["name"],
                    name_fr=r["name_fr"], primary_family=r["primary_family"],
                    data_status=r["data_status"], has_source=r["source_release_id"] is not None,
                )
                for r in cur.fetchall()
            ]
    return ResourceCatalogListResponse(items=items, total=total, limit=limit, offset=offset)


def get_detail(*, company_id: int, slug: str) -> ResourceCatalogDetail:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            row = resolve_resource(cur, company_id=company_id, slug=slug)
            rid = row["id"]
            counts: dict[str, int] = {}
            for key, table in (
                ("aliases_count", "resource_aliases"),
                ("regulations_count", "resource_regulatory_statuses"),
                ("uses_count", "resource_sector_uses"),
            ):
                cur.execute(
                    f"SELECT COUNT(*) AS n FROM {table} WHERE resource_id = %s AND {_SCOPE_READ}",
                    (rid, company_id),
                )
                counts[key] = cur.fetchone()["n"]
    return ResourceCatalogDetail(
        id=row["id"], company_id=row["company_id"], slug=row["slug"], name=row["name"],
        name_fr=row["name_fr"], primary_family=row["primary_family"],
        description=row["description"], data_status=row["data_status"],
        source_release_id=row["source_release_id"], created_at=row["created_at"], **counts,
    )


def find_by_legacy_material_id(*, company_id: int, material_id: str) -> ResourceCatalogResponse | None:
    """Reverse-lookup D-2 : un ancien `material_id` (030/034) → sa ressource, via
    `resource_aliases`. `None` si aucun alias legacy ne correspond (aucun ancien
    identifiant n'est jamais supprimé — il est rattaché, pas remplacé)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.* FROM resource_aliases a
                JOIN resource_catalog c ON c.id = a.resource_id
                WHERE a.alias_kind = 'legacy_material_id' AND a.alias_value = %s
                  AND (a.company_id = %s OR a.company_id IS NULL)
                  AND (c.company_id = %s OR c.company_id IS NULL)
                ORDER BY c.company_id NULLS LAST
                LIMIT 1
                """,
                (material_id, company_id, company_id),
            )
            row = cur.fetchone()
    return _catalog_response(row) if row is not None else None


# ---------------------------------------------------------------------------
# Alias
# ---------------------------------------------------------------------------

def _alias_response(row: dict[str, Any]) -> ResourceAliasResponse:
    return ResourceAliasResponse(**{k: row[k] for k in ResourceAliasResponse.model_fields})


def list_aliases(
    *, company_id: int, slug: str, limit: int = 50, offset: int = 0
) -> ResourceAliasListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = resolve_resource(cur, company_id=company_id, slug=slug)
            rid = resource["id"]
            cur.execute(
                f"SELECT COUNT(*) AS n FROM resource_aliases WHERE resource_id = %s AND {_SCOPE_READ}",
                (rid, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM resource_aliases WHERE resource_id = %s AND {_SCOPE_READ}
                ORDER BY alias_kind, alias_value LIMIT %s OFFSET %s
                """,
                (rid, company_id, limit, offset),
            )
            items = [_alias_response(r) for r in cur.fetchall()]
    return ResourceAliasListResponse(items=items, total=total, limit=limit, offset=offset)


def create_alias(
    *, company_id: int, slug: str, payload: ResourceAliasCreate
) -> ResourceAliasResponse:
    """Rattache un identifiant (legacy/CAS/EC…) à une ressource — écriture TENANT."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = resolve_resource(cur, company_id=company_id, slug=slug)
            cur.execute(
                """
                INSERT INTO resource_aliases (company_id, resource_id, alias_kind, alias_value)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (resource_id, alias_kind, alias_value) DO NOTHING
                RETURNING *
                """,
                (company_id, resource["id"], payload.alias_kind, payload.alias_value),
            )
            row = cur.fetchone()
            if row is None:
                raise ResourceCatalogError(
                    f"Alias {payload.alias_kind}='{payload.alias_value}' déjà rattaché à '{slug}'."
                )
    return _alias_response(row)


# ---------------------------------------------------------------------------
# Usages sectoriels
# ---------------------------------------------------------------------------

def _sector_use_response(row: dict[str, Any]) -> ResourceSectorUseResponse:
    return ResourceSectorUseResponse(**{k: row[k] for k in ResourceSectorUseResponse.model_fields})


def list_sector_uses(
    *, company_id: int, slug: str, limit: int = 50, offset: int = 0
) -> ResourceSectorUseListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = resolve_resource(cur, company_id=company_id, slug=slug)
            rid = resource["id"]
            cur.execute(
                f"SELECT COUNT(*) AS n FROM resource_sector_uses WHERE resource_id = %s AND {_SCOPE_READ}",
                (rid, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM resource_sector_uses WHERE resource_id = %s AND {_SCOPE_READ}
                ORDER BY sector_code NULLS LAST, use_label LIMIT %s OFFSET %s
                """,
                (rid, company_id, limit, offset),
            )
            items = [_sector_use_response(r) for r in cur.fetchall()]
    return ResourceSectorUseListResponse(items=items, total=total, limit=limit, offset=offset)


def create_sector_use(
    *, company_id: int, slug: str, payload: ResourceSectorUseCreate, created_by: int | None = None
) -> ResourceSectorUseResponse:
    """Usage-secteur d'une ressource — écriture TENANT. `use_label`/`criticality_note`
    = classification supply-chain SEULEMENT (aucun contenu technique, cf.
    MODULE2_RLS_AND_SECURITY.md §7)."""
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise ResourceCatalogError(
            "Un usage sectoriel « verified » requiert une release source (source_release_id)."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = resolve_resource(cur, company_id=company_id, slug=slug)
            cur.execute(
                """
                INSERT INTO resource_sector_uses
                    (company_id, resource_id, sector_code, use_label, criticality_note,
                     data_status, source_release_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, resource["id"], payload.sector_code, payload.use_label,
                    payload.criticality_note, payload.data_status, payload.source_release_id,
                    created_by,
                ),
            )
            row = cur.fetchone()
    return _sector_use_response(row)
