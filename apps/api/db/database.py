"""
database.py — Connexion PostgreSQL via psycopg2 (synchrone, léger pour FastAPI).

Stratégie :
  - Si DATABASE_URL est définie → PostgreSQL (Neon ou autre)
  - Sinon → mode dégradé : les services utilisent le fallback /tmp JSON

Usage :
    from db.database import get_db, db_available

    if db_available():
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ...")
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

try:
    import psycopg2
    import psycopg2.extras
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False

DATABASE_URL: str | None = os.environ.get("DATABASE_URL")


def db_available() -> bool:
    """Return True if PostgreSQL is configured and psycopg2 is installed."""
    return bool(DATABASE_URL and _PSYCOPG2_AVAILABLE)


def _get_connection():  # type: ignore[return]
    if not db_available():
        raise RuntimeError("PostgreSQL non configuré (DATABASE_URL manquant ou psycopg2 absent)")
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    return conn


@contextmanager
def get_db() -> Generator:
    """Context manager — yields a psycopg2 connection, commits on exit, rolls back on error."""
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
