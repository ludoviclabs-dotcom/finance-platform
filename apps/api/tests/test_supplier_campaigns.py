"""
test_supplier_campaigns.py — T7.3 : campagnes de collecte fournisseurs.

Couvre :
  - le cœur pur : parse_suppliers_csv (séparateurs, en-têtes fr/en, nombres à
    virgule, lignes invalides), detect_anomalies, paliers de relance J-14/J-7/deadline
  - le flux API complet en mode /tmp : création de campagne, import CSV,
    invitations tokenisées, consultation publique (viewed), soumission,
    revue accept/flag (mise à jour de l'estimation GES), relances cron.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from services import supplier_campaigns_service as svc
from services import supplier_service


# ---------------------------------------------------------------------------
# Cœur pur — CSV
# ---------------------------------------------------------------------------

def test_parse_csv_virgule_et_entetes_fr():
    text = (
        "nom,email,pays,secteur,dépenses,ges\n"
        "Aciers Réunis,contact@aciers.fr,France,Industrie,\"120000\",450\n"
        "Translog,ops@translog.be,Belgique,Transport,80000,\n"
    )
    rows, issues = svc.parse_suppliers_csv(text)
    assert issues == []
    assert len(rows) == 2
    assert rows[0]["name"] == "Aciers Réunis"
    assert rows[0]["contact_email"] == "contact@aciers.fr"
    assert rows[0]["spend_eur"] == 120000.0
    assert rows[0]["ghg_estimate_tco2e"] == 450.0
    assert "ghg_estimate_tco2e" not in rows[1]  # champ vide non inventé


def test_parse_csv_point_virgule_et_decimale_virgule():
    text = "name;spend_eur\nFournisseur A;12 500,50\n"
    rows, issues = svc.parse_suppliers_csv(text)
    assert issues == []
    assert rows[0]["spend_eur"] == 12500.5


def test_parse_csv_colonne_nom_absente():
    rows, issues = svc.parse_suppliers_csv("email,pays\na@b.fr,France\n")
    assert rows == []
    assert any("name/nom" in i for i in issues)


def test_parse_csv_lignes_invalides_signalees():
    text = "nom,ges\n,12\nBon Fournisseur,abc\n"
    rows, issues = svc.parse_suppliers_csv(text)
    # ligne 2 : nom manquant → ignorée ; ligne 3 : ges invalide → champ ignoré, ligne gardée
    assert len(rows) == 1
    assert rows[0]["name"] == "Bon Fournisseur"
    assert len(issues) == 2


# ---------------------------------------------------------------------------
# Cœur pur — anomalies
# ---------------------------------------------------------------------------

def test_detect_anomalies_total_incoherent():
    anomalies = svc.detect_anomalies(
        {"ghg_total_tco2e": 100.0, "ghg_scope1": 10.0, "ghg_scope2": 10.0,
         "ghg_scope3": 10.0, "methodology": "GHG Protocol", "reporting_year": 2025},
        current_year=2026,
    )
    assert any("incohérent" in a for a in anomalies)


def test_detect_anomalies_ok():
    anomalies = svc.detect_anomalies(
        {"ghg_total_tco2e": 30.0, "ghg_scope1": 10.0, "ghg_scope2": 10.0,
         "ghg_scope3": 10.0, "methodology": "GHG Protocol", "reporting_year": 2025},
        current_year=2026,
    )
    assert anomalies == []


def test_detect_anomalies_methodologie_et_annee():
    anomalies = svc.detect_anomalies(
        {"ghg_total_tco2e": 50.0, "reporting_year": 2009}, current_year=2026
    )
    assert any("méthodologie" in a for a in anomalies)
    assert any("2009" in a for a in anomalies)


def test_detect_anomalies_reponse_vide():
    anomalies = svc.detect_anomalies({"narrative": "Nous n'avons pas encore de bilan."})
    assert any("sans aucune valeur" in a for a in anomalies)


# ---------------------------------------------------------------------------
# Cœur pur — paliers de relance
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("days", "expected"),
    [(30, ""), (15, ""), (14, "j14"), (8, "j14"), (7, "j7"), (1, "j7"), (0, "deadline"), (-2, "deadline")],
)
def test_target_campaign_stage(days: int, expected: str):
    assert svc.target_campaign_stage(days) == expected


def test_campaign_reminder_progression():
    assert svc.campaign_reminder_needed("", 10) == "j14"
    assert svc.campaign_reminder_needed("j14", 9) is None
    assert svc.campaign_reminder_needed("j14", 5) == "j7"
    assert svc.campaign_reminder_needed("j7", 0) == "deadline"
    assert svc.campaign_reminder_needed("deadline", -10) is None


# ---------------------------------------------------------------------------
# API (mode /tmp)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_campaign_state():
    """Isole chaque test : campagnes, tokens/réponses démo, fournisseurs importés."""
    base_suppliers = len(supplier_service._DEMO_SUPPLIERS)
    svc._MEM_CAMPAIGNS.clear()
    svc._MEM_NEXT_ID["campaign"] = 1
    supplier_service._DEMO_TOKENS.clear()
    supplier_service._DEMO_ANSWERS.clear()
    yield
    svc._MEM_CAMPAIGNS.clear()
    svc._MEM_NEXT_ID["campaign"] = 1
    supplier_service._DEMO_TOKENS.clear()
    supplier_service._DEMO_ANSWERS.clear()
    del supplier_service._DEMO_SUPPLIERS[base_suppliers:]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_flux_campagne_complet(client, analyst_token):
    # 1. Import CSV → nouveaux fournisseurs (noms inconnus du jeu démo)
    csv_text = (
        "nom,email,catégorie\n"
        "Test Campagne Alpha,alpha@test.fr,C1 Biens achetés\n"
        "Test Campagne Beta,beta@test.fr,C4 Transport amont\n"
        "Acier Durable SAS,doublon@test.fr,C1 Biens achetés\n"  # déjà en démo → skip
    )
    imp = client.post("/suppliers/import-csv", json={"csv_text": csv_text}, headers=_auth(analyst_token))
    assert imp.status_code == 200, imp.text
    assert imp.json()["created"] == 2
    assert imp.json()["skipped"] == 1

    # Récupère les ids des fournisseurs importés
    suppliers = client.get("/suppliers?limit=200", headers=_auth(analyst_token)).json()
    ids = [s["id"] for s in suppliers if s["name"].startswith("Test Campagne")]
    assert len(ids) == 2

    # 2. Création de campagne avec deadline
    deadline = (date.today() + timedelta(days=45)).isoformat()
    camp = client.post(
        "/suppliers/campaigns",
        json={"name": "Collecte 2026", "exercise_year": 2026, "deadline": deadline},
        headers=_auth(analyst_token),
    )
    assert camp.status_code == 201, camp.text
    campaign_id = camp.json()["id"]

    # 3. Invitations (dédupliquées au second appel)
    inv = client.post(
        f"/suppliers/campaigns/{campaign_id}/invites",
        json={"supplier_ids": ids},
        headers=_auth(analyst_token),
    )
    assert inv.status_code == 200, inv.text
    invites = inv.json()
    assert len(invites) == 2
    assert all(i["status"] == "pending" for i in invites)

    inv2 = client.post(
        f"/suppliers/campaigns/{campaign_id}/invites",
        json={"supplier_ids": ids},
        headers=_auth(analyst_token),
    )
    assert len(inv2.json()) == 2  # pas de doublon

    # 4. Consultation publique → statut « viewed »
    token = invites[0]["url"].rsplit("/q/", 1)[1]
    pub = client.get(f"/suppliers/public/q/{token}")
    assert pub.status_code == 200
    detail = client.get(f"/suppliers/campaigns/{campaign_id}", headers=_auth(analyst_token)).json()
    statuses = {i["supplier_id"]: i["status"] for i in detail["invites"]}
    assert statuses[invites[0]["supplier_id"]] == "viewed"

    # 5. Soumission publique (avec incohérence volontaire total ≠ somme scopes)
    answer = client.post(
        f"/suppliers/public/q/{token}",
        json={"ghg_total_tco2e": 100.0, "ghg_scope1": 5.0, "ghg_scope2": 5.0,
              "ghg_scope3": 5.0, "methodology": "GHG Protocol", "reporting_year": 2025},
    )
    assert answer.status_code == 201, answer.text
    answer_id = answer.json()["id"]

    # Le suivi passe en « completed » et les stats suivent
    listing = client.get("/suppliers/campaigns", headers=_auth(analyst_token)).json()
    stats = next(c for c in listing if c["id"] == campaign_id)["stats"]
    assert stats["invited"] == 2
    assert stats["completed"] == 1
    assert stats["response_rate"] == 0.5

    # 6. Revue : la réponse est en attente avec l'anomalie détectée
    pending = client.get("/suppliers/answers/pending", headers=_auth(analyst_token)).json()
    assert len(pending) == 1
    assert pending[0]["id"] == answer_id
    assert any("incohérent" in a for a in pending[0]["anomalies"])

    # 7. Acceptation → l'estimation GES du fournisseur est mise à jour
    review = client.post(
        f"/suppliers/answers/{answer_id}/review",
        json={"action": "accept", "apply_to_supplier": True},
        headers=_auth(analyst_token),
    )
    assert review.status_code == 200
    assert review.json()["review_status"] == "accepted"

    supplier = client.get(f"/suppliers/{invites[0]['supplier_id']}", headers=_auth(analyst_token)).json()
    assert supplier["ghg_estimate_tco2e"] == 100.0

    # Plus rien en attente ; une re-revue est refusée
    assert client.get("/suppliers/answers/pending", headers=_auth(analyst_token)).json() == []
    re_review = client.post(
        f"/suppliers/answers/{answer_id}/review",
        json={"action": "flag"},
        headers=_auth(analyst_token),
    )
    assert re_review.status_code == 404

    # 8. Clôture
    assert client.post(
        f"/suppliers/campaigns/{campaign_id}/close", headers=_auth(analyst_token)
    ).status_code == 204


def test_relances_cron_paliers(client, analyst_token, monkeypatch):
    monkeypatch.setenv("CRON_SERVICE_TOKEN", "cron-secret-test")

    # Campagne à J-5 (palier j7) avec un fournisseur invité sans réponse
    deadline = (date.today() + timedelta(days=5)).isoformat()
    camp = client.post(
        "/suppliers/campaigns",
        json={"name": "Relance test", "deadline": deadline},
        headers=_auth(analyst_token),
    )
    campaign_id = camp.json()["id"]
    client.post(
        f"/suppliers/campaigns/{campaign_id}/invites",
        json={"supplier_ids": [1]},
        headers=_auth(analyst_token),
    )

    # Anonyme refusé
    assert client.post("/suppliers/campaigns/reminders/run").status_code == 401

    run = client.post("/suppliers/campaigns/reminders/run", headers=_auth("cron-secret-test"))
    assert run.status_code == 200, run.text
    body = run.json()
    assert body["notified"] == 1
    assert body["reminders"][0]["stage"] == "j7"
    assert body["reminders"][0]["pending"] == 1
    assert body["reminders"][0]["emails_sent"] == 0  # EMAIL_ENABLED absent

    # Anti-spam : pas de re-notification au même palier
    run2 = client.post("/suppliers/campaigns/reminders/run", headers=_auth("cron-secret-test"))
    assert run2.json()["notified"] == 0

    # Notification in-app visible
    notifs = client.get("/alerts/notifications", headers=_auth(analyst_token)).json()
    assert any("Relance test" in n["title"] for n in notifs["notifications"])


def test_campagne_invites_sur_campagne_cloturee(client, analyst_token):
    camp = client.post(
        "/suppliers/campaigns", json={"name": "Éphémère"}, headers=_auth(analyst_token)
    )
    campaign_id = camp.json()["id"]
    client.post(f"/suppliers/campaigns/{campaign_id}/close", headers=_auth(analyst_token))
    inv = client.post(
        f"/suppliers/campaigns/{campaign_id}/invites",
        json={"supplier_ids": [1]},
        headers=_auth(analyst_token),
    )
    assert inv.status_code == 404
