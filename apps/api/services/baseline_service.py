"""
baseline_service.py — T4.5 : année de référence & politique de recalcul.

Une baseline gèle les KPIs d'une année + le hash de chaîne au moment du gel. Un
recalcul (motif obligatoire) ré-émet les facts concernés en portant le motif
dans meta (PAS dans compute_hash — la chaîne reste valide). L'ancienne valeur
reste consultable dans le trail (append-only). Comparaison « vs référence ».
"""

from __future__ import annotations

import json
import logging
from typing import Any

from db.database import db_available, get_db
from services import facts_service

logger = logging.getLogger(__name__)

RECALC_REASONS = {
    "scope_change": "Changement de périmètre",
    "ef_version": "Changement de version de facteurs d'émission",
    "data_error": "Correction d'une erreur matérielle",
    "manual_adjustment": "Ajustement manuel (admin)",
}


class BaselineError(Exception):
    """Erreur métier baseline/recalcul."""


def compute_deltas(baseline_kpis: dict[str, Any], current_kpis: dict[str, Any]) -> dict[str, Any]:
    """Deltas vs référence (pur). change_pct = (cur - base) / |base| × 100, None si base 0/absent."""
    out: dict[str, Any] = {}
    for code in sorted(set(baseline_kpis) | set(current_kpis)):
        base = baseline_kpis.get(code)
        cur = current_kpis.get(code)
        change_pct: float | None = None
        if base not in (None, 0) and cur is not None:
            change_pct = round((float(cur) - float(base)) / abs(float(base)) * 100, 2)
        out[code] = {"baseline": base, "current": cur, "change_pct": change_pct}
    return out


def _current_kpis(company_id: int) -> dict[str, float]:
    kpis: dict[str, float] = {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT code, value FROM facts_current WHERE company_id = %s", (company_id,))
            for r in cur.fetchall():
                if r["value"] is not None:
                    kpis[r["code"]] = float(r["value"])
    return kpis


def freeze_baseline(*, company_id: int, baseline_year: int, ef_version: str | None = None) -> dict[str, Any]:
    """Gèle l'année de référence (KPIs courants + hash de chaîne)."""
    if not db_available():
        raise BaselineError("Base de données indisponible.")
    kpis = _current_kpis(company_id)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT hash_self FROM facts_events WHERE company_id = %s "
                "ORDER BY computed_at DESC, id DESC LIMIT 1",
                (company_id,),
            )
            row = cur.fetchone()
            snapshot_hash = row["hash_self"] if row else None
            cur.execute(
                """
                INSERT INTO baselines (company_id, baseline_year, snapshot_hash, ef_version, kpis, frozen_at)
                VALUES (%s, %s, %s, %s, %s, now())
                ON CONFLICT (company_id, baseline_year) DO UPDATE SET
                    snapshot_hash = EXCLUDED.snapshot_hash, ef_version = EXCLUDED.ef_version,
                    kpis = EXCLUDED.kpis, frozen_at = now()
                RETURNING id, frozen_at
                """,
                (company_id, baseline_year, snapshot_hash, ef_version, json.dumps(kpis)),
            )
            res = cur.fetchone()
    return {"id": res["id"], "baseline_year": baseline_year, "snapshot_hash": snapshot_hash, "kpi_count": len(kpis)}


def list_baselines(company_id: int) -> list[dict[str, Any]]:
    if not db_available():
        return []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, baseline_year, snapshot_hash, ef_version, frozen_at FROM baselines "
                "WHERE company_id = %s ORDER BY baseline_year DESC",
                (company_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def _get_baseline(company_id: int, baseline_id: int) -> dict[str, Any] | None:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, baseline_year, kpis FROM baselines WHERE company_id = %s AND id = %s",
                (company_id, baseline_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    kpis = row["kpis"]
    if isinstance(kpis, str):
        kpis = json.loads(kpis or "{}")
    return {"id": row["id"], "baseline_year": row["baseline_year"], "kpis": kpis or {}}


def baseline_vs_current(*, company_id: int, baseline_id: int) -> dict[str, Any]:
    if not db_available():
        raise BaselineError("Base de données indisponible.")
    baseline = _get_baseline(company_id, baseline_id)
    if baseline is None:
        raise BaselineError("Baseline introuvable.")
    return {
        "baseline_year": baseline["baseline_year"],
        "deltas": compute_deltas(baseline["kpis"], _current_kpis(company_id)),
    }


def trigger_recalc(*, company_id: int, baseline_id: int | None, reason: str, detail: str | None = None,
                   actor: str | None = None) -> dict[str, Any]:
    """Recalcul : enregistre un event motivé et ré-émet les KPIs GES avec le motif
    en meta (l'ancienne valeur reste dans le trail)."""
    if reason not in RECALC_REASONS:
        raise BaselineError(f"Motif de recalcul inconnu : {reason}.")
    if not db_available():
        raise BaselineError("Base de données indisponible.")

    touched = 0
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT code, value, unit FROM facts_current WHERE company_id = %s AND code LIKE 'CC.GES.%%'",
                (company_id,),
            )
            ges = [(r["code"], r["value"], r["unit"]) for r in cur.fetchall()]
    for code, value, unit in ges:
        if value is None:
            continue
        ev = facts_service.emit_fact(
            company_id=company_id, code=code, value=float(value), unit=unit or "tCO2e", ef_id=None,
            source_path="recalc", meta={"recalc_reason": reason, "recalc_baseline_id": baseline_id},
        )
        if ev is not None:
            touched += 1
    if touched > 0:
        try:
            facts_service.refresh_facts_current()
        except Exception as exc:  # pragma: no cover
            logger.warning("refresh_facts_current (recalc) échoué: %s", exc)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO recalc_events (company_id, baseline_id, reason, detail, facts_touched, actor) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (company_id, baseline_id, reason, detail, touched, actor),
            )
            ev_id = cur.fetchone()["id"]
    return {"recalc_event_id": ev_id, "reason": reason, "facts_touched": touched}
