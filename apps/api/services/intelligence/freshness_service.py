"""
freshness_service.py — fraîcheur des sources (PR-04).

Lit la vue `source_freshness` (migration 029, `security_invoker=true`) et en
dérive, par source : l'âge de la dernière release, un drapeau de péremption,
et l'état de licence (déterministe, via `license_policy.evaluate`).

Isolation en profondeur (contrats §7) : la vue applique déjà la RLS des tables
028 sous l'identité de l'appelant (security_invoker) EN PROD ; en plus, chaque
requête de ce module porte son prédicat de périmètre explicite —
`(company_id = tenant OR company_id IS NULL)` — pour que l'isolation reste
vraie même sous une connexion superuser (le PostgreSQL de CI), qui bypasse
toute RLS. `/health/intelligence` est public : il ne lit QUE les sources
globales (`company_id IS NULL`), jamais une donnée tenant.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db.database import get_db
from models.intelligence import (
    IntelligenceHealthResponse,
    IntelligenceHealthSource,
    SourceFreshness,
)
from services.intelligence import license_policy

# Aligné sur `apps/carbon/lib/crm/dataLoader.ts::STALE_AFTER_DAYS` — au-delà, la
# dernière release est signalée comme potentiellement périmée.
STALE_AFTER_DAYS = 120

# Colonnes de licence exposées par la vue (mêmes clés que license_policy lit).
_VIEW_COLUMNS = (
    "source_id, company_id, code, publisher, title, source_type, active, "
    "automated_access_allowed, storage_allowed, commercial_use_allowed, "
    "redistribution_allowed, derived_use_allowed, display_allowed, attribution_text, "
    "last_release_id, last_release_key, last_release_status, last_release_at, "
    "published_release_count, total_release_count"
)

_READ_SCOPE = "(company_id = %s OR company_id IS NULL)"


def _age_days(last_release_at: datetime | None, now: datetime) -> int | None:
    if last_release_at is None:
        return None
    delta = now - last_release_at
    return max(delta.days, 0)


def _to_freshness(row: dict[str, Any], now: datetime) -> SourceFreshness:
    """Construit une SourceFreshness à partir d'une ligne de vue + licence."""
    decision = license_policy.evaluate(row)
    last_at = row.get("last_release_at")
    age = _age_days(last_at, now)
    has_release = row.get("last_release_id") is not None
    is_stale = age is not None and age > STALE_AFTER_DAYS
    # « license_ok » = mêmes droits que la gate de publication du noyau
    # (allow_ingest ET allow_store), pas un booléen ad hoc.
    license_ok = decision.allow_ingest and decision.allow_store
    return SourceFreshness(
        source_id=row["source_id"],
        company_id=row["company_id"],
        code=row["code"],
        publisher=row["publisher"],
        title=row["title"],
        source_type=row["source_type"],
        active=row["active"],
        last_release_id=row.get("last_release_id"),
        last_release_key=row.get("last_release_key"),
        last_release_status=row.get("last_release_status"),
        last_release_at=last_at,
        published_release_count=row.get("published_release_count") or 0,
        total_release_count=row.get("total_release_count") or 0,
        has_release=has_release,
        age_days=age,
        is_stale=is_stale,
        license_ok=license_ok,
        allow_display=decision.allow_display,
        allow_derived_use=decision.allow_derived_use,
        license_reasons=decision.reasons,
        license_warnings=decision.warnings,
    )


def list_source_freshness(
    *, company_id: int, limit: int = 50, offset: int = 0, now: datetime | None = None,
) -> tuple[list[SourceFreshness], int]:
    """Fraîcheur de toutes les sources visibles par le tenant (siennes + globales)."""
    now = now or datetime.now(tz=timezone.utc)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM source_freshness WHERE {_READ_SCOPE}",
                (company_id,),
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT {_VIEW_COLUMNS} FROM source_freshness WHERE {_READ_SCOPE} "
                "ORDER BY last_release_at DESC NULLS LAST, code LIMIT %s OFFSET %s",
                (company_id, limit, offset),
            )
            rows = cur.fetchall()
    return [_to_freshness(r, now) for r in rows], total


def get_source_freshness(
    *, company_id: int, source_id: int, now: datetime | None = None,
) -> SourceFreshness | None:
    """Fraîcheur d'une source (sienne ou globale) ; None si hors périmètre."""
    now = now or datetime.now(tz=timezone.utc)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_VIEW_COLUMNS} FROM source_freshness "
                f"WHERE source_id = %s AND {_READ_SCOPE}",
                (source_id, company_id),
            )
            row = cur.fetchone()
    return _to_freshness(row, now) if row is not None else None


def intelligence_health(
    *, now: datetime | None = None, limit: int = 50,
) -> IntelligenceHealthResponse:
    """État public minimal de fraîcheur — sources GLOBALES uniquement
    (`company_id IS NULL`, aucune donnée tenant). Borné, aucun secret."""
    now = now or datetime.now(tz=timezone.utc)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_VIEW_COLUMNS} FROM source_freshness "
                "WHERE company_id IS NULL ORDER BY code LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()

    entries = [_to_freshness(r, now) for r in rows]
    stale_count = sum(1 for e in entries if e.is_stale)
    license_anomaly_count = sum(1 for e in entries if not e.license_ok)
    if not entries:
        status = "empty"
    elif stale_count or license_anomaly_count:
        status = "degraded"
    else:
        status = "ok"

    return IntelligenceHealthResponse(
        status=status,
        checked_at=now,
        source_count=len(entries),
        stale_count=stale_count,
        license_anomaly_count=license_anomaly_count,
        sources=[
            IntelligenceHealthSource(
                code=e.code,
                last_release_at=e.last_release_at,
                age_days=e.age_days,
                last_release_status=e.last_release_status,
                is_stale=e.is_stale,
                license_ok=e.license_ok,
            )
            for e in entries
        ],
    )
