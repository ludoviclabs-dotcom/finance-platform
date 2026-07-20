"""
reference_service.py — référentiels matières globaux (PR-07).

Groupes de matières, statut réglementaire (critique / stratégique), étapes de la
chaîne de valeur, substituts, filières de recyclage, événements commerciaux et
réglementaires.

**Portée mixte.** Ces tables acceptent des lignes GLOBALES (`company_id IS NULL`,
partagées par tous les tenants) et des lignes TENANT. La lecture voit les deux
(`_SCOPE_READ`), l'écriture ne crée jamais que du tenant (`company_id = %s`) —
une ligne globale s'écrit uniquement par un service admin sous
`app.rls_bypass`. Ce prédicat applicatif DOUBLE la RLS : en CI, PostgreSQL est
superuser et bypasse la RLS, donc sans lui aucun test d'isolation ne prouverait
quoi que ce soit (contrats §7).

**Statut critique / stratégique NON EXCLUSIF (plan §12.1).** Il n'est pas porté
par deux booléens sur une table `materials` (où rien n'empêcherait
`strategic=true, critical=false`) mais par l'appartenance aux groupes
`eu_critical` / `eu_strategic`. `get_material_status` recompose les deux
booléens et SIGNALE l'incohérence (`strategic_not_critical`) au lieu de la
corriger en silence.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.crma import (
    GROUP_CODE_CRITICAL,
    GROUP_CODE_STRATEGIC,
    MaterialGroupCreate,
    MaterialGroupListResponse,
    MaterialGroupResponse,
    MaterialStatus,
    ProcessingStageListResponse,
    ProcessingStageResponse,
    RecyclingRouteCreate,
    RecyclingRouteListResponse,
    RecyclingRouteResponse,
    SubstituteCreate,
    SubstituteListResponse,
    SubstituteResponse,
    TradeEventCreate,
    TradeEventListResponse,
    TradeEventResponse,
)

# Lecture : ligne du tenant OU ligne globale. Écriture : tenant uniquement.
_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"


class CrmaReferenceError(Exception):
    """Erreur métier des référentiels matières (groupe introuvable, doublon…)."""


def _float(value: Any) -> float | None:
    return float(value) if value is not None else None


# ---------------------------------------------------------------------------
# Groupes et statut réglementaire
# ---------------------------------------------------------------------------

def _group_row(row: dict[str, Any]) -> MaterialGroupResponse:
    return MaterialGroupResponse(**{k: row[k] for k in MaterialGroupResponse.model_fields})


def create_group(
    *, company_id: int, payload: MaterialGroupCreate, created_by: int | None = None
) -> MaterialGroupResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO material_groups
                    (company_id, code, label, group_kind, regulation_version, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING *
                """,
                (
                    company_id, payload.code, payload.label, payload.group_kind,
                    payload.regulation_version, payload.description, created_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise CrmaReferenceError(f"Groupe de matières '{payload.code}' déjà existant.")
            return _group_row(row)


def list_groups(
    *, company_id: int, group_kind: str | None = None, limit: int = 50, offset: int = 0
) -> MaterialGroupListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if group_kind:
        clauses.append("group_kind = %s")
        params.append(group_kind)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM material_groups WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM material_groups WHERE {where}
                ORDER BY group_kind, code LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_group_row(r) for r in cur.fetchall()]
    return MaterialGroupListResponse(items=items, total=total, limit=limit, offset=offset)


def add_material_to_group(
    *, company_id: int, group_code: str, material_id: str
) -> MaterialGroupResponse:
    """Rattache une matière à un groupe. Le groupe peut être global ou tenant ;
    l'appartenance créée est TOUJOURS tenant (jamais une ligne globale)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM material_groups WHERE code = %s AND {_SCOPE_READ}",
                (group_code, company_id),
            )
            group = cur.fetchone()
            if group is None:
                raise CrmaReferenceError(f"Groupe de matières '{group_code}' introuvable.")
            cur.execute(
                """
                INSERT INTO material_group_members (company_id, group_id, material_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (group_id, material_id) DO NOTHING
                """,
                (company_id, group["id"], material_id),
            )
            return _group_row(group)


def get_material_status(*, company_id: int, material_id: str) -> MaterialStatus:
    """Statut réglementaire NON EXCLUSIF d'une matière.

    Une matière stratégique doit AUSSI être critique (plan §12.1). Si les
    données disent le contraire, on le signale (`strategic_not_critical=True`)
    plutôt que de « corriger » silencieusement : une incohérence de référentiel
    doit remonter, pas disparaître.
    """
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # Prédicat de périmètre écrit explicitement sur CHAQUE table jointe
            # (défense en profondeur, contrats §7) : une appartenance d'un autre
            # tenant ne doit jamais teinter le statut réglementaire vu ici.
            cur.execute(
                """
                SELECT g.code, g.regulation_version
                FROM material_group_members m
                JOIN material_groups g ON g.id = m.group_id
                WHERE m.material_id = %s
                  AND (m.company_id = %s OR m.company_id IS NULL)
                  AND (g.company_id = %s OR g.company_id IS NULL)
                ORDER BY g.code
                """,
                (material_id, company_id, company_id),
            )
            rows = cur.fetchall()

    codes = [r["code"] for r in rows]
    is_critical = GROUP_CODE_CRITICAL in codes
    is_strategic = GROUP_CODE_STRATEGIC in codes
    regulation = next(
        (r["regulation_version"] for r in rows
         if r["code"] in (GROUP_CODE_CRITICAL, GROUP_CODE_STRATEGIC) and r["regulation_version"]),
        None,
    )
    return MaterialStatus(
        material_id=material_id,
        is_critical_eu=is_critical,
        is_strategic_eu=is_strategic,
        regulation_version=regulation,
        group_codes=codes,
        strategic_not_critical=is_strategic and not is_critical,
    )


# ---------------------------------------------------------------------------
# Étapes de la chaîne de valeur
# ---------------------------------------------------------------------------

def list_stages(*, company_id: int, limit: int = 50, offset: int = 0) -> ProcessingStageListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS n FROM processing_stages WHERE {_SCOPE_READ}", (company_id,)
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM processing_stages WHERE {_SCOPE_READ}
                ORDER BY stage_order, code LIMIT %s OFFSET %s
                """,
                (company_id, limit, offset),
            )
            items = [
                ProcessingStageResponse(**{k: r[k] for k in ProcessingStageResponse.model_fields})
                for r in cur.fetchall()
            ]
    return ProcessingStageListResponse(items=items, total=total, limit=limit, offset=offset)


def stage_rows(*, company_id: int) -> list[dict[str, Any]]:
    """Étapes brutes ordonnées (pour le calcul de la chaîne de valeur)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT code, label, stage_order, is_upstream
                FROM processing_stages WHERE {_SCOPE_READ} ORDER BY stage_order, code
                """,
                (company_id,),
            )
            return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Substituts
# ---------------------------------------------------------------------------

def create_substitute(
    *, company_id: int, payload: SubstituteCreate, created_by: int | None = None
) -> SubstituteResponse:
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise CrmaReferenceError(
            "Un substitut « verified » requiert une release source (source_release_id)."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO substitutes
                    (company_id, material_id, substitute_material_id, stage_code, application,
                     maturity, performance_penalty_pct, data_status, notes,
                     source_release_id, evidence_artifact_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.substitute_material_id,
                    payload.stage_code, payload.application, payload.maturity,
                    payload.performance_penalty_pct, payload.data_status, payload.notes,
                    payload.source_release_id, payload.evidence_artifact_id, created_by,
                ),
            )
            row = cur.fetchone()
    return _substitute_row(row)


def _substitute_row(row: dict[str, Any]) -> SubstituteResponse:
    data = {k: row[k] for k in SubstituteResponse.model_fields}
    data["performance_penalty_pct"] = _float(data["performance_penalty_pct"])
    return SubstituteResponse(**data)


def list_substitutes(
    *, company_id: int, material_id: str | None = None, limit: int = 50, offset: int = 0
) -> SubstituteListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM substitutes WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM substitutes WHERE {where} ORDER BY material_id, maturity LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            items = [_substitute_row(r) for r in cur.fetchall()]
    return SubstituteListResponse(items=items, total=total, limit=limit, offset=offset)


def substitute_rows(*, company_id: int, material_id: str) -> list[dict[str, Any]]:
    """Substituts bruts d'une matière (entrée du calcul de score)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM substitutes WHERE material_id = %s AND {_SCOPE_READ}",
                (material_id, company_id),
            )
            return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Filières de recyclage
# ---------------------------------------------------------------------------

def _recycling_row(row: dict[str, Any]) -> RecyclingRouteResponse:
    data = {k: row[k] for k in RecyclingRouteResponse.model_fields}
    data["recycled_content_pct"] = _float(data["recycled_content_pct"])
    data["recovery_rate_pct"] = _float(data["recovery_rate_pct"])
    return RecyclingRouteResponse(**data)


def create_recycling_route(
    *, company_id: int, payload: RecyclingRouteCreate, created_by: int | None = None
) -> RecyclingRouteResponse:
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise CrmaReferenceError(
            "Une filière de recyclage « verified » requiert une release source (source_release_id)."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO recycling_routes
                    (company_id, material_id, route_code, label, input_stage_code, output_stage_code,
                     maturity, recycled_content_pct, recovery_rate_pct, data_status,
                     source_release_id, evidence_artifact_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, material_id, route_code) DO NOTHING
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.route_code, payload.label,
                    payload.input_stage_code, payload.output_stage_code, payload.maturity,
                    payload.recycled_content_pct, payload.recovery_rate_pct, payload.data_status,
                    payload.source_release_id, payload.evidence_artifact_id, created_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise CrmaReferenceError(
                    f"Filière de recyclage '{payload.route_code}' déjà existante "
                    f"pour la matière '{payload.material_id}'."
                )
    return _recycling_row(row)


def list_recycling_routes(
    *, company_id: int, material_id: str | None = None, limit: int = 50, offset: int = 0
) -> RecyclingRouteListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM recycling_routes WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM recycling_routes WHERE {where} ORDER BY material_id, route_code LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            items = [_recycling_row(r) for r in cur.fetchall()]
    return RecyclingRouteListResponse(items=items, total=total, limit=limit, offset=offset)


def recycling_rows(*, company_id: int, material_id: str) -> list[dict[str, Any]]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM recycling_routes WHERE material_id = %s AND {_SCOPE_READ}",
                (material_id, company_id),
            )
            return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Événements commerciaux et réglementaires
# ---------------------------------------------------------------------------

def _event_row(row: dict[str, Any]) -> TradeEventResponse:
    return TradeEventResponse(**{k: row[k] for k in TradeEventResponse.model_fields})


def create_event(
    *, company_id: int, payload: TradeEventCreate, created_by: int | None = None
) -> TradeEventResponse:
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise CrmaReferenceError(
            "Un événement « verified » requiert une release source (source_release_id)."
        )
    if (
        payload.effective_from is not None
        and payload.effective_to is not None
        and payload.effective_to < payload.effective_from
    ):
        raise CrmaReferenceError("La date de fin d'effet précède la date de début.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO trade_or_regulatory_events
                    (company_id, material_id, stage_code, country_code, event_type, severity,
                     title, description, effective_from, effective_to, data_status,
                     source_release_id, evidence_artifact_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.material_id, payload.stage_code, payload.country_code,
                    payload.event_type, payload.severity, payload.title, payload.description,
                    payload.effective_from, payload.effective_to, payload.data_status,
                    payload.source_release_id, payload.evidence_artifact_id, created_by,
                ),
            )
            row = cur.fetchone()
    return _event_row(row)


def list_events(
    *, company_id: int, material_id: str | None = None, limit: int = 50, offset: int = 0
) -> TradeEventListResponse:
    clauses = [_SCOPE_READ]
    params: list[Any] = [company_id]
    if material_id:
        clauses.append("material_id = %s")
        params.append(material_id)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM trade_or_regulatory_events WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM trade_or_regulatory_events WHERE {where}
                ORDER BY effective_from DESC NULLS LAST, id DESC LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_event_row(r) for r in cur.fetchall()]
    return TradeEventListResponse(items=items, total=total, limit=limit, offset=offset)


def event_rows(*, company_id: int, material_id: str) -> list[dict[str, Any]]:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT * FROM trade_or_regulatory_events
                WHERE material_id = %s AND {_SCOPE_READ}
                """,
                (material_id, company_id),
            )
            return [dict(r) for r in cur.fetchall()]
