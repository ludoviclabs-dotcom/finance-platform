"""
vsme_mapping_service.py — T3.2 : mapping existant → VSME + complétude.

Mappe automatiquement les données déjà collectées (E1 carbone, matérialité,
S1 social, G1 gouvernance — agrégées dans le snapshot VSME) vers les datapoints
du référentiel (T3.1), calcule la complétude par module et globale, et liste les
manquants. La saisie guidée d'un datapoint manquant émet un fact chaîné
(source_path='manual:user@…'). Un datapoint « non applicable » exige une
justification.

Complétude HONNÊTE : le dénominateur = datapoints `mandatory`. Un datapoint
auto-rempli depuis une donnée existante porte sa SOURCE (statut 'auto'), n'est
jamais présenté comme saisi manuellement, et reste ré-éditable.
"""

from __future__ import annotations

import logging
from typing import Any

from db.database import db_available, get_db
from services import facts_service, vsme_catalog

logger = logging.getLogger(__name__)

NA_JUSTIFICATION_MIN = 10

AUTO_SOURCE_BY_SECTION = {
    "profile": "profil",
    "environnement": "E1 (carbone)",
    "social": "S1 (social)",
    "gouvernance": "G1 (gouvernance)",
}

FILLED_STATUSES = {"auto", "manuel", "na"}


class VsmeMappingError(Exception):
    """Erreur métier (datapoint inconnu, justification manquante…)."""


def _resolve(snapshot: dict[str, Any], path: str | None) -> Any:
    if not path:
        return None
    cur: Any = snapshot
    for part in path.split("."):
        cur = cur.get(part) if isinstance(cur, dict) else None
        if cur is None:
            return None
    return cur


def map_datapoints(snapshot: dict[str, Any], overrides: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Fonction PURE : statut/valeur/source de chaque datapoint. Testable sans DB.

    `overrides` : {datapoint_code: {value, is_applicable, na_justification}}.
    Précédence : non-applicable > valeur manuelle > valeur auto (snapshot) > manquant.
    """
    rows: list[dict[str, Any]] = []
    for dp in vsme_catalog.all_datapoints():
        ov = overrides.get(dp["code"])
        na_justification = None
        if ov and ov.get("is_applicable") is False:
            status, value, source = "na", None, "manuel"
            na_justification = ov.get("na_justification")
        elif ov and ov.get("value") not in (None, ""):
            status, value, source = "manuel", ov["value"], "manuel"
        else:
            val = _resolve(snapshot, dp.get("snapshot"))
            if val not in (None, ""):
                section = (dp.get("snapshot") or ".").split(".")[0]
                status, value, source = "auto", val, AUTO_SOURCE_BY_SECTION.get(section, "auto")
            else:
                status, value, source = "missing", None, None
        rows.append({
            "code": dp["code"], "module": dp["module"], "label": dp["label"],
            "type": dp["type"], "unit": dp.get("unit"), "collect": dp["collect"],
            "status": status, "value": value, "source": source,
            "na_justification": na_justification,
        })
    return rows


def completeness(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Complétude par module + globale, dénominateur = mandatory. Fonction PURE."""
    by_module: dict[str, dict[str, int]] = {}
    for r in rows:
        if r["collect"] != "mandatory":
            continue
        m = by_module.setdefault(r["module"], {"total": 0, "filled": 0})
        m["total"] += 1
        if r["status"] in FILLED_STATUSES:
            m["filled"] += 1

    order = {m: i for i, m in enumerate(vsme_catalog.ALL_MODULES)}
    per_module = [
        {
            "module": m, "total": v["total"], "filled": v["filled"],
            "pct": round(100 * v["filled"] / v["total"]) if v["total"] else 0,
        }
        for m, v in sorted(by_module.items(), key=lambda kv: order.get(kv[0], 99))
    ]
    total = sum(v["total"] for v in by_module.values())
    filled = sum(v["filled"] for v in by_module.values())
    return {
        "overall_pct": round(100 * filled / total) if total else 0,
        "mandatory_total": total,
        "mandatory_filled": filled,
        "modules": per_module,
    }


def _snapshot_dict(company_id: int) -> dict[str, Any]:
    try:
        from services.snapshot_cache import read_snapshot
        cached = read_snapshot("vsme", company_id=company_id)
        if cached:
            return cached
        from services.esg_service import build_vsme_snapshot
        return build_vsme_snapshot().model_dump()
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning("snapshot VSME indisponible: %s", exc)
        return {}


def _load_overrides(company_id: int) -> dict[str, dict[str, Any]]:
    if not db_available():
        return {}
    out: dict[str, dict[str, Any]] = {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT datapoint_code, value, is_applicable, na_justification "
                "FROM vsme_field_values WHERE company_id = %s",
                (company_id,),
            )
            for r in cur.fetchall():
                out[r["datapoint_code"]] = {
                    "value": r["value"],
                    "is_applicable": r["is_applicable"],
                    "na_justification": r["na_justification"],
                }
    return out


def compute_mapping(company_id: int) -> dict[str, Any]:
    rows = map_datapoints(_snapshot_dict(company_id), _load_overrides(company_id))
    return {
        "version": vsme_catalog.catalog_version(),
        "completeness": completeness(rows),
        "datapoints": rows,
    }


def list_missing(company_id: int) -> list[dict[str, Any]]:
    rows = map_datapoints(_snapshot_dict(company_id), _load_overrides(company_id))
    missing = [r for r in rows if r["status"] == "missing"]
    # mandatory d'abord
    missing.sort(key=lambda r: (r["collect"] != "mandatory", r["code"]))
    return missing


def save_field_value(
    *,
    company_id: int,
    code: str,
    value: Any = None,
    is_applicable: bool = True,
    na_justification: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    """Enregistre une saisie guidée / un 'non applicable' et émet un fact chaîné."""
    dp = vsme_catalog.get_datapoint(code)
    if dp is None:
        raise VsmeMappingError(f"Datapoint VSME inconnu : {code}")
    if not is_applicable:
        if not na_justification or len(na_justification.strip()) < NA_JUSTIFICATION_MIN:
            raise VsmeMappingError(
                f"Une justification d'au moins {NA_JUSTIFICATION_MIN} caractères est requise pour « non applicable »."
            )
    if not db_available():
        raise VsmeMappingError("Base de données indisponible.")

    source_path = f"manual:{user_email}" if user_email else "manual:unknown"
    fact_event_id: int | None = None

    # Émet un fact chaîné pour un datapoint quantitatif renseigné et applicable.
    if is_applicable and value not in (None, "") and dp.get("fact_code") and dp["type"] == "quantitatif":
        try:
            ev = facts_service.emit_fact(
                company_id=company_id, code=dp["fact_code"], value=float(value),
                unit=dp.get("unit") or "", ef_id=None, source_path=source_path,
                meta={"vsme_code": code},
            )
            if ev is not None:
                fact_event_id = ev.id
        except (TypeError, ValueError):
            pass  # valeur non numérique → stockée telle quelle, pas de fact

    stored_value = None if value is None else str(value)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO vsme_field_values
                    (company_id, datapoint_code, value, is_applicable, na_justification,
                     fact_event_id, source_path, updated_by, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (company_id, datapoint_code) DO UPDATE SET
                    value = EXCLUDED.value, is_applicable = EXCLUDED.is_applicable,
                    na_justification = EXCLUDED.na_justification,
                    fact_event_id = COALESCE(EXCLUDED.fact_event_id, vsme_field_values.fact_event_id),
                    source_path = EXCLUDED.source_path, updated_by = EXCLUDED.updated_by,
                    updated_at = now()
                RETURNING id
                """,
                (company_id, code, stored_value, is_applicable, na_justification,
                 fact_event_id, source_path, user_email),
            )
            row = cur.fetchone()
    return {"id": row["id"], "code": code, "fact_event_id": fact_event_id, "saved": True}
