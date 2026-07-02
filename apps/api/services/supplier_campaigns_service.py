"""
supplier_campaigns_service.py — Campagnes de collecte fournisseurs (T7.3).

Complète le module fournisseurs Phase 4 (suppliers, tokens, réponses) avec le
workflow de gestion côté client :
  - campagnes centralisées (nom, exercice, deadline) et invitations en masse
  - import CSV de fournisseurs (stdlib csv, séparateur détecté , ou ;)
  - suivi des réponses : pending / viewed / completed, taux de réponse
  - relances par paliers J-14 / J-7 / deadline (notifications in-app +
    e-mails fournisseurs optionnels derrière EMAIL_ENABLED, SMTP stdlib)
  - revue OBLIGATOIRE des réponses reçues avant intégration (pattern gate
    FEC/imports) : détection d'anomalies pure, accept/flag tracé, application
    à l'estimation GES du fournisseur uniquement sur acceptation.

Cœur PUR (parse_suppliers_csv, detect_anomalies, target_campaign_stage,
campaign_reminder_needed) → testable sans DB. Fallback in-memory (mode /tmp).
"""

from __future__ import annotations

import csv
import io
import logging
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_TOKEN_DAYS = 30  # validité par défaut d'une invitation sans deadline

# Paliers de relance (mêmes principes anti-spam que les rappels BEGES T7.2 :
# un palier n'est notifié qu'une fois, le cron quotidien ne spamme pas).
CAMPAIGN_STAGE_RANK: dict[str, int] = {"": 0, "j14": 1, "j7": 2, "deadline": 3}

CAMPAIGN_STAGE_LABELS: dict[str, str] = {
    "j14": "deadline dans 14 jours ou moins",
    "j7": "deadline dans 7 jours ou moins",
    "deadline": "deadline atteinte",
}

# Colonnes reconnues à l'import CSV (en-têtes insensibles à la casse/accents légers)
_CSV_FIELDS = {
    "name": {"name", "nom", "fournisseur", "supplier"},
    "contact_email": {"contact_email", "email", "e-mail", "courriel"},
    "contact_name": {"contact_name", "contact", "nom_contact"},
    "country": {"country", "pays"},
    "sector": {"sector", "secteur"},
    "scope3_category": {"scope3_category", "categorie", "catégorie", "scope3"},
    "spend_eur": {"spend_eur", "depenses", "dépenses", "spend", "achats_eur"},
    "ghg_estimate_tco2e": {"ghg_estimate_tco2e", "ges", "tco2e", "ghg"},
}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    exercise_year: int | None = Field(default=None, ge=2000, le=2100)
    deadline: date | None = None


class CampaignStats(BaseModel):
    invited: int = 0
    viewed: int = 0
    completed: int = 0
    pending: int = 0
    response_rate: float = 0.0  # completed / invited (0-1)


class CampaignOut(BaseModel):
    id: int
    company_id: int
    name: str
    exercise_year: int | None
    deadline: date | None
    status: str
    reminder_stage: str
    created_by: str | None
    created_at: datetime
    closed_at: datetime | None
    stats: CampaignStats


class CampaignInvite(BaseModel):
    token_id: int
    supplier_id: int
    supplier_name: str
    contact_email: str | None
    status: str  # pending | viewed | completed
    url: str
    expires_at: datetime | None
    viewed_at: datetime | None
    used_at: datetime | None


class InviteRequest(BaseModel):
    supplier_ids: list[int] = Field(default_factory=list)
    all_active: bool = False


class CsvImportRequest(BaseModel):
    csv_text: str = Field(..., min_length=1, max_length=2_000_000)


class AnswerReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(accept|flag)$")
    note: str | None = Field(default=None, max_length=2000)
    apply_to_supplier: bool = True


class PendingAnswer(BaseModel):
    id: int
    supplier_id: int
    supplier_name: str
    ghg_total_tco2e: float | None
    ghg_scope1: float | None
    ghg_scope2: float | None
    ghg_scope3: float | None
    methodology: str | None
    reporting_year: int | None
    narrative: str | None
    submitted_at: datetime
    review_status: str
    anomalies: list[str]


# ---------------------------------------------------------------------------
# Cœur pur — import CSV
# ---------------------------------------------------------------------------

def _normalize_header(h: str) -> str:
    return h.strip().lower().replace("é", "e").replace("è", "e")


def parse_suppliers_csv(text: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse un CSV de fournisseurs. Fonction PURE : (lignes valides, anomalies).

    Séparateur détecté (, ou ;), en-têtes tolérants (fr/en), champ `name`
    obligatoire, nombres avec virgule décimale acceptés. Aucune ligne invalide
    n'est silencieusement ignorée : chaque rejet produit une anomalie lisible.
    """
    issues: list[str] = []
    text = text.lstrip("﻿")  # BOM Excel
    sample = text[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        return [], ["CSV vide ou en-tête manquant."]

    header_map: dict[str, str] = {}
    for raw in reader.fieldnames:
        norm = _normalize_header(raw or "")
        for field, aliases in _CSV_FIELDS.items():
            if norm in aliases:
                header_map[raw] = field
                break
    if "name" not in header_map.values():
        return [], [f"Colonne obligatoire absente : name/nom (en-têtes vus : {reader.fieldnames})."]

    rows: list[dict[str, Any]] = []
    for i, raw_row in enumerate(reader, start=2):  # ligne 1 = en-tête
        row: dict[str, Any] = {}
        for raw_key, field in header_map.items():
            val = (raw_row.get(raw_key) or "").strip()
            if not val:
                continue
            if field in ("spend_eur", "ghg_estimate_tco2e"):
                try:
                    row[field] = float(val.replace(",", ".").replace(" ", "").replace(" ", ""))
                except ValueError:
                    issues.append(f"Ligne {i} : valeur numérique invalide pour {field} (« {val} »).")
                    continue
            else:
                row[field] = val
        if not row.get("name"):
            issues.append(f"Ligne {i} : nom de fournisseur manquant — ligne ignorée.")
            continue
        rows.append(row)
    return rows, issues


# ---------------------------------------------------------------------------
# Cœur pur — anomalies de réponse
# ---------------------------------------------------------------------------

def detect_anomalies(answer: dict[str, Any], current_year: int | None = None) -> list[str]:
    """Signale les incohérences d'une réponse fournisseur. Fonction PURE.

    Ne bloque jamais : la décision reste humaine (écran de revue). Vérifie la
    cohérence total vs somme des scopes, l'année de reporting, l'absence de
    méthodologie sur des valeurs déclarées et les réponses vides.
    """
    current_year = current_year or datetime.now(tz=timezone.utc).year
    anomalies: list[str] = []
    total = answer.get("ghg_total_tco2e")
    scopes = [answer.get("ghg_scope1"), answer.get("ghg_scope2"), answer.get("ghg_scope3")]
    declared = [s for s in scopes if s is not None]

    if total is not None and declared:
        scope_sum = sum(declared)
        if scope_sum > 0 and total > 0:
            gap = abs(total - scope_sum) / max(total, scope_sum)
            if gap > 0.10:
                anomalies.append(
                    f"Total déclaré ({total:g} tCO2e) incohérent avec la somme des scopes "
                    f"({scope_sum:g} tCO2e, écart {gap:.0%})."
                )
        elif total > 0 and scope_sum == 0:
            anomalies.append("Total déclaré mais tous les scopes détaillés sont à zéro.")

    has_values = (total or 0) > 0 or any((s or 0) > 0 for s in declared)
    if has_values and not (answer.get("methodology") or "").strip():
        anomalies.append("Valeurs GES déclarées sans méthodologie renseignée.")

    year = answer.get("reporting_year")
    if year is not None and not (2015 <= int(year) <= current_year):
        anomalies.append(f"Année de reporting inhabituelle : {year}.")

    if total is None and not declared:
        anomalies.append("Réponse sans aucune valeur GES (narratif ou certifications uniquement).")

    return anomalies


# ---------------------------------------------------------------------------
# Cœur pur — paliers de relance
# ---------------------------------------------------------------------------

def target_campaign_stage(days_until_deadline: int) -> str:
    if days_until_deadline <= 0:
        return "deadline"
    if days_until_deadline <= 7:
        return "j7"
    if days_until_deadline <= 14:
        return "j14"
    return ""


def campaign_reminder_needed(current_stage: str, days_until_deadline: int) -> str | None:
    target = target_campaign_stage(days_until_deadline)
    if target and CAMPAIGN_STAGE_RANK[target] > CAMPAIGN_STAGE_RANK.get(current_stage, 0):
        return target
    return None


# ---------------------------------------------------------------------------
# Persistance (DB + fallback in-memory)
# ---------------------------------------------------------------------------

_MEM_CAMPAIGNS: list[dict[str, Any]] = []
_MEM_NEXT_ID = {"campaign": 1}


def _db_available() -> bool:
    from db.database import db_available
    return db_available()


def _base_url() -> str:
    return os.environ.get("FRONTEND_URL", "https://carbon-snowy-nine.vercel.app")


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _invite_status(viewed_at: Any, used_at: Any) -> str:
    if used_at:
        return "completed"
    if viewed_at:
        return "viewed"
    return "pending"


def _stats_from_invites(invites: list[dict[str, Any]]) -> CampaignStats:
    invited = len(invites)
    completed = sum(1 for i in invites if i.get("used_at"))
    viewed = sum(1 for i in invites if i.get("viewed_at") and not i.get("used_at"))
    pending = invited - completed - viewed
    return CampaignStats(
        invited=invited,
        viewed=viewed,
        completed=completed,
        pending=pending,
        response_rate=round(completed / invited, 4) if invited else 0.0,
    )


def create_campaign(payload: CampaignCreate, company_id: int, created_by: str | None) -> CampaignOut:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO supplier_campaigns
                            (company_id, name, exercise_year, deadline, created_by)
                        VALUES (%s,%s,%s,%s,%s)
                        RETURNING *
                        """,
                        (company_id, payload.name, payload.exercise_year, payload.deadline, created_by),
                    )
                    row = dict(cur.fetchone())
                    return CampaignOut(**row, stats=CampaignStats())
        except Exception as exc:
            logger.warning("create_campaign DB error: %s", exc)

    rec = {
        "id": _MEM_NEXT_ID["campaign"],
        "company_id": company_id,
        "name": payload.name,
        "exercise_year": payload.exercise_year,
        "deadline": payload.deadline,
        "status": "active",
        "reminder_stage": "",
        "created_by": created_by,
        "created_at": _now(),
        "closed_at": None,
    }
    _MEM_NEXT_ID["campaign"] += 1
    _MEM_CAMPAIGNS.append(rec)
    return CampaignOut(**rec, stats=CampaignStats())


def _campaign_row(company_id: int, campaign_id: int) -> dict[str, Any] | None:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM supplier_campaigns WHERE id = %s AND company_id = %s",
                        (campaign_id, company_id),
                    )
                    row = cur.fetchone()
                    return dict(row) if row else None
        except Exception as exc:
            logger.warning("_campaign_row DB error: %s", exc)
            return None
    return next(
        (c for c in _MEM_CAMPAIGNS if c["id"] == campaign_id and c["company_id"] == company_id),
        None,
    )


def _db_campaign_invites(company_id: int, campaign_id: int) -> list[dict[str, Any]]:
    from db.database import get_db
    with get_db(company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.id AS token_id, t.supplier_id, t.token, t.expires_at,
                       t.viewed_at, t.used_at, s.name AS supplier_name, s.contact_email
                FROM supplier_questionnaire_tokens t
                JOIN suppliers s ON s.id = t.supplier_id
                WHERE t.campaign_id = %s AND t.company_id = %s
                ORDER BY s.name
                """,
                (campaign_id, company_id),
            )
            return [dict(r) for r in cur.fetchall()]


def _mem_campaign_invites(campaign: dict[str, Any]) -> list[dict[str, Any]]:
    """Mode /tmp : lit le magasin de tokens UNIQUE de supplier_service.

    Les invitations de campagne sont des tokens ordinaires (campaign_id posé) —
    même source que le questionnaire public /q/{token}, donc used_at est stampé
    par submit_answer sans synchronisation supplémentaire.
    """
    from services.supplier_service import _DEMO_TOKENS, get_supplier
    out = []
    for t in _DEMO_TOKENS:
        if t.get("campaign_id") != campaign["id"] or t["company_id"] != campaign["company_id"]:
            continue
        supplier = get_supplier(t["supplier_id"], campaign["company_id"])
        out.append({
            "token_id": t["id"],
            "supplier_id": t["supplier_id"],
            "token": t["token"],
            "expires_at": t.get("expires_at"),
            "viewed_at": t.get("viewed_at"),
            "used_at": t.get("used_at"),
            "supplier_name": supplier.name if supplier else f"Fournisseur {t['supplier_id']}",
            "contact_email": supplier.contact_email if supplier else None,
        })
    return out


def campaign_invites(company_id: int, campaign_id: int) -> list[CampaignInvite]:
    campaign = _campaign_row(company_id, campaign_id)
    if not campaign:
        return []
    if _db_available():
        try:
            raw = _db_campaign_invites(company_id, campaign_id)
        except Exception as exc:
            logger.warning("campaign_invites DB error: %s", exc)
            raw = []
    else:
        raw = _mem_campaign_invites(campaign)
    base = _base_url()
    return [
        CampaignInvite(
            token_id=r["token_id"],
            supplier_id=r["supplier_id"],
            supplier_name=r["supplier_name"],
            contact_email=r.get("contact_email"),
            status=_invite_status(r.get("viewed_at"), r.get("used_at")),
            url=f"{base}/q/{r['token']}",
            expires_at=r.get("expires_at"),
            viewed_at=r.get("viewed_at"),
            used_at=r.get("used_at"),
        )
        for r in raw
    ]


def list_campaigns(company_id: int) -> list[CampaignOut]:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT c.*,
                               COUNT(t.id) AS invited,
                               COUNT(t.used_at) AS completed,
                               COUNT(t.viewed_at) FILTER (WHERE t.used_at IS NULL) AS viewed
                        FROM supplier_campaigns c
                        LEFT JOIN supplier_questionnaire_tokens t ON t.campaign_id = c.id
                        WHERE c.company_id = %s
                        GROUP BY c.id
                        ORDER BY c.created_at DESC
                        """,
                        (company_id,),
                    )
                    out = []
                    for r in cur.fetchall():
                        row = dict(r)
                        invited = int(row.pop("invited") or 0)
                        completed = int(row.pop("completed") or 0)
                        viewed = int(row.pop("viewed") or 0)
                        stats = CampaignStats(
                            invited=invited, completed=completed, viewed=viewed,
                            pending=max(invited - completed - viewed, 0),
                            response_rate=round(completed / invited, 4) if invited else 0.0,
                        )
                        out.append(CampaignOut(**row, stats=stats))
                    return out
        except Exception as exc:
            logger.warning("list_campaigns DB error: %s", exc)

    out = []
    for c in sorted(
        (c for c in _MEM_CAMPAIGNS if c["company_id"] == company_id),
        key=lambda c: c["id"], reverse=True,
    ):
        stats = _stats_from_invites(_mem_campaign_invites(c))
        out.append(CampaignOut(**c, stats=stats))
    return out


def close_campaign(campaign_id: int, company_id: int) -> bool:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE supplier_campaigns SET status = 'closed', closed_at = now() "
                        "WHERE id = %s AND company_id = %s AND status = 'active' RETURNING id",
                        (campaign_id, company_id),
                    )
                    return cur.fetchone() is not None
        except Exception as exc:
            logger.warning("close_campaign DB error: %s", exc)
            return False
    for c in _MEM_CAMPAIGNS:
        if c["id"] == campaign_id and c["company_id"] == company_id and c["status"] == "active":
            c["status"] = "closed"
            c["closed_at"] = _now()
            return True
    return False


def invite_suppliers(
    campaign_id: int,
    company_id: int,
    supplier_ids: list[int],
    *,
    all_active: bool = False,
) -> list[CampaignInvite]:
    """Génère un token par fournisseur pour la campagne (dédupliqué).

    L'expiration est alignée sur la deadline (+ 7 jours de marge) ou 30 jours
    à défaut. Un fournisseur déjà invité sur cette campagne n'est pas re-tokenisé.
    """
    from services.supplier_service import list_suppliers

    campaign = _campaign_row(company_id, campaign_id)
    if not campaign or campaign["status"] != "active":
        return []

    if all_active:
        suppliers, _ = list_suppliers(company_id, status="active", limit=200)
        supplier_ids = [s.id for s in suppliers]

    deadline = campaign.get("deadline")
    if deadline:
        expires_at = datetime.combine(deadline, datetime.min.time(), tzinfo=timezone.utc) + timedelta(days=7)
    else:
        expires_at = _now() + timedelta(days=DEFAULT_TOKEN_DAYS)

    already = {i.supplier_id for i in campaign_invites(company_id, campaign_id)}
    to_invite = [sid for sid in dict.fromkeys(supplier_ids) if sid not in already]

    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    for sid in to_invite:
                        # Vérifie l'appartenance du fournisseur au tenant avant l'INSERT
                        cur.execute(
                            "SELECT id FROM suppliers WHERE id = %s AND company_id = %s",
                            (sid, company_id),
                        )
                        if not cur.fetchone():
                            continue
                        cur.execute(
                            """
                            INSERT INTO supplier_questionnaire_tokens
                                (supplier_id, company_id, token, campaign, campaign_id, expires_at)
                            VALUES (%s,%s,%s,%s,%s,%s)
                            """,
                            (sid, company_id, secrets.token_hex(32), campaign["name"],
                             campaign_id, expires_at),
                        )
        except Exception as exc:
            logger.warning("invite_suppliers DB error: %s", exc)
    else:
        from services.supplier_service import _DEMO_ID_COUNTER, _DEMO_TOKENS, get_supplier
        for sid in to_invite:
            if not get_supplier(sid, company_id):
                continue
            _DEMO_TOKENS.append({
                "id": _DEMO_ID_COUNTER["token"],
                "supplier_id": sid,
                "company_id": company_id,
                "token": secrets.token_hex(32),
                "campaign": campaign["name"],
                "campaign_id": campaign_id,
                "expires_at": expires_at,
                "viewed_at": None,
                "used_at": None,
                "created_at": _now(),
            })
            _DEMO_ID_COUNTER["token"] += 1

    return campaign_invites(company_id, campaign_id)


def mark_token_viewed(token: str) -> None:
    """Stampe la première consultation du questionnaire public (best-effort)."""
    if _db_available():
        try:
            from db.database import get_db
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT public.mark_supplier_token_viewed(%s)",
                        (token,),
                    )
            return
        except Exception as exc:
            logger.warning("mark_token_viewed DB error: %s", exc)
            return
    from services.supplier_service import _DEMO_TOKENS
    for t in _DEMO_TOKENS:
        if t["token"] == token and t.get("viewed_at") is None:
            t["viewed_at"] = _now()


# ---------------------------------------------------------------------------
# Import CSV de fournisseurs
# ---------------------------------------------------------------------------

def import_suppliers_csv(csv_text: str, company_id: int) -> dict[str, Any]:
    """Crée les fournisseurs du CSV (dédup par nom, insensible à la casse)."""
    from services.supplier_service import SupplierCreate, create_supplier, list_suppliers

    rows, issues = parse_suppliers_csv(csv_text)
    existing, _ = list_suppliers(company_id, limit=200)
    known = {s.name.strip().lower() for s in existing}

    created = 0
    skipped = 0
    for row in rows:
        key = row["name"].strip().lower()
        if key in known:
            skipped += 1
            continue
        create_supplier(SupplierCreate(**row), company_id)
        known.add(key)
        created += 1

    return {"created": created, "skipped": skipped, "parsed": len(rows), "issues": issues}


# ---------------------------------------------------------------------------
# Relances (cron quotidien, toutes organisations)
# ---------------------------------------------------------------------------

def _active_campaigns_all_companies() -> list[dict[str, Any]]:
    if _db_available():
        try:
            from db.database import get_db
            with get_db() as conn:  # companies sans RLS ; lecture par company ensuite
                with conn.cursor() as cur:
                    cur.execute("SELECT id, name FROM companies")
                    companies = {r["id"]: r["name"] for r in cur.fetchall()}
        except Exception as exc:
            logger.warning("_active_campaigns companies DB error: %s", exc)
            return []
        out: list[dict[str, Any]] = []
        for cid, cname in companies.items():
            try:
                from db.database import get_db
                with get_db(cid) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT * FROM supplier_campaigns "
                            "WHERE company_id = %s AND status = 'active' AND deadline IS NOT NULL",
                            (cid,),
                        )
                        for r in cur.fetchall():
                            out.append({**dict(r), "company_name": cname})
            except Exception as exc:
                logger.warning("_active_campaigns DB error (company %s): %s", cid, exc)
        return out

    return [
        {**c, "company_name": f"Organisation {c['company_id']}"}
        for c in _MEM_CAMPAIGNS
        if c["status"] == "active" and c.get("deadline") is not None
    ]


def _mark_campaign_stage(campaign_id: int, company_id: int, stage: str) -> None:
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE supplier_campaigns SET reminder_stage = %s "
                        "WHERE id = %s AND company_id = %s",
                        (stage, campaign_id, company_id),
                    )
            return
        except Exception as exc:
            logger.warning("_mark_campaign_stage DB error: %s", exc)
            return
    for c in _MEM_CAMPAIGNS:
        if c["id"] == campaign_id and c["company_id"] == company_id:
            c["reminder_stage"] = stage


def run_campaign_reminders(today: date | None = None) -> dict[str, Any]:
    """Relances des campagnes actives à deadline (J-14 / J-7 / deadline).

    Pour chaque palier atteint : notification in-app à l'organisation (état de
    la collecte) + e-mail de relance aux fournisseurs n'ayant pas répondu
    (uniquement si EMAIL_ENABLED — sinon in-app seul, zéro dépendance).
    """
    from routers.alerts import _persist_notification
    from services.alerts_service import email_enabled, send_email

    today = today or _now().date()
    checked = 0
    notified: list[dict[str, Any]] = []

    for campaign in _active_campaigns_all_companies():
        checked += 1
        days = (campaign["deadline"] - today).days
        stage = campaign_reminder_needed(campaign.get("reminder_stage", ""), days)
        if not stage:
            continue

        company_id = campaign["company_id"]
        invites = campaign_invites(company_id, campaign["id"])
        pending = [i for i in invites if i.status != "completed"]
        stats = f"{sum(1 for i in invites if i.status == 'completed')}/{len(invites)} réponses reçues"

        title = f"Campagne fournisseurs « {campaign['name']} » : {CAMPAIGN_STAGE_LABELS[stage]}"
        body = (
            f"{stats} — deadline le {campaign['deadline'].strftime('%d/%m/%Y')}. "
            f"{len(pending)} fournisseur(s) sans réponse complète."
        )
        ev = {"rule_id": None, "rule_name": "Fournisseurs", "fired_at": _now().isoformat()}
        _persist_notification(company_id, ev, title, body)

        emails_sent = 0
        if email_enabled():
            for invite in pending:
                if not invite.contact_email:
                    continue
                subject = f"[{campaign['company_name']}] Questionnaire ESG — {CAMPAIGN_STAGE_LABELS[stage]}"
                mail_body = (
                    f"Bonjour,\n\n{campaign['company_name']} vous a invité à compléter son questionnaire "
                    f"de données carbone (campagne « {campaign['name']} »). "
                    f"Date limite : {campaign['deadline'].strftime('%d/%m/%Y')}.\n\n"
                    f"Répondre (sans création de compte) : {invite.url}\n\n"
                    "Ce lien est personnel et expire après la campagne."
                )
                if send_email(invite.contact_email, subject, mail_body):
                    emails_sent += 1

        _mark_campaign_stage(campaign["id"], company_id, stage)
        notified.append({
            "company_id": company_id, "campaign_id": campaign["id"],
            "stage": stage, "pending": len(pending), "emails_sent": emails_sent,
        })

    return {"checked": checked, "notified": len(notified), "reminders": notified}


# ---------------------------------------------------------------------------
# Revue des réponses (gate avant intégration)
# ---------------------------------------------------------------------------

def list_pending_answers(company_id: int) -> list[PendingAnswer]:
    """Réponses en attente de revue, enrichies des anomalies détectées."""
    rows: list[dict[str, Any]] = []
    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT a.*, s.name AS supplier_name
                        FROM supplier_answers a
                        JOIN suppliers s ON s.id = a.supplier_id
                        WHERE a.company_id = %s AND a.review_status = 'pending'
                        ORDER BY a.submitted_at DESC
                        """,
                        (company_id,),
                    )
                    rows = [dict(r) for r in cur.fetchall()]
        except Exception as exc:
            logger.warning("list_pending_answers DB error: %s", exc)
    else:
        from services.supplier_service import _DEMO_ANSWERS, get_supplier
        for a in _DEMO_ANSWERS:
            if a["company_id"] == company_id and a.get("review_status", "pending") == "pending":
                supplier = get_supplier(a["supplier_id"], company_id)
                rows.append({
                    **a,
                    "supplier_name": supplier.name if supplier else f"Fournisseur {a['supplier_id']}",
                })

    out = []
    for r in rows:
        for k in ("ghg_total_tco2e", "ghg_scope1", "ghg_scope2", "ghg_scope3"):
            if r.get(k) is not None:
                r[k] = float(r[k])
        out.append(PendingAnswer(
            id=r["id"], supplier_id=r["supplier_id"], supplier_name=r["supplier_name"],
            ghg_total_tco2e=r.get("ghg_total_tco2e"), ghg_scope1=r.get("ghg_scope1"),
            ghg_scope2=r.get("ghg_scope2"), ghg_scope3=r.get("ghg_scope3"),
            methodology=r.get("methodology"), reporting_year=r.get("reporting_year"),
            narrative=r.get("narrative"), submitted_at=r["submitted_at"],
            review_status=r.get("review_status", "pending"),
            anomalies=detect_anomalies(r),
        ))
    return out


def review_answer(
    answer_id: int,
    company_id: int,
    payload: AnswerReviewRequest,
    reviewed_by: str | None,
) -> dict[str, Any] | None:
    """Accepte ou signale une réponse. Sur acceptation, met à jour l'estimation
    GES du fournisseur (consolidation dashboard) si apply_to_supplier."""
    new_status = "accepted" if payload.action == "accept" else "flagged"

    if _db_available():
        try:
            from db.database import get_db
            with get_db(company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE supplier_answers
                        SET review_status = %s, review_note = %s, reviewed_by = %s, reviewed_at = now()
                        WHERE id = %s AND company_id = %s AND review_status = 'pending'
                        RETURNING *
                        """,
                        (new_status, payload.note, reviewed_by, answer_id, company_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        return None
                    row = dict(row)
                    if new_status == "accepted" and payload.apply_to_supplier:
                        ghg = row.get("ghg_total_tco2e")
                        if ghg is None:
                            parts = [row.get(k) for k in ("ghg_scope1", "ghg_scope2", "ghg_scope3")]
                            declared = [float(p) for p in parts if p is not None]
                            ghg = sum(declared) if declared else None
                        if ghg is not None:
                            cur.execute(
                                "UPDATE suppliers SET ghg_estimate_tco2e = %s, updated_at = now() "
                                "WHERE id = %s AND company_id = %s",
                                (float(ghg), row["supplier_id"], company_id),
                            )
                    return {"id": row["id"], "review_status": new_status}
        except Exception as exc:
            logger.warning("review_answer DB error: %s", exc)
            return None

    from services.supplier_service import _DEMO_ANSWERS, _DEMO_SUPPLIERS
    for a in _DEMO_ANSWERS:
        if a["id"] == answer_id and a["company_id"] == company_id \
                and a.get("review_status", "pending") == "pending":
            a["review_status"] = new_status
            a["review_note"] = payload.note
            a["reviewed_by"] = reviewed_by
            a["reviewed_at"] = _now()
            if new_status == "accepted" and payload.apply_to_supplier:
                ghg = a.get("ghg_total_tco2e")
                if ghg is None:
                    declared = [a.get(k) for k in ("ghg_scope1", "ghg_scope2", "ghg_scope3")]
                    declared = [d for d in declared if d is not None]
                    ghg = sum(declared) if declared else None
                if ghg is not None:
                    for s in _DEMO_SUPPLIERS:
                        if s["id"] == a["supplier_id"] and s["company_id"] == company_id:
                            s["ghg_estimate_tco2e"] = float(ghg)
            return {"id": answer_id, "review_status": new_status}
    return None
