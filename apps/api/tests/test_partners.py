"""
test_partners.py — T7.5 : candidatures partenaires experts-comptables.

Couvre : dépôt public (validation e-mail/SIRET, honeypot anti-bot), pipeline
admin (listing + changement de statut), protection des endpoints admin.
"""

from __future__ import annotations

import pytest

from routers import partners


@pytest.fixture(autouse=True)
def _reset_applications():
    partners._MEM_APPLICATIONS.clear()
    partners._MEM_NEXT_ID["application"] = 1
    yield
    partners._MEM_APPLICATIONS.clear()
    partners._MEM_NEXT_ID["application"] = 1


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_apply_public_ok(client):
    resp = client.post(
        "/partners/apply",
        json={
            "cabinet_name": "Cabinet Fiduciaire du Parc",
            "email": "Contact@Cabinet-Parc.FR",
            "contact_name": "M. Test",
            "siret": "123 456 789 00012",
            "clients_estimate": "5 à 20 dossiers",
            "message": "Plusieurs clients industriels assujettis BEGES.",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["ok"] is True
    # e-mail normalisé + SIRET nettoyé
    assert partners._MEM_APPLICATIONS[0]["email"] == "contact@cabinet-parc.fr"
    assert partners._MEM_APPLICATIONS[0]["siret"] == "12345678900012"


def test_apply_validation(client):
    assert client.post(
        "/partners/apply", json={"cabinet_name": "X", "email": "pas-un-email"}
    ).status_code == 422
    assert client.post(
        "/partners/apply",
        json={"cabinet_name": "Cabinet OK", "email": "a@b.fr", "siret": "123"},
    ).status_code == 422


def test_apply_honeypot_silencieux(client):
    resp = client.post(
        "/partners/apply",
        json={"cabinet_name": "Bot Corp", "email": "bot@spam.io", "website": "http://spam"},
    )
    # 201 pour ne pas signaler le rejet au bot — mais rien n'est persisté
    assert resp.status_code == 201
    assert partners._MEM_APPLICATIONS == []


def test_pipeline_admin(client, admin_token, analyst_token):
    client.post(
        "/partners/apply",
        json={"cabinet_name": "Cabinet Pipeline", "email": "pipe@line.fr"},
    )

    # Analyst → interdit ; anonyme → 401
    assert client.get("/partners/applications").status_code == 401
    assert client.get("/partners/applications", headers=_auth(analyst_token)).status_code == 403

    listing = client.get("/partners/applications", headers=_auth(admin_token))
    assert listing.status_code == 200
    apps = listing.json()
    assert len(apps) == 1
    assert apps[0]["cabinet_name"] == "Cabinet Pipeline"
    assert apps[0]["status"] == "new"

    patched = client.patch(
        f"/partners/applications/{apps[0]['id']}",
        json={"status": "contacted"},
        headers=_auth(admin_token),
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "contacted"

    assert client.patch(
        f"/partners/applications/{apps[0]['id']}",
        json={"status": "inexistant"},
        headers=_auth(admin_token),
    ).status_code == 422

    assert client.patch(
        "/partners/applications/999",
        json={"status": "contacted"},
        headers=_auth(admin_token),
    ).status_code == 404
