"""
sites_service.py — Sites physiques (usines, entrepôts, datacenters).

Un site rattache les leviers MACC à une implantation réelle : actions.site_id
NULLABLE (NULL = « entreprise entière », comportement historique intact). La
MACC est filtrable par site ; le rollup groupe = la MACC sans filtre. Aucune
donnée d'émission n'est portée par le site lui-même (facts_current reste la
seule source des émissions — pattern actions_service).

Par-organisation → RLS (migration 027, pattern 009 : FORCE + rls_bypass).
"""

from __future__ import annotations

import logging
from typing import Any

from db.database import db_available, get_db

logger = logging.getLogger(__name__)


class SiteError(Exception):
    """Site invalide."""


_COLS = ("id", "company_id", "name", "location", "naf_code", "activity_type",
         "created_at", "updated_at")


def _row(r: dict[str, Any]) -> dict[str, Any]:
    out = {k: r.get(k) for k in _COLS}
    for k in ("created_at", "updated_at"):
        if out.get(k) is not None:
            out[k] = str(out[k])
    return out


def list_sites(company_id: int) -> list[dict[str, Any]]:
    if not db_available():
        return []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(_COLS)} FROM sites WHERE company_id = %s ORDER BY name",
                (company_id,),
            )
            return [_row(r) for r in cur.fetchall()]


def create_site(company_id: int, *, name: str, location: str | None = None,
                naf_code: str | None = None, activity_type: str | None = None) -> dict[str, Any]:
    if not name or not name.strip():
        raise SiteError("Nom de site obligatoire.")
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sites (company_id, name, location, naf_code, activity_type) "
                    "VALUES (%s,%s,%s,%s,%s) RETURNING " + ", ".join(_COLS),
                    (company_id, name.strip(), location, naf_code, activity_type),
                )
                return _row(cur.fetchone())
    except Exception as exc:
        # Contrainte UNIQUE (company_id, name) → message métier, pas une 500.
        if "sites_company_name_uniq" in str(exc):
            raise SiteError(f"Un site nommé « {name.strip()} » existe déjà.") from exc
        raise
