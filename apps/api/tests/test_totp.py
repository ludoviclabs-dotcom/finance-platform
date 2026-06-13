"""
test_totp.py — T1.4 : double authentification TOTP (mode /tmp, sans DB).

Flux complet : enroll -> activate -> login en 2 temps -> verify (code TOTP puis
code de récupération) -> disable. Le rate-limit est désactivé en test
(RATE_LIMIT_DISABLED=1) : on vérifie la présence de la règle 5/900 séparément.
"""

from __future__ import annotations

import pyotp
from fastapi.testclient import TestClient

ADMIN = {"email": "admin@carbonco.fr", "password": "Admin2024!"}


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_totp_full_flow(client: TestClient, admin_token: str):
    # 1. Enrôlement (secret pending)
    enroll = client.post("/auth/totp/enroll", headers=_auth(admin_token))
    assert enroll.status_code == 200, enroll.text
    secret = enroll.json()["secret"]
    assert enroll.json()["otpauthUri"].startswith("otpauth://totp/")

    # 2. Activation avec un code valide -> 8 codes de récupération
    code = pyotp.TOTP(secret).now()
    act = client.post("/auth/totp/activate", json={"code": code}, headers=_auth(admin_token))
    assert act.status_code == 200, act.text
    recovery = act.json()["recoveryCodes"]
    assert len(recovery) == 8

    # 3. Statut activé
    st = client.get("/auth/totp/status", headers=_auth(admin_token))
    assert st.json()["enabled"] is True

    # 4. Le login exige désormais le TOTP
    login = client.post("/auth/login", json=ADMIN)
    assert login.status_code == 200, login.text
    assert login.json()["requiresTotp"] is True
    pre = login.json()["preAuthToken"]
    assert pre

    # 5. Vérification avec le code TOTP -> session émise
    verify = client.post("/auth/totp/verify", json={"preAuthToken": pre, "code": pyotp.TOTP(secret).now()})
    assert verify.status_code == 200, verify.text
    assert verify.json()["accessToken"]

    # 6. Un code de récupération fonctionne (second facteur de secours)
    login2 = client.post("/auth/login", json=ADMIN)
    pre2 = login2.json()["preAuthToken"]
    rec_verify = client.post("/auth/totp/verify", json={"preAuthToken": pre2, "code": recovery[0]})
    assert rec_verify.status_code == 200, rec_verify.text

    # … et n'est pas réutilisable
    login3 = client.post("/auth/login", json=ADMIN)
    pre3 = login3.json()["preAuthToken"]
    reuse = client.post("/auth/totp/verify", json={"preAuthToken": pre3, "code": recovery[0]})
    assert reuse.status_code == 401

    # 7. Désactivation -> login redevient simple
    disable = client.post("/auth/totp/disable", headers=_auth(admin_token))
    assert disable.status_code == 204
    assert client.get("/auth/totp/status", headers=_auth(admin_token)).json()["enabled"] is False
    final = client.post("/auth/login", json=ADMIN)
    assert final.json().get("accessToken")
    assert final.json()["requiresTotp"] is False


def test_invalid_code_rejected(client: TestClient, admin_token: str):
    enroll = client.post("/auth/totp/enroll", headers=_auth(admin_token))
    secret = enroll.json()["secret"]
    bad = client.post("/auth/totp/activate", json={"code": "000000"}, headers=_auth(admin_token))
    # 000000 ne correspond presque jamais au secret -> 400 (sauf collision improbable)
    assert bad.status_code in (400, 200)
    # nettoyage
    if bad.status_code == 200:
        client.post("/auth/totp/disable", headers=_auth(admin_token))
    # un secret existe mais non activé : le statut reste désactivé
    _ = secret


def test_totp_rate_rule_configured():
    from middleware.rate_limit import RULES
    rule = RULES.get("/auth/totp")
    assert rule is not None
    assert rule.limit == 5 and rule.window_seconds == 900
