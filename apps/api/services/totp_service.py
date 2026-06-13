"""
totp_service.py — Double authentification TOTP (T1.4 du PLAN_ACTION_CARBONCO).

Secret TOTP chiffré au repos (Fernet, clé TOTP_ENCRYPTION_KEY), 8 codes de
récupération hashés (SHA-256), enrôlement en deux temps (enroll -> activate).

Stockage clé sur l'EMAIL (AuthUser n'expose pas d'id) : PostgreSQL (user_totp,
user_recovery_codes) ou /tmp JSON (CI/dev sans Neon).

⚠️ Production : définir TOTP_ENCRYPTION_KEY (Fernet, 32 octets base64). En son
absence, une clé éphémère est générée au chargement (dev/test uniquement) — les
secrets ne survivront pas à un redémarrage.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
from pathlib import Path
from typing import Any

import pyotp
from cryptography.fernet import Fernet, InvalidToken

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

ISSUER = "CarbonCo"
RECOVERY_CODE_COUNT = 8


def _fernet() -> Fernet:
    key = os.environ.get("TOTP_ENCRYPTION_KEY")
    if not key:
        global _EPHEMERAL_KEY
        if "_EPHEMERAL_KEY" not in globals():
            _EPHEMERAL_KEY = Fernet.generate_key().decode()
            logger.warning("TOTP_ENCRYPTION_KEY absent — clé éphémère (dev/test uniquement).")
        key = _EPHEMERAL_KEY
    return Fernet(key.encode() if isinstance(key, str) else key)


def _encrypt(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def _decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()


# --------------------------------------------------------------------------- #
# /tmp fallback                                                               #
# --------------------------------------------------------------------------- #

def _store_path() -> Path:
    cache_dir = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "user_totp.json"


def _load() -> dict[str, Any]:
    path = _store_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict[str, Any]) -> None:
    _store_path().write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Persistence helpers (DB ou /tmp)                                            #
# --------------------------------------------------------------------------- #

def _put_secret(email: str, company_id: int, secret_enc: str, enabled: bool) -> None:
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO user_totp (user_email, company_id, secret_encrypted, enabled_at)
                        VALUES (%s, %s, %s, CASE WHEN %s THEN now() ELSE NULL END)
                        ON CONFLICT (user_email) DO UPDATE
                          SET secret_encrypted = EXCLUDED.secret_encrypted,
                              enabled_at = CASE WHEN %s THEN now() ELSE user_totp.enabled_at END
                        """,
                        (email, company_id, secret_enc, enabled, enabled),
                    )
            return
        except Exception as exc:
            logger.warning("TOTP put_secret PG échoué, fallback /tmp : %s", exc)
    data = _load()
    rec = data.get(email, {})
    rec.update({"company_id": company_id, "secret": secret_enc})
    if enabled:
        rec["enabled"] = True
    data[email] = rec
    _save(data)


def _get_secret(email: str) -> tuple[str | None, bool]:
    """Retourne (secret_encrypted, enabled)."""
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT secret_encrypted, enabled_at FROM user_totp WHERE user_email = %s",
                        (email,),
                    )
                    row = cur.fetchone()
            if row:
                return row["secret_encrypted"], row["enabled_at"] is not None
            return None, False
        except Exception as exc:
            logger.warning("TOTP get_secret PG échoué, fallback /tmp : %s", exc)
    rec = _load().get(email)
    if not rec:
        return None, False
    return rec.get("secret"), bool(rec.get("enabled"))


def _store_recovery(email: str, codes: list[str], company_id: int) -> None:
    hashes = [_hash_code(c) for c in codes]
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM user_recovery_codes WHERE user_email = %s", (email,))
                    for h in hashes:
                        cur.execute(
                            "INSERT INTO user_recovery_codes (user_email, code_hash) VALUES (%s, %s)",
                            (email, h),
                        )
            return
        except Exception as exc:
            logger.warning("TOTP store_recovery PG échoué, fallback /tmp : %s", exc)
    data = _load()
    rec = data.setdefault(email, {})
    rec["recovery"] = [{"hash": h, "used": False} for h in hashes]
    _save(data)


def _consume_recovery(email: str, code: str) -> bool:
    h = _hash_code(code)
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE user_recovery_codes SET used_at = now() "
                        "WHERE user_email = %s AND code_hash = %s AND used_at IS NULL "
                        "RETURNING id",
                        (email, h),
                    )
                    return cur.fetchone() is not None
        except Exception as exc:
            logger.warning("TOTP consume_recovery PG échoué, fallback /tmp : %s", exc)
    data = _load()
    rec = data.get(email, {})
    for entry in rec.get("recovery", []):
        if entry["hash"] == h and not entry["used"]:
            entry["used"] = True
            _save(data)
            return True
    return False


# --------------------------------------------------------------------------- #
# Public API                                                                  #
# --------------------------------------------------------------------------- #

def is_enabled(email: str) -> bool:
    _, enabled = _get_secret(email)
    return enabled


def enroll(email: str, company_id: int) -> dict[str, str]:
    """Génère un secret (statut « pending ») et retourne l'URI de provisioning.

    Le QR est rendu côté front à partir de `otpauthUri`.
    """
    secret = pyotp.random_base32()
    _put_secret(email, company_id, _encrypt(secret), enabled=False)
    uri = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)
    return {"secret": secret, "otpauthUri": uri}


def activate(email: str, code: str, company_id: int) -> list[str]:
    """Vérifie le code du secret pending, active le TOTP et retourne 8 codes
    de récupération (en clair, affichés une seule fois)."""
    secret_enc, _ = _get_secret(email)
    secret = _decrypt(secret_enc) if secret_enc else None
    if not secret or not pyotp.TOTP(secret).verify(code, valid_window=1):
        raise ValueError("Code TOTP invalide")
    _put_secret(email, company_id, secret_enc, enabled=True)
    codes = [secrets.token_hex(5).upper() for _ in range(RECOVERY_CODE_COUNT)]
    _store_recovery(email, codes, company_id)
    return codes


def verify(email: str, code: str) -> bool:
    """Vérifie un code TOTP (fenêtre ±1) ou consomme un code de récupération."""
    secret_enc, enabled = _get_secret(email)
    if not enabled or not secret_enc:
        return False
    secret = _decrypt(secret_enc)
    if secret and pyotp.TOTP(secret).verify(code, valid_window=1):
        return True
    return _consume_recovery(email, code)


def disable(email: str, company_id: int) -> None:
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM user_recovery_codes WHERE user_email = %s", (email,))
                    cur.execute("DELETE FROM user_totp WHERE user_email = %s", (email,))
            return
        except Exception as exc:
            logger.warning("TOTP disable PG échoué, fallback /tmp : %s", exc)
    data = _load()
    data.pop(email, None)
    _save(data)
