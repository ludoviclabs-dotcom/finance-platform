"""
activities_service.py — ledger d'activités eau (PR-08A) : import CSV
idempotent + gate de revue + CRUD de lecture.

Deux niveaux d'idempotence, tous deux EN BASE (patron purchase_import_service
PR-05A + energy_activities 031) :
  1. CONTENU — `water_imports UNIQUE(company_id, sha256)` : rejouer les mêmes
     octets renvoie l'import existant (`already_imported=True`), zéro doublon.
  2. LIGNE — `water_activities_idempotency_uniq` (site, type, source, période) :
     un flux physique n'existe qu'une fois (`ON CONFLICT DO NOTHING`).

Gate de revue : toute activité naît `pending` ; une revue analyste la passe
`accepted` ou `flagged`. Le parsing est PUR (bytes → lignes normalisées),
testable sans base ; une ligne invalide est comptée et expliquée, jamais
devinée ni silencieusement écartée.

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime
from typing import Any

from db.database import get_db
from models.water import (
    WaterActivityListResponse,
    WaterActivityResponse,
    WaterImportResponse,
)
from services.csv_import_parsers import _find_col, _read_rows, _to_float

_SCOPE = "company_id = %s"

_ACTIVITY_TYPES = ("withdrawal", "consumption", "discharge")
_SOURCE_TYPES = ("surface", "groundwater", "municipal", "seawater", "other")


class WaterActivityError(Exception):
    """Erreur métier du ledger d'activités eau."""


def content_sha256(content: bytes) -> str:
    """SHA-256 hexadécimal du contenu brut — clé d'idempotence de contenu."""
    return hashlib.sha256(content).hexdigest()


def _to_date(value: str | None) -> date | None:
    if not value:
        return None
    v = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Parsing pur (testable sans DB)
# ---------------------------------------------------------------------------

def parse_water_csv(content: bytes) -> list[dict[str, Any]]:
    """Parse un CSV d'activités eau en lignes normalisées (PUR). Colonnes
    reconnues de façon tolérante : site (id), type d'activité, type de source,
    quantité (m3), période. Chaque ligne porte soit ses champs normalisés, soit
    une `error` EXPLICITE — jamais une valeur devinée."""
    rows, _encoding = _read_rows(content)
    fields = list(rows[0].keys())
    col = {
        "site": _find_col(fields, "site_id", "site"),
        "activity": _find_col(fields, "activity_type", "activity", "activite", "activité", "type"),
        "source": _find_col(fields, "source_type", "source"),
        "quantity": _find_col(fields, "quantity_m3", "quantity", "quantite", "quantité", "volume"),
        "start": _find_col(fields, "period_start", "start", "debut", "début"),
        "end": _find_col(fields, "period_end", "end", "fin"),
    }

    def _get(row: dict[str, str], key: str) -> str | None:
        name = col[key]
        return row.get(name) if name else None

    out: list[dict[str, Any]] = []
    for idx, row in enumerate(rows, start=1):
        site_raw = (_get(row, "site") or "").strip()
        activity = (_get(row, "activity") or "").strip().lower()
        source = (_get(row, "source") or "other").strip().lower() or "other"
        quantity = _to_float(_get(row, "quantity") or "")
        period_start = _to_date(_get(row, "start"))
        period_end = _to_date(_get(row, "end"))

        error: str | None = None
        site_id: int | None = None
        if not site_raw.isdigit():
            error = f"ligne {idx} : site_id manquant ou non numérique ('{site_raw}')"
        else:
            site_id = int(site_raw)
        if error is None and activity not in _ACTIVITY_TYPES:
            error = f"ligne {idx} : activity_type '{activity}' inconnu (attendu : {', '.join(_ACTIVITY_TYPES)})"
        if error is None and source not in _SOURCE_TYPES:
            error = f"ligne {idx} : source_type '{source}' inconnu (attendu : {', '.join(_SOURCE_TYPES)})"
        if error is None and (quantity is None or quantity < 0):
            error = f"ligne {idx} : quantity_m3 manquante ou négative"
        if error is None and (period_start is None or period_end is None):
            error = f"ligne {idx} : période invalide (period_start/period_end requis, format ISO)"
        if error is None and period_end < period_start:  # type: ignore[operator]
            error = f"ligne {idx} : period_end antérieure à period_start"

        out.append({
            "site_id": site_id,
            "activity_type": activity or None,
            "source_type": source,
            "quantity_m3": quantity,
            "period_start": period_start,
            "period_end": period_end,
            "error": error,
        })
    return out


# ---------------------------------------------------------------------------
# Import idempotent (DB)
# ---------------------------------------------------------------------------

def create_import(
    *, company_id: int, filename: str, content: bytes, imported_by: int | None = None,
) -> WaterImportResponse:
    """Import CSV IDEMPOTENT par contenu (sha256). Rejouer le même fichier
    renvoie l'import existant sans réinsérer de ligne. Un import neuf parse,
    valide chaque ligne (site du tenant, vocabulaire, période), insère les
    lignes valides en `pending` et compte les rejets AVEC leurs raisons — dans
    la MÊME transaction."""
    sha = content_sha256(content)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO water_imports (company_id, filename, sha256, status, imported_by)
                VALUES (%s, %s, %s, 'pending', %s)
                ON CONFLICT (company_id, sha256) DO NOTHING
                RETURNING *
                """,
                (company_id, filename, sha, imported_by),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    f"SELECT * FROM water_imports WHERE {_SCOPE} AND sha256 = %s",
                    (company_id, sha),
                )
                existing = dict(cur.fetchone())
                return WaterImportResponse(**existing, already_imported=True)

            import_id = row["id"]
            parsed = parse_water_csv(content)
            accepted = rejected = 0
            errors: list[str] = []
            for line in parsed:
                if line["error"] is not None:
                    rejected += 1
                    errors.append(line["error"])
                    continue
                cur.execute(
                    f"SELECT 1 FROM sites WHERE id = %s AND {_SCOPE}",
                    (line["site_id"], company_id),
                )
                if cur.fetchone() is None:
                    rejected += 1
                    errors.append(
                        f"site '{line['site_id']}' introuvable dans le périmètre — ligne rejetée"
                    )
                    continue
                cur.execute(
                    """
                    INSERT INTO water_activities
                        (company_id, site_id, activity_type, source_type, quantity_m3,
                         period_start, period_end, import_id, data_status, review_status,
                         created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'manual', 'pending', %s)
                    ON CONFLICT ON CONSTRAINT water_activities_idempotency_uniq DO NOTHING
                    RETURNING id
                    """,
                    (
                        company_id, line["site_id"], line["activity_type"],
                        line["source_type"], line["quantity_m3"], line["period_start"],
                        line["period_end"], import_id, imported_by,
                    ),
                )
                if cur.fetchone() is None:
                    rejected += 1
                    errors.append(
                        f"flux déjà présent (site {line['site_id']}, {line['activity_type']}/"
                        f"{line['source_type']}, {line['period_start']}→{line['period_end']}) — doublon ignoré"
                    )
                else:
                    accepted += 1
            cur.execute(
                "UPDATE water_imports SET row_count = %s, accepted_count = %s, "
                "rejected_count = %s, updated_at = now() WHERE id = %s RETURNING *",
                (len(parsed), accepted, rejected, import_id),
            )
            updated = dict(cur.fetchone())
    return WaterImportResponse(**updated, already_imported=False, errors=errors)


def review_import(
    *, company_id: int, import_id: int, accept: bool, reviewed_by: int | None = None,
) -> WaterImportResponse:
    """Gate de revue d'un import : `pending` → `validated`/`rejected`. Un rejet
    marque `flagged` les activités importées encore `pending` (elles restent
    visibles — traçabilité — mais hors de tout calcul)."""
    target = "validated" if accept else "rejected"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT status FROM water_imports WHERE id = %s AND {_SCOPE}",
                (import_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise WaterActivityError(f"Import '{import_id}' introuvable.")
            if row["status"] != "pending":
                raise WaterActivityError(
                    f"Import '{import_id}' au statut '{row['status']}' — seul un import 'pending' est revu."
                )
            cur.execute(
                "UPDATE water_imports SET status = %s, updated_at = now() WHERE id = %s RETURNING *",
                (target, import_id),
            )
            updated = dict(cur.fetchone())
            if not accept:
                cur.execute(
                    f"UPDATE water_activities SET review_status = 'flagged', updated_at = now() "
                    f"WHERE import_id = %s AND {_SCOPE} AND review_status = 'pending'",
                    (import_id, company_id),
                )
    return WaterImportResponse(**updated, already_imported=False)


# ---------------------------------------------------------------------------
# CRUD activités
# ---------------------------------------------------------------------------

def _activity_response(row: dict[str, Any]) -> WaterActivityResponse:
    return WaterActivityResponse(**row)


def create_activity(
    *, company_id: int, site_id: int, activity_type: str, source_type: str,
    quantity_m3: float, period_start: date, period_end: date,
    data_status: str = "manual", evidence_artifact_id: int | None = None,
    created_by: int | None = None,
) -> WaterActivityResponse:
    """Saisie directe d'une activité (même vocabulaire et même gate que
    l'import : elle naît `pending`)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT 1 FROM sites WHERE id = %s AND {_SCOPE}", (site_id, company_id))
            if cur.fetchone() is None:
                raise WaterActivityError(f"Site '{site_id}' introuvable.")
            try:
                cur.execute(
                    """
                    INSERT INTO water_activities
                        (company_id, site_id, activity_type, source_type, quantity_m3,
                         period_start, period_end, data_status, evidence_artifact_id,
                         review_status, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)
                    RETURNING *
                    """,
                    (
                        company_id, site_id, activity_type, source_type, quantity_m3,
                        period_start, period_end, data_status, evidence_artifact_id, created_by,
                    ),
                )
                return _activity_response(dict(cur.fetchone()))
            except Exception as exc:
                if "water_activities_idempotency_uniq" in str(exc):
                    raise WaterActivityError(
                        f"Un flux identique existe déjà (site {site_id}, {activity_type}/"
                        f"{source_type}, {period_start}→{period_end})."
                    ) from exc
                raise


def list_activities(
    *, company_id: int, site_id: int | None = None, activity_type: str | None = None,
    review_status: str | None = None, limit: int = 50, offset: int = 0,
) -> WaterActivityListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if activity_type is not None:
        clauses.append("activity_type = %s")
        params.append(activity_type)
    if review_status is not None:
        clauses.append("review_status = %s")
        params.append(review_status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM water_activities {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM water_activities {where} "
                "ORDER BY period_start DESC, id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return WaterActivityListResponse(
        items=[_activity_response(dict(r)) for r in rows],
        total=total, limit=limit, offset=offset,
    )


def review_activity(
    *, company_id: int, activity_id: int, accept: bool, reviewed_by: int | None = None,
) -> WaterActivityResponse:
    """Gate de revue d'une activité : `pending` → `accepted`/`flagged`."""
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM water_activities WHERE id = %s AND {_SCOPE}",
                (activity_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise WaterActivityError(f"Activité eau '{activity_id}' introuvable.")
            if row["review_status"] != "pending":
                raise WaterActivityError(
                    f"Activité '{activity_id}' déjà revue ({row['review_status']}) — "
                    "seule une activité 'pending' est revue."
                )
            cur.execute(
                f"UPDATE water_activities SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, activity_id, company_id),
            )
            return _activity_response(dict(cur.fetchone()))
