"""
test_totp.py — T1.4 : double authentification TOTP (mode /tmp, sans DB).

Flux complet : enroll -> activate -> login en 2 temps -> verify (code TOTP puis
code de récupération) -> disable. Le rate-limit est désactivé en test
(RATE_LIMIT_DISABLED=1) : on vérifie la présence de la règle 5/900 séparément.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pyotp
import pytest
from fastapi.testclient import TestClient

from services import totp_service

ADMIN = {"email": "admin@carbonco.fr", "password": "Admin2024!"}
FROZEN = datetime(2026, 9, 16, 12, 0, 15, tzinfo=timezone.utc)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class _FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        return FROZEN if tz else FROZEN.replace(tzinfo=None)


@pytest.fixture()
def frozen_clock(monkeypatch):
    """Horloge serveur figée : chaque étape du flux utilise un pas RFC 6238
    distinct (t-30 s, t, t+30 s), tous dans la fenêtre de tolérance ±1."""
    monkeypatch.setattr(totp_service, "datetime", _FrozenDatetime)


def _code(totp: pyotp.TOTP, offset_steps: int) -> str:
    return totp.at(FROZEN + timedelta(seconds=30 * offset_steps))


def test_totp_full_flow(client: TestClient, admin_token: str, frozen_clock):
    # 1. Enrôlement (secret pending)
    enroll = client.post("/auth/totp/enroll", headers=_auth(admin_token))
    assert enroll.status_code == 200, enroll.text
    totp = pyotp.TOTP(enroll.json()["secret"])
    assert enroll.json()["otpauthUri"].startswith("otpauth://totp/")

    # 2. Activation avec un code valide -> 8 codes de récupération
    act = client.post("/auth/totp/activate", json={"code": _code(totp, 0)}, headers=_auth(admin_token))
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

    # 5. Anti-rejeu (RFC 6238 §5.2) : le code déjà accepté à l'activation est refusé…
    replay = client.post("/auth/totp/verify", json={"preAuthToken": pre, "code": _code(totp, 0)})
    assert replay.status_code == 401
    # … un code d'un autre pas de la fenêtre ouvre la session
    verify = client.post("/auth/totp/verify", json={"preAuthToken": pre, "code": _code(totp, 1)})
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

    # 7. Le jeton pré-auth n'ouvre JAMAIS l'API (B-02)
    assert client.get("/auth/me", headers=_auth(pre3)).status_code == 401

    # 8. Désactivation : un jeton d'accès seul ne suffit pas (M-13)
    assert client.post("/auth/totp/disable", headers=_auth(admin_token)).status_code == 422
    valid = {_code(totp, k) for k in (-1, 0, 1)}
    wrong = next(c for c in ("000000", "111111", "222222", "333333") if c not in valid)
    bad = client.post("/auth/totp/disable", json={"code": wrong}, headers=_auth(admin_token))
    assert bad.status_code == 401
    disable = client.post("/auth/totp/disable", json={"code": _code(totp, -1)}, headers=_auth(admin_token))
    assert disable.status_code == 204
    assert client.get("/auth/totp/status", headers=_auth(admin_token)).json()["enabled"] is False
    final = client.post("/auth/login", json=ADMIN)
    assert final.json().get("accessToken")
    assert final.json()["requiresTotp"] is False

    # 9. Plus rien à désactiver
    again = client.post("/auth/totp/disable", json={"code": _code(totp, 1)}, headers=_auth(admin_token))
    assert again.status_code == 409


def test_invalid_code_rejected(client: TestClient, admin_token: str, frozen_clock):
    enroll = client.post("/auth/totp/enroll", headers=_auth(admin_token))
    totp = pyotp.TOTP(enroll.json()["secret"])
    valid = {_code(totp, k) for k in (-1, 0, 1)}
    wrong = next(c for c in ("000000", "111111", "222222", "333333") if c not in valid)
    bad = client.post("/auth/totp/activate", json={"code": wrong}, headers=_auth(admin_token))
    assert bad.status_code == 400
    # un secret existe mais non activé : le statut reste désactivé
    assert client.get("/auth/totp/status", headers=_auth(admin_token)).json()["enabled"] is False


def test_totp_rate_rule_configured():
    from middleware.rate_limit import RULES
    rule = RULES.get("/auth/totp")
    assert rule is not None
    assert rule.limit == 5 and rule.window_seconds == 900
