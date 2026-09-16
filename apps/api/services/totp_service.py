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
import hmac
import json
import logging
import os
import secrets
from datetime import datetime, timezone
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
# Base configurée → PostgreSQL UNIQUEMENT : une erreur remonte (fail-closed).
# L'ancien repli silencieux vers /tmp faisait, sur une erreur transitoire,
# lire « 2FA non activée » (connexion sans second facteur) ou « enregistrer »
# un enrôlement dans un fichier éphémère de l'instance serverless.
# Le mode /tmp reste réservé au développement et à la CI sans base.

def _put_secret(email: str, company_id: int, secret_enc: str, enabled: bool) -> None:
    if db_available():
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
    rec = _load().get(email)
    if not rec:
        return None, False
    return rec.get("secret"), bool(rec.get("enabled"))


def _store_recovery(email: str, codes: list[str], company_id: int) -> None:
    hashes = [_hash_code(c) for c in codes]
    if db_available():
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_recovery_codes WHERE user_email = %s", (email,))
                for h in hashes:
                    cur.execute(
                        "INSERT INTO user_recovery_codes (user_email, code_hash) VALUES (%s, %s)",
                        (email, h),
                    )
        return
    data = _load()
    rec = data.setdefault(email, {})
    rec["recovery"] = [{"hash": h, "used": False} for h in hashes]
    _save(data)


def _consume_recovery(email: str, code: str) -> bool:
    h = _hash_code(code)
    if db_available():
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE user_recovery_codes SET used_at = now() "
                    "WHERE user_email = %s AND code_hash = %s AND used_at IS NULL "
                    "RETURNING id",
                    (email, h),
                )
                return cur.fetchone() is not None
    data = _load()
    rec = data.get(email, {})
    for entry in rec.get("recovery", []):
        if hmac.compare_digest(entry["hash"], h) and not entry["used"]:
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


# --------------------------------------------------------------------------- #
# Anti-rejeu (RFC 6238 §5.2 : un code accepté ne doit pas l'être une 2e fois)  #
# --------------------------------------------------------------------------- #

# Fenêtre de tolérance ±1 pas (30 s) : décalage d'horloge du téléphone.
VALID_WINDOW = 1
_USED_STEPS_KEEP = 8
_used_steps_table_missing_logged = False


def _matching_step(secret: str, code: str) -> int | None:
    """Pas de temps (compteur RFC 6238) auquel `code` correspond, ou None."""
    totp = pyotp.TOTP(secret)
    base = totp.timecode(datetime.now(timezone.utc))
    candidate = (code or "").strip()
    for offset in range(-VALID_WINDOW, VALID_WINDOW + 1):
        if hmac.compare_digest(totp.generate_otp(base + offset), candidate):
            return base + offset
    return None


def _claim_step(email: str, step: int) -> bool:
    """Réserve (email, pas) de façon atomique. False si déjà consommé.

    PostgreSQL : clé primaire (user_email, time_step) de user_totp_used_steps
    (migration 044) — deux requêtes concurrentes avec le même code ne peuvent
    pas réussir toutes les deux. Tant que 044 n'est pas appliquée, la
    protection est absente (comportement antérieur) et on le journalise.
    """
    global _used_steps_table_missing_logged
    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO user_totp_used_steps (user_email, time_step) "
                        "VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING time_step",
                        (email, step),
                    )
                    claimed = cur.fetchone() is not None
                    # Purge opportuniste : au-delà de la fenêtre, un pas ne
                    # peut plus être rejoué (le code n'est plus accepté).
                    cur.execute(
                        "DELETE FROM user_totp_used_steps "
                        "WHERE user_email = %s AND time_step < %s",
                        (email, step - 2 * VALID_WINDOW - 1),
                    )
            return claimed
        except Exception as exc:
            if getattr(exc, "pgcode", None) == "42P01":  # undefined_table
                if not _used_steps_table_missing_logged:
                    logger.warning(
                        "Anti-rejeu TOTP inactif : table user_totp_used_steps absente "
                        "(migration 044 non appliquée)."
                    )
                    _used_steps_table_missing_logged = True
                return True
            logger.warning("TOTP claim_step PG échoué, fallback /tmp : %s", exc)
    data = _load()
    rec = data.setdefault(email, {})
    used = [int(s) for s in rec.get("used_steps", [])]
    if step in used:
        return False
    rec["used_steps"] = sorted(used + [step])[-_USED_STEPS_KEEP:]
    _save(data)
    return True


def _verify_totp_code(email: str, secret: str, code: str) -> bool:
    step = _matching_step(secret, code)
    return step is not None and _claim_step(email, step)


def activate(email: str, code: str, company_id: int) -> list[str]:
    """Vérifie le code du secret pending, active le TOTP et retourne 8 codes
    de récupération (en clair, affichés une seule fois)."""
    secret_enc, _ = _get_secret(email)
    secret = _decrypt(secret_enc) if secret_enc else None
    if not secret or not _verify_totp_code(email, secret, code):
        raise ValueError("Code TOTP invalide")
    _put_secret(email, company_id, secret_enc, enabled=True)
    codes = [secrets.token_hex(5).upper() for _ in range(RECOVERY_CODE_COUNT)]
    _store_recovery(email, codes, company_id)
    return codes


def verify(email: str, code: str) -> bool:
    """Vérifie un code TOTP (fenêtre ±1, usage unique) ou consomme un code de
    récupération."""
    secret_enc, enabled = _get_secret(email)
    if not enabled or not secret_enc:
        return False
    secret = _decrypt(secret_enc)
    if secret and _verify_totp_code(email, secret, code):
        return True
    return _consume_recovery(email, code)


def disable(email: str, company_id: int) -> None:
    if db_available():
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_recovery_codes WHERE user_email = %s", (email,))
                cur.execute("DELETE FROM user_totp WHERE user_email = %s", (email,))
        return
    data = _load()
    data.pop(email, None)
    _save(data)
