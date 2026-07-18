"""
activities_service.py — activités de consommation d'énergie (PR-06A).

Import CSV idempotent + gate de revue (patron import_screening_service /
supplier_answers) : les activités importées entrent en `review_status='pending'`
et ne sont réputées exploitables qu'après acceptation analyste. AUCUN fact
Scope 2 n'est émis ici — PR-06A est une fondation de données, pas un moteur de
calcul.

Idempotence EN BASE : la clé naturelle (company_id, meter_id, period_start,
period_end) est UNIQUE (migration 031) ; réimporter le même CSV est un no-op
(`ON CONFLICT DO NOTHING`). Le parsing CSV est PUR (testable sans DB) ; l'écriture
passe par `get_db` avec défense en profondeur (`company_id = %s` explicite).
"""

from __future__ import annotations

import csv
import hashlib
import io
from datetime import date
from typing import Any

from db.database import get_db
from models.energy import (
    ActivityImportResult,
    ActivityResponse,
    ReviewStatus,
)
from services.energy import EnergyError

_COLS = (
    "id, company_id, meter_id, site_id, carrier, quantity, unit, "
    "period_start, period_end, import_id, data_status, evidence_artifact_id, "
    "review_status, created_at, updated_at"
)

_REQUIRED_CSV_COLUMNS = ("meter_code", "carrier", "quantity", "period_start", "period_end")
_VALID_CARRIERS = ("electricity", "gas", "heat", "steam", "cooling", "other")


def _row_to_response(row: dict[str, Any]) -> ActivityResponse:
    return ActivityResponse(**row)


def parse_activities_csv(csv_text: str) -> list[dict[str, Any]]:
    """Parse un CSV d'activités énergie en lignes normalisées. Fonction PURE.

    Colonnes attendues (en-tête obligatoire) : meter_code, carrier, quantity,
    period_start, period_end, [unit]. Lève `EnergyError` (message français, non
    sensible) si l'en-tête est incomplet ou une valeur est invalide — jamais de
    fallback silencieux.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    if reader.fieldnames is None:
        raise EnergyError("CSV vide ou sans en-tête.")
    header = {(h or "").strip() for h in reader.fieldnames}
    missing = [c for c in _REQUIRED_CSV_COLUMNS if c not in header]
    if missing:
        raise EnergyError(f"Colonnes CSV requises manquantes : {', '.join(missing)}.")

    rows: list[dict[str, Any]] = []
    for i, raw in enumerate(reader, start=2):  # ligne 1 = en-tête
        meter_code = (raw.get("meter_code") or "").strip()
        carrier = (raw.get("carrier") or "").strip().lower()
        if not meter_code:
            raise EnergyError(f"Ligne {i} : meter_code manquant.")
        if carrier not in _VALID_CARRIERS:
            raise EnergyError(f"Ligne {i} : vecteur (carrier) invalide '{carrier}'.")
        try:
            quantity = float((raw.get("quantity") or "").strip())
        except ValueError as exc:
            raise EnergyError(f"Ligne {i} : quantité invalide '{raw.get('quantity')}'.") from exc
        if quantity < 0:
            raise EnergyError(f"Ligne {i} : quantité négative.")
        try:
            period_start = date.fromisoformat((raw.get("period_start") or "").strip())
            period_end = date.fromisoformat((raw.get("period_end") or "").strip())
        except ValueError as exc:
            raise EnergyError(f"Ligne {i} : période invalide (format attendu AAAA-MM-JJ).") from exc
        if period_end < period_start:
            raise EnergyError(f"Ligne {i} : period_end antérieure à period_start.")
        rows.append({
            "meter_code": meter_code,
            "carrier": carrier,
            "quantity": quantity,
            "unit": (raw.get("unit") or "MWh").strip() or "MWh",
            "period_start": period_start,
            "period_end": period_end,
        })
    return rows


def _import_id_for(filename: str, csv_text: str) -> str:
    """Identifiant d'import déterministe (contenu-adressé) : réimporter le même
    fichier produit le même id, et toutes ses lignes entrent en conflit → 0 créé."""
    digest = hashlib.sha256(f"{filename}\n{csv_text}".encode("utf-8")).hexdigest()
    return f"imp_{digest[:16]}"


def import_activities(*, company_id: int, filename: str, csv_text: str) -> ActivityImportResult:
    """Importe des activités énergie depuis un CSV. Idempotent + gate de revue.

    Les lignes dont le `meter_code` n'existe pas pour le tenant sont ignorées
    (warning explicite, jamais de création silencieuse d'un compteur fantôme).
    """
    parsed = parse_activities_csv(csv_text)
    import_id = _import_id_for(filename, csv_text)
    warnings: list[str] = []
    created = 0

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # Résolution meter_code -> (meter_id, site_id) DANS le périmètre tenant.
            cur.execute(
                "SELECT id, meter_code, site_id FROM energy_meters WHERE company_id = %s",
                (company_id,),
            )
            by_code = {r["meter_code"]: r for r in cur.fetchall()}

            for row in parsed:
                meter = by_code.get(row["meter_code"])
                if meter is None:
                    warnings.append(f"Compteur '{row['meter_code']}' inconnu — ligne ignorée.")
                    continue
                cur.execute(
                    """
                    INSERT INTO energy_activities
                        (company_id, meter_id, site_id, carrier, quantity, unit,
                         period_start, period_end, import_id, data_status, review_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'manual', 'pending')
                    ON CONFLICT (company_id, meter_id, period_start, period_end) DO NOTHING
                    RETURNING id
                    """,
                    (
                        company_id, meter["id"], meter["site_id"], row["carrier"],
                        row["quantity"], row["unit"], row["period_start"], row["period_end"],
                        import_id,
                    ),
                )
                if cur.fetchone() is not None:
                    created += 1

    total_rows = len(parsed)
    return ActivityImportResult(
        import_id=import_id,
        filename=filename,
        total_rows=total_rows,
        created=created,
        skipped=total_rows - created,
        review_status="pending",
        warnings=warnings,
    )


def get_activity(*, company_id: int, activity_id: int) -> ActivityResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_COLS} FROM energy_activities WHERE id = %s AND company_id = %s",
                (activity_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise EnergyError(f"Activité '{activity_id}' introuvable.")
    return _row_to_response(row)


def list_activities(
    *,
    company_id: int,
    limit: int = 50,
    offset: int = 0,
    site_id: int | None = None,
    carrier: str | None = None,
    review_status: str | None = None,
    period_from: date | None = None,
    period_to: date | None = None,
) -> tuple[list[ActivityResponse], int]:
    where = ["company_id = %s"]
    params: list[Any] = [company_id]
    if site_id is not None:
        where.append("site_id = %s")
        params.append(site_id)
    if carrier:
        where.append("carrier = %s")
        params.append(carrier)
    if review_status:
        where.append("review_status = %s")
        params.append(review_status)
    if period_from is not None:
        where.append("period_end >= %s")
        params.append(period_from)
    if period_to is not None:
        where.append("period_start <= %s")
        params.append(period_to)
    clause = " AND ".join(where)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM energy_activities WHERE {clause}", tuple(params))
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT {_COLS} FROM energy_activities WHERE {clause} "
                "ORDER BY period_start DESC, id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total


def review_activity(*, company_id: int, activity_id: int, decision: ReviewStatus) -> ActivityResponse:
    """Gate de revue : passe une activité `pending` → `accepted` / `flagged`.

    Orchestré côté service uniquement dans PR-06A (non exposé en HTTP, comme les
    transitions release de PR-03) — testé directement. Écriture stricte tenant
    (`company_id = %s`, jamais la branche IS NULL des lectures)."""
    if decision not in ("accepted", "flagged", "pending"):
        raise EnergyError(f"Décision de revue invalide : '{decision}'.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE energy_activities SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND company_id = %s RETURNING {_COLS}",
                (decision, activity_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise EnergyError(f"Activité '{activity_id}' introuvable.")
    return _row_to_response(row)
