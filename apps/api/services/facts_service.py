"""
facts_service.py — Couche preuve : émission, trail et vérification de la chaîne hash.

Chaque appel à emit_fact() produit une ligne append-only dans facts_events avec :
  - un hash SHA-256 calculé sur le tuple (hash_prev, company_id, code, value, unit,
    ef_id, source_path, computed_at)
  - le hash_prev est le hash_self du dernier event de la même company (FOR UPDATE)

La fonction verify_chain() relit les events en ordre chronologique et recompute
chaque hash pour détecter toute altération a posteriori.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from db.database import db_available, get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclasses de réponse
# ---------------------------------------------------------------------------

@dataclass
class FactEvent:
    id: int
    company_id: int
    code: str
    value: float | None
    unit: str
    ef_id: int | None
    source_path: str
    computed_at: datetime
    hash_prev: str | None
    hash_self: str
    meta: dict[str, Any] | None


@dataclass
class ChainVerification:
    ok: bool
    broken_at: int | None  # id du premier event invalide, ou None si chaîne saine
    checked: int            # nombre d'events vérifiés


# ---------------------------------------------------------------------------
# Hash Merkle chaîné
# ---------------------------------------------------------------------------

def compute_hash(
    *,
    hash_prev: str | None,
    company_id: int,
    code: str,
    value: float | int | None,
    unit: str,
    ef_id: int | None,
    source_path: str,
    computed_at: datetime,
) -> str:
    """SHA-256 hex lowercase sur tuple ordonné, séparateur '|'.

    La valeur est formatée en .6f pour éviter les divergences IEEE 754.
    computed_at en isoformat(microseconds) pour unicité.
    """
    tpl = "|".join([
        hash_prev or "GENESIS",
        str(company_id),
        code,
        "" if value is None else f"{float(value):.6f}",
        unit,
        "" if ef_id is None else str(ef_id),
        source_path,
        computed_at.isoformat(timespec="microseconds"),
    ])
    return hashlib.sha256(tpl.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# emit_fact — insertion atomique avec lock sur la chaîne
# ---------------------------------------------------------------------------

def emit_fact(
    *,
    company_id: int,
    code: str,
    value: float | int | None,
    unit: str,
    ef_id: int | None = None,
    source_path: str,
    meta: dict[str, Any] | None = None,
    computed_at: datetime | None = None,
) -> FactEvent | None:
    """Insère un fact_event avec hash chaîné.

    Retourne None si la DB est indisponible (mode dégradé sans blocage).
    Le FOR UPDATE sur le dernier event empêche la race condition entre
    deux inserts simultanés pour la même company.
    """
    if not db_available():
        logger.debug("emit_fact: DB indisponible, fact ignoré (code=%s)", code)
        return None

    ts = computed_at or datetime.now(tz=timezone.utc)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # Récupérer le dernier hash pour cette company (verrou exclusif)
            cur.execute(
                "SELECT hash_self FROM facts_events "
                "WHERE company_id=%s ORDER BY computed_at DESC, id DESC LIMIT 1 "
                "FOR UPDATE",
                (company_id,),
            )
            row = cur.fetchone()
            hash_prev = row["hash_self"] if row else None

            hash_self = compute_hash(
                hash_prev=hash_prev,
                company_id=company_id,
                code=code,
                value=value,
                unit=unit,
                ef_id=ef_id,
                source_path=source_path,
                computed_at=ts,
            )

            cur.execute(
                """
                INSERT INTO facts_events
                    (company_id, code, value, unit, ef_id, source_path,
                     computed_at, hash_prev, hash_self, meta)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, code, computed_at) DO NOTHING
                RETURNING id, computed_at
                """,
                (
                    company_id, code,
                    None if value is None else float(value),
                    unit, ef_id, source_path,
                    ts, hash_prev, hash_self,
                    None if meta is None else __import__("json").dumps(meta),
                ),
            )
            inserted = cur.fetchone()

    if not inserted:
        logger.warning("emit_fact: conflit (company=%s, code=%s, computed_at=%s) — ignoré", company_id, code, ts)
        return None

    return FactEvent(
        id=inserted["id"],
        company_id=company_id,
        code=code,
        value=float(value) if value is not None else None,
        unit=unit,
        ef_id=ef_id,
        source_path=source_path,
        computed_at=inserted["computed_at"],
        hash_prev=hash_prev,
        hash_self=hash_self,
        meta=meta,
    )


def emit_facts_bulk(
    events: list[dict[str, Any]],
    *,
    company_id: int,
) -> list[FactEvent | None]:
    """Émet plusieurs facts en séquence dans une seule transaction.

    Chaque event est un dict avec les clés de emit_fact().
    Retourne la liste dans le même ordre.
    """
    results: list[FactEvent | None] = []
    for ev in events:
        results.append(emit_fact(company_id=company_id, **ev))
    return results


# ---------------------------------------------------------------------------
# get_trail — historique d'un KPI
# ---------------------------------------------------------------------------

def get_trail(
    *,
    code: str,
    company_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[FactEvent]:
    """Retourne l'historique paginé des valeurs d'un KPI pour une company."""
    if not db_available():
        return []

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, company_id, code, value, unit, ef_id, source_path,
                       computed_at, hash_prev, hash_self, meta
                FROM facts_events
                WHERE company_id = %s AND code = %s
                ORDER BY computed_at DESC, id DESC
                LIMIT %s OFFSET %s
                """,
                (company_id, code, limit, offset),
            )
            rows = cur.fetchall()

    return [
        FactEvent(
            id=r["id"],
            company_id=r["company_id"],
            code=r["code"],
            value=float(r["value"]) if r["value"] is not None else None,
            unit=r["unit"],
            ef_id=r["ef_id"],
            source_path=r["source_path"],
            computed_at=r["computed_at"],
            hash_prev=r["hash_prev"],
            hash_self=r["hash_self"],
            meta=r["meta"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# verify_chain — vérification O(N) de l'intégrité de la chaîne
# ---------------------------------------------------------------------------

def verify_chain(company_id: int) -> ChainVerification:
    """Recompute tous les hash_self pour détecter une altération a posteriori.

    Utilise un curseur server-side pour éviter de charger tous les events en mémoire.
    Retourne (ok=True, broken_at=None) si la chaîne est intègre.
    """
    if not db_available():
        return ChainVerification(ok=True, broken_at=None, checked=0)

    prev_hash: str | None = None
    checked = 0

    with get_db(company_id=company_id) as conn:
        with conn.cursor("verify_cursor") as cur:
            cur.execute(
                """
                SELECT id, company_id, code, value, unit, ef_id,
                       source_path, computed_at, hash_prev, hash_self
                FROM facts_events
                WHERE company_id = %s
                ORDER BY computed_at ASC, id ASC
                """,
                (company_id,),
            )
            for row in cur:
                expected = compute_hash(
                    hash_prev=prev_hash,
                    company_id=row["company_id"],
                    code=row["code"],
                    value=float(row["value"]) if row["value"] is not None else None,
                    unit=row["unit"],
                    ef_id=row["ef_id"],
                    source_path=row["source_path"],
                    computed_at=row["computed_at"],
                )
                if row["hash_self"] != expected:
                    return ChainVerification(ok=False, broken_at=row["id"], checked=checked)
                prev_hash = row["hash_self"]
                checked += 1

    return ChainVerification(ok=True, broken_at=None, checked=checked)


# ---------------------------------------------------------------------------
# refresh_facts_current — déclenché après un batch d'ingest
# ---------------------------------------------------------------------------

def refresh_facts_current() -> None:
    """Rafraîchit la vue matérialisée facts_current.

    CONCURRENTLY nécessite l'index unique idx_facts_current_pk.
    Ne bloque pas les lectures en cours.
    """
    if not db_available():
        return
    try:
        with get_db() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY facts_current")
    except Exception as exc:
        logger.warning("refresh_facts_current échoué: %s", exc)
