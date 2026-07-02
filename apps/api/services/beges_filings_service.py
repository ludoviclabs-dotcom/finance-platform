"""
beges_filings_service.py — Suivi des dépôts BEGES (T7.2).

Historique des bilans BEGES déposés (année de référence, date de dépôt déclarée,
référence ADEME), calcul de l'échéance suivante (+4 ans, art. L229-25) et rappels
de renouvellement par paliers — J-180, J-30, échéance atteinte — persistés dans
le centre de notifications in-app (alert_notifications, T5.3). E-mail OPTIONNEL
derrière EMAIL_ENABLED (SMTP stdlib), destinataire BEGES_REMINDER_EMAIL.

Cœur PUR (compute_next_due, target_stage, reminder_needed, schedule_from_filings)
→ testable sans DB. Fallback in-memory quand PostgreSQL est absent (mode /tmp).
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

RENEWAL_YEARS = 4  # entreprises : bilan tous les 4 ans maximum

# Paliers de rappel, du plus lointain au plus urgent. Un rappel n'est émis que
# lorsqu'on ENTRE dans un palier plus urgent que le dernier notifié (anti-spam :
# le cron quotidien ne renvoie pas la même alerte chaque jour).
STAGE_RANK: dict[str, int] = {"": 0, "j180": 1, "j30": 2, "overdue": 3}

STAGE_LABELS: dict[str, str] = {
    "j180": "Échéance BEGES dans moins de 6 mois",
    "j30": "Échéance BEGES dans moins de 30 jours",
    "overdue": "Échéance BEGES atteinte ou dépassée",
}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class BegesFilingCreate(BaseModel):
    exercise_year: int = Field(..., ge=2000, le=2100, description="Année de référence du bilan")
    filed_at: date = Field(..., description="Date de dépôt sur bilans-ges.ademe.fr")
    ademe_ref: str | None = Field(default=None, max_length=100)
    package_hash: str | None = Field(default=None, max_length=64)
    total_tco2e: float | None = None
    notes: str | None = Field(default=None, max_length=2000)


class BegesFilingOut(BaseModel):
    id: int
    company_id: int
    exercise_year: int
    filed_at: date
    next_due_at: date
    ademe_ref: str | None
    package_hash: str | None
    total_tco2e: float | None
    notes: str | None
    reminder_stage: str
    created_by: str | None
    created_at: datetime


class BegesSchedule(BaseModel):
    status: str  # aucun_bilan | a_jour | echeance_proche | en_retard
    label: str
    next_due_at: date | None = None
    days_until_due: int | None = None
    last_exercise_year: int | None = None
    last_filed_at: date | None = None


# ---------------------------------------------------------------------------
# Cœur pur
# ---------------------------------------------------------------------------

def compute_next_due(filed_at: date, years: int = RENEWAL_YEARS) -> date:
    """Échéance suivante = date de dépôt + N ans (29 février → 28 février)."""
    try:
        return filed_at.replace(year=filed_at.year + years)
    except ValueError:  # 29 février d'une année bissextile → année non bissextile
        return filed_at.replace(year=filed_at.year + years, day=28)


def target_stage(days_until_due: int) -> str:
    """Palier de rappel correspondant au nombre de jours restants."""
    if days_until_due <= 0:
        return "overdue"
    if days_until_due <= 30:
        return "j30"
    if days_until_due <= 180:
        return "j180"
    return ""


def reminder_needed(current_stage: str, days_until_due: int) -> str | None:
    """Retourne le palier à notifier si on a progressé au-delà du dernier notifié."""
    target = target_stage(days_until_due)
    if target and STAGE_RANK[target] > STAGE_RANK.get(current_stage, 0):
        return target
    return None


def format_reminder(company_name: str, exercise_year: int, next_due_at: date,
                    days_until_due: int, stage: str) -> tuple[str, str]:
    """(titre, corps) d'une notification de renouvellement. Fonction pure."""
    title = STAGE_LABELS.get(stage, "Échéance BEGES")
    due_str = next_due_at.strftime("%d/%m/%Y")
    if stage == "overdue":
        detail = f"l'échéance du {due_str} est atteinte ou dépassée"
    else:
        detail = f"échéance le {due_str} ({days_until_due} jours restants)"
    body = (
        f"{company_name} : le dernier bilan BEGES déposé porte sur l'exercice {exercise_year} — "
        f"{detail}. Le renouvellement se dépose sur bilans-ges.ademe.fr "
        f"(sanction encourue : jusqu'à 50 000 €, 100 000 € en récidive)."
    )
    return title, body


def schedule_from_filings(filings: list[dict[str, Any]], today: date) -> BegesSchedule:
    """Statut d'échéance à partir de l'historique des dépôts. Fonction pure."""
    if not filings:
        return BegesSchedule(
            status="aucun_bilan",
            label="Aucun bilan enregistré — déclarez votre dernier dépôt pour activer le suivi d'échéance.",
        )
    latest = max(filings, key=lambda f: (f["next_due_at"], f["exercise_year"]))
    next_due: date = latest["next_due_at"]
    days = (next_due - today).days
    if days <= 0:
        status, label = "en_retard", f"Échéance atteinte ou dépassée depuis le {next_due.strftime('%d/%m/%Y')}."
    elif days <= 180:
        status, label = "echeance_proche", f"Prochain dépôt avant le {next_due.strftime('%d/%m/%Y')} ({days} jours restants)."
    else:
        status, label = "a_jour", f"À jour — prochain dépôt avant le {next_due.strftime('%d/%m/%Y')}."
    return BegesSchedule(
        status=status,
        label=label,
        next_due_at=next_due,
        days_until_due=days,
        last_exercise_year=latest["exercise_year"],
        last_filed_at=latest["filed_at"],
    )


# ---------------------------------------------------------------------------
# Persistance (DB + fallback in-memory)
# ---------------------------------------------------------------------------

_MEM_FILINGS: list[dict[str, Any]] = []
_MEM_NEXT_ID = {"filing": 1}

_COLS = ["id", "company_id", "exercise_year", "filed_at", "next_due_at", "ademe_ref",
         "package_hash", "total_tco2e", "notes", "reminder_stage", "created_by", "created_at"]


def _db_available() -> bool:
    from db.database import db_available
    return db_available()


def _row_out(row: dict[str, Any]) -> BegesFilingOut:
    data = {k: row.get(k) for k in _COLS}
    if data.get("total_tco2e") is not None:
        data["total_tco2e"] = float(data["total_tco2e"])
    return BegesFilingOut(**data)


def record_filing(payload: BegesFilingCreate, company_id: int, created_by: str | None) -> BegesFilingOut:
    """Enregistre (ou met à jour) le dépôt d'un exercice. Reset le palier de rappel."""
    next_due = compute_next_due(payload.filed_at)
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO beges_filings
                            (company_id, exercise_year, filed_at, next_due_at, ademe_ref,
                             package_hash, total_tco2e, notes, created_by)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (company_id, exercise_year) DO UPDATE SET
                            filed_at = EXCLUDED.filed_at,
                            next_due_at = EXCLUDED.next_due_at,
                            ademe_ref = EXCLUDED.ademe_ref,
                            package_hash = EXCLUDED.package_hash,
                            total_tco2e = EXCLUDED.total_tco2e,
                            notes = EXCLUDED.notes,
                            reminder_stage = '',
                            updated_at = now()
                        RETURNING *
                        """,
                        (company_id, payload.exercise_year, payload.filed_at, next_due,
                         payload.ademe_ref, payload.package_hash, payload.total_tco2e,
                         payload.notes, created_by),
                    )
                    return _row_out(cur.fetchone())
        except Exception as exc:
            logger.warning("record_filing DB error: %s", exc)

    # Fallback in-memory (mode /tmp)
    existing = next(
        (f for f in _MEM_FILINGS
         if f["company_id"] == company_id and f["exercise_year"] == payload.exercise_year),
        None,
    )
    rec = {
        "company_id": company_id,
        "exercise_year": payload.exercise_year,
        "filed_at": payload.filed_at,
        "next_due_at": next_due,
        "ademe_ref": payload.ademe_ref,
        "package_hash": payload.package_hash,
        "total_tco2e": payload.total_tco2e,
        "notes": payload.notes,
        "reminder_stage": "",
        "created_by": created_by,
    }
    if existing:
        existing.update(rec)
        return _row_out(existing)
    rec["id"] = _MEM_NEXT_ID["filing"]
    rec["created_at"] = datetime.now(tz=timezone.utc)
    _MEM_NEXT_ID["filing"] += 1
    _MEM_FILINGS.append(rec)
    return _row_out(rec)


def list_filings(company_id: int) -> list[BegesFilingOut]:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM beges_filings WHERE company_id = %s ORDER BY exercise_year DESC",
                        (company_id,),
                    )
                    return [_row_out(r) for r in cur.fetchall()]
        except Exception as exc:
            logger.warning("list_filings DB error: %s", exc)

    return [
        _row_out(f)
        for f in sorted(
            (f for f in _MEM_FILINGS if f["company_id"] == company_id),
            key=lambda f: -f["exercise_year"],
        )
    ]


def delete_filing(filing_id: int, company_id: int) -> bool:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM beges_filings WHERE id = %s AND company_id = %s RETURNING id",
                        (filing_id, company_id),
                    )
                    return cur.fetchone() is not None
        except Exception as exc:
            logger.warning("delete_filing DB error: %s", exc)
            return False

    before = len(_MEM_FILINGS)
    _MEM_FILINGS[:] = [
        f for f in _MEM_FILINGS
        if not (f["id"] == filing_id and f["company_id"] == company_id)
    ]
    return len(_MEM_FILINGS) < before


def get_schedule(company_id: int, today: date | None = None) -> BegesSchedule:
    today = today or datetime.now(tz=timezone.utc).date()
    filings = [f.model_dump() for f in list_filings(company_id)]
    return schedule_from_filings(filings, today)


# ---------------------------------------------------------------------------
# Rappels de renouvellement (cron quotidien, toutes organisations)
# ---------------------------------------------------------------------------

def _companies_with_filings() -> list[tuple[int, str]]:
    """(company_id, name) des organisations ayant au moins un dépôt enregistré."""
    if _db_available():
        try:
            from db.database import get_db
            with get_db() as conn:  # companies n'a pas de RLS
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT DISTINCT c.id, c.name FROM companies c "
                        "JOIN beges_filings f ON f.company_id = c.id"
                    )
                    return [(r["id"], r["name"]) for r in cur.fetchall()]
        except Exception as exc:
            logger.warning("_companies_with_filings DB error: %s", exc)
            return []

    seen: dict[int, str] = {}
    for f in _MEM_FILINGS:
        seen.setdefault(f["company_id"], f"Organisation {f['company_id']}")
    return sorted(seen.items())


def _mark_stage(filing_id: int, company_id: int, stage: str) -> None:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE beges_filings SET reminder_stage = %s, updated_at = now() "
                        "WHERE id = %s AND company_id = %s",
                        (stage, filing_id, company_id),
                    )
            return
        except Exception as exc:
            logger.warning("_mark_stage DB error: %s", exc)
            return
    for f in _MEM_FILINGS:
        if f["id"] == filing_id and f["company_id"] == company_id:
            f["reminder_stage"] = stage


def run_reminders(today: date | None = None) -> dict[str, Any]:
    """Parcourt toutes les organisations et émet les rappels d'échéance dus.

    Persiste chaque rappel dans le centre de notifications in-app (pattern
    alerts, les deux modes DB / in-memory sont gérés par _persist_notification).
    E-mail optionnel : EMAIL_ENABLED + BEGES_REMINDER_EMAIL.
    """
    # Import paresseux : réutilise le centre de notifications du router alerts
    # (gère DB et fallback in-memory) sans dupliquer sa logique de persistance.
    from routers.alerts import _persist_notification
    from services.alerts_service import send_email

    today = today or datetime.now(tz=timezone.utc).date()
    checked = 0
    notified: list[dict[str, Any]] = []

    for company_id, company_name in _companies_with_filings():
        filings = [f.model_dump() for f in list_filings(company_id)]
        if not filings:
            continue
        checked += 1
        latest = max(filings, key=lambda f: (f["next_due_at"], f["exercise_year"]))
        days = (latest["next_due_at"] - today).days
        stage = reminder_needed(latest.get("reminder_stage", ""), days)
        if not stage:
            continue
        title, body = format_reminder(
            company_name, latest["exercise_year"], latest["next_due_at"], days, stage,
        )
        ev = {"rule_id": None, "rule_name": "BEGES", "fired_at": datetime.now(tz=timezone.utc).isoformat()}
        _persist_notification(company_id, ev, title, body)
        _mark_stage(latest["id"], company_id, stage)
        dest = os.environ.get("BEGES_REMINDER_EMAIL")
        if dest:
            send_email(dest, f"[CarbonCo] {title}", body)
        notified.append({"company_id": company_id, "stage": stage, "days_until_due": days})

    return {"checked": checked, "notified": len(notified), "reminders": notified}
