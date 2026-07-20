"""
exposure_service.py — expositions matières du tenant et orchestration du
CarbonCo Material Exposure Score (PR-07).

`company_material_exposures` est une table TENANT STRICTE : toutes les requêtes
portent `company_id = %s` (jamais `IS NULL`), en lecture comme en écriture.
C'est la défense en profondeur applicative des contrats §7 — indispensable
puisque le PostgreSQL de CI, superuser, bypasse la RLS.

Le rattachement à la nomenclature (`bom_item_id`, `material_mapping_id`) est
vérifié dans le périmètre du tenant AVANT insertion : on ne s'accroche jamais à
un composant BOM d'un autre tenant, même si un identifiant est deviné.

Le score lui-même n'est pas calculé ici : ce module rassemble les entrées
(chaîne de valeur par étape, parts fournisseurs, substituts, recyclage, stock,
événements, exploitabilité des données de marché) et délègue à `scoring`, qui
est pur et testable sans base.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from db.database import get_db
from models.crma import (
    ExposureAnalysisMeta,
    ExposureAnalysisResponse,
    ExposureCreate,
    ExposureListResponse,
    ExposureResponse,
    MaterialExposureScore,
)
from services.crma import reference_service, scoring, stage_service

# Table TENANT STRICTE — aucune ligne globale, donc jamais de `IS NULL` ici.
_SCOPE = "company_id = %s"


class ExposureError(Exception):
    """Erreur métier des expositions matières (composant hors périmètre…)."""


def _float(value: Any) -> float | None:
    return float(value) if value is not None else None


def _exposure_row(row: dict[str, Any]) -> ExposureResponse:
    data = {k: row[k] for k in ExposureResponse.model_fields}
    for key in (
        "annual_mass_kg", "annual_spend_eur", "share_of_supply_pct",
        "stock_coverage_days", "confidence",
    ):
        data[key] = _float(data[key])
    return ExposureResponse(**data)


def _assert_in_scope(cur, *, table: str, row_id: int, company_id: int, label: str) -> None:
    """Vérifie qu'une FK pointe bien dans le périmètre du tenant.

    Message volontairement identique pour « inexistant » et « hors périmètre » :
    ne pas révéler l'existence d'une ressource d'un autre tenant (contrats §6).
    """
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND company_id = %s", (row_id, company_id))
    if cur.fetchone() is None:
        raise ExposureError(f"{label} '{row_id}' introuvable ou hors périmètre.")


def create_exposure(
    *, company_id: int, payload: ExposureCreate, created_by: int | None = None
) -> ExposureResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if payload.bom_item_id is not None:
                _assert_in_scope(
                    cur, table="bom_items", row_id=payload.bom_item_id,
                    company_id=company_id, label="Composant BOM",
                )
            if payload.material_mapping_id is not None:
                _assert_in_scope(
                    cur, table="material_mappings", row_id=payload.material_mapping_id,
                    company_id=company_id, label="Correspondance matière",
                )
            if payload.supplier_id is not None:
                _assert_in_scope(
                    cur, table="suppliers", row_id=payload.supplier_id,
                    company_id=company_id, label="Fournisseur",
                )
            if payload.supplier_site_id is not None:
                _assert_in_scope(
                    cur, table="supplier_sites", row_id=payload.supplier_site_id,
                    company_id=company_id, label="Site fournisseur",
                )
            if payload.product_id is not None:
                _assert_in_scope(
                    cur, table="products", row_id=payload.product_id,
                    company_id=company_id, label="Produit",
                )
            cur.execute(
                """
                INSERT INTO company_material_exposures
                    (company_id, material_id, stage_code, bom_item_id, material_mapping_id,
                     product_id, supplier_id, supplier_site_id, annual_mass_kg, annual_spend_eur,
                     share_of_supply_pct, stock_coverage_days, stock_as_of, reference_year,
                     data_status, confidence, notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.stage_code, payload.bom_item_id,
                    payload.material_mapping_id, payload.product_id, payload.supplier_id,
                    payload.supplier_site_id, payload.annual_mass_kg, payload.annual_spend_eur,
                    payload.share_of_supply_pct, payload.stock_coverage_days, payload.stock_as_of,
                    payload.reference_year, payload.data_status, payload.confidence,
                    payload.notes, created_by,
                ),
            )
            row = cur.fetchone()
    return _exposure_row(row)


def list_exposures(
    *, company_id: int, material_id: str | None = None, limit: int = 50, offset: int = 0
) -> ExposureListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM company_material_exposures WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM company_material_exposures WHERE {where}
                ORDER BY material_id, id LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_exposure_row(r) for r in cur.fetchall()]
    return ExposureListResponse(items=items, total=total, limit=limit, offset=offset)


def get_exposure(*, company_id: int, exposure_id: int) -> ExposureResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM company_material_exposures WHERE id = %s AND {_SCOPE}",
                (exposure_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise ExposureError(f"Exposition '{exposure_id}' introuvable ou hors périmètre.")
    return _exposure_row(row)


def exposure_rows(*, company_id: int, material_id: str) -> list[dict[str, Any]]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM company_material_exposures WHERE material_id = %s AND {_SCOPE}",
                (material_id, company_id),
            )
            rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        for key in ("annual_mass_kg", "share_of_supply_pct", "stock_coverage_days"):
            row[key] = _float(row.get(key))
    return rows


# ---------------------------------------------------------------------------
# Orchestration du score
# ---------------------------------------------------------------------------

def _supplier_shares(rows: list[dict[str, Any]]) -> list[float]:
    """Parts d'approvisionnement par fournisseur.

    Priorité à `share_of_supply_pct` quand il est renseigné ; à défaut, la masse
    annuelle sert de proxy de part. Les deux ne sont jamais additionnées : ce
    sont des grandeurs différentes, et les mélanger fausserait le HHI.
    """
    explicit = [
        (r["supplier_id"], r["share_of_supply_pct"])
        for r in rows
        if r.get("supplier_id") is not None and r.get("share_of_supply_pct") is not None
    ]
    if explicit:
        by_supplier: dict[Any, float] = {}
        for supplier_id, share in explicit:
            by_supplier[supplier_id] = by_supplier.get(supplier_id, 0.0) + float(share)
        return list(by_supplier.values())

    by_mass: dict[Any, float] = {}
    for row in rows:
        if row.get("supplier_id") is not None and row.get("annual_mass_kg") is not None:
            by_mass[row["supplier_id"]] = by_mass.get(row["supplier_id"], 0.0) + float(row["annual_mass_kg"])
    return list(by_mass.values())


def _stock_coverage(rows: list[dict[str, Any]]) -> float | None:
    """Couverture de stock retenue : la PLUS FAIBLE des couvertures déclarées.

    Une moyenne masquerait le point de rupture — c'est le maillon le plus court
    qui détermine quand la production s'arrête.
    """
    values = [float(r["stock_coverage_days"]) for r in rows if r.get("stock_coverage_days") is not None]
    return min(values) if values else None


def compute_exposure_score(
    *,
    company_id: int,
    material_id: str,
    reference_year: int | None = None,
    as_of: date | None = None,
) -> MaterialExposureScore:
    """Assemble les entrées et délègue le calcul à `scoring.compute_score`.

    Aucune règle de score n'est écrite ici : ce module ne fait que lire la base
    dans le périmètre du tenant. La méthode elle-même reste pure et versionnée.
    """
    value_chain = stage_service.get_value_chain(
        company_id=company_id, material_id=material_id, reference_year=reference_year
    )
    exposures = exposure_rows(company_id=company_id, material_id=material_id)
    market_total, market_blocked = stage_service.market_usability(
        company_id=company_id, material_id=material_id
    )

    return scoring.compute_score(
        material_id=material_id,
        stage_concentrations=value_chain.stages,
        supplier_shares=_supplier_shares(exposures),
        substitutes=reference_service.substitute_rows(company_id=company_id, material_id=material_id),
        recycling_routes=reference_service.recycling_rows(company_id=company_id, material_id=material_id),
        stock_coverage_days=_stock_coverage(exposures),
        events=reference_service.event_rows(company_id=company_id, material_id=material_id),
        as_of=as_of,
        license_blocked_count=market_blocked,
        market_observations_count=market_total,
    )


def evidence_refs(*, company_id: int, material_id: str) -> list[dict[str, Any]]:
    """Pièces de preuve citées par les observations d'étape d'une matière.

    Renvoie des références (`artifact_id`, release, étape), jamais des URLs
    directes (contrats §4).
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT o.evidence_artifact_id AS artifact_id,
                       o.source_release_id, o.stage_code, r.release_key, s.code AS source_code
                FROM material_stage_observations o
                LEFT JOIN source_releases r ON r.id = o.source_release_id
                LEFT JOIN source_registry s ON s.id = r.source_id
                WHERE o.material_id = %s
                  AND (o.company_id = %s OR o.company_id IS NULL)
                  AND o.evidence_artifact_id IS NOT NULL
                ORDER BY o.evidence_artifact_id
                """,
                (material_id, company_id),
            )
            return [dict(r) for r in cur.fetchall()]


def analyse_material(
    *,
    company_id: int,
    material_id: str,
    reference_year: int | None = None,
    as_of: date | None = None,
) -> ExposureAnalysisResponse:
    """Enveloppe analytique {data, meta, evidence} des contrats §4."""
    score = compute_exposure_score(
        company_id=company_id, material_id=material_id,
        reference_year=reference_year, as_of=as_of,
    )
    return ExposureAnalysisResponse(
        data=score,
        meta=ExposureAnalysisMeta(
            as_of=as_of or date.today(),
            # Le score est une DÉRIVATION : jamais 'verified', quelle que soit
            # la qualité des observations sous-jacentes.
            status="estimated",
            method={"code": score.methodology_code, "version": score.methodology_version},
            quality={
                # `confidence` est reportée telle quelle, à côté du risque —
                # jamais fusionnée avec lui.
                "confidence": score.confidence,
                "coverage_pct": score.coverage_pct,
                "warnings": score.warnings,
            },
        ),
        evidence=evidence_refs(company_id=company_id, material_id=material_id),
    )
