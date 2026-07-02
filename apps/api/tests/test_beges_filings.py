"""
test_beges_filings.py — T7.2 : suivi des dépôts BEGES et rappels de renouvellement.

Couvre :
  - le cœur pur : compute_next_due (+4 ans, 29 février), target_stage (paliers),
    reminder_needed (progression anti-spam), schedule_from_filings (statuts)
  - l'API en mode /tmp : déclaration d'un dépôt (upsert), listing + statut,
    endpoint cron /beges/reminders/run (token de service vs anonyme) et
    persistance de la notification in-app.
"""

from __future__ import annotations

from datetime import date

import pytest

from services import beges_filings_service as svc


# ---------------------------------------------------------------------------
# Cœur pur
# ---------------------------------------------------------------------------

def test_compute_next_due_plus_4_ans():
    assert svc.compute_next_due(date(2025, 5, 10)) == date(2029, 5, 10)


def test_compute_next_due_29_fevrier():
    # 2024 bissextile + 4 = 2028 bissextile → 29/02 conservé
    assert svc.compute_next_due(date(2024, 2, 29)) == date(2028, 2, 29)
    # 2026 + 4 = 2030 non bissextile — un 29/02 source n'existe pas en 2026,
    # mais la garde doit tenir pour tout écart d'années
    assert svc.compute_next_due(date(2024, 2, 29), years=3) == date(2027, 2, 28)


@pytest.mark.parametrize(
    ("days", "expected"),
    [
        (365, ""),
        (181, ""),
        (180, "j180"),
        (31, "j180"),
        (30, "j30"),
        (1, "j30"),
        (0, "overdue"),
        (-45, "overdue"),
    ],
)
def test_target_stage_paliers(days: int, expected: str):
    assert svc.target_stage(days) == expected


def test_reminder_needed_progression_sans_spam():
    # Aucun rappel émis → J-180 déclenche
    assert svc.reminder_needed("", 150) == "j180"
    # Déjà notifié J-180 → pas de re-notification tant qu'on reste dans le palier
    assert svc.reminder_needed("j180", 120) is None
    # Passage sous J-30 → nouveau palier
    assert svc.reminder_needed("j180", 12) == "j30"
    # Échéance dépassée → dernier palier, une seule fois
    assert svc.reminder_needed("j30", -3) == "overdue"
    assert svc.reminder_needed("overdue", -30) is None
    # Cas d'un premier enregistrement déjà en retard : overdue direct
    assert svc.reminder_needed("", -10) == "overdue"


def test_schedule_from_filings_statuts():
    today = date(2026, 7, 2)
    assert svc.schedule_from_filings([], today).status == "aucun_bilan"

    def filing(year: int, filed: date) -> dict:
        return {
            "exercise_year": year,
            "filed_at": filed,
            "next_due_at": svc.compute_next_due(filed),
        }

    a_jour = svc.schedule_from_filings([filing(2024, date(2025, 6, 1))], today)
    assert a_jour.status == "a_jour"
    assert a_jour.next_due_at == date(2029, 6, 1)
    assert a_jour.days_until_due and a_jour.days_until_due > 180

    proche = svc.schedule_from_filings([filing(2021, date(2022, 9, 1))], today)
    assert proche.status == "echeance_proche"  # échéance 01/09/2026 → 61 jours

    retard = svc.schedule_from_filings([filing(2020, date(2021, 6, 1))], today)
    assert retard.status == "en_retard"

    # Plusieurs dépôts → c'est la MEILLEURE échéance (max next_due_at) qui compte
    multi = svc.schedule_from_filings(
        [filing(2020, date(2021, 6, 1)), filing(2024, date(2025, 6, 1))], today
    )
    assert multi.status == "a_jour"
    assert multi.last_exercise_year == 2024


# ---------------------------------------------------------------------------
# API (mode /tmp, in-memory)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_filings():
    svc._MEM_FILINGS.clear()
    svc._MEM_NEXT_ID["filing"] = 1
    yield
    svc._MEM_FILINGS.clear()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_record_and_list_filings(client, analyst_token):
    resp = client.post(
        "/beges/filings",
        json={"exercise_year": 2024, "filed_at": "2025-03-15", "ademe_ref": "DOS-2025-042"},
        headers=_auth(analyst_token),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["next_due_at"] == "2029-03-15"
    assert body["ademe_ref"] == "DOS-2025-042"

    # Upsert : re-déclarer le même exercice corrige la saisie sans doublon
    resp2 = client.post(
        "/beges/filings",
        json={"exercise_year": 2024, "filed_at": "2025-04-01"},
        headers=_auth(analyst_token),
    )
    assert resp2.status_code == 201
    assert resp2.json()["next_due_at"] == "2029-04-01"

    listing = client.get("/beges/filings", headers=_auth(analyst_token))
    assert listing.status_code == 200
    data = listing.json()
    assert len(data["filings"]) == 1
    assert data["status"] == "a_jour"
    assert data["last_exercise_year"] == 2024


def test_filings_requires_auth(client):
    resp = client.post(
        "/beges/filings", json={"exercise_year": 2024, "filed_at": "2025-03-15"}
    )
    assert resp.status_code == 401


def test_reminders_run_cron_token(client, analyst_token, monkeypatch):
    monkeypatch.setenv("CRON_SERVICE_TOKEN", "cron-secret-test")

    # Anonyme → refusé
    assert client.post("/beges/reminders/run").status_code == 401
    # Mauvais token → refusé
    assert (
        client.post(
            "/beges/reminders/run", headers=_auth("mauvais-token")
        ).status_code
        == 401
    )

    # Dépôt volontairement ancien : échéance dépassée depuis longtemps
    resp = client.post(
        "/beges/filings",
        json={"exercise_year": 2019, "filed_at": "2020-01-10"},
        headers=_auth(analyst_token),
    )
    assert resp.status_code == 201

    run = client.post("/beges/reminders/run", headers=_auth("cron-secret-test"))
    assert run.status_code == 200, run.text
    body = run.json()
    assert body["checked"] >= 1
    assert body["notified"] == 1
    assert body["reminders"][0]["stage"] == "overdue"

    # Anti-spam : un second run ne renvoie pas le même palier
    run2 = client.post("/beges/reminders/run", headers=_auth("cron-secret-test"))
    assert run2.status_code == 200
    assert run2.json()["notified"] == 0

    # La notification in-app est visible dans le centre de notifications
    notifs = client.get("/alerts/notifications", headers=_auth(analyst_token))
    assert notifs.status_code == 200
    titles = [n["title"] for n in notifs.json()["notifications"]]
    assert any("BEGES" in t for t in titles)


def test_reminders_run_analyst_jwt(client, analyst_token, monkeypatch):
    monkeypatch.delenv("CRON_SERVICE_TOKEN", raising=False)
    run = client.post("/beges/reminders/run", headers=_auth(analyst_token))
    assert run.status_code == 200
    assert run.json()["notified"] == 0  # aucun dépôt enregistré dans ce test
